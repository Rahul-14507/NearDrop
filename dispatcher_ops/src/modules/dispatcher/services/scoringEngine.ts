/**
 * Scoring Engine
 * ----------------
 * Implements the V2 trust dynamic score formula.
 * This mirrors the FastAPI scoring module logic.
 *
 * Formula components:
 * 1. On-Time %         (Weight: 40%)
 * 2. Acceptance %      (Weight: 20%)
 * 3. Reroute Success % (Weight: 25%)
 * 4. Customer Rating   (Weight: 15%)
 * 5. Failure Penalty   (Deduction: -5 points per critical failure)
 */

export interface ScoringMetrics {
  onTimePercentage: number;     // 0-100
  acceptancePercentage: number; // 0-100
  rerouteSuccessRate: number;   // 0-100
  customerRating: number;       // 0-5
  recentCriticalFailures: number;
}

export class ScoringEngine {
  public static calculateRiderTrustScore(metrics: ScoringMetrics): number {
    const {
      onTimePercentage,
      acceptancePercentage,
      rerouteSuccessRate,
      customerRating,
      recentCriticalFailures,
    } = metrics;

    // Normalize customer rating to 100-scale
    const ratingScore = (customerRating / 5) * 100;

    let baseScore =
      onTimePercentage * 0.40 +
      acceptancePercentage * 0.20 +
      rerouteSuccessRate * 0.25 +
      ratingScore * 0.15;

    // Apply penalties
    const penalty = recentCriticalFailures * 5;
    let finalScore = baseScore - penalty;

    // Floor and Ceiling
    if (finalScore < 0) finalScore = 0;
    if (finalScore > 100) finalScore = 100;

    return Math.round(finalScore);
  }

  // Future-proofing: calculate zone difficulty modifier
  public static calculateZoneModifier(zoneHeat: number): number {
    // If a zone is highly constrained, drivers get a bump in positive metrics
    return zoneHeat > 80 ? 1.05 : 1.0;
  }
}
