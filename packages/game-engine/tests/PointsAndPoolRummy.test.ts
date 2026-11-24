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

  it('strictly validates 13 to 14 card lifecycle, prevents duplicate draws, and checks turn authority', () => {
    const players = [
      { playerId: 'p1', username: 'Alice', seatIndex: 0 },
      { playerId: 'p2', username: 'Bob', seatIndex: 1 },
    ];

    const engine = new PointsRummyEngine(pointsConfig, players, 1);
    engine.startDeal(0);

    // Initial state: 13 cards each
    expect(engine.players[0].hand.length).toBe(13);
    expect(engine.players[1].hand.length).toBe(13);

    // Turn enforcement: Player 2 cannot draw out of turn
    expect(() => {
      engine.drawCard('p2', 'CLOSED_DECK');
    }).toThrow(/Not player p2's turn/);

    // Player 1 draws: hand becomes 14
    const drawn = engine.drawCard('p1', 'CLOSED_DECK');
    expect(engine.players[0].hand.length).toBe(14);
    // Verified: player.groups contains all 14 cards!
    const totalGroupedCards = engine.players[0].groups.reduce((sum, g) => sum + g.cards.length, 0);
    expect(totalGroupedCards).toBe(14);

    // Duplicate draw prevention: Cannot draw twice in same turn
    expect(() => {
      engine.drawCard('p1', 'CLOSED_DECK');
    }).toThrow(/Invalid turn phase: must be DRAW/);

    // Player 1 discards: hand returns to 13
    engine.discardCard('p1', drawn.cardId);
    expect(engine.players[0].hand.length).toBe(13);
    const postDiscardGroupedCards = engine.players[0].groups.reduce((sum, g) => sum + g.cards.length, 0);
    expect(postDiscardGroupedCards).toBe(13);

    // Turn is now Player 2
    expect(engine.activePlayerSeat).toBe(1);
    expect(engine.turnPhase).toBe('DRAW');
  });

  it('runs Pool 201 Rummy and validates 201 elimination threshold', () => {
    const pool201Config: TableConfig = {
      ...pointsConfig,
      tableId: 'table-pool-201',
      variant: 'POOL_201',
      poolEliminationLimit: 201,
    };

    const players = [
      { playerId: 'p1', username: 'P1', seatIndex: 0 },
      { playerId: 'p2', username: 'P2', seatIndex: 1 },
    ];

    const pool201 = new PoolRummyEngine(pool201Config, players);

    // Deal 1: Player 2 gets 80 pts
    const deal1 = pool201.startNextDeal();
    deal1.players[1].dealScore = 80;
    deal1.drop('p2');
    pool201.concludeCurrentDeal();
    expect(pool201.players[1].totalPoolScore).toBe(20); // first drop 20
    expect(pool201.players[1].isEliminated).toBe(false);

    // Deal 2: Another drop
    const deal2 = pool201.startNextDeal();
    const d2 = deal2.drawCard('p2', 'CLOSED_DECK');
    deal2.drop('p2'); // middle drop 40
    pool201.concludeCurrentDeal();
    expect(pool201.players[1].totalPoolScore).toBe(60);
    expect(pool201.players[1].isEliminated).toBe(false);

    // At 60 pts, Bob is still very much alive in Pool 201 (limit 201)
    expect(pool201.isCompleted).toBe(false);
  });

  it('triggers 15-second ARRANGE_HAND phase on valid declaration and accepts opponent submission', () => {
    const players = [
      { playerId: 'p1', username: 'WinnerPlayer', seatIndex: 0 },
      { playerId: 'p2', username: 'OpponentPlayer', seatIndex: 1 },
    ];

    const engine = new PointsRummyEngine(pointsConfig, players, 1);
    engine.startDeal(0);

    // Give player 1 a guaranteed winning 14-card hand
    const pureSeq = [
      { cardId: 'c1', suit: 'HEARTS' as const, rank: 'A' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS' as const, rank: '2' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'HEARTS' as const, rank: '3' as const, deckIndex: 0, isPrintedJoker: false },
    ];
    const seq2 = [
      { cardId: 'c4', suit: 'SPADES' as const, rank: '4' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c5', suit: 'SPADES' as const, rank: '5' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c6', suit: 'SPADES' as const, rank: '6' as const, deckIndex: 0, isPrintedJoker: false },
    ];
    const set1 = [
      { cardId: 'c7', suit: 'CLUBS' as const, rank: 'K' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c8', suit: 'DIAMONDS' as const, rank: 'K' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c9', suit: 'HEARTS' as const, rank: 'K' as const, deckIndex: 0, isPrintedJoker: false },
    ];
    const set2 = [
      { cardId: 'c10', suit: 'CLUBS' as const, rank: '7' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c11', suit: 'DIAMONDS' as const, rank: '7' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c12', suit: 'HEARTS' as const, rank: '7' as const, deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c13', suit: 'SPADES' as const, rank: '7' as const, deckIndex: 0, isPrintedJoker: false },
    ];
    const finishCard = { cardId: 'c_finish', suit: 'CLUBS' as const, rank: '2' as const, deckIndex: 0, isPrintedJoker: false };

    engine.players[0].hand = [...pureSeq, ...seq2, ...set1, ...set2, finishCard];
    engine.turnPhase = 'DISCARD';
    engine.players[0].hasDrawnInCurrentTurn = true;

    // Player 1 declares with finishCard
    const declResult = engine.declareHand('p1', 'c_finish', [
      { cards: pureSeq },
      { cards: seq2 },
      { cards: set1 },
      { cards: set2 },
    ]);

    expect(declResult.isValid).toBe(true);
    expect(declResult.status).toBe('ARRANGE_HAND');
    expect(engine.tableStatus).toBe('ARRANGE_HAND');
    expect(engine.declarationInfo).toBeDefined();
    expect(engine.declarationInfo?.winnerPlayerId).toBe('p1');
    expect(engine.declarationInfo?.arrangeDurationSec).toBe(15);

    // Opponent player submits their arranged hand to reduce points
    const oppSubmission = engine.submitArrangedHand('p2', [
      { id: 'g1', cards: [engine.players[1].hand[0], engine.players[1].hand[1]] },
    ]);

    expect(oppSubmission.allSubmitted).toBe(true);
    expect(oppSubmission.dealResult).toBeDefined();
    expect(engine.tableStatus).toBe('DEAL_OVER');
    expect(engine.completedDealResult?.winnerPlayerId).toBe('p1');
    expect(engine.completedDealResult?.scores.find((s) => s.playerId === 'p1')?.dealPenalty).toBe(0);
  });
});
