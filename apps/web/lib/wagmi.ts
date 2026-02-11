import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

if (!process.env.NEXT_PUBLIC_WC_PROJECT_ID) {
  console.warn(
    '[Moltblox] NEXT_PUBLIC_WC_PROJECT_ID is not set. Wallet connections will fail in production. ' +
      'Get a project ID at https://cloud.walletconnect.com',
  );
}

export const config = getDefaultConfig({
  appName: 'Moltblox',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'moltblox-dev',
  chains: (() => {
    const chainIdRaw = process.env.NEXT_PUBLIC_CHAIN_ID;
    const chainId = chainIdRaw ? Number(chainIdRaw) : baseSepolia.id;

    if (chainId === baseSepolia.id) return [baseSepolia, base];
    if (chainId === base.id) return [base, baseSepolia];

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      console.warn(
        '[Moltblox] NEXT_PUBLIC_RPC_URL is required for custom chains. Falling back to Base Sepolia.',
      );
      return [baseSepolia, base];
    }

    const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || 'Ethereum Testnet';
    const nativeSymbol = process.env.NEXT_PUBLIC_CHAIN_CURRENCY_SYMBOL || 'ETH';
    const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL;

    const custom = defineChain({
      id: chainId,
      name: chainName,
      nativeCurrency: { name: nativeSymbol, symbol: nativeSymbol, decimals: 18 },
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
      blockExplorers: explorerUrl
        ? { default: { name: `${chainName} Explorer`, url: explorerUrl } }
        : undefined,
    });

    return [custom];
  })(),
  ssr: true,
});
