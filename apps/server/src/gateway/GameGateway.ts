import { Server as SocketIOServer, Socket } from 'socket.io';
import { AuthService } from '../auth/AuthService';
import { MatchmakingService, QueuedPlayer } from '../matchmaking/MatchmakingService';
import { GameTableSession, TableManager } from '../table/TableManager';

export class GameGateway {
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

    this.matchmakingService.setMatchFoundCallback((config, players) => {
      const session = this.tableManager.createTable(
        config,
        players.map((p) => ({
          playerId: p.playerId,
          username: p.username,
          avatarUrl: p.avatarUrl,
          socketId: p.socketId,
        }))
      );

      // Join sockets into the room
      for (const p of players) {
        const socket = this.io.sockets.sockets.get(p.socketId);
        if (socket) {
          socket.join(`table:${config.tableId}`);
          socket.emit('table:joined', { tableId: config.tableId, config });
        }
      }

      // Initial broadcast
      this.broadcastTableState(config.tableId, session);
    });
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

      // 1. Join Matchmaking
      socket.on('matchmaking:join', (data: { variant: any; pointValue: number; maxPlayers: 2 | 6 }) => {
        try {
          const queuedPlayer: QueuedPlayer = {
            playerId: user.userId,
            username: user.username,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
            socketId: socket.id,
            variant: data.variant || 'POINTS',
            pointValue: Number(data.pointValue) || 1.0,
            maxPlayers: data.maxPlayers === 6 ? 6 : 2,
            queuedAt: Date.now(),
          };

          const res = this.matchmakingService.joinQueue(queuedPlayer);
          socket.emit('matchmaking:status', res);
        } catch (err: any) {
          socket.emit('error:action_rejected', { message: err.message });
        }
      });

      // 2. Leave Matchmaking
      socket.on('matchmaking:leave', () => {
        this.matchmakingService.leaveQueue(user.userId);
        socket.emit('matchmaking:status', { status: 'CANCELLED' });
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

      // 7. Group Cards
      socket.on('game:group_cards', (data: { tableId: string; groups: any[] }) => {
        try {
          this.tableManager.handleGroupCards(data.tableId, user.userId, data.groups);
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'group_cards', message: err.message });
        }
      });

      // 8. Reconnect
      socket.on('game:reconnect', (data: { tableId?: string }) => {
        try {
          const session = this.tableManager.handlePlayerReconnect(user.userId, socket.id);
          if (session) {
            socket.join(`table:${session.tableId}`);
            socket.emit('table:joined', { tableId: session.tableId, config: session.config });
            this.broadcastTableState(session.tableId, session);
          }
        } catch (err: any) {
          socket.emit('error:action_rejected', { action: 'reconnect', message: err.message });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.matchmakingService.leaveQueue(user.userId);
        this.tableManager.handlePlayerDisconnect(socket.id);
      });
    });
  }
}
