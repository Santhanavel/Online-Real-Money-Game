import { describe, it, expect, vi } from 'vitest';
import { TableManager } from '../src/table/TableManager';
import { TableConfig } from '@rummy/shared-types';

describe('Server Pool Split, Hand Reveal, and Countdown Lifecycle', () => {
  const config: TableConfig = {
    tableId: 'tbl-server-pool-split',
    variant: 'POOL_101',
    pointValue: 1,
    entryAmount: 100,
    maxPlayers: 6,
    turnDurationSec: 30,
    extraTimeSec: 15,
    firstDropPenalty: 20,
    middleDropPenalty: 40,
    wrongShowPenalty: 80,
    consecutiveTimeoutDrop: 3,
    maxScoreCap: 80,
    poolEliminationLimit: 101,
  };

  it('emits deal:hands_revealed with verified player cards when deal completes', () => {
    let handsRevealedPayload: any = null;
    let scoreboardPayload: any = null;

    const tableManager = new TableManager(
      () => {},
      (tableId, event, data) => {
        if (event === 'deal:hands_revealed') {
          handsRevealedPayload = data;
        }
        if (event === 'scoreboard:updated') {
          scoreboardPayload = data;
        }
      }
    );

    const session = tableManager.createTable(config, [
      { playerId: 'p1', username: 'Amit', avatarUrl: '/1.png', socketId: 's1' },
      { playerId: 'p2', username: 'Rajesh', avatarUrl: '/2.png', socketId: 's2' },
    ]);

    // Player 1 drops deal
    tableManager.handleDrop(session.tableId, 'p1');

    expect(handsRevealedPayload).toBeDefined();
    expect(handsRevealedPayload.tableId).toBe(session.tableId);
    expect(handsRevealedPayload.hands.length).toBe(2);

    const p1Hand = handsRevealedPayload.hands.find((h: any) => h.playerId === 'p1');
    expect(p1Hand.dealPenalty).toBe(20); // First drop

    const p2Hand = handsRevealedPayload.hands.find((h: any) => h.playerId === 'p2');
    expect(p2Hand.dealPenalty).toBe(0);
    expect(p2Hand.isWinner).toBe(true);

    expect(scoreboardPayload).toBeDefined();
    expect(scoreboardPayload.rows.length).toBe(2);
  });

  it('handles split request, pauses next deal countdown, and handles unanimous accept', () => {
    let splitRequestedPayload: any = null;
    let splitCompletedPayload: any = null;
    let countdownPausedPayload: any = null;

    const tableManager = new TableManager(
      () => {},
      (tableId, event, data) => {
        if (event === 'split:requested') splitRequestedPayload = data;
        if (event === 'split:completed') splitCompletedPayload = data;
        if (event === 'deal:countdown_paused') countdownPausedPayload = data;
      }
    );

    const session = tableManager.createTable(config, [
      { playerId: 'p1', username: 'Amit', avatarUrl: '/1.png', socketId: 's1' },
      { playerId: 'p2', username: 'Rajesh', avatarUrl: '/2.png', socketId: 's2' },
      { playerId: 'p3', username: 'Priya', avatarUrl: '/3.png', socketId: 's3' },
      { playerId: 'p4', username: 'Neha', avatarUrl: '/4.png', socketId: 's4' },
      { playerId: 'p5', username: 'Suresh', avatarUrl: '/5.png', socketId: 's5' },
      { playerId: 'p6', username: 'Karan', avatarUrl: '/6.png', socketId: 's6' },
    ]);

    // Simulate 4 players eliminated
    session.poolEngine!.players[2].isEliminated = true;
    session.poolEngine!.players[3].isEliminated = true;
    session.poolEngine!.players[4].isEliminated = true;
    session.poolEngine!.players[5].isEliminated = true;
    // 2 active players: p1, p2

    // Start next deal countdown
    tableManager.startNextDealCountdown(session, 15);

    // p1 requests split
    const splitReq = tableManager.handleRequestSplit(session.tableId, 'p1');
    expect(splitReq).toBeDefined();
    expect(splitRequestedPayload).toBeDefined();
    expect(countdownPausedPayload).toBeDefined();

    // p2 votes accept
    const voteRes = tableManager.handleVoteSplit(session.tableId, 'p2', true);
    expect(voteRes.status).toBe('ACCEPTED');
    expect(splitCompletedPayload).toBeDefined();
    expect(session.poolEngine!.isCompleted).toBe(true);
  });

  it('handles split decline and resumes countdown', () => {
    let splitDeclinedPayload: any = null;

    const tableManager = new TableManager(
      () => {},
      (tableId, event, data) => {
        if (event === 'split:declined') splitDeclinedPayload = data;
      }
    );

    const session = tableManager.createTable(config, [
      { playerId: 'p1', username: 'Amit', avatarUrl: '/1.png', socketId: 's1' },
      { playerId: 'p2', username: 'Rajesh', avatarUrl: '/2.png', socketId: 's2' },
      { playerId: 'p3', username: 'Priya', avatarUrl: '/3.png', socketId: 's3' },
      { playerId: 'p4', username: 'Neha', avatarUrl: '/4.png', socketId: 's4' },
    ]);

    session.poolEngine!.players[2].isEliminated = true;
    session.poolEngine!.players[3].isEliminated = true;

    tableManager.startNextDealCountdown(session, 10);
    tableManager.handleRequestSplit(session.tableId, 'p1');

    // p2 declines
    const voteRes = tableManager.handleVoteSplit(session.tableId, 'p2', false);
    expect(voteRes.status).toBe('DECLINED');
    expect(splitDeclinedPayload).toBeDefined();
    expect(session.poolEngine!.isCompleted).toBe(false);
  });

  it('processes verified re-entry for an eliminated player', () => {
    let reenteredPayload: any = null;

    const tableManager = new TableManager(
      () => {},
      (tableId, event, data) => {
        if (event === 'game:player_reentered') reenteredPayload = data;
      }
    );

    const session = tableManager.createTable(config, [
      { playerId: 'p1', username: 'Amit', avatarUrl: '/1.png', socketId: 's1' },
      { playerId: 'p2', username: 'Rajesh', avatarUrl: '/2.png', socketId: 's2' },
      { playerId: 'p3', username: 'Priya', avatarUrl: '/3.png', socketId: 's3' },
    ]);

    // p3 eliminated with 110 points, p2 has 50 points (<= 79)
    session.poolEngine!.players[2].isEliminated = true;
    session.poolEngine!.players[2].totalPoolScore = 110;
    session.poolEngine!.players[1].totalPoolScore = 50;

    const res = tableManager.handleRequestReentry(session.tableId, 'p3');
    expect(res.success).toBe(true);
    expect(res.newScore).toBe(51); // 50 + 1
    expect(reenteredPayload.playerId).toBe('p3');
    expect(reenteredPayload.newScore).toBe(51);
    expect(session.poolEngine!.players[2].isEliminated).toBe(false);
  });
});
