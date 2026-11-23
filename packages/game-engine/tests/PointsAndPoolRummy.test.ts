import { describe, expect, it } from 'vitest';
import { TableConfig } from '@rummy/shared-types';
import { PointsRummyEngine } from '../src/engine/PointsRummyEngine';
import { PoolRummyEngine } from '../src/engine/PoolRummyEngine';

describe('PointsRummyEngine & PoolRummyEngine', () => {
  const pointsConfig: TableConfig = {
    tableId: 'table-pts-1',
    variant: 'POINTS',
    pointValue: 1.0,
    maxPlayers: 2,
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

  it('runs complete Points Rummy deal with 2 players', () => {
    const players = [
      { playerId: 'p1', username: 'PlayerOne', seatIndex: 0 },
      { playerId: 'p2', username: 'PlayerTwo', seatIndex: 1 },
    ];

    const engine = new PointsRummyEngine(pointsConfig, players, 1);
    engine.startDeal(0);

    expect(engine.tableStatus).toBe('IN_PROGRESS');
    expect(engine.activePlayerSeat).toBe(0);
    expect(engine.turnPhase).toBe('DRAW');
    expect(engine.wildJokerCard).toBeDefined();
    expect(engine.openDiscardPile.length).toBe(1);

    // Player 1 has 13 cards, player 2 has 13 cards
    expect(engine.players[0].hand.length).toBe(13);
    expect(engine.players[1].hand.length).toBe(13);

    // Player 1 draws from closed deck
    const drawn = engine.drawCard('p1', 'CLOSED_DECK');
    expect(engine.players[0].hand.length).toBe(14);
    expect(engine.turnPhase).toBe('DISCARD');

    // Player 1 discards drawn card
    const discarded = engine.discardCard('p1', drawn.cardId);
    expect(engine.players[0].hand.length).toBe(13);
    expect(engine.openDiscardPile[engine.openDiscardPile.length - 1].cardId).toBe(discarded.cardId);

    // Turn advances to Player 2
    expect(engine.activePlayerSeat).toBe(1);
    expect(engine.turnPhase).toBe('DRAW');

    // Player 2 draws from discard pile
    const drawn2 = engine.drawCard('p2', 'OPEN_DISCARD');
    expect(drawn2.cardId).toBe(discarded.cardId);
    expect(engine.players[1].hand.length).toBe(14);

    // Player 2 drops -> Player 1 wins
    const dropType = engine.drop('p2');
    expect(dropType).toBe('MIDDLE'); // already drew
    expect(engine.tableStatus).toBe('DEAL_OVER');
    expect(engine.completedDealResult).toBeDefined();
    expect(engine.completedDealResult?.winnerPlayerId).toBe('p1');
    expect(engine.players[1].dealScore).toBe(40);
  });

  it('runs Pool Rummy multi-deal game and eliminates players reaching limit', () => {
    const poolConfig: TableConfig = {
      ...pointsConfig,
      tableId: 'table-pool-1',
      variant: 'POOL_101',
      poolEliminationLimit: 101,
    };

    const players = [
      { playerId: 'p1', username: 'Alice', seatIndex: 0 },
      { playerId: 'p2', username: 'Bob', seatIndex: 1 },
    ];

    const poolEngine = new PoolRummyEngine(poolConfig, players);
    const deal1 = poolEngine.startNextDeal();

    // Deal 1: Player 2 drops first turn -> 20 pts
    deal1.drop('p2');
    const conclusion1 = poolEngine.concludeCurrentDeal();
    expect(conclusion1.isPoolCompleted).toBe(false);
    expect(poolEngine.players[1].totalPoolScore).toBe(20);
    expect(poolEngine.players[1].isEliminated).toBe(false);

    // Start Deal 2
    const deal2 = poolEngine.startNextDeal();
    // Simulate Bob incurring another 80 penalty (e.g. invalid show / wrong declaration)
    const drawn = deal2.drawCard('p2', 'CLOSED_DECK');
    // Bob makes a wrong show declaration with invalid cards
    const wrongShowGroups = [
      { cards: [deal2.players[1].hand[0], deal2.players[1].hand[1], deal2.players[1].hand[2]] },
    ];
    // Declare wrong show
    const declRes = deal2.declareHand('p2', drawn.cardId, wrongShowGroups);
    expect(declRes.isValid).toBe(false);

    const conclusion2 = poolEngine.concludeCurrentDeal();
    // Bob gets 80 wrong show penalty -> 20 + 80 = 100
    expect(poolEngine.players[1].totalPoolScore).toBe(100);
    expect(conclusion2.isPoolCompleted).toBe(false);

    // Start Deal 3
    const deal3 = poolEngine.startNextDeal();
    deal3.drop('p2'); // Bob drops (middle drop 40 pts -> 100 + 40 = 140 >= 101)
    const conclusion3 = poolEngine.concludeCurrentDeal();

    expect(conclusion3.isPoolCompleted).toBe(true);
    expect(poolEngine.players[1].totalPoolScore).toBe(120); // 100 + 20 (first drop) >= 101 limit
    expect(poolEngine.players[1].isEliminated).toBe(true);
    expect(conclusion3.finalResult?.winnerPlayerId).toBe('p1');
    expect(conclusion3.finalResult?.finalStandings[0].playerId).toBe('p1');
  });
});
