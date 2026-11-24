import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MatchmakingService, QueuedPlayer } from '../src/matchmaking/MatchmakingService';
import { TableManager } from '../src/table/TableManager';

describe('Matchmaking Engine Specification & Invariants', () => {
  let mm: MatchmakingService;
  let tableManager: TableManager;
  let matchesCreated: any[] = [];
  let tableUpdates: any[] = [];
  let playerStatuses: any[] = [];

  beforeEach(() => {
    matchesCreated = [];
    tableUpdates = [];
    playerStatuses = [];

    tableManager = new TableManager();
    mm = new MatchmakingService(
      (config, players) => {
        const session = tableManager.createTable(config, players);
        matchesCreated.push({ config, players, session });
      },
      (tableId, payload, targetSocketIds) => {
        tableUpdates.push({ tableId, payload, targetSocketIds });
      },
      (socketId, payload) => {
        playerStatuses.push({ socketId, payload });
      },
      undefined,
      { countdownDurationMs: 0 } // Default 0 for immediate allocation unit assertions
    );
  });

  afterEach(() => {
    mm.stopCleanupWorker();
  });

  it('1 & 2: Handles Points Rummy 2-player and 6-player tables separately', () => {
    // 2-player queue
    const p1: QueuedPlayer = {
      playerId: 'pts-2p-1',
      username: 'P1',
      avatarUrl: '/a1.png',
      socketId: 'sock-p1',
      variant: 'POINTS',
      pointValue: 0.1,
      maxPlayers: 2,
    };
    const p2: QueuedPlayer = {
      playerId: 'pts-2p-2',
      username: 'P2',
      avatarUrl: '/a2.png',
      socketId: 'sock-p2',
      variant: 'POINTS',
      pointValue: 0.1,
      maxPlayers: 2,
    };

    const res1 = mm.joinQueue(p1);
    expect(res1.state).toBe('PLAYERS_JOINING');
    expect(res1.ticket?.assignedSeatIndex).toBe(0);

    const res2 = mm.joinQueue(p2);
    expect(res2.state).toBe('STARTED');
    expect(matchesCreated.length).toBe(1);
    expect(matchesCreated[0].players.length).toBe(2);
    expect(matchesCreated[0].config.maxPlayers).toBe(2);
  });

  it('3 & 4: Matches 6-player Points Rummy table only when all 6 real seats are filled', () => {
    for (let i = 1; i <= 5; i++) {
      const res = mm.joinQueue({
        playerId: `pts-6p-${i}`,
        username: `Player_${i}`,
        avatarUrl: `/a${i}.png`,
        socketId: `sock-6p-${i}`,
        variant: 'POINTS',
        pointValue: 1.0,
        maxPlayers: 6,
      });
      expect(res.state).toBe('PLAYERS_JOINING');
      expect(res.table?.occupiedSeatCount).toBe(i);
      expect(matchesCreated.length).toBe(0); // Cannot start with < 6 players!
    }

    // 6th player joins -> fills table
    const res6 = mm.joinQueue({
      playerId: 'pts-6p-6',
      username: 'Player_6',
      avatarUrl: '/a6.png',
      socketId: 'sock-6p-6',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 6,
    });
    expect(res6.state).toBe('STARTED');
    expect(matchesCreated.length).toBe(1);
    expect(matchesCreated[0].players.length).toBe(6);
    expect(matchesCreated[0].config.maxPlayers).toBe(6);
  });

  it('5 & 6 & 8: Never mixes Pool 101 and Pool 201 or incompatible stakes', () => {
    // Player A joins Pool 101 (2P, 25.0 stake)
    const resA = mm.joinQueue({
      playerId: 'pool-101-player',
      username: 'Pool101Fan',
      avatarUrl: '/p101.png',
      socketId: 'sock-101',
      variant: 'POOL_101',
      pointValue: 25.0,
      maxPlayers: 2,
    });
    expect(resA.state).toBe('PLAYERS_JOINING');
    expect(resA.ticket?.gameType).toBe('POOL_101');

    // Player B joins Pool 201 (2P, 25.0 stake) -> MUST NOT MATCH WITH PLAYER A!
    const resB = mm.joinQueue({
      playerId: 'pool-201-player',
      username: 'Pool201Fan',
      avatarUrl: '/p201.png',
      socketId: 'sock-201',
      variant: 'POOL_201',
      pointValue: 25.0,
      maxPlayers: 2,
    });
    expect(resB.state).toBe('PLAYERS_JOINING');
    expect(resB.ticket?.gameType).toBe('POOL_201');
    expect(matchesCreated.length).toBe(0); // Incompatible variants remain separate

    // Player C joins Pool 101 (2P, 50.0 stake) -> MUST NOT MATCH WITH PLAYER A (different stakes)!
    const resC = mm.joinQueue({
      playerId: 'pool-101-high-stake',
      username: 'HighRoller',
      avatarUrl: '/p101h.png',
      socketId: 'sock-101h',
      variant: 'POOL_101',
      pointValue: 50.0,
      maxPlayers: 2,
    });
    expect(resC.state).toBe('PLAYERS_JOINING');
    expect(matchesCreated.length).toBe(0);

    // Player D joins Pool 101 (2P, 25.0 stake) -> MATCHES WITH PLAYER A!
    const resD = mm.joinQueue({
      playerId: 'pool-101-player2',
      username: 'Pool101Fan2',
      avatarUrl: '/p101b.png',
      socketId: 'sock-101b',
      variant: 'POOL_101',
      pointValue: 25.0,
      maxPlayers: 2,
    });
    expect(resD.state).toBe('STARTED');
    expect(matchesCreated.length).toBe(1);
    expect(matchesCreated[0].config.variant).toBe('POOL_101');
    expect(matchesCreated[0].config.pointValue).toBe(25.0);
  });

  it('7: Handles player cancellation and safely releases seat reservation', () => {
    // Player 1 joins a 6-player table
    const res1 = mm.joinQueue({
      playerId: 'cancel-p1',
      username: 'CancelP1',
      avatarUrl: '/a.png',
      socketId: 'sock-cp1',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 6,
    });
    const ticketId1 = res1.ticket!.ticketId;
    expect(res1.table?.occupiedSeatCount).toBe(1);

    // Player 2 joins same table
    const res2 = mm.joinQueue({
      playerId: 'cancel-p2',
      username: 'CancelP2',
      avatarUrl: '/b.png',
      socketId: 'sock-cp2',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 6,
    });
    expect(res2.table?.occupiedSeatCount).toBe(2);

    // Player 1 cancels matchmaking
    const cancelRes = mm.cancelTicket(ticketId1);
    expect(cancelRes.state).toBe('CANCELLED');

    // Verify Player 2 was notified of the freed seat
    const lastUpdate = tableUpdates[tableUpdates.length - 1];
    expect(lastUpdate).toBeDefined();
    expect(lastUpdate.payload.occupiedSeatCount).toBe(1);
    expect(lastUpdate.payload.seats[0].isOccupied).toBe(false); // Seat 0 released!

    // Verify Player 3 can now claim the freed seat
    const res3 = mm.joinQueue({
      playerId: 'cancel-p3',
      username: 'CancelP3',
      avatarUrl: '/c.png',
      socketId: 'sock-cp3',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 6,
    });
    expect(res3.ticket?.assignedSeatIndex).toBe(0); // Took empty seat 0!
    expect(res3.table?.occupiedSeatCount).toBe(2);
  });

  it('8: Idempotent join: returns existing ticket if player joins twice', () => {
    const p: QueuedPlayer = {
      playerId: 'idem-player-1',
      username: 'IdemUser',
      avatarUrl: '/u.png',
      socketId: 'sock-idem-1',
      variant: 'POINTS',
      pointValue: 2.0,
      maxPlayers: 2,
    };

    const firstJoin = mm.joinQueue(p);
    expect(firstJoin.state).toBe('PLAYERS_JOINING');
    const firstTicketId = firstJoin.ticket?.ticketId;

    // Second join call from same player for same configuration
    const secondJoin = mm.joinQueue({
      ...p,
      socketId: 'sock-idem-refreshed',
    });
    expect(secondJoin.ticket?.ticketId).toBe(firstTicketId);
    expect(secondJoin.ticket?.socketId).toBe('sock-idem-refreshed');
  });

  it('9: Handles reconnection and restores seat and waiting table state', () => {
    const res = mm.joinQueue({
      playerId: 'reconnect-player-1',
      username: 'ReconnectUser',
      avatarUrl: '/r.png',
      socketId: 'old-socket-id',
      variant: 'POOL_201',
      pointValue: 10.0,
      maxPlayers: 2,
    });
    const ticketId = res.ticket!.ticketId;

    // Player disconnects and reconnects with new socket ID
    const reconnectRes = mm.reconnectPlayer('reconnect-player-1', 'new-socket-id');
    expect(reconnectRes).toBeDefined();
    expect(reconnectRes?.ticket?.ticketId).toBe(ticketId);
    expect(reconnectRes?.ticket?.socketId).toBe('new-socket-id');
    expect(reconnectRes?.ticket?.assignedSeatIndex).toBe(0);
    expect(reconnectRes?.state).toBe('PLAYERS_JOINING');
  });

  it('10: Concurrency safety: atomic seat allocation under rapid concurrent joins', () => {
    // 20 players attempt to join the same 2-player configuration concurrently
    const results: any[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(
        mm.joinQueue({
          playerId: `concurrent-user-${i}`,
          username: `Concurrent_${i}`,
          avatarUrl: `/avatar_${i}.png`,
          socketId: `sock-conc-${i}`,
          variant: 'POINTS',
          pointValue: 0.5,
          maxPlayers: 2,
        })
      );
    }

    // Exactly 10 matches must be created (20 players / 2 players per table)
    expect(matchesCreated.length).toBe(10);

    // Verify all 10 tables have exactly 2 distinct players with seats 0 and 1
    for (const match of matchesCreated) {
      expect(match.players.length).toBe(2);
      expect(match.players[0].playerId).not.toBe(match.players[1].playerId);
      expect(match.players[0].seatIndex).not.toBe(match.players[1].seatIndex);
    }
  });

  it('11: Background cleanup worker cleans up stale tickets without heartbeat', () => {
    const res = mm.joinQueue({
      playerId: 'stale-user-1',
      username: 'StaleUser',
      avatarUrl: '/s.png',
      socketId: 'sock-stale-1',
      variant: 'POINTS',
      pointValue: 1.0,
      maxPlayers: 2,
    });

    const ticket = res.ticket!;
    // Simulate expired heartbeat (> 35s ago)
    ticket.lastHeartbeatAt = Date.now() - 40000;

    const cleaned = mm.cleanupStaleRecords();
    expect(cleaned).toBe(1);
    expect(ticket.ticketStatus).toBe('EXPIRED');
  });

  it('12: 3-second countdown and 1-second leave boundary locking', () => {
    // Service with real 3000ms countdown
    const countdownMM = new MatchmakingService(
      (config, players) => {
        matchesCreated.push({ config, players });
      },
      undefined,
      undefined,
      undefined,
      { countdownDurationMs: 3000 }
    );

    const p1 = countdownMM.joinQueue({
      playerId: 'cd-p1',
      username: 'CountdownP1',
      avatarUrl: '/a.png',
      socketId: 'sock-cd1',
      variant: 'POINTS',
      entryAmount: 100,
      maxPlayers: 2,
    });
    expect(p1.state).toBe('PLAYERS_JOINING');

    const p2 = countdownMM.joinQueue({
      playerId: 'cd-p2',
      username: 'CountdownP2',
      avatarUrl: '/b.png',
      socketId: 'sock-cd2',
      variant: 'POINTS',
      entryAmount: 100,
      maxPlayers: 2,
    });

    // When full table is formed, enters START_COUNTDOWN
    expect(p2.state).toBe('START_COUNTDOWN');
    expect(p2.countdownSec).toBe(3);
    expect(p2.gameStartsAt).toBeDefined();
    expect(p2.canLeave).toBe(true);

    const tables = countdownMM.getWaitingTablesList();
    expect(tables.length).toBe(1);
    const table = tables[0];
    expect(table.tableStatus).toBe('START_COUNTDOWN');

    // Simulate time passing to within 1-second boundary (<1000ms remaining)
    table.gameStartsAt = Date.now() + 500; // Only 500ms remaining -> LOCKED!

    // Attempting to leave within 1 second boundary MUST be rejected!
    const leaveRes = countdownMM.cancelTicket(p2.ticket!.ticketId);
    expect(leaveRes.state).toBe('LOCKED');
    expect(leaveRes.canLeave).toBe(false);
    expect(leaveRes.error).toContain('locked');

    countdownMM.stopCleanupWorker();
  });

  it('13: Player leave during countdown (>1s) cancels start and resumes original 60s deadline', () => {
    const countdownMM = new MatchmakingService(
      undefined,
      undefined,
      undefined,
      undefined,
      { countdownDurationMs: 3000 }
    );

    const p1 = countdownMM.joinQueue({
      playerId: 'cancel-p1',
      username: 'CancelP1',
      avatarUrl: '/a.png',
      socketId: 'sock-cp1',
      variant: 'POOL_101',
      entryAmount: 500,
      maxPlayers: 2,
    });

    const p2 = countdownMM.joinQueue({
      playerId: 'cancel-p2',
      username: 'CancelP2',
      avatarUrl: '/b.png',
      socketId: 'sock-cp2',
      variant: 'POOL_101',
      entryAmount: 500,
      maxPlayers: 2,
    });

    expect(p2.state).toBe('START_COUNTDOWN');
    const table = countdownMM.getWaitingTablesList()[0];
    const originalDeadline = table.matchmakingDeadline;

    // Leave while 2.5s remaining (>1s) -> allowed!
    const leaveRes = countdownMM.cancelTicket(p2.ticket!.ticketId);
    expect(leaveRes.state).toBe('CANCELLED');
    expect(leaveRes.canLeave).toBe(true);

    // Table must revert to WAITING_FOR_PLAYERS and preserve the original deadline
    expect(table.tableStatus).toBe('WAITING_FOR_PLAYERS');
    expect(table.occupiedSeatCount).toBe(1);
    expect(table.gameStartsAt).toBeNull();
    expect(table.matchmakingDeadline).toBe(originalDeadline);

    countdownMM.stopCleanupWorker();
  });

  it('14: 60-second matchmaking timeout expires incomplete tables', () => {
    const timeoutMM = new MatchmakingService(undefined, undefined, undefined, undefined, { countdownDurationMs: 0 });

    const p1 = timeoutMM.joinQueue({
      playerId: 'to-p1',
      username: 'TimeoutP1',
      avatarUrl: '/a.png',
      socketId: 'sock-to1',
      variant: 'POOL_201',
      entryAmount: 2000,
      maxPlayers: 2,
    });

    const table = timeoutMM.getWaitingTablesList()[0];
    expect(table.occupiedSeatCount).toBe(1);

    // Simulate 60 seconds passing without filling
    table.matchmakingDeadline = Date.now() - 1000;

    const cleaned = timeoutMM.cleanupStaleRecords();
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(timeoutMM.getWaitingTablesList().length).toBe(0);

    timeoutMM.stopCleanupWorker();
  });

  it('15: Supports Points Rummy 240 Out for 241 as distinct configuration and matching', () => {
    const mm240 = new MatchmakingService(
      (config, players) => {
        matchesCreated.push({ config, players });
      },
      undefined,
      undefined,
      undefined,
      { countdownDurationMs: 0 }
    );

    // Player joins standard POINTS
    const stdP = mm240.joinQueue({
      playerId: 'std-p1',
      username: 'StandardPlayer',
      avatarUrl: '/std.png',
      socketId: 'sock-std',
      variant: 'POINTS',
      entryAmount: 200,
      maxPlayers: 2,
    });

    // Player joins 240 Out for 241 with identical entry amount -> MUST NOT MATCH!
    const p240A = mm240.joinQueue({
      playerId: 'p240-1',
      username: '240Player1',
      avatarUrl: '/240a.png',
      socketId: 'sock-240a',
      variant: 'POINTS_240',
      entryAmount: 200,
      maxPlayers: 2,
    });
    expect(p240A.state).toBe('PLAYERS_JOINING');
    expect(p240A.ticket?.gameType).toBe('POINTS_240');

    // Player 2 joins 240 Out for 241 -> MATCHES with Player 1 of 240 Out!
    const p240B = mm240.joinQueue({
      playerId: 'p240-2',
      username: '240Player2',
      avatarUrl: '/240b.png',
      socketId: 'sock-240b',
      variant: 'POINTS_240',
      entryAmount: 200,
      maxPlayers: 2,
    });
    expect(p240B.state).toBe('STARTED');

    const createdMatch = matchesCreated.find((m) => m.config.variant === 'POINTS_240');
    expect(createdMatch).toBeDefined();
    expect(createdMatch?.config.variant).toBe('POINTS_240');
    expect(createdMatch?.config.pointsOutThreshold).toBe(240);
    expect(createdMatch?.config.winningThreshold).toBe(241);
    expect(createdMatch?.config.entryAmount).toBe(200);

    mm240.stopCleanupWorker();
  });

  it('16: Partitions queues by selectable entry amounts (50, 100, 200, 500, 1000, 1500, 2000)', () => {
    const entryMM = new MatchmakingService(
      (config, players) => {
        matchesCreated.push({ config, players });
      },
      undefined,
      undefined,
      undefined,
      { countdownDurationMs: 0 }
    );

    // Player A joins entry 50
    entryMM.joinQueue({
      playerId: 'amt-50',
      username: 'Player50',
      avatarUrl: '/a.png',
      socketId: 'sock-50',
      variant: 'POINTS',
      entryAmount: 50,
      maxPlayers: 2,
    });

    // Player B joins entry 100 -> MUST NOT MATCH
    entryMM.joinQueue({
      playerId: 'amt-100',
      username: 'Player100',
      avatarUrl: '/b.png',
      socketId: 'sock-100',
      variant: 'POINTS',
      entryAmount: 100,
      maxPlayers: 2,
    });

    // Player C joins entry 50 -> MATCHES with Player A!
    const resC = entryMM.joinQueue({
      playerId: 'amt-50-b',
      username: 'Player50B',
      avatarUrl: '/c.png',
      socketId: 'sock-50b',
      variant: 'POINTS',
      entryAmount: 50,
      maxPlayers: 2,
    });
    expect(resC.state).toBe('STARTED');
    expect(resC.ticket?.entryAmount).toBe(50);

    entryMM.stopCleanupWorker();
  });
});
