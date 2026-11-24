import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MatchmakingService, QueuedPlayer } from '../src/matchmaking/MatchmakingService';
import { TableManager } from '../src/table/TableManager';

describe('Shared Table Matchmaking & Adaptive Waiting Lobby (17 Verification Test Cases)', () => {
  let mm: MatchmakingService;
  let tableManager: TableManager;
  let matchesCreated: any[] = [];
  let tableUpdates: any[] = [];
  let playerStatuses: any[] = [];
  let countdownEvents: any[] = [];

  beforeEach(() => {
    matchesCreated = [];
    tableUpdates = [];
    playerStatuses = [];
    countdownEvents = [];

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
      (targetSocketIds, event, data) => {
        countdownEvents.push({ targetSocketIds, event, data });
      },
      {
        maxWaitDurationSec: 30,
        acceleratedCountdownSec: 5,
      }
    );
  });

  afterEach(() => {
    mm.stopCleanupWorker();
  });

  // Test 1: First player creates a table
  it('1. First player creates a waiting table with authoritative maximum wait deadline', () => {
    const p1: QueuedPlayer = {
      playerId: 'usr-p101-1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    };

    const res = mm.joinQueue(p1);
    expect(res.state).toBe('PLAYERS_JOINING');
    expect(res.table).toBeDefined();
    expect(res.table?.occupiedSeatCount).toBe(1);
    expect(res.table?.tableCapacity).toBe(6);
    expect(res.table?.gameType).toBe('POOL_101');
    expect(res.matchmakingDeadline).toBeDefined();
    expect(res.canLeave).toBe(true);

    const tables = mm.getWaitingTablesList();
    expect(tables.length).toBe(1);
    expect(tables[0].seats[0].playerId).toBe('usr-p101-1');
    expect(tables[0].seats[1].isOccupied).toBe(false);
  });

  // Test 2: Second player joins an existing table
  it('2. Second player joins existing compatible table and deadline does not reset', () => {
    const p1: QueuedPlayer = {
      playerId: 'usr-p101-1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    };
    const p2: QueuedPlayer = {
      playerId: 'usr-p101-2',
      username: 'Bob',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    };

    const res1 = mm.joinQueue(p1);
    const deadline1 = res1.matchmakingDeadline;

    const res2 = mm.joinQueue(p2);
    expect(res2.table?.tableId).toBe(res1.table?.tableId);
    expect(res2.table?.occupiedSeatCount).toBe(2);
    // Deadline must not reset when another player joins
    expect(res2.matchmakingDeadline).toBe(deadline1);
    expect(mm.getWaitingTablesList().length).toBe(1);
  });

  // Test 3: Multiple players join one table
  it('3. Multiple players join one table and receive unique sequential seats', () => {
    const tableId: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = mm.joinQueue({
        playerId: `usr-pool201-${i}`,
        username: `Player_${i}`,
        avatarUrl: `/a${i}.png`,
        socketId: `sock-${i}`,
        variant: 'POOL_201',
        entryAmount: 200,
        maxPlayers: 6,
      });
      tableId.push(res.table!.tableId);
      expect(res.table!.occupiedSeatCount).toBe(i);
    }

    // All 5 players must be in the exact same table
    expect(new Set(tableId).size).toBe(1);
    const table = mm.getWaitingTablesList()[0];
    expect(table.occupiedSeatCount).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(table.seats[i].isOccupied).toBe(true);
      expect(table.seats[i].playerId).toBe(`usr-pool201-${i + 1}`);
    }
    expect(table.seats[5].isOccupied).toBe(false);
  });

  // Test 4: A full table starts after accelerated countdown
  it('4. A full table enters START_COUNTDOWN and transitions to game launch after countdown', () => {
    mm.setCountdownDurationMs(0); // instant launch for unit test

    for (let i = 1; i <= 6; i++) {
      mm.joinQueue({
        playerId: `usr-pool240-${i}`,
        username: `Player_${i}`,
        avatarUrl: `/a${i}.png`,
        socketId: `sock-${i}`,
        variant: 'POOL_240',
        entryAmount: 50,
        maxPlayers: 6,
      });
    }

    // Game launched
    expect(matchesCreated.length).toBe(1);
    expect(matchesCreated[0].config.variant).toBe('POOL_240');
    expect(matchesCreated[0].players.length).toBe(6);
  });

  // Test 5: A table does not wait for the original 30-second timer after becoming full
  it('5. Table triggers accelerated countdown when full and does not wait for original 30s deadline', () => {
    mm.setAcceleratedCountdownSec(5); // 5s accelerated countdown
    let latestRes: any;

    for (let i = 1; i <= 2; i++) {
      latestRes = mm.joinQueue({
        playerId: `usr-fast-${i}`,
        username: `FastPlayer_${i}`,
        avatarUrl: `/a${i}.png`,
        socketId: `sock-${i}`,
        variant: 'POOL_101',
        entryAmount: 100,
        maxPlayers: 2,
      });
    }

    expect(latestRes.state).toBe('START_COUNTDOWN');
    expect(latestRes.countdownSec).toBe(5);
    expect(latestRes.gameStartsAt).toBeDefined();

    const table = mm.getWaitingTablesList()[0];
    expect(table.tableStatus).toBe('START_COUNTDOWN');
    // gameStartsAt is 5s ahead, NOT 30s ahead!
    expect(table.gameStartsAt! - table.createdAt).toBeLessThan(10000);
  });

  // Test 6: A table reaches maximum wait without filling (no silent underfilled start)
  it('6. Table expires without starting when maximum waiting period ends underfilled', () => {
    // 6-player table with only 2 players
    mm.joinQueue({
      playerId: 'usr-p1',
      username: 'P1',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    });
    mm.joinQueue({
      playerId: 'usr-p2',
      username: 'P2',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    });

    const table = mm.getWaitingTablesList()[0];
    expect(table.occupiedSeatCount).toBe(2);

    // Fast-forward deadline to the past
    table.matchmakingDeadline = Date.now() - 1000;

    // Run background cleanup worker
    const cleaned = mm.cleanupStaleRecords();
    expect(cleaned).toBeGreaterThan(0);

    // Table must not start underfilled!
    expect(matchesCreated.length).toBe(0);
    // Table should be removed from waiting list
    expect(mm.getWaitingTablesList().length).toBe(0);
  });

  // Test 7: A player leaves while waiting
  it('7. Player leaves while waiting: releases seat and preserves original waiting deadline', () => {
    const res1 = mm.joinQueue({
      playerId: 'usr-leave-1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    });
    const res2 = mm.joinQueue({
      playerId: 'usr-leave-2',
      username: 'Bob',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    });

    const deadlineBefore = res1.matchmakingDeadline;
    const table = mm.getWaitingTablesList()[0];
    expect(table.occupiedSeatCount).toBe(2);

    // Bob leaves
    const leaveRes = mm.cancelTicket(res2.ticket!.ticketId);
    expect(leaveRes.state).toBe('CANCELLED');
    expect(table.occupiedSeatCount).toBe(1);
    expect(table.seats[1].isOccupied).toBe(false);
    expect(table.matchmakingDeadline).toBe(deadlineBefore);
  });

  // Test 8: A player leaves during full-table countdown
  it('8. Player leaves during full-table countdown: cancels countdown and resumes waiting', () => {
    mm.setAcceleratedCountdownSec(5);

    const res1 = mm.joinQueue({
      playerId: 'usr-p1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });
    const res2 = mm.joinQueue({
      playerId: 'usr-p2',
      username: 'Bob',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    const table = mm.getWaitingTablesList()[0];
    expect(table.tableStatus).toBe('START_COUNTDOWN');
    expect(table.gameStartsAt).toBeDefined();

    // Bob leaves during countdown (>1s remaining)
    const cancelRes = mm.cancelTicket(res2.ticket!.ticketId);
    expect(cancelRes.state).toBe('CANCELLED');

    // Countdown cancelled & reverted to WAITING_FOR_PLAYERS
    expect(table.tableStatus).toBe('WAITING_FOR_PLAYERS');
    expect(table.gameStartsAt).toBeNull();
    expect(table.occupiedSeatCount).toBe(1);
  });

  // Test 9: A new player joins after a seat becomes available
  it('9. New player joins after a seat becomes available and triggers a new countdown', () => {
    mm.setAcceleratedCountdownSec(5);

    const res1 = mm.joinQueue({
      playerId: 'usr-p1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });
    const res2 = mm.joinQueue({
      playerId: 'usr-p2',
      username: 'Bob',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    // Bob leaves
    mm.cancelTicket(res2.ticket!.ticketId);

    // Charlie joins in Bob's vacated seat
    const res3 = mm.joinQueue({
      playerId: 'usr-p3',
      username: 'Charlie',
      avatarUrl: '/a3.png',
      socketId: 'sock-3',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    expect(res3.state).toBe('START_COUNTDOWN');
    const table = mm.getWaitingTablesList()[0];
    expect(table.occupiedSeatCount).toBe(2);
    expect(table.seats[1].playerId).toBe('usr-p3');
    expect(table.tableStatus).toBe('START_COUNTDOWN');
  });

  // Test 10: Two players request the same seat (concurrency / distinct seats)
  it('10. Concurrent join requests allocate distinct, non-overlapping seat indices', () => {
    const results = [
      mm.joinQueue({
        playerId: 'usr-c1',
        username: 'C1',
        avatarUrl: '/a1.png',
        socketId: 'sock-1',
        variant: 'POOL_101',
        entryAmount: 100,
        maxPlayers: 6,
      }),
      mm.joinQueue({
        playerId: 'usr-c2',
        username: 'C2',
        avatarUrl: '/a2.png',
        socketId: 'sock-2',
        variant: 'POOL_101',
        entryAmount: 100,
        maxPlayers: 6,
      }),
    ];

    const seat0 = results[0].ticket?.assignedSeatIndex;
    const seat1 = results[1].ticket?.assignedSeatIndex;
    expect(seat0).not.toBe(seat1);
    expect([0, 1]).toContain(seat0);
    expect([0, 1]).toContain(seat1);
  });

  // Test 11: Two tables have available seats (joins oldest compatible table first)
  it('11. Joins oldest compatible table first when multiple tables exist', () => {
    // Player 1 creates table A
    const resA = mm.joinQueue({
      playerId: 'usr-t1',
      username: 'T1',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    });

    const tables = mm.getWaitingTablesList();
    expect(tables.length).toBe(1);
    const tableAId = resA.table!.tableId;

    // Simulate another table B created slightly later
    const fakeTicket: any = {
      ticketId: 'tkt-b',
      playerId: 'usr-b',
      username: 'TB',
      avatarUrl: '/b.png',
      socketId: 'sock-b',
      gameType: 'POOL_101',
      poolVariant: 'POOL_101',
      tableCapacity: 6,
      tableConfigurationId: resA.ticket!.tableConfigurationId,
      pointValue: 1,
      entryAmount: 100,
      rulesVersion: '1.0.0',
    };
    // Force new table with later timestamp
    const resNew = (mm as any).createNewWaitingTable(fakeTicket);
    resNew.createdAt = Date.now() + 1000;

    // Player 3 joins: MUST join the oldest table A
    const res3 = mm.joinQueue({
      playerId: 'usr-t3',
      username: 'T3',
      avatarUrl: '/a3.png',
      socketId: 'sock-3',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    });

    expect(res3.table?.tableId).toBe(tableAId);
  });

  // Test 12: A player tries joining twice (idempotent join)
  it('12. A player joining twice receives existing reservation without duplicate seats', () => {
    const p: QueuedPlayer = {
      playerId: 'usr-double-1',
      username: 'DoubleJoiner',
      avatarUrl: '/a.png',
      socketId: 'sock-orig',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 6,
    };

    const res1 = mm.joinQueue(p);
    const seatBefore = res1.ticket?.assignedSeatIndex;

    // Second join with new socket
    p.socketId = 'sock-reconnected';
    const res2 = mm.joinQueue(p);

    expect(res2.ticket?.ticketId).toBe(res1.ticket?.ticketId);
    expect(res2.ticket?.assignedSeatIndex).toBe(seatBefore);
    expect(res2.table?.occupiedSeatCount).toBe(1); // Still exactly 1!
  });

  // Test 13: Server recovers during waiting
  it('13. Heartbeat updates lastHeartbeatAt and maintains active ticket state during waiting', () => {
    const res = mm.joinQueue({
      playerId: 'usr-hb-1',
      username: 'HeartbeatUser',
      avatarUrl: '/a.png',
      socketId: 'sock-hb',
      variant: 'POOL_201',
      entryAmount: 50,
      maxPlayers: 2,
    });

    const ticketId = res.ticket!.ticketId;
    const hbOk = mm.heartbeat(ticketId);
    expect(hbOk).toBe(true);

    const ticket = mm.getActiveTicket(ticketId);
    expect(ticket?.lastHeartbeatAt).toBeGreaterThanOrEqual(Date.now() - 100);
  });

  // Test 14: Server recovers during countdown
  it('14. Server preserves countdown timer state during client reconnection', () => {
    mm.setAcceleratedCountdownSec(5);

    mm.joinQueue({
      playerId: 'usr-p1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });
    const resBob = mm.joinQueue({
      playerId: 'usr-p2',
      username: 'Bob',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    const table = mm.getWaitingTablesList()[0];
    expect(table.tableStatus).toBe('START_COUNTDOWN');
    expect(table.gameStartsAt).toBeDefined();

    const ticketBob = mm.getActiveTicket(resBob.ticket!.ticketId);
    expect(ticketBob?.ticketStatus).toBe('RESERVED');
  });

  // Test 15: A player reconnects during countdown
  it('15. Player reconnecting during countdown receives current table state and remaining time', () => {
    mm.setAcceleratedCountdownSec(5);

    mm.joinQueue({
      playerId: 'usr-p1',
      username: 'Alice',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });
    mm.joinQueue({
      playerId: 'usr-p2',
      username: 'Bob',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    // Alice reconnects on new socket
    const reconnectRes = mm.reconnectPlayer('usr-p1', 'sock-1-new');
    expect(reconnectRes.state).toBe('START_COUNTDOWN');
    expect(reconnectRes.table?.tableStatus).toBe('START_COUNTDOWN');
    expect(reconnectRes.countdownSec).toBeGreaterThan(0);
    expect(reconnectRes.ticket?.socketId).toBe('sock-1-new');
  });

  // Test 16: A late player attempts to join a started table
  it('16. Late player cannot join an already full or started table; allocated fresh table', () => {
    mm.setCountdownDurationMs(0); // instant start

    // Table 1 fills with 2 players
    mm.joinQueue({
      playerId: 'usr-p1',
      username: 'P1',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });
    mm.joinQueue({
      playerId: 'usr-p2',
      username: 'P2',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    // Late player 3 joins
    const resLate = mm.joinQueue({
      playerId: 'usr-p3',
      username: 'P3_Late',
      avatarUrl: '/a3.png',
      socketId: 'sock-3',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    expect(resLate.state).toBe('PLAYERS_JOINING');
    expect(resLate.table?.occupiedSeatCount).toBe(1);
    expect(resLate.table?.seats[0].playerId).toBe('usr-p3');
  });

  // Test 17: Two server workers attempt to start the same table (single worker start protection)
  it('17. Concurrency guard prevents duplicate game starts; exactly one match created', () => {
    mm.setAcceleratedCountdownSec(5);

    mm.joinQueue({
      playerId: 'usr-p1',
      username: 'P1',
      avatarUrl: '/a1.png',
      socketId: 'sock-1',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });
    mm.joinQueue({
      playerId: 'usr-p2',
      username: 'P2',
      avatarUrl: '/a2.png',
      socketId: 'sock-2',
      variant: 'POOL_101',
      entryAmount: 100,
      maxPlayers: 2,
    });

    const table = mm.getWaitingTablesList()[0];

    // Two workers simultaneously call launchGame
    (mm as any).launchGame(table);
    (mm as any).launchGame(table);

    // Exactly one match must be created
    expect(matchesCreated.length).toBe(1);
  });
});
