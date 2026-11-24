import { describe, it, expect } from 'vitest';
import { PoolRummyEngine } from '../src/engine/PoolRummyEngine';
import { TableConfig } from '@rummy/shared-types';

describe('Pool Rummy Prize Split Engine', () => {
  const baseConfig: TableConfig = {
    tableId: 'tbl-split-test',
    variant: 'POOL_101',
    entryAmount: 100, // 100 chips/rupees
    pointValue: 1,
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

  const initialSixPlayers = [
    { playerId: 'p1', username: 'Amit', seatIndex: 0 },
    { playerId: 'p2', username: 'Rajesh', seatIndex: 1 },
    { playerId: 'p3', username: 'Priya', seatIndex: 2 },
    { playerId: 'p4', username: 'Neha', seatIndex: 3 },
    { playerId: 'p5', username: 'Suresh', seatIndex: 4 },
    { playerId: 'p6', username: 'Karan', seatIndex: 5 },
  ];

  it('correctly calculates remaining drops based on middle drop penalty', () => {
    const engine = new PoolRummyEngine(baseConfig, initialSixPlayers);
    // Pool 101, middle drop = 40
    // score 0: (101 - 0 - 1) / 40 = 100 / 40 = 2 drops
    expect(engine.getRemainingDrops(0)).toBe(2);
    // score 20: (101 - 20 - 1) / 40 = 80 / 40 = 2 drops
    expect(engine.getRemainingDrops(20)).toBe(2);
    // score 61: (101 - 61 - 1) / 40 = 39 / 40 = 0 drops
    expect(engine.getRemainingDrops(61)).toBe(0);
    // score 60: (101 - 60 - 1) / 40 = 40 / 40 = 1 drop
    expect(engine.getRemainingDrops(60)).toBe(1);
  });

  it('enforces table capacity split eligibility (6-player table allows split when 2 or 3 remain)', () => {
    const engine = new PoolRummyEngine(baseConfig, initialSixPlayers);

    // 6 players active -> Ineligible
    let elig = engine.checkSplitEligibility();
    expect(elig.isEligible).toBe(false);
    expect(elig.reason).toContain('requires 2 or 3 active players');

    // Eliminate 3 players -> 3 players active -> Eligible!
    engine.players[3].isEliminated = true;
    engine.players[4].isEliminated = true;
    engine.players[5].isEliminated = true;

    elig = engine.checkSplitEligibility();
    expect(elig.isEligible).toBe(true);
    expect(elig.eligiblePlayerCount).toBe(3);
    expect(elig.calculation).toBeDefined();

    // Eliminate 1 more -> 2 players active -> Still Eligible!
    engine.players[2].isEliminated = true;
    elig = engine.checkSplitEligibility();
    expect(elig.isEligible).toBe(true);
    expect(elig.eligiblePlayerCount).toBe(2);

    // Eliminate 1 more -> 1 player active -> Game completes, split ineligible
    engine.players[1].isEliminated = true;
    engine.isCompleted = true;
    elig = engine.checkSplitEligibility();
    expect(elig.isEligible).toBe(false);
  });

  it('disallows split on 2-player tables', () => {
    const twoPlayerEngine = new PoolRummyEngine(
      { ...baseConfig, maxPlayers: 2 },
      [initialSixPlayers[0], initialSixPlayers[1]]
    );

    const elig = twoPlayerEngine.checkSplitEligibility();
    expect(elig.isEligible).toBe(false);
    expect(elig.reason).toContain('2-player tables are not eligible');
  });

  it('performs exact integer drop-equalization calculation with zero remainder leakage', () => {
    const engine = new PoolRummyEngine(baseConfig, initialSixPlayers);
    // 3 active players:
    // p1: 10 points -> remaining drops = 2
    // p2: 50 points -> remaining drops = 1
    // p3: 70 points -> remaining drops = 0
    engine.players[0].totalPoolScore = 10;
    engine.players[1].totalPoolScore = 50;
    engine.players[2].totalPoolScore = 70;
    engine.players[3].isEliminated = true;
    engine.players[4].isEliminated = true;
    engine.players[5].isEliminated = true;

    const calc = engine.calculateSplit();
    expect(calc.eligiblePlayerIds.length).toBe(3);

    // Gross pool = 6 players * 100 * 100 paise = 60,000 paise
    // Platform fee (10%) = 6,000 paise
    // Net prize pool = 54,000 paise
    expect(calc.totalPrizePool).toBe(60000);
    expect(calc.platformFee).toBe(6000);
    expect(calc.netPrizePool).toBe(54000);

    // Total payouts across all 3 players must match netPrizePool exactly!
    expect(calc.reconciliationTotal).toBe(54000);

    const p1Calc = calc.playerCalculations.find((p) => p.playerId === 'p1')!;
    const p2Calc = calc.playerCalculations.find((p) => p.playerId === 'p2')!;
    const p3Calc = calc.playerCalculations.find((p) => p.playerId === 'p3')!;

    // p1 has 2 drops, p2 has 1 drop, p3 has 0 drops
    // p1 should receive the highest payout due to having the most excess drops!
    expect(p1Calc.totalPayout).toBeGreaterThan(p2Calc.totalPayout);
    expect(p2Calc.totalPayout).toBeGreaterThan(p3Calc.totalPayout);
  });

  it('handles voting lifecycle: unanimous accept concludes match with SPLIT_MUTUAL', () => {
    const engine = new PoolRummyEngine(baseConfig, initialSixPlayers);
    engine.players[2].isEliminated = true;
    engine.players[3].isEliminated = true;
    engine.players[4].isEliminated = true;
    engine.players[5].isEliminated = true;
    // 2 players remaining: p1, p2

    // p1 initiates split
    const splitReq = engine.createSplitRequest('p1');
    expect(splitReq.status).toBe('PENDING');
    expect(splitReq.votes['p1']).toBe(true);
    expect(splitReq.votes['p2']).toBe(null);

    // p2 accepts
    const res = engine.recordSplitVote('p2', true);
    expect(res.status).toBe('ACCEPTED');
    expect(engine.isCompleted).toBe(true);
    expect(engine.finalResult?.winnerPlayerId).toBe('SPLIT_MUTUAL');
    expect(engine.finalResult?.finalStandings.length).toBe(2);
  });

  it('handles voting lifecycle: single decline immediately terminates split proposal', () => {
    const engine = new PoolRummyEngine(baseConfig, initialSixPlayers);
    engine.players[2].isEliminated = true;
    engine.players[3].isEliminated = true;
    engine.players[4].isEliminated = true;
    engine.players[5].isEliminated = true;

    engine.createSplitRequest('p1');
    const res = engine.recordSplitVote('p2', false);
    expect(res.status).toBe('DECLINED');
    expect(engine.activeSplitRequest).toBeNull();
    expect(engine.isCompleted).toBe(false);
  });
});
