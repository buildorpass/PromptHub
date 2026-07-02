import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Asset, PaginatedResponse } from "@/types";

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: () => api.get<PaginatedResponse<Asset>>("/assets"),
    select: (data) => data.items,
  });
}

export function useAsset(id: number | null) {
  return useQuery({
    queryKey: ["assets", id],
    queryFn: () => api.get<Asset>(`/assets/${id}`),
    enabled: id != null,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      content: string;
      type: string;
      team_shared?: boolean;
    }) => api.post<Asset>("/assets", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Asset> & { id: number }) =>
      api.put<Asset>(`/assets/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["assets", vars.id] });
    },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
