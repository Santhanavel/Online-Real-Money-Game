import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableConfig } from '@rummy/shared-types';
import { TableManager } from '../src/table/TableManager';

const config = (tableId: string): TableConfig => ({
  tableId, variant: 'POINTS', pointValue: 1, maxPlayers: 6,
  turnDurationSec: 30, extraTimeSec: 15, firstDropPenalty: 20,
  middleDropPenalty: 40, wrongShowPenalty: 80, consecutiveTimeoutDrop: 3,
  maxScoreCap: 80, poolEliminationLimit: 0, deckCount: 2, printedJokersPerDeck: 2,
});
const players = () => ['one', 'two', 'three'].map(id => ({playerId: id, username: id, avatarUrl: '', socketId: `socket-${id}`}));

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('Table turn deadline', () => {
  it('does not extend the active turn when another player drops', () => {
    vi.useFakeTimers();
    const manager = new TableManager();
    const session = manager.createTable(config('deadline-drop'), players());
    vi.advanceTimersByTime(10000);
    manager.handleDrop(session.tableId, 'three');
    vi.advanceTimersByTime(20000);
    expect(session.pointsEngine?.getPublicState().players.find(player => player.playerId === 'one')?.consecutiveTimeouts).toBe(1);
    expect(session.pointsEngine?.getPublicState().activePlayerSeat).toBe(1);
  });
  it('restores the same seat, drawn hand and deadline after disconnect', () => {
    vi.useFakeTimers();
    const manager = new TableManager();
    const session = manager.createTable(config('reconnect'), players());
    manager.handleDraw(session.tableId, 'one', 'CLOSED_DECK');
    const engine = session.pointsEngine!;
    const hand = engine.getPrivateStateForPlayer('one').myHand.map(card => card.cardId);
    const deadline = engine.turnExpiresAt;
    manager.handlePlayerDisconnect('socket-one');
    vi.advanceTimersByTime(5000);
    expect(manager.getResumableTable('one')).toBe(session);
    expect(manager.handlePlayerReconnect('one', 'replacement', 'different-table')).toBeNull();
    expect(manager.handlePlayerReconnect('one', 'replacement', session.tableId)).toBe(session);
    manager.handlePlayerDisconnect('socket-one');
    expect(session.players[0]).toMatchObject({ socketId: 'replacement', isOnline: true, seatIndex: 0 });
    expect(engine.getPrivateStateForPlayer('one').myHand.map(card => card.cardId)).toEqual(hand);
    expect(engine.turnExpiresAt).toBe(deadline);
    expect(engine.getPublicState().turnPhase).toBe('DISCARD');
    engine.tableStatus = 'COMPLETED';
    expect(manager.getResumableTable('one')).toBeUndefined();
  });
  it('reports first and middle drop metadata without revealing opponents hands', () => {
    vi.useFakeTimers();
    const manager = new TableManager();
    const session = manager.createTable(config('drop-preview'), players());
    const before = session.pointsEngine!.getPublicState();
    expect(before.players[0]).toMatchObject({turnsPlayed: 0, hasDrawnInCurrentTurn: false});
    manager.handleDraw(session.tableId, 'one', 'CLOSED_DECK');
    const after = session.pointsEngine!.getPublicState();
    expect(after.players[0]).toMatchObject({turnsPlayed: 0, hasDrawnInCurrentTurn: true});
    expect(after.players[1]).not.toHaveProperty('hand');
    expect(manager.handleDrop(session.tableId, 'one')).toBe('MIDDLE');
    expect(session.pointsEngine!.getPublicState().players[0].dealScore).toBe(40);
  });
});
