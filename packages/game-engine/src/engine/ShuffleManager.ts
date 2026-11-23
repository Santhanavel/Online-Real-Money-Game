import * as crypto from 'crypto';
import { Card } from '@rummy/shared-types';

export interface ShuffleAudit {
  seedHash: string;
  timestamp: number;
  cardCount: number;
  initialCardIdsHash: string;
  finalCardIdsHash: string;
}

export class ShuffleManager {
  /**
   * Cryptographically secure integer generator in range [min, max)
   */
  private static secureRandomInt(min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return min;

    // Use Node.js crypto.randomInt if available
    if (typeof crypto.randomInt === 'function') {
      return crypto.randomInt(min, max);
    }

    // Fallback secure random
    const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
    const cutoff = Math.floor(Math.pow(256, bytesNeeded) / range) * range;
    const bytes = new Uint8Array(bytesNeeded);

    while (true) {
      crypto.randomFillSync(bytes);
      let value = 0;
      for (let i = 0; i < bytesNeeded; i++) {
        value = (value << 8) + bytes[i];
      }
      if (value < cutoff) {
        return min + (value % range);
      }
    }
  }

  /**
   * Unbiased Fisher-Yates (Knuth) Shuffle using CSPRNG
   */
  public static shuffle(cards: Card[]): { shuffled: Card[]; audit: ShuffleAudit } {
    const shuffled = [...cards];
    const initialHash = this.computeCardListHash(cards);
    const timestamp = Date.now();
    const seed = crypto.randomBytes(32).toString('hex');

    // Fisher-Yates from end to beginning
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.secureRandomInt(0, i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    const finalHash = this.computeCardListHash(shuffled);

    const audit: ShuffleAudit = {
      seedHash: crypto.createHash('sha256').update(seed).digest('hex'),
      timestamp,
      cardCount: shuffled.length,
      initialCardIdsHash: initialHash,
      finalCardIdsHash: finalHash,
    };

    return { shuffled, audit };
  }

  private static computeCardListHash(cards: Card[]): string {
    const cardIdStr = cards.map((c) => c.cardId).join('|');
    return crypto.createHash('sha256').update(cardIdStr).digest('hex');
  }
}
