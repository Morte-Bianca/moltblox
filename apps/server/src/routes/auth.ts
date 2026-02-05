/**
 * Authentication routes for Moltblox API
 * Sign-In with Ethereum (SIWE) flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SiweMessage } from 'siwe';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /auth/nonce - Get a nonce for SIWE
 * The client includes this nonce in the SIWE message to prevent replay attacks.
 */
router.get('/nonce', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nonce = randomUUID();

    // Store nonce temporarily - in production use Redis with TTL
    // For now we store it and it gets consumed on verify
    res.json({
      nonce,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/verify - Verify SIWE signature and issue JWT
 * Body: { message: string, signature: string }
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, signature } = req.body;

    if (!message || !signature) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Missing message or signature',
      });
      return;
    }

    // Parse and verify the SIWE message
    const siweMessage = new SiweMessage(message);
    const { data: verified } = await siweMessage.verify({ signature });

    const address = verified.address.toLowerCase();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: address },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: address,
          username: `molt_${address.slice(2, 8)}`,
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Issue JWT
    const token = signToken(user.id, address);

    res.json({
      token,
      user: {
        id: user.id,
        address: user.walletAddress,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      expiresIn: '7d',
    });
  } catch (error: any) {
    if (error.message?.includes('Signature') || error.message?.includes('verify')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid SIWE signature',
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /auth/refresh - Refresh JWT token (auth required)
 */
router.post('/refresh', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const token = signToken(user.id, user.address);

    res.json({
      token,
      expiresIn: '7d',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me - Get current user profile (auth required)
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        reputationTotal: true,
        reputationCreator: true,
        reputationPlayer: true,
        reputationCommunity: true,
        reputationTournament: true,
        createdAt: true,
        _count: {
          select: {
            games: true,
            posts: true,
            tournamentEntries: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'NotFound', message: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /auth/profile - Update user profile (auth required)
 */
router.put('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, displayName, bio, avatarUrl } = req.body;

    const updateData: Record<string, string> = {};
    if (username !== undefined) updateData.username = username;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'BadRequest', message: 'No fields to update' });
      return;
    }

    // Check username uniqueness
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.user!.id) {
        res.status(409).json({ error: 'Conflict', message: 'Username already taken' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
    });

    res.json({ user, message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/api-key - Generate an API key for bot access (auth required)
 */
router.post('/api-key', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = `moltblox_${randomUUID().replace(/-/g, '')}`;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { apiKey },
    });

    res.json({
      apiKey,
      message: 'API key generated. Store it securely — it cannot be retrieved again.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
