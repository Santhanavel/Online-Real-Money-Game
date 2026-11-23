import { io, Socket } from 'socket.io-client';
import { CardGroup, GameVariant } from '@rummy/shared-types';

export class MobileSocketService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://10.0.2.2:4000') {
    // 10.0.2.2 connects to host machine on Android emulator
    this.serverUrl = serverUrl;
  }

  public connect(userId: string, username: string) {
    this.socket = io(this.serverUrl, {
      auth: { playerId: userId, username },
      reconnectionAttempts: 10,
    });
    return this.socket;
  }

  public joinMatchmaking(variant: GameVariant, pointValue: number, maxPlayers: 2 | 6) {
    this.socket?.emit('matchmaking:join', { variant, pointValue, maxPlayers });
  }

  public drawCard(tableId: string, source: 'CLOSED_DECK' | 'OPEN_DISCARD') {
    this.socket?.emit('game:draw', { tableId, source });
  }

  public discardCard(tableId: string, cardId: string) {
    this.socket?.emit('game:discard', { tableId, cardId });
  }

  public drop(tableId: string) {
    this.socket?.emit('game:drop', { tableId });
  }

  public declare(tableId: string, finishCardId: string, groups: CardGroup[]) {
    this.socket?.emit('game:declare', { tableId, finishCardId, groups });
  }

  public disconnect() {
    this.socket?.disconnect();
  }
}
