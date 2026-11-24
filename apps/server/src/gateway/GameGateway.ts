import { Server as SocketIOServer, Socket } from 'socket.io';
import { DatabaseService } from '../db/schema';
import { AuthService } from '../auth/AuthService';
import { MatchmakingService, QueuedPlayer } from '../matchmaking/MatchmakingService';
import { GameTableSession, TableManager } from '../table/TableManager';

export class GameGateway {
  private guestKeys = new Map<string, string>();
  private io: SocketIOServer;
  private authService: AuthService;
  private matchmakingService: MatchmakingService;
  private tableManager: TableManager;

  constructor(
    io: SocketIOServer,
    authService: AuthService,
    matchmakingService: MatchmakingService,
    tableManager: TableManager
  ) {
    this.io = io;
    this.authService = authService;
    this.matchmakingService = matchmakingService;
    this.tableManager = tableManager;

    this.setupTableCallbacks();
    this.setupSocketHandlers();
  }

  private setupTableCallbacks() {
    this.tableManager.setCallbacks(
      (tableId: string, session: GameTableSession) => {
        this.broadcastTableState(tableId, session);
      },
      (tableId: string, event: string, data: any, targetSocketId?: string) => {
        if (targetSocketId) {
          this.io.to(targetSocketId).emit(event, data);
        } else {
          this.io.to(`table:${tableId}`).emit(event, data);
        }
      }
    );

    this.matchmakingService.setCallbacks(
      // 1. onMatchFound
      (config, players) => {
        const session = this.tableManager.createTable(
          config,
          players.map((p) => ({
            playerId: p.playerId,
            username: p.username,
            avatarUrl: p.avatarUrl,
            socketId: p.socketId,
          }))
        );

        // Join sockets into the room & transition them into game
        for (const p of players) {
          const socket = this.io.sockets.sockets.get(p.socketId);
          if (socket) {
            socket.join(`table:${config.tableId}`);
            socket.emit('matchmaking:started', { tableId: config.tableId, config });
            socket.emit('table:joined', { tableId: config.tableId, config });
          }
        }

        // Initial broadcast
        this.broadcastTableState(config.tableId, session);
      },
      // 2. onTableUpdated: real-time seat occupancy update
      (tableId, payload, targetSocketIds) => {
        for (const socketId of targetSocketIds) {
          this.io.to(socketId).emit('matchmaking:table_updated', payload);
        }
      },
      // 3. onPlayerStatus: individual player state update
      (socketId, payload) => {
        this.io.to(socketId).emit('matchmaking:status', payload);
      },
      // 4. onCountdownEvent: countdown starts, ticks, leave_locked, cancelled
      (targetSocketIds, event, data) => {
        for (const socketId of targetSocketIds) {
          this.io.to(socketId).emit(event, data);
        }
      }
    );
  }

  /**
   * Securely broadcasts state to all players.
   * Public table state sent to room; private hands sent ONLY to the individual player's socket!
   */
  private broadcastTableState(tableId: string, session: GameTableSession) {
    if (!session.pointsEngine) return;

    const publicState = session.pointsEngine.getPublicState();
    this.io.to(`table:${tableId}`).emit('game:state', publicState);

    // Private hand dispatched to each player individually
    for (const player of session.players) {
      if (player.isOnline && player.socketId) {
        const privateState = session.pointsEngine.getPrivateStateForPlayer(player.playerId);
        this.io.to(player.socketId).emit('game:my_hand', {
          myHand: privateState.myHand,
          myGroups: privateState.myGroups,
        });
      }
    }
  }

  private setupSocketHandlers() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
          // Allow guest token for dev/testing
          const guestId = (socket.handshake.auth?.playerId as string) || `guest-${socket.id.substring(0, 5)}`;
          if (DatabaseService.getInstance().findUserById(guestId)) return next(new Error('Sign in to restore this account'));
          const guestKey = socket.handshake.auth?.guestKey;
          const savedKey = this.guestKeys.get(guestId);
          if (savedKey && guestKey !== savedKey) return next(new Error('Guest session does not match'));
          if (!savedKey && typeof guestKey === 'string' && guestKey.length >= 32) this.guestKeys.set(guestId, guestKey);
          const guestName = (socket.handshake.auth?.username as string) || `Player-${socket.id.substring(0, 4)}`;
          (socket as any).user = { userId: guestId, username: guestName, role: 'USER' };
          return next();
        }

        const decoded = this.authService.verifyToken(token as string);
        (socket as any).user = decoded;
        next();
      } catch (err: any) {
        next(new Error('Authentication failed: ' + err.message));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;

      socket.use(([event, data], next) => {
        if (data?.tableId && /^(game|pool|split):/.test(event) && event !== 'game:reconnect') {
          const seat = this.tableManager.getSession(data.tableId)?.players.find(p => p.playerId === user.userId);
          if (seat?.socketId !== socket.id) {
            socket.emit('error:action_rejected', { message: 'Return to your table before taking a turn.' });
            return;
          }
        }
        next();
      });

      // 1. Join Matchmaking (Supports 'matchmaking:join', 'JOIN_MATCHMAKING', 'JOIN_TABLE', 'table:join')
      const handleJoin = (data: { variant: any; entryAmount?: number; pointValue?: number; maxPlayers: 2 | 6; configurationId?: string }) => {
        try {
          const existing = this.tableManager.getResumableTable(user.userId);
          if (existing) {
            socket.emit('game:resume_available', { tableId: existing.tableId });
            return;
          }
          const entryAmount = Number(data.entryAmount) || 50;
          const queuedPlayer: QueuedPlayer = {
            playerId: user.userId,
            username: user.username,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
            socketId: socket.id,
            variant: data.variant || 'POINTS',
            entryAmount,
            pointValue: Number(data.pointValue) || (entryAmount / 80),
            maxPlayers: data.maxPlayers === 6 ? 6 : 2,
            configurationId: data.configurationId,
            queuedAt: Date.now(),
          };

          const res = this.matchmakingService.joinQueue(queuedPlayer);
          socket.emit('matchmaking:status', res);
        } catch (err: any) {
          socket.emit('error:action_rejected', { message: err.message });
        }
      };

      socket.on('matchmaking:join', handleJoin);
      socket.on('JOIN_MATCHMAKING', handleJoin);
      socket.on('JOIN_TABLE', handleJoin);
      socket.on('table:join', handleJoin);

      // 2. Cancel / Leave Matchmaking (Supports 'matchmaking:cancel', 'matchmaking:leave', 'LEAVE_MATCHMAKING', 'LEAVE_TABLE', 'table:leave')
      const handleLeave = (data?: { ticketId?: string }) => {
        try {
          if (data?.ticketId) {
            const res = this.matchmakingService.cancelTicket(data.ticketId);
            socket.emit('matchmaking:status', res);
          } else {
            this.matchmakingService.leaveQueue(user.userId);
            socket.emit('matchmaking:status', { state: 'CANCELLED', message: 'Matchmaking cancelled' });
          }
        } catch (err: any) {
          socket.emit('error:action_rejected', { message: err.message });
        }
      };

      socket.on('matchmaking:cancel', handleLeave);
      socket.on('matchmaking:leave', handleLeave);
      socket.on('LEAVE_MATCHMAKING', handleLeave);
      socket.on('LEAVE_TABLE', handleLeave);
      socket.on('table:leave', handleLeave);

      // 2.1 Request Table Status (Requirement 12)
      const handleRequestTableStatus = (data: { tableId: string }) => {
        if (!data?.tableId) return;
        const waitingTable = this.matchmakingService.getTableStatus(data.tableId);
        if (waitingTable) {
          const payload = this.matchmakingService.formatTablePayload(waitingTable, '');
          socket.emit('table:status', payload);
          socket.emit('TABLE_STATUS_RESPONSE', payload);
        }
      };

      socket.on('table:request_status', handleRequestTableStatus);
      socket.on('REQUEST_TABLE_STATUS', handleRequestTableStatus);

      // 2.2 Matchmaking Heartbeat
      socket.on('matchmaking:heartbeat', (data: { ticketId: string }) => {
        if (data?.ticketId) {
          this.matchmakingService.heartbeat(data.ticketId);
        }
      });

      // 2.3 Matchmaking Reconnect
      socket.on('matchmaking:reconnect', () => {
        const active = this.tableManager.getResumableTable(user.userId);
        if (active) {
          socket.emit('game:resume_available', { tableId: active.tableId });
          return;
        }
        const res = this.matchmakingService.reconnectPlayer(user.userId, socket.id);
        if (res) {
          socket.emit('matchmaking:status', res);
          if (res.table) {
            socket.emit('matchmaking:table_updated', res.table);
          }
        }
      });

      // 3. Draw Card
      socket.on('game:draw', (data: { tableId: string; source: 'CLOSED_DECK' | 'OPEN_DISCARD' }) => {
        try {
          const drawnCard = this.tableManager.handleDraw(data.tableId, user.userId, data.source);
          socket.emit('game:card_drawn', { card: drawnCard, source: data.source });
          // Public announcement of draw action so opponents see draw animations (without revealing private card)
          socket.to(`table:${data.tableId}`).emit('game:player_drew', {
            playerId: user.userId,
            source: data.source,
          });
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'draw', message: err.message });
        }
      });

      // 4. Discard Card
      socket.on('game:discard', (data: { tableId: string; cardId: string }) => {
        try {
          const discardedCard = this.tableManager.handleDiscard(data.tableId, user.userId, data.cardId);
          socket.emit('game:card_discarded', { card: discardedCard });
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'discard', message: err.message });
        }
      });

      // 5. Drop Deal
      socket.on('game:drop', (data: { tableId: string }) => {
        try {
          const dropType = this.tableManager.handleDrop(data.tableId, user.userId);
          socket.emit('game:dropped', { dropType });
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'drop', message: err.message });
        }
      });

      // 6. Declare Hand
      socket.on('game:declare', (data: { tableId: string; finishCardId: string; groups: any[] }) => {
        try {
          const declResult = this.tableManager.handleDeclare(
            data.tableId,
            user.userId,
            data.finishCardId,
            data.groups
          );
          socket.emit('game:declaration_result', declResult);
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'declare', message: err.message });
        }
      });

      // 6.1 Submit Arranged Hand (during 15s arrange phase)
      socket.on('game:submit_arranged_hand', (data: { tableId: string; groups: any[] }) => {
        try {
          const res = this.tableManager.handleSubmitArrangedHand(
            data.tableId,
            user.userId,
            data.groups
          );
          socket.emit('game:hand_submitted', { success: true });
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'submit_arranged_hand', message: err.message });
        }
      });

      // 7. Group Cards
      socket.on('game:group_cards', (data: { tableId: string; groups: any[] }) => {
        try {
          this.tableManager.handleGroupCards(data.tableId, user.userId, data.groups);
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'group_cards', message: err.message });
        }
      });

      // 8. Reconnect
      socket.on('game:discover', () => {
        const session = this.tableManager.getResumableTable(user.userId);
        if (!session && this.matchmakingService.hasWaitingSeat(user.userId)) {
          socket.emit('matchmaking:reservation_available');
        } else {
          socket.emit('game:resume_available', { tableId: session?.tableId ?? null });
        }
      });

      socket.on('game:reconnect', (data?: { tableId?: string }) => {
        try {
          const mapped = this.tableManager.getTableIdForPlayer(user.userId);
          const previous = mapped && this.tableManager.getSession(mapped)?.players.find(p => p.playerId === user.userId)?.socketId;
          const session = this.tableManager.handlePlayerReconnect(user.userId, socket.id, data?.tableId);
          if (session) {
            if (previous && previous !== socket.id) {
              const old = this.io.sockets.sockets.get(previous);
              old?.leave(`table:${session.tableId}`);
              old?.emit('game:seat_transferred');
            }
            socket.join(`table:${session.tableId}`);
            socket.emit('table:joined', { tableId: session.tableId, config: session.config });
            this.broadcastTableState(session.tableId, session);
            if (session.pointsEngine?.completedDealResult) {
              socket.emit('deal:hands_revealed', { hands: session.pointsEngine.getRevealedHands() });
              socket.emit('game:deal_ended', { dealResult: session.pointsEngine.completedDealResult });
              if (session.poolEngine) socket.emit('scoreboard:updated', session.poolEngine.getScoreboard());
              if (session.poolEngine && session.nextDealDeadline) socket.emit('deal:countdown_tick', {
                tableId: session.tableId, dealNumber: session.poolEngine.currentDealNumber, startsAt: session.nextDealDeadline,
                countdownSec: Math.max(0, Math.ceil((session.nextDealDeadline - Date.now()) / 1000)),
                isPaused: !!session.poolEngine.activeSplitRequest,
              });
              if (session.poolEngine?.activeSplitRequest) socket.emit('split:requested', session.poolEngine.activeSplitRequest);
              if (session.poolEngine?.finalResult) socket.emit('game:completed', {
                dealResult: session.pointsEngine.completedDealResult, finalResult: session.poolEngine.finalResult,
              });
            }
          } else {
            socket.emit('game:session_missing');
          }
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'reconnect', message: err.message });
        }
      });

      // 9. Pool Prize Split Request
      socket.on('split:request', (data: { tableId: string }) => {
        try {
          const splitReq = this.tableManager.handleRequestSplit(data.tableId, user.userId);
          socket.emit('split:request_success', { splitReq });
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'split:request', message: err.message });
        }
      });

      // 10. Pool Prize Split Vote
      socket.on('split:vote', (data: { tableId: string; accept: boolean }) => {
        try {
          const splitResult = this.tableManager.handleVoteSplit(data.tableId, user.userId, data.accept);
          socket.emit('split:vote_success', { splitResult });
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'split:vote', message: err.message });
        }
      });

      // 11. Pool Re-entry Request
      socket.on('pool:reentry', (data: { tableId: string }) => {
        try {
          const res = this.tableManager.handleRequestReentry(data.tableId, user.userId);
          if (res.success) {
            socket.emit('pool:reentry_success', res);
          } else {
            socket.emit('error:action_rejected', { action: 'pool:reentry', message: res.reason });
          }
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'pool:reentry', message: err.message });
        }
      });

      // 12. Scoreboard Query
      socket.on('scoreboard:get', (data: { tableId: string }) => {
        try {
          const scoreboard = this.tableManager.handleGetScoreboard(data.tableId);
          if (scoreboard) {
            socket.emit('scoreboard:updated', scoreboard);
          }
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'scoreboard:get', message: err.message });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        // Retain seat reservation during grace period for reconnection; TableManager handles game disconnect
        this.tableManager.handlePlayerDisconnect(socket.id);
      });
    });
  }
}
