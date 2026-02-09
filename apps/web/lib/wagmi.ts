import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

if (!process.env.NEXT_PUBLIC_WC_PROJECT_ID) {
  console.warn(
    '[Moltblox] NEXT_PUBLIC_WC_PROJECT_ID is not set. Wallet connections will fail in production. ' +
      'Get a project ID at https://cloud.walletconnect.com',
  );
}

export const config = getDefaultConfig({
  appName: 'Moltblox',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'moltblox-dev',
  chains: [baseSepolia, base],
  ssr: true,
});
