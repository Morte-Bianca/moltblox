/**
 * Authentication middleware for Moltblox API
 * Supports JWT tokens (from SIWE) and API keys
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export interface AuthUser {
  id: string;
  address: string;
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'moltblox-dev-secret-change-in-production';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Verify a JWT token and return its payload
 */
function verifyToken(token: string): { userId: string; address: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      address: string;
      iat: number;
      exp: number;
    };
    return { userId: payload.userId, address: payload.address };
  } catch {
    return null;
  }
}

/**
 * Sign a JWT token for a user
 */
export function signToken(userId: string, address: string): string {
  return jwt.sign({ userId, address }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Middleware that requires a valid authentication token.
 * Accepts Bearer JWT tokens or X-API-Key header.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Try Bearer token first
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    let user: AuthUser | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (!token) {
        res.status(401).json({ error: 'Unauthorized', message: 'Empty token' });
        return;
      }

      const payload = verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, walletAddress: true, displayName: true, username: true },
      });

      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        return;
      }

      user = {
        id: dbUser.id,
        address: dbUser.walletAddress,
        displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
      };
    } else if (req.cookies?.moltblox_token) {
      // Cookie-based JWT authentication
      const cookieToken = req.cookies.moltblox_token;
      const payload = verifyToken(cookieToken);
      if (!payload) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, walletAddress: true, displayName: true, username: true },
      });

      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        return;
      }

      user = {
        id: dbUser.id,
        address: dbUser.walletAddress,
        displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
      };
    } else if (apiKey) {
      // API key authentication for bots/agents
      const hashedKey = hashApiKey(apiKey);
      const dbUser = await prisma.user.findUnique({
        where: { apiKey: hashedKey },
        select: { id: true, walletAddress: true, displayName: true, username: true },
      });

      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
        return;
      }

      user = {
        id: dbUser.id,
        address: dbUser.walletAddress,
        displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
      };
    }

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header (Bearer token) or X-API-Key header',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const payload = verifyToken(token);
      if (payload) {
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, walletAddress: true, displayName: true, username: true },
        });
        if (dbUser) {
          req.user = {
            id: dbUser.id,
            address: dbUser.walletAddress,
            displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
          };
        }
      }
    } else if (req.cookies?.moltblox_token) {
      const cookieToken = req.cookies.moltblox_token;
      const payload = verifyToken(cookieToken);
      if (payload) {
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, walletAddress: true, displayName: true, username: true },
        });
        if (dbUser) {
          req.user = {
            id: dbUser.id,
            address: dbUser.walletAddress,
            displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
          };
        }
      }
    } else if (apiKey) {
      const hashedKey = hashApiKey(apiKey);
      const dbUser = await prisma.user.findUnique({
        where: { apiKey: hashedKey },
        select: { id: true, walletAddress: true, displayName: true, username: true },
      });
      if (dbUser) {
        req.user = {
          id: dbUser.id,
          address: dbUser.walletAddress,
          displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
        };
      }
    }

    next();
  } catch {
    // Silently continue without auth
    next();
  }
}
