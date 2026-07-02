import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Prompt, PaginatedResponse } from "@/types";

interface PromptFilters {
  search?: string;
  folder_id?: number | null;
}

export function usePrompts(filters?: PromptFilters) {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.folder_id != null)
    params.set("folder_id", String(filters.folder_id));
  const query = params.toString();

  return useQuery({
    queryKey: ["prompts", filters],
    queryFn: () => api.get<PaginatedResponse<Prompt>>(`/prompts${query ? `?${query}` : ""}`),
    select: (data) => data.items,
  });
}

export function usePrompt(id: number | null) {
  return useQuery({
    queryKey: ["prompts", id],
    queryFn: () => api.get<Prompt>(`/prompts/${id}`),
    enabled: id != null,
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      folder_id?: number | null;
      tags?: string[];
    }) => api.post<Prompt>("/prompts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Prompt> & { id: number }) =>
      api.put<Prompt>(`/prompts/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      qc.invalidateQueries({ queryKey: ["prompts", vars.id] });
    },
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/prompts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}
