import {
  DealResult,
  GameFinalResult,
  PlayerStatus,
  TableConfig,
  PoolScoreboardPayload,
  ScoreboardRow,
  RevealedPlayerHand,
  PoolSplitEligibility,
  PoolSplitCalculation,
  PoolSplitRequest,
  SplitDropCalculation,
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
  public initialCapacity: number;
  public activeSplitRequest: PoolSplitRequest | null;
  public splitHistory: PoolSplitRequest[];
  private startingSeatOffset: number;

  constructor(
    config: TableConfig,
    initialPlayers: { playerId: string; username: string; avatarUrl?: string; seatIndex: number }[]
  ) {
    this.tableId = config.tableId;
    this.config = config;
    if (config.variant === 'POOL_101') {
      this.poolLimit = 101;
    } else if (config.variant === 'POOL_240' || (config.variant as string) === 'POINTS_240') {
      this.poolLimit = 240;
    } else if (config.variant === 'POOL_201') {
      this.poolLimit = 201;
    } else {
      this.poolLimit = config.poolEliminationLimit || 101;
    }
    this.currentDealNumber = 1;
    this.startingSeatOffset = 0;
    this.dealHistory = [];
    this.currentDealEngine = null;
    this.isCompleted = false;
    this.finalResult = null;
    this.initialCapacity = initialPlayers.length;
    this.activeSplitRequest = null;
    this.splitHistory = [];

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
        scoreItem.totalPoolScore = poolPlayer.totalPoolScore;

        // Check elimination limit (Strictly >= poolLimit: 100 is Active in Pool 101, 101 is Eliminated)
        if (poolPlayer.totalPoolScore >= this.poolLimit) {
          poolPlayer.isEliminated = true;
          poolPlayer.eliminatedInDeal = this.currentDealNumber;
          scoreItem.isEliminated = true;
        } else {
          poolPlayer.isEliminated = false;
          scoreItem.isEliminated = false;
        }
      } else if (poolPlayer) {
        scoreItem.totalPoolScore = poolPlayer.totalPoolScore;
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

  /**
   * Evaluates if an eliminated player is eligible for re-entry (buy-in)
   * Thresholds:
   * - Pool 101: highestActiveScore <= 79
   * - Pool 201: highestActiveScore <= 174
   * - Pool 240: highestActiveScore <= 200
   */
  public getReentryEligibility(playerId: string): {
    eligible: boolean;
    reentryFee: number;
    startingScore: number;
    reason?: string;
  } {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player) {
      return { eligible: false, reentryFee: 0, startingScore: 0, reason: 'Player not found at this table' };
    }
    if (!player.isEliminated) {
      return { eligible: false, reentryFee: 0, startingScore: player.totalPoolScore, reason: 'Player is not eliminated' };
    }
    if (this.isCompleted) {
      return { eligible: false, reentryFee: 0, startingScore: 0, reason: 'Game is already completed' };
    }

    const activePlayers = this.players.filter((p) => !p.isEliminated);
    if (activePlayers.length < 1) {
      return { eligible: false, reentryFee: 0, startingScore: 0, reason: 'No active players remaining' };
    }

    const highestActiveScore = Math.max(...activePlayers.map((p) => p.totalPoolScore));

    const maxAllowableScore =
      this.poolLimit === 101
        ? 79
        : this.poolLimit === 240
        ? 200
        : 174; // Pool 201

    if (highestActiveScore > maxAllowableScore) {
      return {
        eligible: false,
        reentryFee: this.config.entryAmount || 100,
        startingScore: highestActiveScore + 1,
        reason: `Highest active score (${highestActiveScore}) exceeds re-entry cutoff (${maxAllowableScore})`,
      };
    }

    return {
      eligible: true,
      reentryFee: this.config.entryAmount || 100,
      startingScore: highestActiveScore + 1,
    };
  }

  /**
   * Executes a verified re-entry for an eliminated player
   */
  public executeReentry(playerId: string): {
    success: boolean;
    newScore: number;
    reason?: string;
  } {
    const eligibility = this.getReentryEligibility(playerId);
    if (!eligibility.eligible) {
      return { success: false, newScore: 0, reason: eligibility.reason };
    }

    const player = this.players.find((p) => p.playerId === playerId)!;
    player.isEliminated = false;
    player.totalPoolScore = eligibility.startingScore;

    return {
      success: true,
      newScore: eligibility.startingScore,
    };
  }

  /**
   * Computes the number of drops remaining before elimination for a given cumulative score.
   */
  public getRemainingDrops(score: number): number {
    const dropPenalty = this.poolLimit === 101 ? 40 : 50;
    return Math.max(0, Math.floor((this.poolLimit - score - 1) / dropPenalty));
  }

  /**
   * Evaluates Split eligibility after deal conclusion according to RummyCulture rules:
   * - Table started with >3 players (e.g. 6 players): 2 or 3 active players remaining.
   * - Table started with 3 players: 2 active players remaining.
   * - Table started with 2 players: Not eligible.
   * - Game must not be completed.
   */
  public checkSplitEligibility(): PoolSplitEligibility {
    if (this.isCompleted) {
      return { isEligible: false, reason: 'Game is already completed', eligiblePlayerCount: 0 };
    }

    const activePlayers = this.players.filter((p) => !p.isEliminated);
    const count = activePlayers.length;

    let isEligible = false;
    let reason = '';

    if (this.initialCapacity > 3) {
      if (count === 2 || count === 3) {
        isEligible = true;
      } else {
        reason = `Split requires 2 or 3 active players remaining (currently ${count})`;
      }
    } else if (this.initialCapacity === 3) {
      if (count === 2) {
        isEligible = true;
      } else {
        reason = `Split requires 2 active players remaining (currently ${count})`;
      }
    } else {
      reason = '2-player tables are not eligible for split';
    }

    if (!isEligible) {
      return { isEligible: false, reason, eligiblePlayerCount: count };
    }

    try {
      const calculation = this.calculateSplit();
      return { isEligible: true, eligiblePlayerCount: count, calculation };
    } catch (err: any) {
      return { isEligible: false, reason: err.message || 'Calculation failed', eligiblePlayerCount: count };
    }
  }

  /**
   * Implements the RummyCulture Drop-Equalization Split Payout algorithm.
   * Payouts are calculated in integer minor units (paise/cents) to prevent floating-point drift.
   */
  public calculateSplit(): PoolSplitCalculation {
    const activePlayers = this.players.filter((p) => !p.isEliminated);
    if (activePlayers.length < 2) {
      throw new Error('Cannot calculate split with fewer than 2 active players');
    }

    const N = activePlayers.length;
    const entryAmount = this.config.entryAmount || 100;
    const dropPenalty = this.poolLimit === 101 ? 40 : 50;

    // Financial totals in integer minor units (paise = 100 per rupee)
    const totalPrizePool = this.initialCapacity * entryAmount * 100;
    const platformFee = Math.round(totalPrizePool * 0.10); // 10% platform fee
    const netPrizePool = totalPrizePool - platformFee;

    // Remaining drops per player
    const playerDrops = activePlayers.map((p) => ({
      player: p,
      drops: this.getRemainingDrops(p.totalPoolScore),
    }));

    const minRemainingDrops = Math.min(...playerDrops.map((pd) => pd.drops));
    const excessDropsTotal = playerDrops.reduce((acc, pd) => acc + (pd.drops - minRemainingDrops), 0);

    // Drop rate in minor units
    // Cap excess drops allocation to 40% of net prize pool to guarantee solid equal distribution
    let dropRate = 0;
    if (excessDropsTotal > 0) {
      const maxExcessPool = Math.floor(netPrizePool * 0.40);
      dropRate = Math.floor(maxExcessPool / excessDropsTotal);
    }

    const excessPayouts = playerDrops.map((pd) => {
      const excess = pd.drops - minRemainingDrops;
      return excess * dropRate;
    });

    const totalExcessPayout = excessPayouts.reduce((a, b) => a + b, 0);
    const remainingPool = netPrizePool - totalExcessPayout;

    const equalShare = Math.floor(remainingPool / N);
    const remainder = remainingPool - equalShare * N;

    // Find the player with lowest score (best performance) to award any odd remainder minor units
    const bestPlayer = [...activePlayers].sort((a, b) => a.totalPoolScore - b.totalPoolScore)[0];

    const playerCalculations: SplitDropCalculation[] = activePlayers.map((p, idx) => {
      const drops = playerDrops[idx].drops;
      const excess = drops - minRemainingDrops;
      const excessPayout = excess * dropRate;
      const isBest = p.playerId === bestPlayer.playerId;
      const totalPayout = excessPayout + equalShare + (isBest ? remainder : 0);

      return {
        playerId: p.playerId,
        username: p.username,
        remainingDrops: drops,
        excessDrops: excess,
        excessDropPayout: excessPayout,
        equalSharePayout: equalShare,
        totalPayout,
      };
    });

    const reconciliationTotal = playerCalculations.reduce((sum, c) => sum + c.totalPayout, 0);
    if (reconciliationTotal !== netPrizePool) {
      throw new Error(`Split reconciliation mismatch: sum=${reconciliationTotal}, expected=${netPrizePool}`);
    }

    return {
      eligiblePlayerIds: activePlayers.map((p) => p.playerId),
      totalPrizePool,
      platformFee,
      netPrizePool,
      dropRate,
      minRemainingDrops,
      playerCalculations,
      reconciliationTotal,
    };
  }

  /**
   * Initiates a prize split request by an eligible player
   */
  public createSplitRequest(initiatorPlayerId: string): PoolSplitRequest {
    const eligibility = this.checkSplitEligibility();
    if (!eligibility.isEligible || !eligibility.calculation) {
      throw new Error(eligibility.reason || 'Table is not eligible for split');
    }

    const initiator = this.players.find((p) => p.playerId === initiatorPlayerId && !p.isEliminated);
    if (!initiator) {
      throw new Error('Initiator is not an active player at this table');
    }

    if (this.activeSplitRequest && this.activeSplitRequest.status === 'PENDING') {
      throw new Error('A split request is already pending');
    }

    const votes: Record<string, boolean | null> = {};
    for (const id of eligibility.calculation.eligiblePlayerIds) {
      votes[id] = id === initiatorPlayerId ? true : null;
    }

    const splitRequest: PoolSplitRequest = {
      splitId: `split-${this.tableId}-${this.currentDealNumber}-${Date.now()}`,
      tableId: this.tableId,
      initiatorPlayerId,
      initiatorUsername: initiator.username,
      calculation: eligibility.calculation,
      votes,
      status: 'PENDING',
      votingExpiresAt: Date.now() + 15000,
    };

    this.activeSplitRequest = splitRequest;
    return splitRequest;
  }

  /**
   * Records a vote from an eligible active player
   */
  public recordSplitVote(playerId: string, accept: boolean): PoolSplitRequest {
    if (!this.activeSplitRequest || this.activeSplitRequest.status !== 'PENDING') {
      throw new Error('No active split request to vote on');
    }

    if (!(playerId in this.activeSplitRequest.votes)) {
      throw new Error('Player is not eligible to vote on this split request');
    }

    this.activeSplitRequest.votes[playerId] = accept;

    // If anyone declines: immediately DECLINED
    if (!accept) {
      this.activeSplitRequest.status = 'DECLINED';
      const resolved = { ...this.activeSplitRequest };
      this.splitHistory.push(resolved);
      this.activeSplitRequest = null;
      return resolved;
    }

    // Check if unanimous acceptance
    const allAccepted = Object.values(this.activeSplitRequest.votes).every((v) => v === true);
    if (allAccepted) {
      this.activeSplitRequest.status = 'ACCEPTED';
      this.isCompleted = true;

      // Create final result for split
      const standings = this.activeSplitRequest.calculation.playerCalculations.map((c, idx) => ({
        rank: idx + 1,
        playerId: c.playerId,
        username: c.username,
        totalScore: this.players.find((p) => p.playerId === c.playerId)?.totalPoolScore || 0,
        status: 'ACTIVE' as PlayerStatus,
      }));

      this.finalResult = {
        tableId: this.tableId,
        variant: this.config.variant,
        winnerPlayerId: 'SPLIT_MUTUAL',
        deals: this.dealHistory,
        finalStandings: standings,
      };

      const resolved = { ...this.activeSplitRequest };
      this.splitHistory.push(resolved);
      return resolved;
    }

    return this.activeSplitRequest;
  }

  /**
   * Expires the pending split request if voting deadline has passed
   */
  public expireSplit(): PoolSplitRequest | null {
    if (!this.activeSplitRequest || this.activeSplitRequest.status !== 'PENDING') {
      return null;
    }
    if (Date.now() >= this.activeSplitRequest.votingExpiresAt) {
      this.activeSplitRequest.status = 'EXPIRED';
      const expired = { ...this.activeSplitRequest };
      this.splitHistory.push(expired);
      this.activeSplitRequest = null;
      return expired;
    }
    return null;
  }

  /**
   * Generates the multi-deal scoreboard payload
   */
  public getScoreboard(): PoolScoreboardPayload {
    const lastDeal = this.dealHistory[this.dealHistory.length - 1];
    const winnerPlayerId = lastDeal?.winnerPlayerId;

    // Order players: Active first (lowest score first), Eliminated next (lowest score first)
    const sorted = [...this.players].sort((a, b) => {
      if (a.isEliminated !== b.isEliminated) {
        return a.isEliminated ? 1 : -1;
      }
      if (a.totalPoolScore !== b.totalPoolScore) {
        return a.totalPoolScore - b.totalPoolScore;
      }
      return a.seatIndex - b.seatIndex;
    });

    const rows: ScoreboardRow[] = sorted.map((p, idx) => {
      const lastDealScoreItem = lastDeal?.scores.find((s) => s.playerId === p.playerId);
      const currentDealPenalty = lastDealScoreItem?.dealPenalty ?? 0;
      const previousScore = Math.max(0, p.totalPoolScore - currentDealPenalty);
      const remainingDrops = this.getRemainingDrops(p.totalPoolScore);
      const canReenter = p.isEliminated && this.getReentryEligibility(p.playerId).eligible;

      let status: 'ACTIVE' | 'ELIMINATED' | 'REENTERED' | 'DROPPED' = p.isEliminated ? 'ELIMINATED' : 'ACTIVE';
      if (lastDealScoreItem?.dealPenalty === 20 || lastDealScoreItem?.dealPenalty === 40 || lastDealScoreItem?.dealPenalty === 25 || lastDealScoreItem?.dealPenalty === 50) {
        status = 'DROPPED';
      }

      return {
        rank: idx + 1,
        playerId: p.playerId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        isWinner: p.playerId === winnerPlayerId,
        previousScore,
        currentDealScore: currentDealPenalty,
        totalScore: p.totalPoolScore,
        poolLimit: this.poolLimit,
        pointsRemaining: Math.max(0, this.poolLimit - p.totalPoolScore),
        status,
        remainingDrops,
        canReenter,
      };
    });

    const splitEligibility = this.checkSplitEligibility();

    return {
      tableId: this.tableId,
      dealNumber: this.currentDealNumber,
      rows,
      winnerPlayerId,
      isFinalDeal: this.isCompleted,
      splitEligible: splitEligibility.isEligible,
      reentryEligible: this.players.some((p) => p.isEliminated && this.getReentryEligibility(p.playerId).eligible),
      splitEligibility,
      dealHistory: this.dealHistory,
    };
  }

  /**
   * Extracts revealed hands from the completed deal
   */
  public getRevealedHands(): RevealedPlayerHand[] {
    if (!this.currentDealEngine) return [];
    return this.currentDealEngine.getRevealedHands();
  }
}
