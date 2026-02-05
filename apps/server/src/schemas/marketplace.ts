import { z } from 'zod';

export const createItemSchema = {
  body: z.object({
    gameId: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    price: z.string().regex(/^\d+$/, 'Price must be a numeric string'),
    category: z.enum(['cosmetic', 'power_up', 'consumable', 'access', 'subscription']).optional(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
    imageUrl: z.string().url().optional(),
    maxSupply: z.number().int().positive().optional(),
    properties: z.record(z.unknown()).optional(),
  }),
};

export const purchaseItemSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    quantity: z.number().int().positive().max(100).optional().default(1),
  }),
};

export const browseItemsSchema = {
  query: z.object({
    category: z.string().optional(),
    gameId: z.string().optional(),
    rarity: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  }),
};
