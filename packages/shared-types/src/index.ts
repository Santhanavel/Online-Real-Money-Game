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

export type GameVariant = 'POINTS' | 'POOL_101' | 'POOL_201';

export type TableStatus =
  | 'WAITING_FOR_PLAYERS'
  | 'STARTING'
  | 'IN_PROGRESS'
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
  pointValue: number;         // e.g. 0.05, 0.10, 1.00 (numeric display value)
  maxPlayers: 2 | 6;
  turnDurationSec: number;    // Default 30s
  extraTimeSec: number;       // Time bank, e.g. 15s
  firstDropPenalty: number;   // 20
  middleDropPenalty: number;  // 40
  wrongShowPenalty: number;   // 80
  consecutiveTimeoutDrop: number; // 3
  maxScoreCap: number;        // 80
  poolEliminationLimit: number; // 101 or 201 (0 for Points)
  deckCount: number;          // 2 standard decks
  printedJokersPerDeck: number; // 2 per deck
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
