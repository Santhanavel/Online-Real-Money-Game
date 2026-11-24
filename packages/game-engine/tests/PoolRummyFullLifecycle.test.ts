import { describe, it, expect } from 'vitest';
import { PoolRummyEngine } from '../src/engine/PoolRummyEngine';
import { TableConfig } from '@rummy/shared-types';

describe('Pool Rummy Full Production Lifecycle', () => {
  const baseConfig: TableConfig = {
    tableId: 'tbl-pool-test',
    variant: 'POOL_101',
    entryAmount: 500,
    pointValue: 1,
    maxPlayers: 2,
    turnDurationSec: 30,
    extraTimeSec: 15,
    firstDropPenalty: 20,
    middleDropPenalty: 40,
    wrongShowPenalty: 80,
    consecutiveTimeoutDrop: 3,
    maxScoreCap: 80,
    poolEliminationLimit: 101,
  };

  const players = [
    { playerId: 'p1', username: 'Amit', seatIndex: 0 },
    { playerId: 'p2', username: 'Rajesh', seatIndex: 1 },
    { playerId: 'p3', username: 'Priya', seatIndex: 2 },
  ];

  it('correctly tracks multi-deal cumulative pool scores and eliminates on reaching poolLimit', () => {
    const engine = new PoolRummyEngine(baseConfig, players);
    expect(engine.players.length).toBe(3);
    expect(engine.poolLimit).toBe(101);

    // Deal 1: Deal starts
    const deal1 = engine.startNextDeal();
    expect(deal1.dealNumber).toBe(1);

    // Simulate completion of Deal 1: Amit declares 0, Rajesh gets 40, Priya gets 80
    deal1.completedDealResult = {
      dealNumber: 1,
      winnerPlayerId: 'p1',
      winningDeclarationType: 'VALID',
      wildJokerCard: deal1.wildJokerCard!,
      scores: [
        { playerId: 'p1', username: 'Amit', totalPoolScore: 0, dealPenalty: 0, isWinner: true, groups: [] },
        { playerId: 'p2', username: 'Rajesh', totalPoolScore: 0, dealPenalty: 40, isWinner: false, groups: [] },
        { playerId: 'p3', username: 'Priya', totalPoolScore: 0, dealPenalty: 80, isWinner: false, groups: [] },
      ],
      closedDeckCount: 50,
      discardPileCount: 2,
    };

    const res1 = engine.concludeCurrentDeal();
    expect(res1.isPoolCompleted).toBe(false);
    expect(engine.players.find((p) => p.playerId === 'p2')?.totalPoolScore).toBe(40);
    expect(engine.players.find((p) => p.playerId === 'p3')?.totalPoolScore).toBe(80);
    expect(engine.players.find((p) => p.playerId === 'p3')?.isEliminated).toBe(false);

    // Deal 2: Deal starts
    const deal2 = engine.startNextDeal();
    expect(deal2.dealNumber).toBe(2);

    // Deal 2 conclusion: Priya gets 40 points -> cumulative = 120 -> ELIMINATED (>= 101)
    deal2.completedDealResult = {
      dealNumber: 2,
      winnerPlayerId: 'p1',
      winningDeclarationType: 'VALID',
      wildJokerCard: deal2.wildJokerCard!,
      scores: [
        { playerId: 'p1', username: 'Amit', totalPoolScore: 0, dealPenalty: 0, isWinner: true, groups: [] },
        { playerId: 'p2', username: 'Rajesh', totalPoolScore: 40, dealPenalty: 20, isWinner: false, groups: [] },
        { playerId: 'p3', username: 'Priya', totalPoolScore: 80, dealPenalty: 40, isWinner: false, groups: [] },
      ],
      closedDeckCount: 48,
      discardPileCount: 4,
    };

    const res2 = engine.concludeCurrentDeal();
    expect(res2.isPoolCompleted).toBe(false);

    const priya = engine.players.find((p) => p.playerId === 'p3')!;
    expect(priya.totalPoolScore).toBe(120);
    expect(priya.isEliminated).toBe(true);

    // Rajesh has 60, Amit has 0
    // Priya re-entry check:
    // Highest active score is 60 (Rajesh). 60 <= 79 cutoff for Pool 101.
    const reEntryEligibility = engine.getReentryEligibility('p3');
    expect(reEntryEligibility.eligible).toBe(true);
    expect(reEntryEligibility.startingScore).toBe(61); // highestActiveScore + 1

    // Execute re-entry
    const reEntryRes = engine.executeReentry('p3');
    expect(reEntryRes.success).toBe(true);
    expect(reEntryRes.newScore).toBe(61);
    expect(priya.isEliminated).toBe(false);
    expect(priya.totalPoolScore).toBe(61);
  });

  it('rejects re-entry when highest active score exceeds cutoff threshold (79 for Pool 101)', () => {
    const engine = new PoolRummyEngine(baseConfig, players);
    const priya = engine.players.find((p) => p.playerId === 'p3')!;
    const rajesh = engine.players.find((p) => p.playerId === 'p2')!;

    priya.isEliminated = true;
    priya.totalPoolScore = 110;
    rajesh.totalPoolScore = 85; // > 79 threshold!

    const eligibility = engine.getReentryEligibility('p3');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toContain('exceeds re-entry cutoff');

    const execRes = engine.executeReentry('p3');
    expect(execRes.success).toBe(false);
    expect(priya.isEliminated).toBe(true);
  });

  it('correctly concludes tournament and awards victory to last uneliminated player', () => {
    const engine = new PoolRummyEngine(baseConfig, [players[0], players[1]]);
    const deal1 = engine.startNextDeal();

    // Rajesh reaches 105 -> eliminated -> Amit is the sole survivor!
    deal1.completedDealResult = {
      dealNumber: 1,
      winnerPlayerId: 'p1',
      winningDeclarationType: 'VALID',
      wildJokerCard: deal1.wildJokerCard!,
      scores: [
        { playerId: 'p1', username: 'Amit', totalPoolScore: 0, dealPenalty: 0, isWinner: true, groups: [] },
        { playerId: 'p2', username: 'Rajesh', totalPoolScore: 0, dealPenalty: 105, isWinner: false, groups: [] },
      ],
      closedDeckCount: 50,
      discardPileCount: 2,
    };

    const res = engine.concludeCurrentDeal();
    expect(res.isPoolCompleted).toBe(true);
    expect(engine.isCompleted).toBe(true);
    expect(res.finalResult?.winnerPlayerId).toBe('p1');
    expect(res.finalResult?.finalStandings[0].username).toBe('Amit');
  });
});
