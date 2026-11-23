import { GameVariant, TableConfig } from '@rummy/shared-types';

export interface QueuedPlayer {
  playerId: string;
  username: string;
  avatarUrl: string;
  socketId: string;
  variant: GameVariant;
  pointValue: number;
  maxPlayers: 2 | 6;
  queuedAt: number;
}

export type MatchFoundCallback = (config: TableConfig, players: QueuedPlayer[]) => void;

export class MatchmakingService {
  private queues: Map<string, QueuedPlayer[]> = new Map();
  private onMatchFound?: MatchFoundCallback;

  constructor(onMatchFound?: MatchFoundCallback) {
    this.onMatchFound = onMatchFound;
  }

  public setMatchFoundCallback(callback: MatchFoundCallback) {
    this.onMatchFound = callback;
  }

  private getQueueKey(variant: GameVariant, pointValue: number, maxPlayers: number): string {
    return `${variant}_${pointValue.toFixed(2)}_${maxPlayers}`;
  }

  public joinQueue(player: QueuedPlayer): { status: 'QUEUED' | 'MATCHED'; tableId?: string } {
    // Remove if already in any queue
    this.leaveQueue(player.playerId);

    const key = this.getQueueKey(player.variant, player.pointValue, player.maxPlayers);
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }

    const queue = this.queues.get(key)!;
    queue.push(player);

    // Check if queue has enough players for a match
    if (queue.length >= player.maxPlayers) {
      const matchedPlayers = queue.splice(0, player.maxPlayers);
      const tableId = `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const config: TableConfig = {
        tableId,
        variant: player.variant,
        pointValue: player.pointValue,
        maxPlayers: player.maxPlayers,
        turnDurationSec: 30,
        extraTimeSec: 15,
        firstDropPenalty: 20,
        middleDropPenalty: 40,
        wrongShowPenalty: 80,
        consecutiveTimeoutDrop: 3,
        maxScoreCap: 80,
        poolEliminationLimit: player.variant === 'POOL_101' ? 101 : player.variant === 'POOL_201' ? 201 : 0,
        deckCount: 2,
        printedJokersPerDeck: 2,
      };

      if (this.onMatchFound) {
        this.onMatchFound(config, matchedPlayers);
      }

      return { status: 'MATCHED', tableId };
    }

    return { status: 'QUEUED' };
  }

  public leaveQueue(playerId: string): boolean {
    let removed = false;
    for (const [key, queue] of this.queues.entries()) {
      const idx = queue.findIndex((p) => p.playerId === playerId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        removed = true;
      }
    }
    return removed;
  }

  public getQueueStats(): { key: string; count: number }[] {
    const stats: { key: string; count: number }[] = [];
    for (const [key, queue] of this.queues.entries()) {
      stats.push({ key, count: queue.length });
    }
    return stats;
  }
}
