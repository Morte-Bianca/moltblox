'use client';

import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { MOLT_TOKEN_ADDRESS, ERC20_ABI } from '@/lib/contracts';

export function useMoltBalance() {
  const { address, isConnected } = useAccount();

  const { data: rawBalance, isLoading } = useReadContract({
    address: MOLT_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && MOLT_TOKEN_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 15_000,
    },
  });

  const balance = rawBalance ? formatUnits(rawBalance as bigint, 18) : '0.00';
  const formatted = parseFloat(balance).toFixed(2);

  return {
    balance,
    formatted,
    isLoading,
    isConnected,
    address,
  };
}
