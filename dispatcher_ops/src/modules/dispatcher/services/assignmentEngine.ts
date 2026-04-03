import type { Incident, Rider, Coordinates } from '../types/dispatcher.types';

export interface AssignmentRecommendation {
  recommendedRiderId: string | null;
  etaMinutes: number;
  confidenceScore: number;
  reasoning: string[];
}

/**
 * Assignment Explainability Engine
 * --------------------------------
 * Performs heuristics to find the optimal rider to rescue an incident.
 * Surfaces specific reasons ("explainability layer") to build trust with dispatchers.
 */
export class AssignmentEngine {
  
  // Haversine rough distance
  private static calculateDistance(c1: Coordinates, c2: Coordinates): number {
    const R = 6371; // km
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLon = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  public static recommendRider(
    incident: Incident,
    availableRiders: Rider[]
  ): AssignmentRecommendation {
    
    if (!availableRiders || availableRiders.length === 0) {
      return {
        recommendedRiderId: null,
        etaMinutes: 0,
        confidenceScore: 0,
        reasoning: ['No drivers available in the network.'],
      };
    }

    let bestRider: Rider | null = null;
    let highestScore = -Infinity;
    let finalReasoning: string[] = [];
    let bestEta = 0;

    for (const rider of availableRiders) {
      // 1. Hard Constraints
      if (rider.status === 'offline') continue; // completely unavailable
      
      let tempScore = 0;
      let reasons: string[] = [];

      // 2. Proximity (Primary metric)
      // Assuming average speed 30km/h in city -> 0.5km/min
      const dist = rider.coordinates 
        ? this.calculateDistance(rider.coordinates, incident.coordinates)
        : 10; // default unknown fallback
      
      const eta = Math.ceil(dist / 0.5); 
      
      if (eta < 15) {
        tempScore += 50;
        reasons.push('Nearest rider (ETA < 15m)');
      } else if (eta < 30) {
        tempScore += 30;
      }

      // 3. Status & Load Constraints
      if (rider.status === 'idle') {
        tempScore += 20;
        reasons.push('Idle - Ready immediately');
      } else if (rider.status === 'online' && rider.load < 3) {
        tempScore += 10;
        reasons.push('Low active load');
      } else if (rider.load >= 4) {
        // High load - avoid assignment if possible but not ruled out
        tempScore -= 20;
        reasons.push('Warning: High delivery load');
      }

      // 4. Trust Score Constraint
      if (rider.score > 85) {
        tempScore += 15;
        reasons.push('High Trust Score');
      }

      // 5. Zone Match
      if (incident.location.toLowerCase().includes(rider.zone.toLowerCase())) {
        tempScore += 15;
        reasons.push('Zone Match');
      }

      // Evaluator
      if (tempScore > highestScore) {
        highestScore = tempScore;
        bestRider = rider;
        finalReasoning = reasons;
        bestEta = eta;
      }
    }

    if (!bestRider) {
      return {
        recommendedRiderId: null,
        etaMinutes: 0,
        confidenceScore: 0,
        reasoning: ['All online drivers are at full capacity.'],
      };
    }

    return {
      recommendedRiderId: bestRider.id,
      etaMinutes: bestEta,
      // Normalize confidence score out of 100
      confidenceScore: Math.min(100, Math.max(0, highestScore)),
      reasoning: finalReasoning.length > 0 ? finalReasoning : ['Selected as default best-effort match.'],
    };
  }
}
