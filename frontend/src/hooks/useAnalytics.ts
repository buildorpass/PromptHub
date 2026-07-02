import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AnalyticsSummary,
  CostByModelItem,
  CostByPromptItem,
  EfficiencyItem,
  RecentRunItem,
} from "@/types";

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => api.get<AnalyticsSummary>("/analytics/summary"),
    staleTime: 30_000,
  });
}

export function useCostByModel() {
  return useQuery({
    queryKey: ["analytics", "cost-by-model"],
    queryFn: () => api.get<CostByModelItem[]>("/analytics/cost-by-model"),
    staleTime: 30_000,
  });
}

export function useCostByPrompt() {
  return useQuery({
    queryKey: ["analytics", "cost-by-prompt"],
    queryFn: () => api.get<CostByPromptItem[]>("/analytics/cost-by-prompt"),
    staleTime: 30_000,
  });
}

export function useEfficiency() {
  return useQuery({
    queryKey: ["analytics", "efficiency"],
    queryFn: () => api.get<EfficiencyItem[]>("/analytics/efficiency"),
    staleTime: 30_000,
  });
}

export function useRecentRuns(limit = 20) {
  return useQuery({
    queryKey: ["analytics", "recent-runs", limit],
    queryFn: () =>
      api.get<RecentRunItem[]>(`/analytics/recent-runs?limit=${limit}`),
    staleTime: 30_000,
  });
}
