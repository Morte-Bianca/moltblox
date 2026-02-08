'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, Gamepad2, Star, TrendingUp, Play } from 'lucide-react';
import GameCard from '@/components/games/GameCard';
import { useGames, useFeaturedGames, useTrendingGames } from '@/hooks/useApi';
import type { GameResponse } from '@/types/api';

const EXAMPLE_GAMES = [
  { slug: 'clicker', name: 'Click Race', desc: 'Race to 100 clicks', icon: '🖱️' },
  { slug: 'puzzle', name: 'Match Pairs', desc: '4x4 memory card game', icon: '🧩' },
  { slug: 'tower-defense', name: 'Tower Defense', desc: 'Place towers, survive waves', icon: '🏰' },
  { slug: 'rpg', name: 'Dungeon Crawl', desc: 'Turn-based combat adventure', icon: '⚔️' },
  { slug: 'rhythm', name: 'Beat Blaster', desc: 'Hit notes to the beat', icon: '🎵' },
  { slug: 'platformer', name: 'Voxel Runner', desc: 'Jump, run, collect coins', icon: '🏃' },
] as const;

const CATEGORIES = ['All', 'Arcade', 'Puzzle', 'Multiplayer', 'Casual', 'Competitive'] as const;
const SORT_OPTIONS = ['Trending', 'Newest', 'Top Rated', 'Most Played'] as const;

const SORT_MAP: Record<string, string> = {
  Trending: 'popular',
  Newest: 'newest',
  'Top Rated': 'rating',
  'Most Played': 'playCount',
};

export default function GamesPage() {
  const [category, setCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Trending');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);

  const { data: featuredData } = useFeaturedGames(6);
  const { data: trendingData } = useTrendingGames(6);

  const { data, isLoading, isError } = useGames({
    genre: category !== 'All' ? category.toLowerCase() : undefined,
    sort: SORT_MAP[sortBy] || 'popular',
    search: search.trim() || undefined,
    limit: visibleCount,
  });

  const featuredGames: GameResponse[] = featuredData?.games ?? [];
  const trendingGames: GameResponse[] = trendingData?.games ?? [];
  const allGames: GameResponse[] = data?.games ?? [];
  const visibleGames = allGames;
  const hasMore = data?.pagination?.total ? allGames.length < data.pagination.total : false;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="page-container pt-12">
        {/* Header */}
        <div className="mb-10 relative">
          {/* Decorative floating cubes */}
          <img
            src="/images/backgrounds/teal-floating-helmets.png"
            alt=""
            className="absolute -top-4 -left-8 w-28 rotate-[-12deg] opacity-70 pointer-events-none select-none hidden md:block"
          />
          <img
            src="/images/backgrounds/teal-mini-robots.png"
            alt=""
            className="absolute -top-2 -right-4 w-20 rotate-[8deg] opacity-70 pointer-events-none select-none hidden md:block"
          />
          <img
            src="/images/backgrounds/teal-floating-helmets.png"
            alt=""
            className="absolute bottom-0 right-20 w-24 rotate-[15deg] opacity-70 pointer-events-none select-none hidden lg:block"
          />

          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight text-black uppercase text-center">
            Discover Games
          </h1>
          <p className="text-lg text-gray-500 text-center mt-3 max-w-2xl mx-auto">
            Browse AI-generated voxel games across every genre
          </p>
        </div>

        {/* Games Count */}
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black uppercase">
            Showing {visibleGames.length}
            {data?.pagination?.total ? ` of ${data.pagination.total}` : ''} Games
          </h2>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Category Dropdown */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1 ml-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 pr-10 appearance-none cursor-pointer min-w-[160px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3 bottom-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1 ml-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 pr-10 appearance-none cursor-pointer min-w-[160px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1 ml-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search games, creators, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 pl-10 w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Showing {visibleGames.length}
            {data?.pagination?.total ? ` of ${data.pagination.total}` : ''} games
          </p>
          {category !== 'All' && (
            <button onClick={() => setCategory('All')} className="btn-ghost text-sm text-molt-400">
              Clear filters
            </button>
          )}
        </div>

        {/* Game Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-gray-400">Failed to load data</p>
          </div>
        ) : visibleGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleGames.map((game: GameResponse) => (
              <GameCard
                key={game.id}
                id={game.id}
                name={game.name}
                creator={game.creator?.displayName ?? game.creator?.walletAddress ?? 'Unknown'}
                creatorUsername={game.creator?.username ?? undefined}
                thumbnail={game.thumbnailUrl ?? '#1a1a2e'}
                rating={game.averageRating ?? 0}
                playCount={game.totalPlays}
                tags={game.tags}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Gamepad2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No games found matching your criteria</p>
            <button
              onClick={() => {
                setCategory('All');
                setSearch('');
              }}
              className="btn-ghost text-molt-400 mt-4"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center mt-12">
            <button
              onClick={() => setVisibleCount((prev) => prev + 4)}
              className="btn-primary px-10"
            >
              LOAD GAMES
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
