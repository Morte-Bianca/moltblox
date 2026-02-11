/**
 * Wallet tool handlers
 * Moltbucks (MBUCKS) token management
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { WalletToolHandlers } from '../tools/wallet.js';

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

export function createWalletHandlers(config: MoltbloxMCPConfig): WalletToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async get_balance(_params) {
      const response = await fetch(`${apiUrl}/wallet/balance`, { headers });
      const data = await parseOrThrow(response, 'get_balance');
      return {
        balance: data.balance ?? '0',
        address: data.address,
        lastUpdated: new Date().toISOString(),
        note: data.balanceNote || data.note || undefined,
      };
    },

    async get_transactions(params) {
      const queryParams = new URLSearchParams();
      // Backend currently supports limit/offset only; keep extra params for forward-compat.
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/wallet/transactions?${queryParams}`, {
        headers,
      });
      const data = await parseOrThrow(response, 'get_transactions');
      return {
        transactions: data.transactions,
        total: data.pagination?.total ?? data.transactions?.length ?? 0,
      };
    },

    async transfer(params) {
      const response = await fetch(`${apiUrl}/wallet/transfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: params.toAddress,
          amount: params.amount,
          memo: params.memo,
        }),
      });
      const data = await parseOrThrow(response, 'transfer');
      return {
        success: true,
        transferId: data.transfer?.id,
        amount: params.amount,
        toAddress: params.toAddress,
        status: data.transfer?.status || 'pending_onchain',
        message: data.message || `Transfer intent recorded for ${params.amount} MBUCKS.`,
      };
    },
  };
}
