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
      // Pool 101 or 201
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

    const timeoutMs = session.config.turnDurationSec * 1000;

    session.timerHandle = setTimeout(() => {
      this.handlePlayerTimeout(session.tableId, activePlayer.playerId);
    }, timeoutMs);
  }

  private handlePlayerTimeout(tableId: string, playerId: string) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) return;

    try {
      session.pointsEngine.handleTimeout(playerId);

      if (session.pointsEngine.tableStatus === 'DEAL_OVER') {
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

    const dropType = session.pointsEngine.drop(playerId);
    session.lastActionAt = Date.now();

    if (session.pointsEngine.tableStatus === 'DEAL_OVER') {
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

    const result = session.pointsEngine.declareHand(playerId, finishCardId, groups);
    session.lastActionAt = Date.now();

    if (session.pointsEngine.tableStatus === 'DEAL_OVER') {
      this.handleDealOver(session);
    } else {
      this.resetTurnTimer(session);
      this.broadcastState(session);
    }

    return result;
  }

  /**
   * Player custom groups update
   */
  public handleGroupCards(tableId: string, playerId: string, groups: CardGroup[]) {
    const session = this.activeTables.get(tableId);
    if (!session || !session.pointsEngine) return;

    const player = session.pointsEngine.players.find((p) => p.playerId === playerId);
    if (player) {
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

    const dealResult = session.pointsEngine!.completedDealResult!;

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

        this.broadcastState(session);
        if (this.onEmitEvent) {
          this.onEmitEvent(session.tableId, 'game:completed', {
            dealResult: poolConclusion.dealResult,
            finalResult: poolConclusion.finalResult,
          });
        }
      } else {
        // Prepare next deal after 15-second results & scoreboard break
        const nextRoundStartsAt = Date.now() + 15000;
        session.pointsEngine!.nextRoundStartsAt = nextRoundStartsAt;
        this.broadcastState(session);

        if (this.onEmitEvent) {
          this.onEmitEvent(session.tableId, 'game:deal_ended', {
            dealResult: poolConclusion.dealResult,
            nextRoundStartsAt,
            nextDealInSec: 15,
          });
        }

        setTimeout(() => {
          if (this.activeTables.has(session.tableId)) {
            session.poolEngine!.startNextDeal();
            session.pointsEngine = session.poolEngine!.currentDealEngine!;
            session.pointsEngine.nextRoundStartsAt = null;
            this.resetTurnTimer(session);
            this.broadcastState(session);
          }
        }, 15000);
      }
    }
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
  public handlePlayerReconnect(playerId: string, newSocketId: string): GameTableSession | null {
    const tableId = this.playerToTableMap.get(playerId);
    if (!tableId) return null;

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
