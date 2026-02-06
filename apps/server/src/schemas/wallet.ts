import { z } from 'zod';

const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

export const transferSchema = {
  body: z.object({
    to: z.string().regex(ethereumAddressRegex, 'Invalid Ethereum address'),
    amount: z.string().regex(/^\d+$/, 'Amount must be a positive numeric string').refine(
      (val) => BigInt(val) > 0n,
      { message: 'Amount must be greater than zero' }
    ),
  }),
};

export const transactionsQuerySchema = {
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
  }),
};
