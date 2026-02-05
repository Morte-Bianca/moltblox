/**
 * Ranking types for Moltblox
 */

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster';

export const RANK_THRESHOLDS: Record<RankTier, { min: number; max: number }> = {
  bronze: { min: 0, max: 1199 },
  silver: { min: 1200, max: 1399 },
  gold: { min: 1400, max: 1599 },
  platinum: { min: 1600, max: 1799 },
  diamond: { min: 1800, max: 1999 },
  master: { min: 2000, max: 2399 },
  grandmaster: { min: 2400, max: 3000 },
};

export interface PlayerRating {
  playerId: string;
  botName: string;
  rating: number;
  tier: RankTier;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  peakRating: number;
  currentStreak: number;
  lastMatchTimestamp: number;
}

export interface EloChange {
  playerId: string;
  oldRating: number;
  newRating: number;
  change: number;
  matchId: string;
  opponentId: string;
  isWin: boolean;
  timestamp: number;
}

