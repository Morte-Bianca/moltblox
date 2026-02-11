/**
 * Game tool handlers
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { GameToolHandlers } from '../tools/game.js';
import WebSocket from 'ws';

function authHeaders(config: MoltbloxMCPConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = config.apiKey || process.env.MOLTBLOX_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  if (config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }
  return headers;
}

async function parseOrThrow(response: Response, label: string): Promise<any> {
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `${label} failed (${response.status})`);
  }
  return data;
}

export function createGameHandlers(config: MoltbloxMCPConfig): GameToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  function requireWsUrl(): string {
    const wsUrl = config.wsUrl || process.env.MOLTBLOX_WS_URL;
    if (!wsUrl) {
      throw new Error(
        'Missing WebSocket URL. Set MOLTBLOX_WS_URL (e.g. wss://api.moltblox.com) to use play_game.',
      );
    }
    return wsUrl;
  }

  function requireAuthToken(): string {
    const token = config.authToken || process.env.MOLTBLOX_AUTH_TOKEN;
    if (!token) {
      throw new Error(
        'Missing auth token. Set MOLTBLOX_AUTH_TOKEN (JWT) to authenticate to the API/WS.',
      );
    }
    return token;
  }

  return {
    async publish_game(params) {
      const response = await fetch(`${apiUrl}/games`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await parseOrThrow(response, 'publish_game');
      return {
        gameId: data.id,
        status: data.status,
        message:
          data.message ||
          `Game "${params.name}" created successfully. (Note: publishing requires setting status=published.)`,
      };
    },

    async update_game(params) {
      const { gameId, ...rest } = params as any;
      const response = await fetch(`${apiUrl}/games/${gameId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(rest),
      });
      await parseOrThrow(response, 'update_game');
      return {
        success: true,
        message: 'Game updated successfully',
      };
    },

    async get_game(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}`, { headers });
      const data = await parseOrThrow(response, 'get_game');
      return { game: data };
    },

    async browse_games(params) {
      // Backend supports:
      // - /games?sort=popular|newest|rating
      // - /games/trending
      const { sortBy, genre, limit, offset, search } = params as any;

      if (sortBy === 'trending') {
        const queryParams = new URLSearchParams();
        queryParams.set('limit', String(limit));
        if (genre) queryParams.set('genre', genre);
        const response = await fetch(`${apiUrl}/games/trending?${queryParams}`, { headers });
        return await parseOrThrow(response, 'browse_games');
      }

      const sort = sortBy === 'newest' ? 'newest' : sortBy === 'top_rated' ? 'rating' : 'popular';

      const queryParams = new URLSearchParams();
      if (genre) queryParams.set('genre', genre);
      if (search) queryParams.set('search', search);
      queryParams.set('sort', sort);
      queryParams.set('limit', String(limit));
      queryParams.set('offset', String(offset));

      const response = await fetch(`${apiUrl}/games?${queryParams}`, { headers });
      return await parseOrThrow(response, 'browse_games');
    },

    async play_game(params) {
      const wsUrl = requireWsUrl();
      const token = requireAuthToken();

      // Current backend does not expose an HTTP sessions API; gameplay starts via WS matchmaking.
      // For solo play, set the game's maxPlayers=1; matchmaking will instantly create a session.
      const gameId = (params as any).gameId as string;

      const socket = new WebSocket(wsUrl);

      const result = await new Promise<any>((resolve, reject) => {
        const timeoutMs = 12_000;
        const timer = setTimeout(() => {
          try {
            socket.close();
          } catch {
            // ignore
          }
          resolve({
            status: 'queued',
            gameId,
            wsUrl,
            note: 'Joined matchmaking queue. Waiting for enough players; listen for session_start over WS.',
          });
        }, timeoutMs);

        function cleanup() {
          clearTimeout(timer);
          socket.removeAllListeners();
        }

        socket.on('open', () => {
          socket.send(
            JSON.stringify({
              type: 'authenticate',
              payload: { token },
            }),
          );
        });

        socket.on('message', (raw: WebSocket.RawData) => {
          let msg: any;
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }

          if (msg?.type === 'authenticated') {
            socket.send(JSON.stringify({ type: 'join_queue', payload: { gameId } }));
            return;
          }

          if (msg?.type === 'queue_joined') {
            // keep waiting for session_start
            return;
          }

          if (msg?.type === 'session_start') {
            cleanup();
            try {
              socket.close();
            } catch {
              // ignore
            }
            resolve({
              status: 'started',
              sessionId: msg.payload?.sessionId,
              gameId: msg.payload?.gameId,
              players: msg.payload?.players,
              currentTurn: msg.payload?.currentTurn,
              state: msg.payload?.state,
              note: 'Session started. To play, open a WS connection and send game_action messages after authenticating.',
            });
            return;
          }

          if (msg?.type === 'error') {
            cleanup();
            try {
              socket.close();
            } catch {
              // ignore
            }
            reject(new Error(msg.payload?.message || 'WS error'));
          }
        });

        socket.on('error', (err: Error) => {
          cleanup();
          reject(err);
        });

        socket.on('close', () => {
          // If it closes before resolve/reject, let timeout resolve queued state.
        });
      });

      return result;
    },

    async get_game_stats(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/stats?period=${params.period}`,
        { headers },
      );
      const data = await parseOrThrow(response, 'get_game_stats');
      return { stats: data };
    },

    async get_game_analytics(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/analytics?period=${params.period}`,
        { headers },
      );
      const data = await parseOrThrow(response, 'get_game_analytics');
      return { analytics: data };
    },

    async get_creator_dashboard() {
      const response = await fetch(`${apiUrl}/creator/analytics`, { headers });
      const data = await parseOrThrow(response, 'get_creator_dashboard');
      return { dashboard: data };
    },

    async get_game_ratings(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/stats`, { headers });
      const data = await parseOrThrow(response, 'get_game_ratings');
      return { ratings: data };
    },

    async add_collaborator(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/collaborators`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          role: params.role,
          canEditCode: params.canEditCode,
          canEditMeta: params.canEditMeta,
          canCreateItems: params.canCreateItems,
          canPublish: params.canPublish,
        }),
      });
      const data = await parseOrThrow(response, 'add_collaborator');
      return { collaborator: data, message: data.message };
    },

    async remove_collaborator(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/collaborators/${params.userId}`,
        { method: 'DELETE', headers },
      );
      const data = await parseOrThrow(response, 'remove_collaborator');
      return { message: data.message };
    },

    async list_collaborators(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/collaborators`, {
        headers,
      });
      return await parseOrThrow(response, 'list_collaborators');
    },
  };
}
