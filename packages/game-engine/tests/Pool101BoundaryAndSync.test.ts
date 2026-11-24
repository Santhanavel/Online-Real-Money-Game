import { describe, it, expect } from 'vitest';
import { PoolRummyEngine } from '../src/engine/PoolRummyEngine';
import { TableConfig } from '@rummy/shared-types';

describe('Pool 101 / 201 / 240 Elimination Thresholds and Lifecycle', () => {
  const pool101Config: TableConfig = {
    tableId: 'tbl-pool-101',
    variant: 'POOL_101',
    entryAmount: 100,
    maxPlayers: 2,
    turnDurationSec: 30,
    firstDropPenalty: 20,
    middleDropPenalty: 40,
    wrongShowPenalty: 80,
    consecutiveTimeoutDrop: 3,
    maxScoreCap: 80,
    poolEliminationLimit: 101,
  };

  const pool201Config: TableConfig = {
    ...pool101Config,
    tableId: 'tbl-pool-201',
    variant: 'POOL_201',
    poolEliminationLimit: 201,
  };

  const pool240Config: TableConfig = {
    ...pool101Config,
    tableId: 'tbl-pool-240',
    variant: 'POOL_240',
    poolEliminationLimit: 240,
  };

  const players = [
    { playerId: 'p1', username: 'Player 1', seatIndex: 0 },
    { playerId: 'p2', username: 'Player 2', seatIndex: 1 },
  ];

  it('guarantees Pool 101: 99 and 100 points are ACTIVE, 101 and 102 are ELIMINATED', () => {
    const engine = new PoolRummyEngine(pool101Config, players);
    expect(engine.poolLimit).toBe(101);

    // Test 99 points
    engine.players[0].totalPoolScore = 79;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 79 + 20 = 99
    let res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(99);
    expect(engine.players[0].isEliminated).toBe(false);
    expect(res.isPoolCompleted).toBe(false);

    // Test 100 points: CRITICAL P0 REQUIREMENT
    engine.players[0].totalPoolScore = 80;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 80 + 20 = 100
    res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(100);
    expect(engine.players[0].isEliminated).toBe(false);
    expect(res.isPoolCompleted).toBe(false);

    // Test 101 points: Exact elimination boundary
    engine.players[0].totalPoolScore = 81;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 81 + 20 = 101
    res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(101);
    expect(engine.players[0].isEliminated).toBe(true);
    expect(res.isPoolCompleted).toBe(true);
    expect(res.finalResult?.winnerPlayerId).toBe('p2');

    // Test 102 points
    const engine2 = new PoolRummyEngine(pool101Config, players);
    engine2.players[0].totalPoolScore = 82;
    engine2.startNextDeal();
    engine2.currentDealEngine!.drop('p1'); // 82 + 20 = 102
    const res2 = engine2.concludeCurrentDeal();
    expect(engine2.players[0].totalPoolScore).toBe(102);
    expect(engine2.players[0].isEliminated).toBe(true);
    expect(res2.isPoolCompleted).toBe(true);
  });

  it('guarantees Pool 201: 200 points is ACTIVE, 201 is ELIMINATED', () => {
    const engine = new PoolRummyEngine(pool201Config, players);
    expect(engine.poolLimit).toBe(201);

    engine.players[0].totalPoolScore = 180;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 180 + 20 = 200
    let res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(200);
    expect(engine.players[0].isEliminated).toBe(false);
    expect(res.isPoolCompleted).toBe(false);

    engine.players[0].totalPoolScore = 181;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 181 + 20 = 201
    res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(201);
    expect(engine.players[0].isEliminated).toBe(true);
    expect(res.isPoolCompleted).toBe(true);
  });

  it('guarantees Pool 240: 239 points is ACTIVE, 240 is ELIMINATED', () => {
    const engine = new PoolRummyEngine(pool240Config, players);
    expect(engine.poolLimit).toBe(240);

    engine.players[0].totalPoolScore = 219;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 219 + 20 = 239
    let res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(239);
    expect(engine.players[0].isEliminated).toBe(false);
    expect(res.isPoolCompleted).toBe(false);

    engine.players[0].totalPoolScore = 220;
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1'); // 220 + 20 = 240
    res = engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(240);
    expect(engine.players[0].isEliminated).toBe(true);
    expect(res.isPoolCompleted).toBe(true);
  });

  it('executes two-player sequence: p1 reaches 100, both active, deal 2 starts, p1 reaches 101, eliminated and p2 wins', () => {
    const engine = new PoolRummyEngine(pool101Config, players);

    // Deal 1: p1 drops (+20 pts) -> 20
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1');
    engine.concludeCurrentDeal();
    expect(engine.players[0].totalPoolScore).toBe(20);

    // Fast-forward to 100 points
    engine.players[0].totalPoolScore = 80;
    engine.players[1].totalPoolScore = 20;

    // Deal 2: p1 drops (+20 pts) -> 100 points
    engine.startNextDeal();
    engine.currentDealEngine!.drop('p1');
    const deal2Conclusion = engine.concludeCurrentDeal();

    // Verification step 1 & 2:
    expect(engine.players[0].totalPoolScore).toBe(100);
    expect(engine.players[0].isEliminated).toBe(false);
    expect(engine.players[1].isEliminated).toBe(false);
    expect(deal2Conclusion.isPoolCompleted).toBe(false);

    // Verification step 3: Next deal must be able to start with both uneliminated players
    const deal3 = engine.startNextDeal();
    expect(deal3.players.length).toBe(2);

    // Deal 3: p1 drops (+20 pts) -> 120 points (>= 101)
    deal3.drop('p1');
    const deal3Conclusion = engine.concludeCurrentDeal();

    // Verification step 4 & 5:
    expect(engine.players[0].totalPoolScore).toBe(120);
    expect(engine.players[0].isEliminated).toBe(true);
    expect(deal3Conclusion.isPoolCompleted).toBe(true);
    expect(deal3Conclusion.finalResult?.winnerPlayerId).toBe('p2');
  });
});
