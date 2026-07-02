import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TestCase, TestRun, PaginatedResponse } from "@/types";

export function useTestCases() {
  return useQuery({
    queryKey: ["test-cases"],
    queryFn: () => api.get<PaginatedResponse<TestCase>>("/test-cases"),
    select: (data) => data.items,
  });
}

export function useTestCase(id: number | null) {
  return useQuery({
    queryKey: ["test-cases", id],
    queryFn: () => api.get<TestCase>(`/test-cases/${id}`),
    enabled: id != null,
  });
}

export function useCreateTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      prompt_version_id: number;
      variable_inputs?: Record<string, string> | null;
      assertion_type?: string | null;
      assertion_value?: string | null;
    }) => api.post<TestCase>("/test-cases", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-cases"] });
    },
  });
}

export function useUpdateTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<TestCase> & { id: number }) =>
      api.put<TestCase>(`/test-cases/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["test-cases"] });
      qc.invalidateQueries({ queryKey: ["test-cases", vars.id] });
    },
  });
}

export function useDeleteTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/test-cases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-cases"] });
    },
  });
}

export function useRunTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      model_names,
    }: {
      id: number;
      model_names: string[];
    }) =>
      api.post<TestRun>(`/test-cases/${id}/run`, { model_names }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-runs"] });
    },
  });
}

export function useTestCaseHistory(id: number | null) {
  return useQuery({
    queryKey: ["test-runs", id],
    queryFn: () => api.get<TestRun[]>(`/test-cases/${id}/history`),
    enabled: id != null,
  });
}
