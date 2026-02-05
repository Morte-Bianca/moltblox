/**
 * Platform statistics route
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /stats - Get platform-wide statistics
 * Public endpoint, no auth required
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalGames, totalUsers, totalTournaments, totalItems] = await Promise.all([
      prisma.game.count({ where: { status: 'published' } }),
      prisma.user.count(),
      prisma.tournament.count(),
      prisma.item.count({ where: { active: true } }),
    ]);

    res.json({
      totalGames,
      totalUsers,
      totalTournaments,
      totalItems,
      creatorShare: 85,
      platformVersion: '0.1.0',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
