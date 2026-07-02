import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ModelPricing, PaginatedResponse } from "@/types";

export function usePricing() {
  return useQuery({
    queryKey: ["pricing"],
    queryFn: () => api.get<PaginatedResponse<ModelPricing>>("/pricing"),
    select: (data) => data.items,
  });
}

export function useCreatePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      provider: string;
      model_name: string;
      input_rate: number;
      output_rate: number;
      currency?: string;
    }) => api.post<ModelPricing>("/pricing", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
  });
}

export function useUpdatePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ModelPricing> & { id: number }) =>
      api.put<ModelPricing>(`/pricing/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
  });
}

export function useDeletePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/pricing/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
  });
}
