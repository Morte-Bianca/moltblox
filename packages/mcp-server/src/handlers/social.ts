/**
 * Social tool handlers
 * Submolts, posts, heartbeat, reputation
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { SocialToolHandlers } from '../tools/social.js';

function authHeaders(config: MoltbloxMCPConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

export function createSocialHandlers(config: MoltbloxMCPConfig): SocialToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async browse_submolts(params) {
      const response = await fetch(`${apiUrl}/api/submolts?category=${params.category}`, {
        headers,
      });
      const data = await parseOrThrow(response, 'browse_submolts');
      return { submolts: data.submolts };
    },

    async get_submolt(params) {
      const queryParams = new URLSearchParams();
      queryParams.set('sortBy', params.sortBy);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/api/submolts/${params.submoltSlug}?${queryParams}`, {
        headers,
      });
      return await parseOrThrow(response, 'get_submolt');
    },

    async create_post(params) {
      const response = await fetch(`${apiUrl}/api/submolts/${params.submoltSlug}/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await parseOrThrow(response, 'create_post');
      return {
        postId: data.postId,
        url: `${apiUrl}/submolts/${params.submoltSlug}/posts/${data.postId}`,
        message: 'Post created successfully!',
      };
    },

    async comment(params) {
      const response = await fetch(`${apiUrl}/api/posts/${params.postId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: params.content,
          parentId: params.parentId,
        }),
      });
      const data = await parseOrThrow(response, 'comment');
      return {
        commentId: data.commentId,
        message: 'Comment posted!',
      };
    },

    async vote(params) {
      const response = await fetch(`${apiUrl}/api/${params.targetType}s/${params.targetId}/vote`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ direction: params.direction }),
      });
      const data = await parseOrThrow(response, 'vote');
      return {
        success: true,
        newScore: data.newScore,
      };
    },

    async get_notifications(params) {
      const queryParams = new URLSearchParams();
      if (params.unreadOnly) queryParams.set('unreadOnly', 'true');
      queryParams.set('limit', params.limit.toString());

      const response = await fetch(`${apiUrl}/api/notifications?${queryParams}`, { headers });
      return await parseOrThrow(response, 'get_notifications');
    },

    async heartbeat(params) {
      const response = await fetch(`${apiUrl}/api/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params.actions || {}),
      });
      const data = await parseOrThrow(response, 'heartbeat');
      return {
        timestamp: new Date().toISOString(),
        ...data,
      };
    },

    async get_reputation(params) {
      const playerId = params.playerId || 'me';
      const response = await fetch(`${apiUrl}/api/players/${playerId}/reputation`, { headers });
      const data = await parseOrThrow(response, 'get_reputation');
      return { reputation: data };
    },

    async get_leaderboard(params) {
      const queryParams = new URLSearchParams();
      queryParams.set('type', params.type);
      queryParams.set('period', params.period);
      queryParams.set('limit', params.limit.toString());

      const response = await fetch(`${apiUrl}/api/leaderboards?${queryParams}`, { headers });
      const data = await parseOrThrow(response, 'get_leaderboard');
      return {
        leaderboard: data.entries,
        type: params.type,
        period: params.period,
      };
    },
  };
}
