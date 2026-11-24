import {
  Card,
  CardGroup,
  DealResult,
  DeclarationInfo,
  DeclarationResultPayload,
  GameVariant,
  PlayerPublicInfo,
  PlayerStatus,
  PublicGameState,
  ScoreItem,
  TableConfig,
  TableStatus,
  RevealedPlayerHand,
} from '@rummy/shared-types';
import { DeckManager } from './DeckManager';
import { DeclarationValidator } from './DeclarationValidator';
import { DropClassification, DropManager } from './DropManager';
import { HandManager } from './HandManager';
import { JokerManager } from './JokerManager';
import { ScoringEngine } from './ScoringEngine';
import { ShuffleManager } from './ShuffleManager';

export interface InternalPlayerState {
  playerId: string;
  username: string;
  avatarUrl: string;
  seatIndex: number;
  hand: Card[];
  groups: CardGroup[];
  status: PlayerStatus;
  turnsPlayed: number;
  hasDrawnInCurrentTurn: boolean;
  consecutiveTimeouts: number;
  dealScore: number;
  totalPoolScore: number;
  hasDropped: boolean;
  dropType?: DropClassification;
  hasSubmittedHand?: boolean;
}

export class PointsRummyEngine {
  public tableId: string;
  public dealNumber: number;
  public variant: GameVariant;
  public config: TableConfig;
  public tableStatus: TableStatus;
  public activePlayerSeat: number | null;
  public turnPhase: 'DRAW' | 'DISCARD' | 'DECLARATION' | 'ENDED';
  public turnExpiresAt: number | null;

  public closedDeck: Card[];
  public openDiscardPile: Card[];
  public wildJokerCard: Card | null;

  public players: InternalPlayerState[];
  public revision: number;
  public turnHistoryCount: number;

  public completedDealResult: DealResult | null;
  public nextRoundStartsAt: number | null = null;
  public lastDrawnEvent: {
    playerId: string;
    source: 'CLOSED_DECK' | 'OPEN_DISCARD';
    timestamp: number;
  } | null = null;

  public declarationInfo: DeclarationInfo | null = null;
  public winnerPlayerId: string | null = null;

  constructor(
    config: TableConfig,
    initialPlayers: { playerId: string; username: string; avatarUrl?: string; seatIndex: number }[],
    dealNumber: number = 1
  ) {
    this.tableId = config.tableId;
    this.dealNumber = dealNumber;
    this.variant = config.variant;
    this.config = config;
    this.tableStatus = 'WAITING_FOR_PLAYERS';
    this.activePlayerSeat = null;
    this.turnPhase = 'DRAW';
    this.turnExpiresAt = null;

    this.closedDeck = [];
    this.openDiscardPile = [];
    this.wildJokerCard = null;
    this.revision = 1;
    this.turnHistoryCount = 0;
    this.completedDealResult = null;

    this.players = initialPlayers.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      avatarUrl: p.avatarUrl || '/avatars/default.png',
      seatIndex: p.seatIndex,
      hand: [],
      groups: [],
      status: 'WAITING',
      turnsPlayed: 0,
      hasDrawnInCurrentTurn: false,
      consecutiveTimeouts: 0,
      dealScore: 0,
      totalPoolScore: 0,
      hasDropped: false,
    }));
  }

  /**
   * Initializes and deals cards to all players to begin the deal.
   */
  public startDeal(startingSeatIndex: number = 0): void {
    if (this.players.length < 2) {
      throw new Error('Cannot start deal with fewer than 2 players');
    }

    // 1. Create full deck
    const deckMgr = new DeckManager(
      this.config.deckCount || 2,
      this.config.printedJokersPerDeck || 2
    );
    const rawDeck = deckMgr.createDeck();

    // 2. Cryptographically secure shuffle
    const { shuffled } = ShuffleManager.shuffle(rawDeck);
    this.closedDeck = shuffled;

    // 3. Deal 13 cards to each player
    for (const player of this.players) {
      player.hand = [];
      player.status = 'ACTIVE';
      player.turnsPlayed = 0;
      player.hasDrawnInCurrentTurn = false;
      player.consecutiveTimeouts = 0;
      player.hasDropped = false;
      delete player.dropType;

      for (let i = 0; i < 13; i++) {
        const card = this.closedDeck.pop();
        if (!card) throw new Error('Deck unexpectedly empty during deal');
        player.hand.push(card);
      }
      // Initial suit sorting for clean UI presentation
      player.hand = HandManager.sortBySuitAndRank(player.hand);
      player.groups = HandManager.autoGroupCards(player.hand, null);
    }

    // 4. Cut wild joker card from top of closed deck
    const cutCard = this.closedDeck.pop();
    if (!cutCard) throw new Error('No card available to cut as wild joker');
    this.wildJokerCard = cutCard;

    // Refresh player auto-groups with wild joker known
    for (const player of this.players) {
      player.groups = HandManager.autoGroupCards(player.hand, this.wildJokerCard);
    }

    // 5. Open 1st discard card
    const firstDiscard = this.closedDeck.pop();
    if (!firstDiscard) throw new Error('No card available for first discard');
    this.openDiscardPile = [firstDiscard];

    // 6. Set starting turn
    this.tableStatus = 'IN_PROGRESS';
    this.activePlayerSeat = startingSeatIndex;
    this.turnPhase = 'DRAW';
    this.turnExpiresAt = Date.now() + this.config.turnDurationSec * 1000;
    this.revision++;
  }

  /**
   * Draw card action (from closed deck or open discard pile)
   */
  public drawCard(playerId: string, source: 'CLOSED_DECK' | 'OPEN_DISCARD'): Card {
    const player = this.getActivePlayerOrThrow(playerId);

    if (this.turnPhase !== 'DRAW') {
      throw new Error(`Invalid turn phase: must be DRAW, currently ${this.turnPhase}`);
    }

    if (player.hasDrawnInCurrentTurn) {
      throw new Error('Player has already drawn a card this turn');
    }

    let drawnCard: Card;

    if (source === 'OPEN_DISCARD') {
      if (this.openDiscardPile.length === 0) {
        throw new Error('Discard pile is empty');
      }
      drawnCard = this.openDiscardPile.pop()!;
    } else {
      // CLOSED_DECK
      if (this.closedDeck.length === 0) {
        // Reshuffle discard pile if closed deck is exhausted
        this.recycleDiscardPileIntoClosedDeck();
      }
      if (this.closedDeck.length === 0) {
        throw new Error('Both closed deck and discard pile are exhausted');
      }
      drawnCard = this.closedDeck.pop()!;
    }

    player.hand.push(drawnCard);
    player.hasDrawnInCurrentTurn = true;
    this.lastDrawnEvent = {
      playerId,
      source,
      timestamp: Date.now(),
    };

    // Synchronize player.groups with 14th drawn card
    player.groups = [
      ...player.groups,
      {
        id: `grp-drawn-${Date.now()}`,
        cards: [drawnCard],
        meldType: 'INVALID',
        isValid: false,
      },
    ];

    this.turnPhase = 'DISCARD';
    this.turnExpiresAt = Date.now() + this.config.turnDurationSec * 1000;
    this.revision++;

    return drawnCard;
  }

  /**
   * Discard card action
   */
  public discardCard(playerId: string, cardId: string): Card {
    const player = this.getActivePlayerOrThrow(playerId);

    if (this.turnPhase !== 'DISCARD') {
      throw new Error(`Invalid turn phase: must be DISCARD, currently ${this.turnPhase}`);
    }

    const cardIndex = player.hand.findIndex((c) => c.cardId === cardId);
    if (cardIndex === -1) {
      throw new Error(`Card with ID ${cardId} not found in player hand`);
    }

    const [discardedCard] = player.hand.splice(cardIndex, 1);
    this.openDiscardPile.push(discardedCard);

    // Synchronize player.groups by removing discarded card and re-evaluating melds
    player.groups = player.groups
      .map((g) => ({
        ...g,
        cards: g.cards.filter((c) => c.cardId !== cardId),
      }))
      .filter((g) => g.cards.length > 0)
      .map((g) => {
        const evalRes = DeclarationValidator.evaluateGroup(g.cards, this.wildJokerCard);
        return {
          ...g,
          meldType: evalRes.meldType,
          isValid: evalRes.isValid,
        };
      });

    player.turnsPlayed++;
    player.hasDrawnInCurrentTurn = false;
    player.consecutiveTimeouts = 0;

    // Advance turn
    this.advanceTurn();
    this.revision++;

    return discardedCard;
  }

  /**
   * Player drops out of the current deal (can drop on their turn or beforehand)
   */
  public drop(playerId: string): DropClassification {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not in game`);
    }

    if (player.status !== 'ACTIVE') {
      throw new Error(`Player ${playerId} is not active (currently ${player.status})`);
    }

    if (this.tableStatus !== 'IN_PROGRESS') {
      throw new Error('Cannot drop when game is not in progress');
    }

    const wasActiveTurn = this.activePlayerSeat === player.seatIndex;

    const dropRes = DropManager.evaluateDrop(
      player.turnsPlayed,
      player.hasDrawnInCurrentTurn,
      false
    );

    player.status = 'DROPPED';
    player.hasDropped = true;
    player.dropType = dropRes.dropType;
    player.dealScore = dropRes.penaltyPoints;

    // Check if only 1 active player remains
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) {
      // Remaining player wins by default
      const winner = activePlayers[0] || player;
      this.finishDealWithWinner(winner.playerId);
    } else if (wasActiveTurn) {
      // Advance to next active player if it was the dropped player's turn
      this.advanceTurn();
    }

    this.revision++;
    return dropRes.dropType;
  }

  /**
   * Declare action (Show hand)
   */
  public declareHand(
    playerId: string,
    finishCardId: string,
    declaredGroups: { cards: Card[] }[]
  ): DeclarationResultPayload {
    const player = this.getActivePlayerOrThrow(playerId);

    if (this.turnPhase !== 'DISCARD') {
      throw new Error('Can only declare after drawing a card (during DISCARD phase)');
    }

    // Verify finishCardId is in hand
    const finishIndex = player.hand.findIndex((c) => c.cardId === finishCardId);
    if (finishIndex === -1) {
      throw new Error('Finish card must be in player hand');
    }

    // Place finish card on open discard pile
    const [finishCard] = player.hand.splice(finishIndex, 1);
    this.openDiscardPile.push(finishCard);

    // Validate the 13 declared cards
    const valResult = DeclarationValidator.validateDeclaration(
      declaredGroups,
      this.wildJokerCard
    );

    if (valResult.isValid) {
      // Valid Show! Player wins the deal!
      player.status = 'DECLARED';
      player.hasSubmittedHand = true;
      player.groups = declaredGroups.map((g, idx) => {
        const ev = DeclarationValidator.evaluateGroup(g.cards, this.wildJokerCard);
        return {
          id: `declared-${idx}`,
          cards: g.cards,
          meldType: ev.meldType,
          isValid: ev.isValid,
        };
      });

      this.winnerPlayerId = playerId;

      // Check remaining active non-dropped players
      const otherActivePlayers = this.getActivePlayers().filter((p) => p.playerId !== playerId);

      if (otherActivePlayers.length === 0) {
        // No opponents to arrange, conclude immediately
        const dealResult = this.finishDealWithWinner(playerId);
        this.revision++;
        return { isValid: true, status: 'DEAL_OVER', dealResult };
      }

      // Transition to ARRANGE_HAND phase for opponents (15 seconds)
      this.tableStatus = 'ARRANGE_HAND';
      this.turnPhase = 'DECLARATION';
      this.activePlayerSeat = null;
      this.turnExpiresAt = null;

      const arrangeDurationSec = 15;
      const arrangeExpiresAt = Date.now() + arrangeDurationSec * 1000;

      this.declarationInfo = {
        winnerPlayerId: player.playerId,
        winnerUsername: player.username,
        arrangeExpiresAt,
        arrangeDurationSec,
      };

      this.revision++;
      return {
        isValid: true,
        status: 'ARRANGE_HAND',
        declarationInfo: this.declarationInfo,
      };
    } else {
      // Wrong Show / Invalid Declaration!
      // Penalty: 80 points.
      player.status = 'ELIMINATED'; // Out of this deal
      player.dealScore = this.config.wrongShowPenalty || 80;

      const activePlayers = this.getActivePlayers();
      if (activePlayers.length <= 1) {
        // If 2-player game, other player wins immediately
        const winner = activePlayers[0] || player;
        const dealResult = this.finishDealWithWinner(winner.playerId);
        this.revision++;
        return {
          isValid: false,
          errorCode: valResult.errorCode || 'INVALID_DECLARATION',
          errorMessage: valResult.reason || 'Invalid declaration arrangement',
          reason: valResult.reason,
          missingRequirements: valResult.missingRequirements || [],
          invalidGroupIndices: valResult.invalidGroupIndices || [],
          invalidCardIds: valResult.invalidCardIds || [],
          dealResult,
          penaltyPoints: 80,
        };
      } else {
        // Deal continues with remaining players
        this.advanceTurn();
        this.revision++;
        return {
          isValid: false,
          errorCode: valResult.errorCode || 'INVALID_DECLARATION',
          errorMessage: valResult.reason || 'Invalid declaration arrangement',
          reason: valResult.reason,
          missingRequirements: valResult.missingRequirements || [],
          invalidGroupIndices: valResult.invalidGroupIndices || [],
          invalidCardIds: valResult.invalidCardIds || [],
          penaltyPoints: 80,
        };
      }
    }
  }

  /**
   * Opponent submits arranged hand during 15s ARRANGE_HAND phase.
   */
  public submitArrangedHand(
    playerId: string,
    groups: CardGroup[]
  ): { allSubmitted: boolean; dealResult?: DealResult } {
    if (this.tableStatus !== 'ARRANGE_HAND') {
      throw new Error('Not currently in arrange hand phase');
    }

    const player = this.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error(`Player ${playerId} not found`);

    if (player.hasDropped || player.status === 'ELIMINATED') {
      throw new Error('Player has already dropped or been eliminated');
    }

    if (groups && groups.length > 0) {
      player.groups = groups.map((g, idx) => {
        const ev = DeclarationValidator.evaluateGroup(g.cards, this.wildJokerCard);
        return {
          id: g.id || `submitted-${idx}`,
          cards: g.cards,
          meldType: ev.meldType,
          isValid: ev.isValid,
        };
      });
    }

    player.hasSubmittedHand = true;
    this.revision++;

    // Check if all non-dropped, active opponents have submitted
    const activeOpponents = this.players.filter(
      (p) => !p.hasDropped && p.status !== 'ELIMINATED' && p.playerId !== this.winnerPlayerId
    );
    const allSubmitted = activeOpponents.every((p) => p.hasSubmittedHand);

    if (allSubmitted && this.winnerPlayerId) {
      const dealResult = this.finishDealWithWinner(this.winnerPlayerId);
      return { allSubmitted: true, dealResult };
    }

    return { allSubmitted: false };
  }

  /**
   * Concludes the 15-second arrange phase when timer fires or all submitted.
   */
  public concludeArrangePhase(): DealResult {
    if (this.tableStatus !== 'ARRANGE_HAND') {
      throw new Error('Table is not in arrange hand phase');
    }
    const winnerId =
      this.winnerPlayerId ||
      this.players.find((p) => p.status === 'DECLARED')?.playerId ||
      this.players[0].playerId;

    return this.finishDealWithWinner(winnerId);
  }

  /**
   * Handle Turn Timeout
   */
  public handleTimeout(playerId: string): void {
    const player = this.getActivePlayerOrThrow(playerId);

    player.consecutiveTimeouts++;

    if (player.consecutiveTimeouts >= this.config.consecutiveTimeoutDrop) {
      // Auto-drop with 80 penalty
      player.status = 'DROPPED';
      player.hasDropped = true;
      player.dropType = 'TIMEOUT';
      player.dealScore = this.config.wrongShowPenalty || 80;

      const activePlayers = this.getActivePlayers();
      if (activePlayers.length <= 1) {
        const winner = activePlayers[0] || player;
        this.finishDealWithWinner(winner.playerId);
      } else {
        this.advanceTurn();
      }
    } else {
      // Timeout without auto-drop:
      // If player has drawn a card, auto-discard the drawn or last card
      if (this.turnPhase === 'DISCARD' && player.hasDrawnInCurrentTurn) {
        const autoDiscard = player.hand[player.hand.length - 1];
        this.discardCard(playerId, autoDiscard.cardId);
      } else {
        // Did not draw: just pass turn
        this.advanceTurn();
      }
    }

    this.revision++;
  }

  /**
   * Advances turn clockwise to the next active player.
   */
  private advanceTurn(): void {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) {
      this.tableStatus = 'COMPLETED';
      return;
    }

    const currentSeat = this.activePlayerSeat ?? 0;
    const sortedSeats = [...this.players]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => p.seatIndex);

    let nextSeat = currentSeat;
    for (let i = 1; i <= this.players.length; i++) {
      const candidateSeat = (currentSeat + i) % this.players.length;
      const candidatePlayer = this.players.find((p) => p.seatIndex === candidateSeat);
      if (candidatePlayer && candidatePlayer.status === 'ACTIVE') {
        nextSeat = candidateSeat;
        break;
      }
    }

    this.activePlayerSeat = nextSeat;
    this.turnPhase = 'DRAW';
    this.turnExpiresAt = Date.now() + this.config.turnDurationSec * 1000;
    this.turnHistoryCount++;

    // Reset drawn flag on all players
    for (const p of this.players) {
      p.hasDrawnInCurrentTurn = false;
    }
  }

  /**
   * Concludes deal and calculates scores for all participants.
   */
  private finishDealWithWinner(winnerPlayerId: string): DealResult {
    this.winnerPlayerId = winnerPlayerId;
    this.tableStatus = 'DEAL_OVER';
    this.turnPhase = 'ENDED';
    this.activePlayerSeat = null;
    this.turnExpiresAt = null;
    this.declarationInfo = null;

    const scores: ScoreItem[] = [];

    for (const player of this.players) {
      const isWinner = player.playerId === winnerPlayerId;

      if (isWinner) {
        player.dealScore = 0;
        scores.push({
          playerId: player.playerId,
          username: player.username,
          hand: player.hand,
          groups: player.groups,
          hasPureSequence: true,
          hasSecondSequence: true,
          isWinner: true,
          dealPenalty: 0,
          totalPoolScore: player.totalPoolScore,
          isEliminated: false,
          notes: 'Winner of deal',
        });
      } else if (player.hasDropped) {
        scores.push({
          playerId: player.playerId,
          username: player.username,
          hand: player.hand,
          groups: player.groups,
          hasPureSequence: false,
          hasSecondSequence: false,
          isWinner: false,
          dealPenalty: player.dealScore,
          totalPoolScore: player.totalPoolScore + player.dealScore,
          isEliminated: false,
          notes: `Dropped (${player.dropType}) - ${player.dealScore} pts`,
        });
      } else if (player.status === 'ELIMINATED') {
        // Wrong show penalty
        scores.push({
          playerId: player.playerId,
          username: player.username,
          hand: player.hand,
          groups: player.groups,
          hasPureSequence: false,
          hasSecondSequence: false,
          isWinner: false,
          dealPenalty: player.dealScore,
          totalPoolScore: player.totalPoolScore + player.dealScore,
          isEliminated: false,
          notes: `Invalid Show penalty - ${player.dealScore} pts`,
        });
      } else {
        // Active loser: evaluate hand score
        // Auto-group if player didn't group
        const groupsToScore =
          player.groups.length > 0
            ? player.groups
            : HandManager.autoGroupCards(player.hand, this.wildJokerCard);

        const scoreRes = ScoringEngine.calculateHandScore(
          groupsToScore,
          this.wildJokerCard,
          false
        );

        player.dealScore = scoreRes.penaltyPoints;

        scores.push({
          playerId: player.playerId,
          username: player.username,
          hand: player.hand,
          groups: groupsToScore,
          hasPureSequence: scoreRes.hasPureSequence,
          hasSecondSequence: scoreRes.hasSecondSequence,
          isWinner: false,
          dealPenalty: scoreRes.penaltyPoints,
          totalPoolScore: player.totalPoolScore + scoreRes.penaltyPoints,
          isEliminated: false,
          notes: scoreRes.notes,
        });
      }
    }

    const result: DealResult = {
      dealNumber: this.dealNumber,
      winnerPlayerId,
      scores,
      wildJoker: this.wildJokerCard!,
      completedAt: new Date().toISOString(),
    };

    this.completedDealResult = result;
    return result;
  }

  private recycleDiscardPileIntoClosedDeck(): void {
    if (this.openDiscardPile.length <= 1) return;
    const topCard = this.openDiscardPile.pop()!;
    const cardsToRecycle = [...this.openDiscardPile];
    this.openDiscardPile = [topCard];

    const { shuffled } = ShuffleManager.shuffle(cardsToRecycle);
    this.closedDeck = shuffled;
  }

  public getActivePlayers(): InternalPlayerState[] {
    return this.players.filter((p) => p.status === 'ACTIVE');
  }

  private getActivePlayerOrThrow(playerId: string): InternalPlayerState {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player) throw new Error(`Player ${playerId} not in game`);
    if (this.activePlayerSeat === null || player.seatIndex !== this.activePlayerSeat) {
      throw new Error(`Not player ${playerId}'s turn (current seat: ${this.activePlayerSeat})`);
    }
    return player;
  }

  /**
   * Extracts sanitized public game state safe for all connected clients.
   * Private cards of other players are NEVER sent!
   */
  public getPublicState(): PublicGameState {
    const publicPlayers: PlayerPublicInfo[] = this.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      avatarUrl: p.avatarUrl,
      seatIndex: p.seatIndex,
      cardCount: p.hand.length,
      status: p.status,
      dealScore: p.dealScore,
      totalPoolScore: p.totalPoolScore,
      hasDropped: p.hasDropped,
      dropType: p.dropType,
      isTurn: p.seatIndex === this.activePlayerSeat,
      turnRemainingSec: this.turnExpiresAt
        ? Math.max(0, Math.ceil((this.turnExpiresAt - Date.now()) / 1000))
        : 0,
      consecutiveTimeouts: p.consecutiveTimeouts,
      isWinner: this.completedDealResult?.winnerPlayerId === p.playerId,
      hasSubmittedHand: !!p.hasSubmittedHand || p.status === 'DECLARED',
    }));

    return {
      tableId: this.tableId,
      dealNumber: this.dealNumber,
      variant: this.variant,
      tableStatus: this.tableStatus,
      activePlayerSeat: this.activePlayerSeat,
      turnPhase: this.turnPhase,
      turnExpiresAt: this.turnExpiresAt,
      closedDeckCount: this.closedDeck.length,
      openDiscardPile: this.openDiscardPile,
      wildJokerCard: this.wildJokerCard,
      turnHistoryCount: this.turnHistoryCount,
      revision: this.revision,
      players: publicPlayers,
      declarationInfo: this.declarationInfo,
      nextRoundStartsAt: this.nextRoundStartsAt,
      lastDrawnEvent: this.lastDrawnEvent,
    };
  }

  /**
   * Extracts private state for a specific player containing their hand and groups.
   */
  public getPrivateStateForPlayer(playerId: string) {
    const publicState = this.getPublicState();
    const player = this.players.find((p) => p.playerId === playerId);

    return {
      ...publicState,
      myPlayerId: playerId,
      myHand: player ? player.hand : [],
      myGroups: player ? player.groups : [],
    };
  }

  /**
   * Extracts verified revealed hands for all participants at deal conclusion.
   * Can ONLY be called after deal completion ('DEAL_OVER' or 'COMPLETED').
   */
  public getRevealedHands(): RevealedPlayerHand[] {
    if (this.tableStatus !== 'DEAL_OVER' && this.tableStatus !== 'COMPLETED') {
      throw new Error('Hands can only be revealed after deal completion');
    }

    return this.players.map((p) => {
      const isWinner = p.playerId === this.winnerPlayerId;
      const groups = p.groups && p.groups.length > 0 ? p.groups : HandManager.autoGroupCards(p.hand, this.wildJokerCard);
      const groupedCardIds = new Set(groups.flatMap((g) => g.cards.map((c) => c.cardId)));
      const unmatchedCards = p.hand.filter((c) => !groupedCardIds.has(c.cardId));

      const pureSequences = groups.filter((g) => g.meldType === 'PURE_SEQUENCE' && g.isValid).length;
      const sequences = groups.filter((g) => (g.meldType === 'IMPURE_SEQUENCE' || g.meldType === 'PURE_SEQUENCE') && g.isValid).length;
      const sets = groups.filter((g) => g.meldType === 'SET' && g.isValid).length;

      return {
        playerId: p.playerId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        cards: [...p.hand],
        groups: JSON.parse(JSON.stringify(groups)),
        unmatchedCards,
        dealPenalty: p.dealScore ?? 0,
        totalPoolScore: p.totalPoolScore ?? 0,
        isWinner,
        isEliminated: p.status === 'ELIMINATED',
        meldsSummary: {
          pureSequences,
          sequences,
          sets,
          hasValidShow: isWinner,
        },
      };
    });
  }
}
