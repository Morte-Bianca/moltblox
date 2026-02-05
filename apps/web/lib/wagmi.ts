import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Moltblox',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'moltblox-dev',
  chains: [baseSepolia, base],
  ssr: true,
});
