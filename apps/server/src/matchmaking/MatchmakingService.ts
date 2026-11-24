import {
  GameVariant,
  MatchmakingCancelPayload,
  MatchmakingJoinPayload,
  MatchmakingStatusPayload,
  MatchmakingTableUpdatedPayload,
  MatchmakingTicket,
  MatchmakingTicketStatus,
  MatchmakingUiState,
  SeatReservation,
  TableConfig,
  TableRealtimeEventPayload,
  WaitingSeat,
  WaitingTable,
  WaitingTableStatus,
} from '@rummy/shared-types';
import { DatabaseService, DbMatchmakingTicket, DbSeatReservation, DbWaitingTable } from '../db/schema';

export interface QueuedPlayer {
  playerId: string;
  username: string;
  avatarUrl: string;
  socketId: string;
  variant: GameVariant;
  entryAmount: number;
  pointValue?: number;
  maxPlayers: 2 | 6;
  configurationId?: string;
  rulesVersion?: string;
  queuedAt?: number;
}

export type MatchFoundCallback = (
  config: TableConfig,
  players: { playerId: string; username: string; avatarUrl: string; socketId: string; seatIndex: number }[]
) => void;

export type TableUpdateCallback = (
  tableId: string,
  payload: MatchmakingTableUpdatedPayload,
  targetSocketIds: string[]
) => void;

export type PlayerStatusCallback = (
  socketId: string,
  payload: MatchmakingStatusPayload
) => void;

export type CountdownEventCallback = (
  targetSocketIds: string[],
  event: string,
  data: any
) => void;

export interface MatchmakingOptions {
  maxWaitDurationSec?: number; // default: 30 seconds (configurable, e.g. 30 or 60)
  acceleratedCountdownSec?: number; // default: 5 seconds (configurable between 3 and 5)
  reservationTtlSec?: number; // default: 60s
  countdownDurationMs?: number; // legacy alias
}

/**
 * Production-Grade Shared Table Matchmaking & Adaptive Waiting Lobby Service
 *
 * Implements:
 * 1. Oldest compatible waiting table reuse (Pool 101, 201, 240 and Points 2P/6P)
 * 2. Atomic seat reservation and unique player participation
 * 3. Server-authoritative maximum waiting deadline (default 30s) initialized on first join and NEVER reset
 * 4. Full-table accelerated countdown (default 5s, configurable 3-5s) that never waits for unused max timer
 * 5. Strict server-side table state transitions:
 *    WAITING_FOR_PLAYERS -> FULL -> START_COUNTDOWN -> STARTING -> IN_PROGRESS / COMPLETED / CANCELLED / EXPIRED
 * 6. Countdown cancellation & deadline preservation if a player leaves during accelerated countdown
 * 7. Underfilled table expiry & refund notification (never silently start underfilled)
 * 8. Standardized real-time events with tableId, eventId, serverTimestamp, stateVersion, counts, state, and applicableDeadline
 * 9. Concurrency race protection (idempotent joins, single worker start transition)
 */
export class MatchmakingService {
  private waitingTables: Map<string, WaitingTable> = new Map();
  private activeTickets: Map<string, MatchmakingTicket> = new Map(); // ticketId -> Ticket
  private playerToTicketMap: Map<string, string> = new Map(); // playerId -> ticketId
  private tableLocks: Set<string> = new Set(); // Concurrency lock per configKey/tableId
  private tableCountdownTimers: Map<string, NodeJS.Timeout[]> = new Map(); // tableId -> timers
  private cleanupInterval?: NodeJS.Timeout;

  private onMatchFound?: MatchFoundCallback;
  private onTableUpdated?: TableUpdateCallback;
  private onPlayerStatus?: PlayerStatusCallback;
  private onCountdownEvent?: CountdownEventCallback;
  private db = DatabaseService.getInstance();

  private readonly RESERVATION_TTL_MS = 60000;
  private readonly HEARTBEAT_TIMEOUT_MS = 35000;
  private readonly RULES_VERSION = '1.0.0';

  // Configurable Matchmaking Parameters
  private maxWaitDurationMs: number = 30000; // Default: 30 seconds
  private acceleratedCountdownMs: number = 5000; // Default: 5 seconds (configurable 3-5s)

  constructor(
    onMatchFound?: MatchFoundCallback,
    onTableUpdated?: TableUpdateCallback,
    onPlayerStatus?: PlayerStatusCallback,
    onCountdownEvent?: CountdownEventCallback,
    options?: MatchmakingOptions
  ) {
    this.onMatchFound = onMatchFound;
    this.onTableUpdated = onTableUpdated;
    this.onPlayerStatus = onPlayerStatus;
    this.onCountdownEvent = onCountdownEvent;

    if (options?.maxWaitDurationSec !== undefined) {
      this.maxWaitDurationMs = options.maxWaitDurationSec * 1000;
    }
    if (options?.acceleratedCountdownSec !== undefined) {
      this.acceleratedCountdownMs = Math.max(3000, Math.min(5000, options.acceleratedCountdownSec * 1000));
    } else if (options?.countdownDurationMs !== undefined) {
      this.acceleratedCountdownMs = options.countdownDurationMs;
    }

    this.startCleanupWorker();
  }

  public setCallbacks(
    onMatchFound: MatchFoundCallback,
    onTableUpdated: TableUpdateCallback,
    onPlayerStatus: PlayerStatusCallback,
    onCountdownEvent?: CountdownEventCallback
  ) {
    this.onMatchFound = onMatchFound;
    this.onTableUpdated = onTableUpdated;
    this.onPlayerStatus = onPlayerStatus;
    if (onCountdownEvent) this.onCountdownEvent = onCountdownEvent;
  }

  public setMaxWaitDurationSec(sec: number) {
    this.maxWaitDurationMs = Math.max(5, sec) * 1000;
  }

  public getMaxWaitDurationSec(): number {
    return Math.round(this.maxWaitDurationMs / 1000);
  }

  public setCountdownDurationMs(ms: number) {
    this.acceleratedCountdownMs = ms;
  }

  public setAcceleratedCountdownSec(sec: number) {
    this.acceleratedCountdownMs = Math.max(3000, Math.min(5000, sec * 1000));
  }

  public getAcceleratedCountdownSec(): number {
    return Math.round(this.acceleratedCountdownMs / 1000);
  }

  /**
   * Deterministic configuration identifier to partition compatible queues
   * Strict matching rule: identical (variant, entryAmount, maxPlayers, rulesVersion)
   */
  public getConfigKey(
    variant: GameVariant,
    entryAmount: number,
    maxPlayers: number,
    pointValue?: number,
    rulesVersion = '1.0.0'
  ): string {
    const pvStr = pointValue !== undefined ? `_pv${pointValue.toFixed(2)}` : '';
    return `${variant}_entry${entryAmount}${pvStr}_${maxPlayers}P_v${rulesVersion}`;
  }

  /**
   * 1. JOIN MATCHMAKING
   * Creates an authoritative ticket, searches for oldest compatible waiting table, and atomically reserves a seat.
   */
  public joinQueue(player: QueuedPlayer): MatchmakingStatusPayload {
    const entryAmount = Number(player.entryAmount) || 50;
    const configId =
      player.configurationId ||
      this.getConfigKey(player.variant, entryAmount, player.maxPlayers, player.pointValue, player.rulesVersion);
    const rulesVersion = player.rulesVersion || this.RULES_VERSION;
    const pointValue = Number(player.pointValue) || (entryAmount / 80);
    const now = Date.now();

    // Check for existing active ticket for this player (Unique player participation)
    const existingTicketId = this.playerToTicketMap.get(player.playerId);
    if (existingTicketId) {
      const existingTicket = this.activeTickets.get(existingTicketId);
      if (
        existingTicket &&
        ['QUEUED', 'RESERVED', 'MATCH_FOUND', 'READY'].includes(existingTicket.ticketStatus)
      ) {
        // Idempotent join: If exact same config, return existing state and refresh socket connection
        if (existingTicket.tableConfigurationId === configId) {
          existingTicket.socketId = player.socketId;
          existingTicket.lastHeartbeatAt = now;
          existingTicket.updatedAt = now;

          const table = existingTicket.currentTableId ? this.waitingTables.get(existingTicket.currentTableId) : undefined;
          let state: MatchmakingUiState = 'SEARCHING';
          if (table) {
            if (table.tableStatus === 'START_COUNTDOWN' || table.tableStatus === 'LOCKED') {
              state = 'START_COUNTDOWN';
            } else if (table.occupiedSeatCount >= table.tableCapacity) {
              state = 'MATCH_FOUND';
            } else {
              state = 'PLAYERS_JOINING';
            }
          }

          return {
            state,
            ticket: existingTicket,
            table: table ? this.formatTablePayload(table, existingTicket.ticketId) : undefined,
            countdownSec: table?.gameStartsAt
              ? Math.max(0, Math.ceil((table.gameStartsAt - now) / 1000))
              : table
              ? Math.max(0, Math.ceil((table.matchmakingDeadline - now) / 1000))
              : undefined,
            gameStartsAt: table?.gameStartsAt,
            matchmakingDeadline: table?.matchmakingDeadline,
            canLeave: table
              ? !(
                  table.tableStatus === 'LOCKED' ||
                  table.tableStatus === 'STARTING' ||
                  table.tableStatus === 'STARTED' ||
                  (table.tableStatus === 'START_COUNTDOWN' && table.gameStartsAt && table.gameStartsAt - now <= 1000)
                )
              : true,
            message: 'Reconnected to active matchmaking ticket',
          };
        } else {
          // Player is queuing for a different game: cancel old ticket first
          this.cancelTicket(existingTicketId, 'Switched game configuration');
        }
      }
    }

    // Create a new Matchmaking Ticket
    const ticketId = `tkt-${now}-${Math.random().toString(36).substring(2, 8)}`;
    const ticket: MatchmakingTicket = {
      ticketId,
      playerId: player.playerId,
      username: player.username,
      avatarUrl: player.avatarUrl,
      socketId: player.socketId,
      gameType: player.variant,
      poolVariant: player.variant.startsWith('POOL') ? (player.variant as any) : null,
      tableCapacity: player.maxPlayers,
      tableConfigurationId: configId,
      pointValue,
      entryAmount,
      rulesVersion,
      queueEnteredAt: now,
      ticketStatus: 'QUEUED',
      currentTableId: null,
      assignedSeatIndex: null,
      reservationExpiry: null,
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.activeTickets.set(ticketId, ticket);
    this.playerToTicketMap.set(player.playerId, ticketId);

    // Persist ticket in DB service
    this.db.saveMatchmakingTicket({
      ticketId: ticket.ticketId,
      playerId: ticket.playerId,
      username: ticket.username,
      socketId: ticket.socketId,
      gameType: ticket.gameType,
      poolVariant: ticket.poolVariant,
      tableCapacity: ticket.tableCapacity,
      tableConfigurationId: ticket.tableConfigurationId,
      pointValue: ticket.pointValue,
      entryAmount: ticket.entryAmount,
      rulesVersion: ticket.rulesVersion,
      ticketStatus: ticket.ticketStatus,
      currentTableId: ticket.currentTableId,
      assignedSeatIndex: ticket.assignedSeatIndex,
      reservationExpiry: ticket.reservationExpiry,
      queueEnteredAt: ticket.queueEnteredAt,
      lastHeartbeatAt: ticket.lastHeartbeatAt,
      createdAt: new Date(ticket.createdAt).toISOString(),
      updatedAt: new Date(ticket.updatedAt).toISOString(),
    });

    this.db.logMatchmakingEvent('TICKET_CREATED', player.playerId, ticketId, undefined, { configId });

    // Acquire atomic partition lock for safe concurrent table allocation
    return this.withLock(configId, () => {
      // Find oldest compatible waiting table or create one
      const { table: waitingTable, isNew } = this.findOrCreateWaitingTable(ticket);

      if (isNew) {
        this.emitRealtimeEvent(waitingTable, 'TABLE_CREATED', {
          message: 'Waiting table created',
        });
      }

      // Atomically allocate an available seat
      const seatIndex = this.allocateSeat(waitingTable, ticket);

      if (seatIndex === -1) {
        // Table filled right before allocation: allocate in a fresh table
        const freshTable = this.createNewWaitingTable(ticket);
        this.emitRealtimeEvent(freshTable, 'TABLE_CREATED', {
          message: 'Waiting table created',
        });
        const freshSeatIndex = this.allocateSeat(freshTable, ticket);
        return this.completeSeatReservation(freshTable, ticket, freshSeatIndex);
      }

      return this.completeSeatReservation(waitingTable, ticket, seatIndex);
    });
  }

  /**
   * Concurrency lock helper (in-process mutex for atomic table/seat allocations)
   */
  private withLock<T>(lockKey: string, fn: () => T): T {
    let retries = 0;
    while (this.tableLocks.has(lockKey) && retries < 50) {
      retries++;
    }
    this.tableLocks.add(lockKey);
    try {
      return fn();
    } finally {
      this.tableLocks.delete(lockKey);
    }
  }

  /**
   * Finds the OLDEST compatible waiting table with open seats, or creates a new one.
   * Requirement 1 & 3: Never unnecessarily create multiple waiting tables for the same configuration.
   */
  private findOrCreateWaitingTable(ticket: MatchmakingTicket): { table: WaitingTable; isNew: boolean } {
    const now = Date.now();
    const candidates: WaitingTable[] = [];

    for (const table of this.waitingTables.values()) {
      if (
        table.tableConfigurationId === ticket.tableConfigurationId &&
        ['WAITING_FOR_PLAYERS', 'WAITING', 'FILLING', 'FILLING_AFTER_LEAVE'].includes(table.tableStatus) &&
        table.occupiedSeatCount < table.tableCapacity &&
        now < table.matchmakingDeadline
      ) {
        candidates.push(table);
      }
    }

    if (candidates.length > 0) {
      // Sort to choose the OLDEST table (earliest createdAt)
      candidates.sort((a, b) => a.createdAt - b.createdAt);
      return { table: candidates[0], isNew: false };
    }

    return { table: this.createNewWaitingTable(ticket), isNew: true };
  }

  /**
   * Initializes a fresh WaitingTable with server-authoritative maximum waiting deadline
   * Requirement 4: The timer begins when the first player successfully occupies the table.
   */
  private createNewWaitingTable(ticket: MatchmakingTicket): WaitingTable {
    const now = Date.now();
    const tableId = `tbl-wait-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const seats: WaitingSeat[] = Array.from({ length: ticket.tableCapacity }, (_, i) => ({
      seatIndex: i,
      playerId: null,
      username: null,
      avatarUrl: null,
      isOccupied: false,
      reservedAt: null,
    }));

    const waitingTable: WaitingTable = {
      tableId,
      gameType: ticket.gameType,
      poolVariant: ticket.poolVariant,
      tableCapacity: ticket.tableCapacity,
      pointValue: ticket.pointValue,
      entryAmount: ticket.entryAmount || 50,
      tableConfigurationId: ticket.tableConfigurationId,
      rulesVersion: ticket.rulesVersion,
      occupiedSeatCount: 0,
      tableStatus: 'WAITING_FOR_PLAYERS',
      seats,
      createdAt: now,
      lastActivityAt: now,
      matchmakingDeadline: now + this.maxWaitDurationMs, // Authoritative maximum waiting deadline
      gameStartsAt: null,
      lockedAt: null,
      revision: 1,
    };

    this.waitingTables.set(tableId, waitingTable);

    // Save to DB
    this.db.saveWaitingTable({
      tableId: waitingTable.tableId,
      gameType: waitingTable.gameType,
      poolVariant: waitingTable.poolVariant,
      tableCapacity: waitingTable.tableCapacity,
      pointValue: waitingTable.pointValue,
      entryAmount: waitingTable.entryAmount,
      tableConfigurationId: waitingTable.tableConfigurationId,
      rulesVersion: waitingTable.rulesVersion,
      occupiedSeatCount: 0,
      tableStatus: 'WAITING_FOR_PLAYERS',
      lockedAt: null,
      createdAt: new Date(waitingTable.createdAt).toISOString(),
      lastActivityAt: waitingTable.lastActivityAt,
    });

    return waitingTable;
  }

  /**
   * Atomically claims an empty seat index in the waiting table
   */
  private allocateSeat(table: WaitingTable, ticket: MatchmakingTicket): number {
    if (table.occupiedSeatCount >= table.tableCapacity) {
      return -1;
    }

    for (let i = 0; i < table.seats.length; i++) {
      if (!table.seats[i].isOccupied) {
        table.seats[i] = {
          seatIndex: i,
          playerId: ticket.playerId,
          username: ticket.username,
          avatarUrl: ticket.avatarUrl,
          isOccupied: true,
          reservedAt: Date.now(),
        };
        table.occupiedSeatCount++;
        // State update: FULL if at capacity, else WAITING_FOR_PLAYERS
        table.tableStatus = table.occupiedSeatCount >= table.tableCapacity ? 'FULL' : 'WAITING_FOR_PLAYERS';
        table.lastActivityAt = Date.now();
        table.revision = (table.revision || 1) + 1;
        return i;
      }
    }

    return -1;
  }

  /**
   * Finalizes seat reservation, emits real-time events, and triggers accelerated countdown if full
   */
  private completeSeatReservation(
    table: WaitingTable,
    ticket: MatchmakingTicket,
    seatIndex: number
  ): MatchmakingStatusPayload {
    const now = Date.now();
    ticket.ticketStatus = 'RESERVED';
    ticket.currentTableId = table.tableId;
    ticket.assignedSeatIndex = seatIndex;
    ticket.reservationExpiry = now + this.RESERVATION_TTL_MS;
    ticket.updatedAt = now;

    // Record seat reservation in DB
    this.db.saveSeatReservation({
      reservationId: `res-${now}-${ticket.playerId}`,
      tableId: table.tableId,
      ticketId: ticket.ticketId,
      playerId: ticket.playerId,
      seatIndex,
      status: 'RESERVED',
      reservedAt: now,
      expiresAt: ticket.reservationExpiry,
    });

    this.db.logMatchmakingEvent('SEAT_RESERVED', ticket.playerId, ticket.ticketId, table.tableId, {
      seatIndex,
      occupiedCount: table.occupiedSeatCount,
      tableCapacity: table.tableCapacity,
    });

    // Publish TABLE_PLAYER_JOINED and TABLE_CAPACITY_UPDATED
    this.emitRealtimeEvent(table, 'TABLE_PLAYER_JOINED', {
      player: {
        playerId: ticket.playerId,
        username: ticket.username,
        avatarUrl: ticket.avatarUrl,
        seatIndex,
      },
      message: `${ticket.username} joined seat ${seatIndex + 1}`,
    });

    this.emitRealtimeEvent(table, 'TABLE_CAPACITY_UPDATED', {
      message: `Table capacity updated: ${table.occupiedSeatCount}/${table.tableCapacity}`,
    });

    // Broadcast table updated to all currently reserved players in this table
    this.broadcastTableUpdate(table);

    // Requirement 5: FULL-TABLE ACCELERATED COUNTDOWN
    if (table.occupiedSeatCount >= table.tableCapacity) {
      if (this.acceleratedCountdownMs === 0) {
        this.launchGame(table);
        return {
          state: 'STARTED',
          ticket,
          table: this.formatTablePayload(table, ticket.ticketId),
          message: 'Match confirmed and game starting',
          canLeave: false,
        };
      }

      this.initiateStartCountdown(table);
      const countdownSec = Math.ceil(this.acceleratedCountdownMs / 1000);

      return {
        state: 'START_COUNTDOWN',
        ticket,
        table: this.formatTablePayload(table, ticket.ticketId),
        countdownSec,
        gameStartsAt: table.gameStartsAt,
        matchmakingDeadline: table.matchmakingDeadline,
        canLeave: true,
        message: `Table full! Game starting in ${countdownSec} seconds...`,
      };
    }

    const remainingSec = Math.max(0, Math.ceil((table.matchmakingDeadline - now) / 1000));
    return {
      state: 'PLAYERS_JOINING',
      ticket,
      table: this.formatTablePayload(table, ticket.ticketId),
      countdownSec: remainingSec,
      matchmakingDeadline: table.matchmakingDeadline,
      canLeave: true,
      message: `Seat ${seatIndex + 1} reserved. Waiting for opponents... (${table.occupiedSeatCount}/${table.tableCapacity})`,
    };
  }

  /**
   * Requirement 5: Accelerated game-start countdown
   * 1. Cancel maximum waiting timer.
   * 2. Lock further seat allocation.
   * 3. Change table status to FULL then START_COUNTDOWN.
   * 4. Start accelerated countdown (default 5s, configurable 3-5s).
   * 5. Notify all seated players with synchronized countdown.
   * 6. Does NOT wait for remaining maximum waiting period.
   */
  private initiateStartCountdown(table: WaitingTable) {
    const now = Date.now();
    table.tableStatus = 'START_COUNTDOWN';
    table.gameStartsAt = now + this.acceleratedCountdownMs;
    table.lockedAt = null;
    table.revision = (table.revision || 1) + 1;

    // Clear any existing timers for this table
    const existing = this.tableCountdownTimers.get(table.tableId);
    if (existing) {
      existing.forEach((t) => clearTimeout(t));
      this.tableCountdownTimers.delete(table.tableId);
    }

    const totalSec = Math.ceil(this.acceleratedCountdownMs / 1000);

    // Publish TABLE_FULL and START_COUNTDOWN_STARTED
    this.emitRealtimeEvent(table, 'TABLE_FULL', {
      message: `Table is full (${table.occupiedSeatCount}/${table.tableCapacity})`,
    });

    this.emitRealtimeEvent(table, 'START_COUNTDOWN_STARTED', {
      countdownSec: totalSec,
      applicableDeadline: table.gameStartsAt,
      message: `Game starting in ${totalSec} seconds...`,
    });

    // Schedule 1-second ticks
    const timers: NodeJS.Timeout[] = [];
    for (let sec = totalSec - 1; sec >= 1; sec--) {
      const delayMs = (totalSec - sec) * 1000;
      const t = setTimeout(() => {
        if (table.tableStatus !== 'START_COUNTDOWN' && table.tableStatus !== 'LOCKED') return;

        // At 1s remaining: Lock final boundary (immutability)
        if (sec <= 1) {
          table.tableStatus = 'LOCKED';
          table.lockedAt = Date.now();
          this.emitRealtimeEvent(table, 'START_COUNTDOWN_UPDATED', {
            countdownSec: sec,
            applicableDeadline: table.gameStartsAt,
            message: 'Participant list locked! Starting game...',
          });
        } else {
          this.emitRealtimeEvent(table, 'START_COUNTDOWN_UPDATED', {
            countdownSec: sec,
            applicableDeadline: table.gameStartsAt,
            message: `Game starting in ${sec} seconds...`,
          });
        }
      }, delayMs);
      timers.push(t);
    }

    // Launch game at 0s
    const launch = setTimeout(() => {
      if (table.tableStatus !== 'START_COUNTDOWN' && table.tableStatus !== 'LOCKED') return;
      this.launchGame(table);
    }, this.acceleratedCountdownMs);
    timers.push(launch);

    this.tableCountdownTimers.set(table.tableId, timers);
  }

  /**
   * Requirement 8: Cancel countdown when a player leaves before 1s boundary
   * Cancels accelerated countdown, reverts table status to WAITING_FOR_PLAYERS,
   * resumes waiting with original matchmakingDeadline.
   */
  private cancelStartCountdown(table: WaitingTable, reason: string) {
    const timers = this.tableCountdownTimers.get(table.tableId);
    if (timers) {
      timers.forEach((t) => clearTimeout(t));
      this.tableCountdownTimers.delete(table.tableId);
    }

    table.gameStartsAt = null;
    const now = Date.now();

    // Check if the original maximum waiting deadline has expired
    if (now >= table.matchmakingDeadline) {
      this.expireWaitingTable(table, 'Matchmaking deadline expired after player departure');
    } else {
      table.tableStatus = 'WAITING_FOR_PLAYERS';
      table.lastActivityAt = now;
      table.revision = (table.revision || 1) + 1;

      const remainingSec = Math.max(0, Math.ceil((table.matchmakingDeadline - now) / 1000));

      this.emitRealtimeEvent(table, 'START_COUNTDOWN_CANCELLED', {
        countdownSec: remainingSec,
        applicableDeadline: table.matchmakingDeadline,
        message: `${reason}. Countdown cancelled. Resuming wait (${remainingSec}s remaining)...`,
      });

      this.broadcastTableUpdate(table);
    }
  }

  /**
   * Launch game session once countdown completes cleanly at zero.
   * Concurrency Protection: Only one server worker may successfully transition to STARTING.
   */
  private launchGame(table: WaitingTable) {
    // Atomic state guard against race conditions
    if (table.tableStatus !== 'START_COUNTDOWN' && table.tableStatus !== 'FULL' && table.tableStatus !== 'LOCKED') {
      return;
    }
    table.tableStatus = 'STARTING';
    const now = Date.now();

    const matchedPlayers: {
      playerId: string;
      username: string;
      avatarUrl: string;
      socketId: string;
      seatIndex: number;
    }[] = [];

    // Revalidate all seats before launching
    for (const seat of table.seats) {
      if (!seat.isOccupied || !seat.playerId) {
        table.tableStatus = 'WAITING_FOR_PLAYERS';
        return;
      }
      const tId = this.playerToTicketMap.get(seat.playerId);
      const ticket = tId ? this.activeTickets.get(tId) : undefined;
      if (!ticket || ticket.ticketStatus === 'CANCELLED' || ticket.ticketStatus === 'EXPIRED') {
        table.tableStatus = 'WAITING_FOR_PLAYERS';
        return;
      }
      matchedPlayers.push({
        playerId: ticket.playerId,
        username: ticket.username,
        avatarUrl: ticket.avatarUrl,
        socketId: ticket.socketId,
        seatIndex: seat.seatIndex,
      });
    }

    // Publish GAME_STARTING
    this.emitRealtimeEvent(table, 'GAME_STARTING', {
      countdownSec: 0,
      applicableDeadline: now,
      message: 'All players verified. Initializing table...',
    });

    // Build TableConfig matching authoritative parameters for Points or Pool formats (Pool 101, 201, 240)
    const gameTableId = `tbl-game-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const isPool240 = table.gameType === 'POOL_240' || (table.gameType as string) === 'POINTS_240';
    const config: TableConfig = {
      tableId: gameTableId,
      variant: table.gameType,
      entryAmount: table.entryAmount || 50,
      pointValue: table.pointValue,
      maxPlayers: table.tableCapacity,
      turnDurationSec: 30,
      extraTimeSec: 15,
      firstDropPenalty: 20,
      middleDropPenalty: 40,
      wrongShowPenalty: 80,
      consecutiveTimeoutDrop: 3,
      maxScoreCap: 80,
      pointsOutThreshold: isPool240 ? 240 : undefined,
      winningThreshold: isPool240 ? 241 : undefined,
      poolEliminationLimit: isPool240 ? 240 : table.gameType === 'POOL_101' ? 101 : table.gameType === 'POOL_201' ? 201 : 0,
      deckCount: 2,
      printedJokersPerDeck: 2,
    };

    // Transition tickets to STARTED
    for (const p of matchedPlayers) {
      const tId = this.playerToTicketMap.get(p.playerId);
      const t = tId ? this.activeTickets.get(tId) : undefined;
      if (t) {
        t.ticketStatus = 'STARTED';
        t.currentTableId = gameTableId;
      }
    }

    table.tableStatus = 'IN_PROGRESS';
    table.startedAt = now;

    // Publish GAME_STARTED
    this.emitRealtimeEvent(table, 'GAME_STARTED', {
      countdownSec: 0,
      applicableDeadline: now,
      message: 'Deal 1 starting!',
    });

    // Invoke match callback to create game table session and join sockets
    if (this.onMatchFound) {
      this.onMatchFound(config, matchedPlayers);
    }

    this.waitingTables.delete(table.tableId);
    this.tableCountdownTimers.delete(table.tableId);
  }

  /**
   * Requirement 7: Partial Table Expiry
   * Never silently starts an underfilled table. Releases seats, cancels tickets, and notifies players.
   */
  public expireWaitingTable(table: WaitingTable, message = 'Unable to find enough players. Please try again.') {
    table.tableStatus = 'EXPIRED';

    const timers = this.tableCountdownTimers.get(table.tableId);
    if (timers) {
      timers.forEach((t) => clearTimeout(t));
      this.tableCountdownTimers.delete(table.tableId);
    }

    // Publish TABLE_EXPIRED
    this.emitRealtimeEvent(table, 'TABLE_EXPIRED', {
      message,
    });

    for (const seat of table.seats) {
      if (seat.isOccupied && seat.playerId) {
        const tId = this.playerToTicketMap.get(seat.playerId);
        const ticket = tId ? this.activeTickets.get(tId) : undefined;
        if (ticket) {
          ticket.ticketStatus = 'EXPIRED';
          this.playerToTicketMap.delete(seat.playerId);
          this.db.updateTicketStatus(ticket.ticketId, 'EXPIRED');
          if (this.onPlayerStatus && ticket.socketId) {
            this.onPlayerStatus(ticket.socketId, {
              state: 'EXPIRED',
              ticket,
              message,
              canLeave: true,
            });
          }
        }
      }
    }

    this.waitingTables.delete(table.tableId);
  }

  /**
   * Requirement 12: Standardized Real-Time Event Publisher
   * Dispatches events with tableId, eventId, serverTimestamp, stateVersion, counts, state, and applicableDeadline.
   */
  private emitRealtimeEvent(
    table: WaitingTable,
    eventName: string,
    extra: Partial<TableRealtimeEventPayload> = {}
  ) {
    const now = Date.now();
    const eventPayload: TableRealtimeEventPayload = {
      tableId: table.tableId,
      eventId: `evt-${now}-${Math.random().toString(36).substring(2, 7)}`,
      serverTimestamp: now,
      stateVersion: table.revision || 1,
      occupiedSeatCount: table.occupiedSeatCount,
      requiredPlayerCount: table.tableCapacity,
      currentTableState: table.tableStatus,
      applicableDeadline: extra.applicableDeadline !== undefined ? extra.applicableDeadline : table.gameStartsAt || table.matchmakingDeadline,
      seats: table.seats,
      gameType: table.gameType,
      entryAmount: table.entryAmount,
      pointValue: table.pointValue,
      ...extra,
    };

    const targetSocketIds: string[] = [];
    for (const seat of table.seats) {
      if (seat.isOccupied && seat.playerId) {
        const tId = this.playerToTicketMap.get(seat.playerId);
        if (tId) {
          const t = this.activeTickets.get(tId);
          if (t?.socketId) {
            targetSocketIds.push(t.socketId);
            if (this.onPlayerStatus) {
              this.onPlayerStatus(t.socketId, {
                state:
                  table.tableStatus === 'LOCKED'
                    ? 'LOCKED'
                    : table.tableStatus === 'STARTING' || table.tableStatus === 'IN_PROGRESS' || table.tableStatus === 'STARTED'
                    ? 'STARTED'
                    : table.tableStatus === 'START_COUNTDOWN'
                    ? 'START_COUNTDOWN'
                    : table.tableStatus === 'EXPIRED'
                    ? 'EXPIRED'
                    : table.tableStatus === 'CANCELLED'
                    ? 'CANCELLED'
                    : 'PLAYERS_JOINING',
                ticket: t,
                table: this.formatTablePayload(table, t.ticketId),
                countdownSec: eventPayload.countdownSec ?? undefined,
                gameStartsAt: table.gameStartsAt,
                matchmakingDeadline: table.matchmakingDeadline,
                canLeave: !(
                  table.tableStatus === 'LOCKED' ||
                  table.tableStatus === 'STARTING' ||
                  table.tableStatus === 'IN_PROGRESS' ||
                  table.tableStatus === 'STARTED'
                ),
                message: eventPayload.message,
              });
            }
          }
        }
      }
    }

    if (this.onCountdownEvent && targetSocketIds.length > 0) {
      // Emit uppercase standard event (e.g. TABLE_PLAYER_JOINED)
      this.onCountdownEvent(targetSocketIds, eventName, eventPayload);
      // Emit lowercase alias for backwards compatibility (e.g. table:player_joined)
      const lowerAlias = `table:${eventName.toLowerCase().replace(/^table_/, '').replace(/^start_/, '')}`;
      this.onCountdownEvent(targetSocketIds, lowerAlias, eventPayload);
    }
  }

  /**
   * Broadcasts table state updates to all seated players
   */
  private broadcastTableUpdate(table: WaitingTable) {
    if (!this.onTableUpdated) return;

    const targetSocketIds: string[] = [];
    for (const seat of table.seats) {
      if (seat.isOccupied && seat.playerId) {
        const tId = this.playerToTicketMap.get(seat.playerId);
        if (tId) {
          const t = this.activeTickets.get(tId);
          if (t?.socketId) {
            targetSocketIds.push(t.socketId);
          }
        }
      }
    }

    if (targetSocketIds.length > 0) {
      const payload = this.formatTablePayload(table, '');
      this.onTableUpdated(table.tableId, payload, targetSocketIds);
    }
  }

  /**
   * Formats waiting table payload with revision and timestamps
   */
  public formatTablePayload(table: WaitingTable, viewerTicketId: string): MatchmakingTableUpdatedPayload {
    const now = Date.now();
    const canLeave = !(
      table.tableStatus === 'LOCKED' ||
      table.tableStatus === 'STARTING' ||
      table.tableStatus === 'IN_PROGRESS' ||
      table.tableStatus === 'STARTED' ||
      (table.tableStatus === 'START_COUNTDOWN' && table.gameStartsAt && table.gameStartsAt - now <= 1000)
    );

    let countdownSec: number | undefined;
    if (table.gameStartsAt && (table.tableStatus === 'START_COUNTDOWN' || table.tableStatus === 'LOCKED')) {
      countdownSec = Math.max(0, Math.ceil((table.gameStartsAt - now) / 1000));
    } else if (table.matchmakingDeadline) {
      countdownSec = Math.max(0, Math.ceil((table.matchmakingDeadline - now) / 1000));
    }

    return {
      ticketId: viewerTicketId,
      tableId: table.tableId,
      gameType: table.gameType,
      poolVariant: table.poolVariant,
      tableCapacity: table.tableCapacity,
      pointValue: table.pointValue,
      entryAmount: table.entryAmount || 50,
      occupiedSeatCount: table.occupiedSeatCount,
      seats: table.seats.map((s) => ({
        ...s,
        isMe: false,
      })),
      tableStatus: table.tableStatus,
      revision: table.revision || Date.now(),
      serverTimestamp: now,
      matchmakingDeadline: table.matchmakingDeadline,
      gameStartsAt: table.gameStartsAt,
      countdownSec,
      canLeave,
    };
  }

  /**
   * 3. PLAYER CANCELLATION & LEAVE RESTRICTION
   * Requirement 8: Allows eligible players to leave, releases seat, updates count, and resumes original wait.
   * If table was in countdown, cancels countdown and reverts to WAITING_FOR_PLAYERS.
   */
  public cancelTicket(ticketId: string, reason = 'Player cancelled'): MatchmakingStatusPayload {
    const ticket = this.activeTickets.get(ticketId);
    if (!ticket) {
      return { state: 'CANCELLED', message: 'Ticket already cancelled or does not exist' };
    }

    if (ticket.ticketStatus === 'STARTED') {
      return {
        state: 'STARTED',
        ticket,
        error: 'Cannot cancel ticket: match has already started',
        canLeave: false,
      };
    }

    // Check if waiting table is in locked countdown
    if (ticket.currentTableId) {
      const table = this.waitingTables.get(ticket.currentTableId);
      if (table) {
        const now = Date.now();
        const isLocked =
          table.tableStatus === 'LOCKED' ||
          table.tableStatus === 'STARTING' ||
          table.tableStatus === 'IN_PROGRESS' ||
          table.tableStatus === 'STARTED' ||
          (table.tableStatus === 'START_COUNTDOWN' && table.gameStartsAt && table.gameStartsAt - now <= 1000);

        if (isLocked) {
          return {
            state: 'LOCKED',
            ticket,
            error: 'Leave rejected: table is locked for game launch (1 second or less remaining)',
            canLeave: false,
          };
        }

        // Allowed leave during countdown (>1s remains): cancel countdown & resume waiting
        if (table.tableStatus === 'START_COUNTDOWN' || table.tableStatus === 'FULL') {
          this.cancelStartCountdown(table, `${ticket.username} left the table`);
        }

        // Release player seat
        const seat = table.seats.find((s) => s.playerId === ticket.playerId);
        const seatIdx = seat ? seat.seatIndex : -1;
        if (seat) {
          seat.isOccupied = false;
          seat.playerId = null;
          seat.username = null;
          seat.avatarUrl = null;
          seat.reservedAt = null;
          table.occupiedSeatCount = Math.max(0, table.occupiedSeatCount - 1);
          table.tableStatus = 'WAITING_FOR_PLAYERS';
          table.lastActivityAt = now;
          table.revision = (table.revision || 1) + 1;

          this.emitRealtimeEvent(table, 'TABLE_PLAYER_LEFT', {
            player: {
              playerId: ticket.playerId,
              username: ticket.username,
              seatIndex: seatIdx,
            },
            message: `${ticket.username} left the table`,
          });

          this.emitRealtimeEvent(table, 'TABLE_CAPACITY_UPDATED', {
            message: `Table capacity updated: ${table.occupiedSeatCount}/${table.tableCapacity}`,
          });

          if (table.occupiedSeatCount === 0) {
            this.waitingTables.delete(table.tableId);
          } else {
            this.broadcastTableUpdate(table);
          }
        }
      }
    }

    const previousStatus = ticket.ticketStatus;
    ticket.ticketStatus = 'CANCELLED';
    ticket.updatedAt = Date.now();
    this.playerToTicketMap.delete(ticket.playerId);

    this.db.updateTicketStatus(ticketId, 'CANCELLED');
    this.db.logMatchmakingEvent('TICKET_CANCELLED', ticket.playerId, ticketId, ticket.currentTableId || undefined, {
      reason,
      previousStatus,
    });

    return {
      state: 'CANCELLED',
      ticket,
      message: 'Matchmaking successfully cancelled',
      canLeave: true,
    };
  }

  /**
   * Leave queue helper by playerId
   */
  public leaveQueue(playerId: string): boolean {
    const ticketId = this.playerToTicketMap.get(playerId);
    if (!ticketId) return false;
    const res = this.cancelTicket(ticketId, 'Player left queue');
    return res.state === 'CANCELLED';
  }

  /**
   * 4. HEARTBEAT & PRESENCE
   */
  public heartbeat(ticketId: string): boolean {
    const ticket = this.activeTickets.get(ticketId);
    if (!ticket || ['CANCELLED', 'EXPIRED', 'FAILED'].includes(ticket.ticketStatus)) {
      return false;
    }
    ticket.lastHeartbeatAt = Date.now();
    ticket.updatedAt = Date.now();
    return true;
  }

  /**
   * 5. RECONNECTION
   * Re-associates a reconnected socket with their active reservation
   */
  public hasWaitingSeat(playerId: string): boolean {
    const ticketId = this.playerToTicketMap.get(playerId);
    const ticket = ticketId ? this.activeTickets.get(ticketId) : undefined;
    return ticket?.ticketStatus === 'QUEUED' || ticket?.ticketStatus === 'RESERVED';
  }

  public reconnectPlayer(playerId: string, newSocketId: string): MatchmakingStatusPayload {
    const ticketId = this.playerToTicketMap.get(playerId);
    if (!ticketId) {
      return {
        state: 'IDLE',
        message: 'No active matchmaking session found',
      };
    }

    const ticket = this.activeTickets.get(ticketId);
    if (!ticket || ['CANCELLED', 'EXPIRED', 'FAILED'].includes(ticket.ticketStatus)) {
      this.playerToTicketMap.delete(playerId);
      return {
        state: 'EXPIRED',
        message: 'Matchmaking ticket expired. Please join a new table.',
      };
    }

    if (ticket.ticketStatus === 'STARTED') return { state: 'IDLE', message: 'Matchmaking has finished' };

    ticket.socketId = newSocketId;
    ticket.lastHeartbeatAt = Date.now();
    ticket.updatedAt = Date.now();

    const table = ticket.currentTableId ? this.waitingTables.get(ticket.currentTableId) : undefined;
    const now = Date.now();

    let state: MatchmakingUiState = 'SEARCHING';
    if (table) {
      if (table.tableStatus === 'START_COUNTDOWN' || table.tableStatus === 'LOCKED') {
        state = 'START_COUNTDOWN';
      } else if (table.occupiedSeatCount >= table.tableCapacity) {
        state = 'MATCH_FOUND';
      } else {
        state = 'PLAYERS_JOINING';
      }
    }

    const canLeave = table
      ? !(
          table.tableStatus === 'LOCKED' ||
          table.tableStatus === 'STARTING' ||
          table.tableStatus === 'IN_PROGRESS' ||
          table.tableStatus === 'STARTED' ||
          (table.tableStatus === 'START_COUNTDOWN' && table.gameStartsAt && table.gameStartsAt - now <= 1000)
        )
      : true;

    return {
      state,
      ticket,
      table: table ? this.formatTablePayload(table, ticket.ticketId) : undefined,
      countdownSec: table?.gameStartsAt
        ? Math.max(0, Math.ceil((table.gameStartsAt - now) / 1000))
        : table
        ? Math.max(0, Math.ceil((table.matchmakingDeadline - now) / 1000))
        : undefined,
      gameStartsAt: table?.gameStartsAt,
      matchmakingDeadline: table?.matchmakingDeadline,
      canLeave,
      message: 'Reconnected to matchmaking session',
    };
  }

  /**
   * Request Table Status query (Requirement 12: REQUEST_TABLE_STATUS)
   */
  public getTableStatus(tableId: string): WaitingTable | undefined {
    return this.waitingTables.get(tableId);
  }

  /**
   * 6. BACKGROUND CLEANUP WORKER
   * Periodically purges abandoned tickets and checks table timeouts
   */
  private startCleanupWorker() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleRecords();
    }, 1000);
  }

  public cleanupStaleRecords(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [ticketId, ticket] of this.activeTickets.entries()) {
      if (['QUEUED', 'RESERVED'].includes(ticket.ticketStatus)) {
        const isHeartbeatExpired = now - ticket.lastHeartbeatAt > this.HEARTBEAT_TIMEOUT_MS;
        const isReservationExpired = ticket.reservationExpiry && now > ticket.reservationExpiry;

        if (isHeartbeatExpired || isReservationExpired) {
          this.cancelTicket(ticketId, 'Heartbeat or reservation timed out');
          ticket.ticketStatus = 'EXPIRED';
          this.db.updateTicketStatus(ticketId, 'EXPIRED');
          cleanedCount++;
        }
      }
    }

    // Check waiting tables for maximum waiting deadline timeout (Requirement 7)
    for (const [tableId, table] of this.waitingTables.entries()) {
      if (
        ['WAITING', 'FILLING', 'WAITING_FOR_PLAYERS', 'FILLING_AFTER_LEAVE'].includes(table.tableStatus)
      ) {
        if (now >= table.matchmakingDeadline) {
          this.expireWaitingTable(table, 'Unable to find enough players within maximum waiting time. Please try again.');
          cleanedCount++;
        }
      } else if (table.occupiedSeatCount === 0 && now - table.lastActivityAt > 180000) {
        this.waitingTables.delete(tableId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  public stopCleanupWorker() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 7. OBSERVABILITY & ADMIN METRICS
   */
  public getMatchmakingStats() {
    const now = Date.now();
    const activeWaitingTables = Array.from(this.waitingTables.values()).map((t) => ({
      tableId: t.tableId,
      configKey: t.tableConfigurationId,
      variant: t.gameType,
      entryAmount: t.entryAmount,
      pointValue: t.pointValue,
      capacity: t.tableCapacity,
      occupied: t.occupiedSeatCount,
      status: t.tableStatus,
      remainingSec: Math.max(0, Math.ceil((t.matchmakingDeadline - now) / 1000)),
      countdownSec: t.gameStartsAt ? Math.max(0, Math.ceil((t.gameStartsAt - now) / 1000)) : null,
      isLocked:
        t.tableStatus === 'LOCKED' ||
        (t.tableStatus === 'START_COUNTDOWN' && t.gameStartsAt ? t.gameStartsAt - now <= 1000 : false),
      seats: t.seats.map((s) => ({
        seatIndex: s.seatIndex,
        isOccupied: s.isOccupied,
        username: s.username,
      })),
    }));

    const totalActiveTickets = Array.from(this.activeTickets.values()).filter((t) =>
      ['QUEUED', 'RESERVED', 'MATCH_FOUND'].includes(t.ticketStatus)
    ).length;

    const ticketsByStatus = {
      QUEUED: 0,
      RESERVED: 0,
      MATCH_FOUND: 0,
      STARTED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    };

    for (const t of this.activeTickets.values()) {
      if (t.ticketStatus in ticketsByStatus) {
        ticketsByStatus[t.ticketStatus as keyof typeof ticketsByStatus]++;
      }
    }

    return {
      activeWaitingTablesCount: this.waitingTables.size,
      activeWaitingTables,
      totalActiveTickets,
      ticketsByStatus,
      timestamp: new Date().toISOString(),
    };
  }

  public getWaitingTablesList(): WaitingTable[] {
    return Array.from(this.waitingTables.values());
  }

  public getActiveTicket(ticketId: string): MatchmakingTicket | undefined {
    return this.activeTickets.get(ticketId);
  }
}
