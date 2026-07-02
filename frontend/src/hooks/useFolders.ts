import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Folder, PaginatedResponse } from "@/types";

export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: () => api.get<PaginatedResponse<Folder>>("/folders"),
    select: (data) => data.items,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parent_id?: number | null; team_shared?: boolean }) =>
      api.post<Folder>("/folders", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Folder> & { id: number }) =>
      api.put<Folder>(`/folders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/folders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}
