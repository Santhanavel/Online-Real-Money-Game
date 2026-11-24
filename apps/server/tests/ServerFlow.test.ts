import { describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/AuthService';
import { DatabaseService } from '../src/db/schema';
import { MatchmakingService } from '../src/matchmaking/MatchmakingService';
import { TableManager } from '../src/table/TableManager';

describe('Server Architecture & Integration Tests', () => {
  it('registers and authenticates player with secure JWT token', () => {
    const auth = new AuthService();
    const reg = auth.register('TestPlayer99', 'test99@rummy.com', 'password123');

    expect(reg.user.id).toBeDefined();
    expect(reg.user.username).toBe('TestPlayer99');
    expect(reg.token).toBeDefined();

    const verified = auth.verifyToken(reg.token);
    expect(verified.userId).toBe(reg.user.id);
    expect(verified.username).toBe('TestPlayer99');

    // Login test
    const loginRes = auth.login('test99@rummy.com', 'password123');
    expect(loginRes.user.id).toBe(reg.user.id);
  });

  it('matches 2 players and creates active Points Rummy table', () => {
    let createdTableId: string | undefined;

    const tableManager = new TableManager();
    const mm = new MatchmakingService(
      (config, players) => {
        const session = tableManager.createTable(
          config,
          players.map((p) => ({
            playerId: p.playerId,
            username: p.username,
            avatarUrl: p.avatarUrl,
            socketId: p.socketId,
          }))
        );
        createdTableId = session.tableId;
      },
      undefined,
      undefined,
      undefined,
      { countdownDurationMs: 0 }
    );

    // Player 1 joins queue
    const res1 = mm.joinQueue({
      playerId: 'p-1',
      username: 'P1',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 2,
      queuedAt: Date.now(),
    });
    expect(res1.state).toBe('PLAYERS_JOINING');
    expect(res1.ticket?.ticketStatus).toBe('RESERVED');
    expect(res1.table?.occupiedSeatCount).toBe(1);

    // Player 2 joins queue
    const res2 = mm.joinQueue({
      playerId: 'p-2',
      username: 'P2',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 2,
      queuedAt: Date.now(),
    });
    expect(res2.state).toBe('STARTED');
    expect(createdTableId).toBeDefined();

    const session = tableManager.getSession(createdTableId!);
    expect(session).toBeDefined();
    expect(session?.players.length).toBe(2);
    expect(session?.pointsEngine?.tableStatus).toBe('IN_PROGRESS');

    // Verify private hand isolation: Player 1's private state contains ONLY Player 1's hand
    const p1State = session?.pointsEngine?.getPrivateStateForPlayer('p-1');
    expect(p1State?.myHand.length).toBe(13);
    expect(p1State?.players[1].cardCount).toBe(13);
    // Player 2's private cards are NOT exposed in public state
    expect((p1State?.players[1] as any).hand).toBeUndefined();
  });

  it('handles draw and discard via TableManager', () => {
    const tableManager = new TableManager();
    const config = {
      tableId: 'test-tbl-dd',
      variant: 'POINTS' as const,
      pointValue: 1.0,
      maxPlayers: 2 as const,
      turnDurationSec: 30,
      extraTimeSec: 15,
      firstDropPenalty: 20,
      middleDropPenalty: 40,
      wrongShowPenalty: 80,
      consecutiveTimeoutDrop: 3,
      maxScoreCap: 80,
      poolEliminationLimit: 0,
      deckCount: 2,
      printedJokersPerDeck: 2,
    };

    const session = tableManager.createTable(config, [
      { playerId: 'pl-1', username: 'PlayerOne', avatarUrl: '/1.png', socketId: 's1' },
      { playerId: 'pl-2', username: 'PlayerTwo', avatarUrl: '/2.png', socketId: 's2' },
    ]);

    // Player 1 draws
    const drawn = tableManager.handleDraw(session.tableId, 'pl-1', 'CLOSED_DECK');
    expect(drawn.cardId).toBeDefined();
    expect(session.pointsEngine?.lastDrawnEvent?.playerId).toBe('pl-1');
    expect(session.pointsEngine?.lastDrawnEvent?.source).toBe('CLOSED_DECK');

    // Player 1 discards
    const discarded = tableManager.handleDiscard(session.tableId, 'pl-1', drawn.cardId);
    expect(discarded.cardId).toBe(drawn.cardId);

    // Turn is now Player 2
    expect(session.pointsEngine?.activePlayerSeat).toBe(1);
  });

  it('sets server-authoritative nextRoundStartsAt between Pool Rummy deals', () => {
    let dealEndedEventData: any = null;

    const tableManager = new TableManager(
      undefined,
      (tableId, event, data) => {
        if (event === 'game:deal_ended') {
          dealEndedEventData = data;
        }
      }
    );

    const config = {
      tableId: 'test-tbl-pool',
      variant: 'POOL_101' as const,
      pointValue: 1.0,
      maxPlayers: 2 as const,
      turnDurationSec: 30,
      extraTimeSec: 15,
      firstDropPenalty: 20,
      middleDropPenalty: 40,
      wrongShowPenalty: 80,
      consecutiveTimeoutDrop: 3,
      maxScoreCap: 80,
      poolEliminationLimit: 101,
      deckCount: 2,
      printedJokersPerDeck: 2,
    };

    const session = tableManager.createTable(config, [
      { playerId: 'pl-1', username: 'PlayerOne', avatarUrl: '/1.png', socketId: 's1' },
      { playerId: 'pl-2', username: 'PlayerTwo', avatarUrl: '/2.png', socketId: 's2' },
    ]);

    // Player 1 drops deal 1
    tableManager.handleDrop(session.tableId, 'pl-1');

    // Deal ended should trigger with nextRoundStartsAt
    expect(dealEndedEventData).toBeDefined();
    expect(dealEndedEventData.nextRoundStartsAt).toBeGreaterThan(Date.now() - 100);
    expect(dealEndedEventData.nextDealInSec).toBe(15);
    expect(session.pointsEngine?.nextRoundStartsAt).toBe(dealEndedEventData.nextRoundStartsAt);
  });
});
