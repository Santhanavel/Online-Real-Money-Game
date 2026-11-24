export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES' | 'NONE';

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'JOKER';

export interface Card {
  cardId: string;       // e.g. "d0-HEARTS-A", "d1-NONE-JOKER-1"
  suit: Suit;
  rank: Rank;
  deckIndex: number;    // 0 or 1
  isPrintedJoker: boolean;
}

export type MeldType = 'PURE_SEQUENCE' | 'IMPURE_SEQUENCE' | 'SET' | 'INVALID';

export interface CardGroup {
  id: string;
  cards: Card[];
  meldType?: MeldType;
  isValid?: boolean;
}

export type GameVariant = 'POINTS' | 'POOL_240' | 'POOL_101' | 'POOL_201' | 'POINTS_240';

export type EntryAmount = 50 | 100 | 200 | 500 | 1000 | 1500 | 2000;
export const VALID_ENTRY_AMOUNTS: EntryAmount[] = [50, 100, 200, 500, 1000, 1500, 2000];

export type TableStatus =
  | 'WAITING_FOR_PLAYERS'
  | 'STARTING'
  | 'IN_PROGRESS'
  | 'ARRANGE_HAND'
  | 'DEAL_OVER'
  | 'COMPLETED'
  | 'ABANDONED';

export type PlayerStatus =
  | 'WAITING'
  | 'ACTIVE'
  | 'DROPPED'
  | 'ELIMINATED'
  | 'DISCONNECTED'
  | 'DECLARED';

export interface TableConfig {
  tableId: string;
  variant: GameVariant;
  entryAmount?: number;          // 50, 100, 200, 500, 1000, 1500, 2000
  pointValue: number;            // e.g. 0.05, 0.10, 1.00 (numeric display value)
  maxPlayers: 2 | 6;
  turnDurationSec: number;       // Default 30s
  extraTimeSec: number;          // Time bank, e.g. 15s
  firstDropPenalty: number;      // 20
  middleDropPenalty: number;     // 40
  wrongShowPenalty: number;      // 80
  consecutiveTimeoutDrop: number;// 3
  maxScoreCap: number;           // 80
  pointsOutThreshold?: number;   // 240 for POINTS_240
  winningThreshold?: number;     // 241 for POINTS_240
  poolEliminationLimit: number;  // 101 or 201 (0 for Points)
  deckCount: number;             // 2 standard decks
  printedJokersPerDeck: number;  // 2 per deck
}

export interface PlayerPublicInfo {
  playerId: string;
  username: string;
  avatarUrl: string;
  seatIndex: number;
  cardCount: number;
  status: PlayerStatus;
  dealScore: number;
  totalPoolScore: number;
  hasDropped: boolean;
  dropType?: 'FIRST' | 'MIDDLE' | 'TIMEOUT';
  isTurn: boolean;
  turnRemainingSec?: number;
  consecutiveTimeouts: number;
  isWinner?: boolean;
  hasSubmittedHand?: boolean;
}

export interface DeclarationInfo {
  winnerPlayerId: string;
  winnerUsername: string;
  arrangeExpiresAt: number;
  arrangeDurationSec: number;
}

export interface PublicGameState {
  tableId: string;
  dealNumber: number;
  variant: GameVariant;
  tableStatus: TableStatus;
  activePlayerSeat: number | null;
  turnPhase: 'DRAW' | 'DISCARD' | 'DECLARATION' | 'ENDED';
  turnExpiresAt: number | null;
  closedDeckCount: number;
  openDiscardPile: Card[];
  wildJokerCard: Card | null;
  turnHistoryCount: number;
  revision: number;
  players: PlayerPublicInfo[];
  declarationInfo?: DeclarationInfo | null;
  nextRoundStartsAt?: number | null; // Authoritative scheduled timestamp when next deal starts
  lastDrawnEvent?: {
    playerId: string;
    source: 'CLOSED_DECK' | 'OPEN_DISCARD';
    timestamp: number;
  } | null;
}

export interface PrivateGameState extends PublicGameState {
  myPlayerId: string;
  myHand: Card[];
  myGroups: CardGroup[];
}

export interface DrawCardAction {
  source: 'CLOSED_DECK' | 'OPEN_DISCARD';
}

export interface DiscardCardAction {
  cardId: string;
}

export interface DeclareAction {
  finishCardId: string;
  groups: {
    cards: Card[];
  }[];
}

export interface SubmitArrangedHandAction {
  tableId: string;
  groups: CardGroup[];
}

export interface DeclarationResultPayload {
  isValid: boolean;
  status?: TableStatus;
  errorCode?: string;
  errorMessage?: string;
  reason?: string;
  invalidGroupIndices?: number[];
  invalidGroupIds?: string[];
  invalidCardIds?: string[];
  missingRequirements?: string[];
  penaltyPoints?: number;
  dealResult?: DealResult;
  declarationInfo?: DeclarationInfo;
}

export interface DropAction {
  // Initiated by player
}

export interface ScoreItem {
  playerId: string;
  username: string;
  hand: Card[];
  groups: CardGroup[];
  hasPureSequence: boolean;
  hasSecondSequence: boolean;
  isWinner: boolean;
  dealPenalty: number;
  totalPoolScore: number;
  isEliminated: boolean;
  notes: string;
}

export interface DealResult {
  dealNumber: number;
  winnerPlayerId: string;
  scores: ScoreItem[];
  wildJoker: Card;
  completedAt: string;
}

export interface GameFinalResult {
  tableId: string;
  variant: GameVariant;
  winnerPlayerId: string;
  deals: DealResult[];
  finalStandings: {
    rank: number;
    playerId: string;
    username: string;
    totalScore: number;
    status: PlayerStatus;
  }[];
}

// ==========================================
// RUMMYCULTURE-INSPIRED MATCHMAKING CONTRACT
// ==========================================

export type MatchmakingTicketStatus =
  | 'QUEUED'
  | 'RESERVED'
  | 'MATCH_FOUND'
  | 'READY'
  | 'STARTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type WaitingTableStatus =
  | 'CREATED'
  | 'WAITING_FOR_PLAYERS'
  | 'WAITING'
  | 'FILLING'
  | 'TABLE_FULL'
  | 'FULL'
  | 'START_COUNTDOWN'
  | 'FILLING_AFTER_LEAVE'
  | 'LOCKED'
  | 'READY_CHECK'
  | 'STARTING'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ACTIVE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export interface WaitingSeat {
  seatIndex: number;
  playerId: string | null;
  username: string | null;
  avatarUrl: string | null;
  isOccupied: boolean;
  reservedAt: number | null;
  isMe?: boolean;
}

export interface MatchmakingTicket {
  ticketId: string;
  playerId: string;
  username: string;
  avatarUrl: string;
  socketId: string;
  gameType: GameVariant;
  poolVariant?: 'POOL_101' | 'POOL_201' | null;
  tableCapacity: 2 | 6;
  tableConfigurationId: string;
  pointValue: number;
  entryAmount?: number;
  rulesVersion: string;
  queueEnteredAt: number;
  ticketStatus: MatchmakingTicketStatus;
  currentTableId: string | null;
  assignedSeatIndex: number | null;
  reservationExpiry: number | null;
  lastHeartbeatAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface SeatReservation {
  reservationId: string;
  tableId: string;
  playerId: string;
  username: string;
  avatarUrl: string;
  seatIndex: number;
  status: 'RESERVED' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  reservedAt: number;
  expiresAt: number;
}

export interface WaitingTable {
  tableId: string;
  gameType: GameVariant;
  poolVariant?: 'POOL_101' | 'POOL_201' | null;
  tableCapacity: 2 | 6;
  pointValue: number;
  entryAmount?: number;
  tableConfigurationId: string;
  rulesVersion: string;
  occupiedSeatCount: number;
  tableStatus: WaitingTableStatus;
  seats: WaitingSeat[];
  createdAt: number;
  lastActivityAt: number;
  matchmakingDeadline: number;       // serverCreatedAt + 60_000ms
  gameStartsAt?: number | null;      // serverTimestamp + 3000ms during countdown
  lockedAt?: number | null;          // when remaining <= 1000ms
  startedAt?: number | null;
  revision?: number;
}

export type MatchmakingUiState =
  | 'IDLE'
  | 'SEARCHING'
  | 'PLAYERS_JOINING'
  | 'TABLE_FULL'
  | 'START_COUNTDOWN'
  | 'LOCKED'
  | 'MATCH_FOUND'
  | 'PREPARING'
  | 'STARTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export interface MatchmakingTableUpdatedPayload {
  ticketId: string;
  tableId: string;
  gameType: GameVariant;
  poolVariant?: 'POOL_101' | 'POOL_201' | null;
  tableCapacity: 2 | 6;
  pointValue: number;
  entryAmount?: number;
  occupiedSeatCount: number;
  seats: WaitingSeat[];
  tableStatus: WaitingTableStatus;
  revision: number;
  serverTimestamp: number;
  matchmakingDeadline?: number;
  gameStartsAt?: number | null;
  countdownSec?: number;
  canLeave?: boolean;
}

export interface MatchmakingStatusPayload {
  state: MatchmakingUiState;
  ticket?: MatchmakingTicket;
  table?: MatchmakingTableUpdatedPayload;
  message?: string;
  countdownSec?: number;
  gameStartsAt?: number | null;
  matchmakingDeadline?: number | null;
  canLeave?: boolean;
  error?: string;
}

export interface MatchmakingJoinPayload {
  variant: GameVariant;
  pointValue?: number;
  entryAmount?: number;
  maxPlayers: 2 | 6;
  configurationId?: string;
}

export interface MatchmakingCancelPayload {
  ticketId?: string;
}

export interface TableRealtimeEventPayload {
  tableId: string;
  eventId: string;
  serverTimestamp: number;
  stateVersion: number;
  occupiedSeatCount: number;
  requiredPlayerCount: number;
  currentTableState: WaitingTableStatus;
  applicableDeadline: number | null;
  player?: {
    playerId: string;
    username: string;
    avatarUrl?: string | null;
    seatIndex: number;
  } | null;
  seats?: WaitingSeat[];
  countdownSec?: number | null;
  message?: string;
  gameType?: GameVariant;
  entryAmount?: number;
  pointValue?: number;
}

// ==========================================
// POOL RUMMY COMPLETE TOURNAMENT LIFECYCLE
// ==========================================

export type PoolMatchLifecycleState =
  | 'WAITING_FOR_PLAYERS'
  | 'READY'
  | 'MATCH_STARTING'
  | 'DEAL_STARTING'
  | 'DEAL_IN_PROGRESS'
  | 'DECLARATION_PENDING'
  | 'DECLARATION_VALIDATED'
  | 'HAND_REVEAL'
  | 'DEAL_SCORING'
  | 'SCOREBOARD_PRESENTATION'
  | 'ELIMINATION_PROCESSING'
  | 'REENTRY_WINDOW'
  | 'SPLIT_ELIGIBILITY_CHECK'
  | 'SPLIT_REQUESTED'
  | 'SPLIT_VOTING'
  | 'SPLIT_PROCESSING'
  | 'NEXT_DEAL_COUNTDOWN'
  | 'NEXT_DEAL_STARTING'
  | 'MATCH_FINALIZING'
  | 'WINNER_DECLARED'
  | 'SETTLEMENT_PENDING'
  | 'SPLIT_COMPLETED'
  | 'COMPLETED'
  | 'TERMINAL_NO_ACTIVE_PLAYERS'
  | 'CANCELLED'
  | 'ABORTED';

export interface RevealedPlayerHand {
  playerId: string;
  username: string;
  avatarUrl: string;
  cards: Card[];
  groups: CardGroup[];
  unmatchedCards: Card[];
  dealPenalty: number;
  totalPoolScore: number;
  isWinner: boolean;
  isEliminated: boolean;
  meldsSummary?: {
    pureSequences: number;
    sequences: number;
    sets: number;
    hasValidShow: boolean;
  };
}

export interface AllHandsRevealedPayload {
  tableId: string;
  dealNumber: number;
  winnerPlayerId: string;
  hands: RevealedPlayerHand[];
  revealedAt: number;
}

export interface ScoreboardRow {
  rank: number;
  playerId: string;
  username: string;
  avatarUrl: string;
  isWinner: boolean;
  previousScore: number;
  currentDealScore: number;
  totalScore: number;
  poolLimit: number;
  pointsRemaining: number;
  status: 'ACTIVE' | 'ELIMINATED' | 'REENTERED' | 'DROPPED';
  remainingDrops: number;
  canReenter?: boolean;
}

export interface PoolScoreboardPayload {
  tableId: string;
  dealNumber: number;
  rows: ScoreboardRow[];
  nextDealStartsAt?: number;
  countdownSec?: number;
  isFinalDeal?: boolean;
  winnerPlayerId?: string;
  splitEligible: boolean;
  reentryEligible: boolean;
  splitEligibility?: PoolSplitEligibility;
  dealHistory?: DealResult[];
}

export interface SplitDropCalculation {
  playerId: string;
  username: string;
  remainingDrops: number;
  excessDrops: number;
  excessDropPayout: number; // In minor units (paise/cents)
  equalSharePayout: number;  // In minor units
  totalPayout: number;       // In minor units
}

export interface PoolSplitCalculation {
  eligiblePlayerIds: string[];
  totalPrizePool: number;
  platformFee: number;
  netPrizePool: number;
  dropRate: number;
  minRemainingDrops: number;
  playerCalculations: SplitDropCalculation[];
  reconciliationTotal: number;
}

export interface PoolSplitEligibility {
  isEligible: boolean;
  reason?: string;
  eligiblePlayerCount: number;
  calculation?: PoolSplitCalculation;
}

export interface PoolSplitRequest {
  splitId: string;
  tableId: string;
  initiatorPlayerId: string;
  initiatorUsername: string;
  calculation: PoolSplitCalculation;
  votes: Record<string, boolean | null>;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  votingExpiresAt: number;
  remainingVotingSec?: number;
}

export interface PoolReentryEligibility {
  eligible: boolean;
  reentryFee: number;
  startingScore: number;
  windowExpiresAt?: number;
  reason?: string;
}

export interface NextDealCountdownPayload {
  tableId: string;
  dealNumber: number;
  startsAt: number;
  countdownSec: number;
  isPaused: boolean;
  pauseReason?: 'SPLIT_VOTING' | 'REENTRY';
}


