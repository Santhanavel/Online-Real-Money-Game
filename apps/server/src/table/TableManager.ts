import {
  Card,
  CardGroup,
  DealResult,
  GameFinalResult,
  PlayerPublicInfo,
  TableConfig,
} from '@rummy/shared-types';
import { PointsRummyEngine, PoolRummyEngine } from '@rummy/game-engine';
import { DatabaseService } from '../db/schema';

export interface ConnectedPlayer {
  playerId: string;
  username: string;
  avatarUrl: string;
  socketId: string;
  seatIndex: number;
  isOnline: boolean;
  disconnectedAt?: number;
}

export interface GameTableSession {
  tableId: string;
  config: TableConfig;
  pointsEngine?: PointsRummyEngine;
  poolEngine?: PoolRummyEngine;
  players: ConnectedPlayer[];
  timerHandle?: NodeJS.Timeout;
  arrangeTimerHandle?: NodeJS.Timeout;
  nextDealTimerHandle?: NodeJS.Timeout;
  nextDealDeadline?: number;
  nextDealRemainingMs?: number;
  splitTimerHandle?: NodeJS.Timeout;
  lastActionAt: number;
}

export type BroadcastStateCallback = (tableId: string, session: GameTableSession) => void;
export type GameEventCallback = (
  tableId: string,
  event: string,
  data: any,
  targetSocketId?: string
) => void;

export class TableManager {
  private activeTables: Map<string, GameTableSession> = new Map();
  private playerToTableMap: Map<string, string> = new Map();
  private db = DatabaseService.getInstance();

  private onBroadcast?: BroadcastStateCallback;
  private onEmitEvent?: GameEventCallback;

  constructor(onBroadcast?: BroadcastStateCallback, onEmitEvent?: GameEventCallback) {
    this.onBroadcast = onBroadcast;
    this.onEmitEvent = onEmitEvent;
  }

  public setCallbacks(broadcast: BroadcastStateCallback, emitEvent: GameEventCallback) {
    this.onBroadcast = broadcast;
    this.onEmitEvent = emitEvent;
  }

  /**
   * Creates a new multiplayer table session and starts the initial deal
   */
  public createTable(
    config: TableConfig,
    matchedPlayers: { playerId: string; username: string; avatarUrl: string; socketId: string }[]
  ): GameTableSession {
    const connectedPlayers: ConnectedPlayer[] = matchedPlayers.map((p, idx) => ({
      playerId: p.playerId,
      username: p.username,
      avatarUrl: p.avatarUrl,
      socketId: p.socketId,
      seatIndex: idx,
      isOnline: true,
    }));

    const session: GameTableSession = {
      tableId: config.tableId,
      config,
      players: connectedPlayers,
      lastActionAt: Date.now(),
    };

    if (config.variant === 'POINTS') {
      session.pointsEngine = new PointsRummyEngine(
        config,
        connectedPlayers.map((p) => ({
          playerId: p.playerId,
          username: p.username,
          avatarUrl: p.avatarUrl,
          seatIndex: p.seatIndex,
        }))
      );
      session.pointsEngine.startDeal(0);
    } else {
      // Pool 240, Pool 101 or Pool 201
      session.poolEngine = new PoolRummyEngine(
        config,
        connectedPlayers.map((p) => ({
          playerId: p.playerId,
          username: p.username,
          avatarUrl: p.avatarUrl,
          seatIndex: p.seatIndex,
        }))
      );
      session.poolEngine.startNextDeal();
      session.pointsEngine = session.poolEngine.currentDealEngine!;
    }

    this.activeTables.set(config.tableId, session);
    for (const p of matchedPlayers) {
      this.playerToTableMap.set(p.playerId, config.tableId);
    }

    // Start turn timer
    this.resetTurnTimer(session);

    // Save table to DB
    this.db.tables.set(config.tableId, {
      id: config.tableId,
      variant: config.variant,
      pointValue: config.pointValue,
      maxPlayers: config.maxPlayers,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
    });

    return session;
  }

  public getSession(tableId: string): GameTableSession | undefined {
    return this.activeTables.get(tableId);
  }

  public getTableIdForPlayer(playerId: string): string | undefined {
    return this.playerToTableMap.get(playerId);
  }

  public getResumableTable(playerId: string): GameTableSession | undefined {
    const tableId = this.playerToTableMap.get(playerId);
    const session = tableId ? this.activeTables.get(tableId) : undefined;
    if (!session?.pointsEngine || session.pointsEngine.tableStatus === 'COMPLETED' || session.poolEngine?.isCompleted) return undefined;
    if (session.poolEngine?.players.find(player => player.playerId === playerId)?.isEliminated) return undefined;
    return session;
  }

  /**
   * Turn timer loop with auto-timeout
   */
  private resetTurnTimer(session: GameTableSession) {
    if (session.timerHandle) {
      clearTimeout(session.timerHandle);
      delete session.timerHandle;
    }

    const currentEngine = session.pointsEngine;
    if (!currentEngine || currentEngine.tableStatus !== 'IN_PROGRESS') {
      return;
    }

    const activeSeat = currentEngine.activePlayerSeat;
    if (activeSeat === null) return;

    const activePlayer = session.players.find((p) => p.seatIndex === activeSeat);
    if (!activePlayer) return;

    const timeoutMs = Math.max(0, (currentEngine.turnExpiresAt ?? Date.now()) - Date.now());

    session.timerHandle = setTimeout(() => {
      this.handlePlayerTimeout(session.tableId, activePlayer.playerId);
    }, timeoutMs);
  }

  private handlePlayerTimeout(tableId: string, playerId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) return;

    try {
      session.pointsEngine.handleTimeout(playerId);

      if (session.pointsEngine.getPublicState().tableStatus === 'DEAL_OVER') {
        this.handleDealOver(session);
      } else {
        this.resetTurnTimer(session);
        this.broadcastState(session);
      }
    } catch (err: any) {
      console.error(`Timeout error for player ${playerId}:`, err.message);
    }
  }

  /**
   * Player draws card action
   */
  public handleDraw(tableId: string, playerId: string, source: 'CLOSED_DECK' | 'OPEN_DISCARD'): Card {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) throw new Error('Game session not found');

    if (session.poolEngine?.isCompleted || session.pointsEngine.tableStatus === 'COMPLETED' || session.pointsEngine.tableStatus === 'DEAL_OVER') {
      throw new Error(`Cannot draw card: deal or match is completed (${session.pointsEngine.tableStatus})`);
    }

    const card = session.pointsEngine.drawCard(playerId, source);
    session.lastActionAt = Date.now();

    this.resetTurnTimer(session);
    this.broadcastState(session);

    return card;
  }

  /**
   * Player discards card action
   */
  public handleDiscard(tableId: string, playerId: string, cardId: string): Card {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) throw new Error('Game session not found');

    if (session.poolEngine?.isCompleted || session.pointsEngine.tableStatus === 'COMPLETED' || session.pointsEngine.tableStatus === 'DEAL_OVER') {
      throw new Error(`Cannot discard card: deal or match is completed (${session.pointsEngine.tableStatus})`);
    }

    const card = session.pointsEngine.discardCard(playerId, cardId);
    session.lastActionAt = Date.now();

    this.resetTurnTimer(session);
    this.broadcastState(session);

    return card;
  }

  /**
   * Player drops deal action
   */
  public handleDrop(tableId: string, playerId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) throw new Error('Game session not found');

    if (session.poolEngine?.isCompleted || session.pointsEngine.tableStatus === 'COMPLETED' || session.pointsEngine.tableStatus === 'DEAL_OVER') {
      throw new Error(`Cannot drop: deal or match is completed (${session.pointsEngine.tableStatus})`);
    }

    const dropType = session.pointsEngine.drop(playerId);
    session.lastActionAt = Date.now();

    if (session.pointsEngine.getPublicState().tableStatus === 'DEAL_OVER') {
      this.handleDealOver(session);
    } else {
      this.resetTurnTimer(session);
      this.broadcastState(session);
    }

    return dropType;
  }

  /**
   * Player declares hand action
   */
  public handleDeclare(
    tableId: string,
    playerId: string,
    finishCardId: string,
    groups: { cards: Card[] }[]
  ) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) throw new Error('Game session not found');

    if (session.poolEngine?.isCompleted || session.pointsEngine.tableStatus === 'COMPLETED' || session.pointsEngine.tableStatus === 'DEAL_OVER') {
      throw new Error(`Cannot declare hand: deal or match is completed (${session.pointsEngine.tableStatus})`);
    }

    const result = session.pointsEngine.declareHand(playerId, finishCardId, groups);
    session.lastActionAt = Date.now();

    if (result.isValid && result.status === 'ARRANGE_HAND') {
      // Clear normal turn timer
      if (session.timerHandle) {
        clearTimeout(session.timerHandle);
        delete session.timerHandle;
      }
      if (session.arrangeTimerHandle) {
        clearTimeout(session.arrangeTimerHandle);
      }

      // 15-second timer for other players to arrange their cards
      session.arrangeTimerHandle = setTimeout(() => {
        this.handleArrangeTimeout(session.tableId);
      }, 15000);

      this.broadcastState(session);
      if (this.onEmitEvent && result.declarationInfo) {
        this.onEmitEvent(session.tableId, 'game:hand_declared_arrange', result.declarationInfo);
      }
    } else if (session.pointsEngine.getPublicState().tableStatus === 'DEAL_OVER') {
      this.handleDealOver(session);
    } else {
      this.resetTurnTimer(session);
      this.broadcastState(session);
    }

    return result;
  }

  /**
   * Player submits arranged hand during 15s ARRANGE_HAND phase to reduce penalty
   */
  public handleSubmitArrangedHand(
    tableId: string,
    playerId: string,
    groups: CardGroup[]
  ) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) throw new Error('Game session not found');

    const subRes = session.pointsEngine.submitArrangedHand(playerId, groups);
    session.lastActionAt = Date.now();

    if (subRes.allSubmitted || session.pointsEngine.tableStatus === 'DEAL_OVER') {
      if (session.arrangeTimerHandle) {
        clearTimeout(session.arrangeTimerHandle);
        delete session.arrangeTimerHandle;
      }
      this.handleDealOver(session);
    } else {
      this.broadcastState(session);
    }

    return subRes;
  }

  /**
   * 15s arrange timer expired: score hands and conclude deal
   */
  private handleArrangeTimeout(tableId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) return;

    if (session.arrangeTimerHandle) {
      clearTimeout(session.arrangeTimerHandle);
      delete session.arrangeTimerHandle;
    }

    if (session.pointsEngine.tableStatus === 'ARRANGE_HAND') {
      session.pointsEngine.concludeArrangePhase();
      this.handleDealOver(session);
    }
  }

  /**
   * Player custom groups update
   */
  public handleGroupCards(tableId: string, playerId: string, groups: CardGroup[]) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) return;

    const player = session.pointsEngine.players.find((p) => p.playerId === playerId);
    if (player?.status === 'ACTIVE' && ['IN_PROGRESS', 'ARRANGE_HAND'].includes(session.pointsEngine.tableStatus)) {
      player.groups = groups;
      this.broadcastState(session);
    }
  }

  /**
   * Handle deal conclusion (Points game complete or Pool game next deal)
   */
  private handleDealOver(session: GameTableSession) {
    if (session.timerHandle) {
      clearTimeout(session.timerHandle);
      delete session.timerHandle;
    }
    if (session.arrangeTimerHandle) {
      clearTimeout(session.arrangeTimerHandle);
      delete session.arrangeTimerHandle;
    }

    const dealResult = session.pointsEngine!.completedDealResult!;
    const revealedHands = session.pointsEngine!.getRevealedHands();

    // 1. Authoritative Hand Reveal Event: Publish all participants' verified cards
    if (this.onEmitEvent) {
      this.onEmitEvent(session.tableId, 'deal:hands_revealed', {
        tableId: session.tableId,
        dealNumber: session.pointsEngine!.dealNumber,
        winnerPlayerId: dealResult.winnerPlayerId,
        hands: revealedHands,
        revealedAt: Date.now(),
      });
    }

    if (session.config.variant === 'POINTS') {
      // Points Rummy is single-deal -> game complete!
      session.pointsEngine!.tableStatus = 'COMPLETED';

      // Save to database
      this.db.saveResult({
        id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tableId: session.tableId,
        variant: session.config.variant,
        winnerUserId: dealResult.winnerPlayerId,
        dealsCount: 1,
        standingsJson: JSON.stringify(dealResult.scores),
        completedAt: new Date().toISOString(),
      });

      this.broadcastState(session);
      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'game:completed', {
          dealResult,
          winnerPlayerId: dealResult.winnerPlayerId,
        });
      }
    } else if (session.poolEngine) {
      // Pool Rummy multi-deal
      const poolConclusion = session.poolEngine.concludeCurrentDeal();
      const scoreboard = session.poolEngine.getScoreboard();

      // Save deal record in database
      this.db.savePoolDeal({
        dealId: `deal-${session.tableId}-${dealResult.dealNumber}`,
        matchId: `match-${session.tableId}`,
        dealNumber: dealResult.dealNumber,
        winnerPlayerId: dealResult.winnerPlayerId,
        scoresJson: JSON.stringify(dealResult.scores),
        revealedHandsJson: JSON.stringify(revealedHands),
        completedAt: new Date().toISOString(),
      });

      if (poolConclusion.isPoolCompleted) {
        // Pool game completed!
        session.pointsEngine!.tableStatus = 'COMPLETED';

        this.db.saveResult({
          id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tableId: session.tableId,
          variant: session.config.variant,
          winnerUserId: poolConclusion.finalResult!.winnerPlayerId,
          dealsCount: session.poolEngine.dealHistory.length,
          standingsJson: JSON.stringify(poolConclusion.finalResult!.finalStandings),
          completedAt: new Date().toISOString(),
        });

        const poolMatch = this.db.getPoolMatch(`match-${session.tableId}`);
        if (poolMatch) {
          poolMatch.status = 'COMPLETED';
          poolMatch.winnerUserId = poolConclusion.finalResult!.winnerPlayerId;
          poolMatch.dealsCount = session.poolEngine.dealHistory.length;
          poolMatch.completedAt = new Date().toISOString();
        }

        this.broadcastState(session);
        if (this.onEmitEvent) {
          this.onEmitEvent(session.tableId, 'game:completed', {
            dealResult: poolConclusion.dealResult,
            finalResult: poolConclusion.finalResult,
          });
        }
      } else {
        // Start 15-second countdown to next deal
        if (this.onEmitEvent) {
          this.onEmitEvent(session.tableId, 'scoreboard:updated', scoreboard);
        }
        this.startNextDealCountdown(session, 15);
      }
    }
  }

  /**
   * Starts or resumes the next-deal countdown timer.
   */
  public startNextDealCountdown(session: GameTableSession, durationSec: number = 10) {
    if (session.nextDealTimerHandle) {
      clearTimeout(session.nextDealTimerHandle);
      delete session.nextDealTimerHandle;
    }

    const startsAt = Date.now() + durationSec * 1000;
    session.nextDealDeadline = startsAt;
    session.nextDealRemainingMs = durationSec * 1000;
    session.pointsEngine!.nextRoundStartsAt = startsAt;
    this.broadcastState(session);

    if (this.onEmitEvent) {
      this.onEmitEvent(session.tableId, 'game:deal_ended', {
        dealResult: session.pointsEngine!.completedDealResult,
        nextRoundStartsAt: startsAt,
        nextDealInSec: durationSec,
      });
      this.onEmitEvent(session.tableId, 'deal:countdown_tick', {
        tableId: session.tableId,
        dealNumber: session.poolEngine!.currentDealNumber,
        startsAt,
        countdownSec: durationSec,
        isPaused: false,
      });
    }

    session.nextDealTimerHandle = setTimeout(() => {
      this.executeNextDeal(session);
    }, durationSec * 1000);
  }

  /**
   * Executes transition to the next deal when countdown reaches zero.
   */
  private executeNextDeal(session: GameTableSession) {
    if (!this.activeTables.has(session.tableId) || !session.poolEngine) return;
    if (session.poolEngine.isCompleted) return;

    try {
      session.poolEngine.startNextDeal();
      session.pointsEngine = session.poolEngine.currentDealEngine!;
      session.pointsEngine.nextRoundStartsAt = null;
      delete session.nextDealTimerHandle;
      delete session.nextDealDeadline;
      delete session.nextDealRemainingMs;

      this.resetTurnTimer(session);
      this.broadcastState(session);

      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'deal:started', {
          tableId: session.tableId,
          dealNumber: session.poolEngine.currentDealNumber,
          startedAt: Date.now(),
        });
      }
    } catch (err: any) {
      console.error(`Error starting next deal on table ${session.tableId}:`, err.message);
    }
  }

  /**
   * Handles player requesting a prize split.
   * Pauses the next-deal countdown and initiates 15s voting window.
   */
  public handleRequestSplit(tableId: string, playerId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.poolEngine) throw new Error('Table not found or not a Pool game');

    const splitReq = session.poolEngine.createSplitRequest(playerId);

    // Pause next-deal countdown
    if (session.nextDealTimerHandle && session.nextDealDeadline) {
      clearTimeout(session.nextDealTimerHandle);
      delete session.nextDealTimerHandle;
      session.nextDealRemainingMs = Math.max(1000, session.nextDealDeadline - Date.now());
    }

    // Save split request in database
    this.db.savePoolSplit({
      splitId: splitReq.splitId,
      matchId: `match-${tableId}`,
      dealNumber: session.poolEngine.currentDealNumber,
      initiatorPlayerId: playerId,
      status: 'PENDING',
      calculationJson: JSON.stringify(splitReq.calculation),
      votesJson: JSON.stringify(splitReq.votes),
      createdAt: new Date().toISOString(),
    });

    if (this.onEmitEvent) {
      this.onEmitEvent(session.tableId, 'split:requested', splitReq);
      this.onEmitEvent(session.tableId, 'deal:countdown_paused', {
        tableId,
        reason: 'SPLIT_VOTING',
        remainingMs: session.nextDealRemainingMs,
      });
    }

    // Start 15s voting timeout
    if (session.splitTimerHandle) {
      clearTimeout(session.splitTimerHandle);
    }
    session.splitTimerHandle = setTimeout(() => {
      this.handleSplitTimeout(tableId);
    }, 15000);

    return splitReq;
  }

  /**
   * Handles player voting on an active prize split proposal.
   */
  public handleVoteSplit(tableId: string, playerId: string, accept: boolean) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.poolEngine) throw new Error('Table not found or not a Pool game');

    const splitResult = session.poolEngine.recordSplitVote(playerId, accept);

    // Update split record in database
    const dbSplit = this.db.poolSplits.get(splitResult.splitId);
    if (dbSplit) {
      dbSplit.status = splitResult.status;
      dbSplit.votesJson = JSON.stringify(splitResult.votes);
    }

    if (splitResult.status === 'ACCEPTED') {
      if (session.splitTimerHandle) {
        clearTimeout(session.splitTimerHandle);
        delete session.splitTimerHandle;
      }
      if (session.nextDealTimerHandle) {
        clearTimeout(session.nextDealTimerHandle);
        delete session.nextDealTimerHandle;
      }

      session.pointsEngine!.tableStatus = 'COMPLETED';

      // Save final split match result
      this.db.saveResult({
        id: `split-res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tableId: session.tableId,
        variant: session.config.variant,
        winnerUserId: 'SPLIT_MUTUAL',
        dealsCount: session.poolEngine.dealHistory.length,
        standingsJson: JSON.stringify(session.poolEngine.finalResult!.finalStandings),
        completedAt: new Date().toISOString(),
      });

      const poolMatch = this.db.getPoolMatch(`match-${session.tableId}`);
      if (poolMatch) {
        poolMatch.status = 'COMPLETED';
        poolMatch.isSplit = true;
        poolMatch.winnerUserId = 'SPLIT_MUTUAL';
        poolMatch.completedAt = new Date().toISOString();
      }

      this.broadcastState(session);
      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'split:completed', splitResult);
        this.onEmitEvent(session.tableId, 'game:completed', {
          dealResult: session.pointsEngine!.completedDealResult,
          finalResult: session.poolEngine.finalResult,
          isSplit: true,
        });
      }
    } else if (splitResult.status === 'DECLINED') {
      if (session.splitTimerHandle) {
        clearTimeout(session.splitTimerHandle);
        delete session.splitTimerHandle;
      }

      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'split:declined', {
          splitId: splitResult.splitId,
          declinedByPlayerId: playerId,
        });
      }

      // Resume next deal countdown (minimum 5s)
      const resumeSec = Math.max(5, Math.ceil((session.nextDealRemainingMs || 5000) / 1000));
      this.startNextDealCountdown(session, resumeSec);
    } else {
      // Still pending, broadcast updated vote tally
      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'split:vote_updated', splitResult);
      }
    }

    return splitResult;
  }

  /**
   * Handles timeout of split voting
   */
  private handleSplitTimeout(tableId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.poolEngine) return;

    const expired = session.poolEngine.expireSplit();
    if (expired) {
      const dbSplit = this.db.poolSplits.get(expired.splitId);
      if (dbSplit) {
        dbSplit.status = 'EXPIRED';
      }

      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'split:expired', expired);
      }

      // Resume next deal countdown (minimum 5s)
      const resumeSec = Math.max(5, Math.ceil((session.nextDealRemainingMs || 5000) / 1000));
      this.startNextDealCountdown(session, resumeSec);
    }
  }

  /**
   * Handles eliminated player requesting re-entry
   */
  public handleRequestReentry(tableId: string, playerId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.poolEngine) throw new Error('Table not found or not a Pool game');

    const res = session.poolEngine.executeReentry(playerId);
    if (res.success) {
      // Save reentry record in database
      this.db.savePoolReentry({
        reentryId: `reentry-${tableId}-${playerId}-${Date.now()}`,
        matchId: `match-${tableId}`,
        dealNumber: session.poolEngine.currentDealNumber,
        playerId,
        fee: session.config.entryAmount || 100,
        startingScore: res.newScore,
        createdAt: new Date().toISOString(),
      });

      const scoreboard = session.poolEngine.getScoreboard();
      this.broadcastState(session);

      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'game:player_reentered', {
          playerId,
          newScore: res.newScore,
        });
        this.onEmitEvent(session.tableId, 'scoreboard:updated', scoreboard);
      }
    }

    return res;
  }

  /**
   * Returns current pool scoreboard
   */
  public handleGetScoreboard(tableId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.poolEngine) return null;
    return session.poolEngine.getScoreboard();
  }

  /**
   * Handle socket disconnection
   */
  public handlePlayerDisconnect(socketId: string) {
    for (const session of this.activeTables.values()) {
      const player = session.players.find((p) => p.socketId === socketId);
      if (player) {
        player.isOnline = false;
        player.disconnectedAt = Date.now();

        if (this.onEmitEvent) {
          this.onEmitEvent(session.tableId, 'game:player_disconnected', {
            playerId: player.playerId,
            username: player.username,
          });
        }
        break;
      }
    }
  }

  /**
   * Handle player reconnection
   */
  public handlePlayerReconnect(playerId: string, newSocketId: string, expectedTableId?: string): GameTableSession | null {
    const tableId = this.playerToTableMap.get(playerId);
    if (!tableId || (expectedTableId && tableId !== expectedTableId)) return null;

    const session = this.activeTables.get(tableId);
    if (!session) return null;

    const player = session.players.find((p) => p.playerId === playerId);
    if (player) {
      player.socketId = newSocketId;
      player.isOnline = true;
      delete player.disconnectedAt;

      if (this.onEmitEvent) {
        this.onEmitEvent(session.tableId, 'game:player_reconnected', {
          playerId: player.playerId,
          username: player.username,
        });
      }

      this.broadcastState(session);
      return session;
    }
    return null;
  }

  private broadcastState(session: GameTableSession) {
    if (this.onBroadcast) {
      this.onBroadcast(session.tableId, session);
    }
  }

  public getActiveTablesList() {
    const list: any[] = [];
    for (const session of this.activeTables.values()) {
      list.push({
        tableId: session.tableId,
        variant: session.config.variant,
        pointValue: session.config.pointValue,
        playerCount: session.players.length,
        status: session.pointsEngine?.tableStatus || 'WAITING',
        dealNumber: session.pointsEngine?.dealNumber || 1,
        players: session.players.map((p) => ({
          username: p.username,
          isOnline: p.isOnline,
        })),
      });
    }
    return list;
  }
}
