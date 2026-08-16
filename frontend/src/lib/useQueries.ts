// 共享数据 hooks — Tanstack Query 封装
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const QK = {
  market: ['market'] as const,
  emotion: ['emotion'] as const,
  volume: (days: number) => ['volume', days] as const,
  amv: (days: number) => ['amv', days] as const,
  global: ['global'] as const,
  sector: (type: string) => ['sector', type] as const,
  premarket: (date: string) => ['premarket', date] as const,
  premarketDates: ['premarket-dates'] as const,
  watchlist: ['watchlist'] as const,
  trades: ['trades'] as const,
  reviews: ['reviews'] as const,
};

export function useMarketSummary() {
  return useQuery({ queryKey: QK.market, queryFn: api.marketSummary, refetchInterval: 30000 });
}

export function useEmotion() {
  return useQuery({ queryKey: QK.emotion, queryFn: api.emotion, refetchInterval: 60000 });
}

export function useVolume(days = 10) {
  return useQuery({ queryKey: QK.volume(days), queryFn: () => api.volume(days), refetchInterval: 120000 });
}

export function useAmv(days = 10) {
  return useQuery({ queryKey: QK.amv(days), queryFn: () => api.amv(days), refetchInterval: 120000 });
}

export function useGlobalIndices() {
  return useQuery({ queryKey: QK.global, queryFn: api.globalIndices, refetchInterval: 120000 });
}

export function useGlobalAll() {
  return useQuery({ queryKey: ['global-all'], queryFn: api.globalAll, refetchInterval: 600000 });
}

export function useBreadth() {
  return useQuery({ queryKey: ['breadth'], queryFn: api.breadth, refetchInterval: 300000 });
}

export function useStats(days = 10) {
  return useQuery({ queryKey: ['stats', days], queryFn: () => api.stats(days), refetchInterval: 600000 });
}

export function useSectorFlow(type = 'industry') {
  return useQuery({ queryKey: QK.sector(type), queryFn: () => api.sectorFlow(type, 30), refetchInterval: 60000 });
}

export function useKgSector(type = 'concept', sort = 'score', limit = 40) {
  return useQuery({ queryKey: ['kg-sector', type, sort], queryFn: () => api.kgSector(type, sort, limit), refetchInterval: 600000 });
}

export function usePremarket(date: string) {
  return useQuery({ queryKey: QK.premarket(date), queryFn: () => api.premarket(date), refetchInterval: 60000 });
}

export function usePremarketDates() {
  return useQuery({ queryKey: QK.premarketDates, queryFn: api.premarketDates });
}

export function useWatchlist() {
  return useQuery({ queryKey: QK.watchlist, queryFn: api.watchlist, refetchInterval: 30000 });
}

export function useTrades() {
  return useQuery({ queryKey: QK.trades, queryFn: api.trades, refetchInterval: 30000 });
}

export function useReviews() {
  return useQuery({ queryKey: QK.reviews, queryFn: api.reviews });
}

export function invalidateAll(qc: ReturnType<typeof useQueryClient>, keys: string[][]) {
  keys.forEach(k => qc.invalidateQueries({ queryKey: k }));
}
