import {
  DealResult,
  GameFinalResult,
  PlayerStatus,
  TableConfig,
} from '@rummy/shared-types';
import { PointsRummyEngine } from './PointsRummyEngine';

export interface PoolPlayer {
  playerId: string;
  username: string;
  avatarUrl: string;
  seatIndex: number;
  totalPoolScore: number;
  isEliminated: boolean;
  eliminatedInDeal?: number;
  dealsPlayed: number;
  finalRank?: number;
}

export class PoolRummyEngine {
  public tableId: string;
  public config: TableConfig;
  public poolLimit: number; // 101 or 201
  public currentDealNumber: number;
  public players: PoolPlayer[];
  public dealHistory: DealResult[];
  public currentDealEngine: PointsRummyEngine | null;
  public isCompleted: boolean;
  public finalResult: GameFinalResult | null;
  private startingSeatOffset: number;

  constructor(
    config: TableConfig,
    initialPlayers: { playerId: string; username: string; avatarUrl?: string; seatIndex: number }[]
  ) {
    this.tableId = config.tableId;
    this.config = config;
    this.poolLimit = config.poolEliminationLimit || (config.variant === 'POOL_101' ? 101 : 201);
    this.currentDealNumber = 1;
    this.startingSeatOffset = 0;
    this.dealHistory = [];
    this.currentDealEngine = null;
    this.isCompleted = false;
    this.finalResult = null;

    this.players = initialPlayers.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      avatarUrl: p.avatarUrl || '/avatars/default.png',
      seatIndex: p.seatIndex,
      totalPoolScore: 0,
      isEliminated: false,
      dealsPlayed: 0,
    }));
  }

  /**
   * Starts or resumes the current deal
   */
  public startNextDeal(): PointsRummyEngine {
    if (this.isCompleted) {
      throw new Error('Pool game is already completed');
    }

    const eligiblePlayers = this.players.filter((p) => !p.isEliminated);
    if (eligiblePlayers.length <= 1) {
      throw new Error('Cannot start deal with fewer than 2 uneliminated players');
    }

    const startingSeat = eligiblePlayers[this.startingSeatOffset % eligiblePlayers.length].seatIndex;

    this.currentDealEngine = new PointsRummyEngine(
      this.config,
      eligiblePlayers.map((p) => ({
        playerId: p.playerId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        seatIndex: p.seatIndex,
      })),
      this.currentDealNumber
    );

    // Sync totalPoolScore to internal players
    for (const player of this.currentDealEngine.players) {
      const poolPlayer = this.players.find((p) => p.playerId === player.playerId);
      if (poolPlayer) {
        player.totalPoolScore = poolPlayer.totalPoolScore;
      }
    }

    this.currentDealEngine.startDeal(startingSeat);
    return this.currentDealEngine;
  }

  /**
   * Concludes the current deal, updates cumulative pool penalties,
   * eliminates players who reach or exceed the pool limit,
   * and checks if game has a final winner.
   */
  public concludeCurrentDeal(): {
    dealResult: DealResult;
    isPoolCompleted: boolean;
    finalResult?: GameFinalResult;
  } {
    if (!this.currentDealEngine || !this.currentDealEngine.completedDealResult) {
      throw new Error('No completed deal to conclude');
    }

    const dealResult = this.currentDealEngine.completedDealResult;
    this.dealHistory.push(dealResult);

    // Update cumulative scores
    for (const scoreItem of dealResult.scores) {
      const poolPlayer = this.players.find((p) => p.playerId === scoreItem.playerId);
      if (poolPlayer && !poolPlayer.isEliminated) {
        poolPlayer.totalPoolScore += scoreItem.dealPenalty;
        poolPlayer.dealsPlayed++;

        // Check elimination limit
        if (poolPlayer.totalPoolScore >= this.poolLimit) {
          poolPlayer.isEliminated = true;
          poolPlayer.eliminatedInDeal = this.currentDealNumber;
          scoreItem.isEliminated = true;
        }
      }
    }

    const uneliminated = this.players.filter((p) => !p.isEliminated);

    if (uneliminated.length <= 1) {
      // Game over! Winner found!
      this.isCompleted = true;
      const winner = uneliminated[0] || this.players[0];

      // Rank players by score ascending (lowest score is best)
      const ranked = [...this.players].sort((a, b) => {
        if (a.isEliminated !== b.isEliminated) {
          return a.isEliminated ? 1 : -1;
        }
        return a.totalPoolScore - b.totalPoolScore;
      });

      const finalStandings = ranked.map((p, idx) => ({
        rank: idx + 1,
        playerId: p.playerId,
        username: p.username,
        totalScore: p.totalPoolScore,
        status: (p.isEliminated ? 'ELIMINATED' : 'ACTIVE') as PlayerStatus,
      }));

      this.finalResult = {
        tableId: this.tableId,
        variant: this.config.variant,
        winnerPlayerId: winner.playerId,
        deals: this.dealHistory,
        finalStandings,
      };

      return {
        dealResult,
        isPoolCompleted: true,
        finalResult: this.finalResult,
      };
    }

    // Continue to next deal
    this.currentDealNumber++;
    this.startingSeatOffset++;

    return {
      dealResult,
      isPoolCompleted: false,
    };
  }
}
