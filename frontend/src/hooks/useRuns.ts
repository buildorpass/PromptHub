import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RunResponse, RunResult, TestRun, PaginatedResponse } from "@/types";

interface CreateRunPayload {
  prompt_version_id: number;
  model_names: string[];
  variable_inputs?: Record<string, string>;
  max_tokens?: number;
  temperature?: number;
}

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRunPayload) =>
      api.post<RunResponse>("/runs", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useRuns(limit = 20) {
  return useQuery({
    queryKey: ["runs", limit],
    queryFn: () => api.get<PaginatedResponse<TestRun>>(`/runs?page=1&page_size=${limit}`),
    select: (data) => data.items,
  });
}

export function useRun(runId: number | null) {
  return useQuery({
    queryKey: ["runs", runId],
    queryFn: () => api.get<RunResponse>(`/runs/${runId}`),
    enabled: runId != null,
  });
}

export function useRateResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      resultId,
      rating,
      tag,
    }: {
      resultId: number;
      rating: number;
      tag?: string;
    }) =>
      api.post<RunResult>(`/runs/results/${resultId}/rate`, { rating, tag }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
