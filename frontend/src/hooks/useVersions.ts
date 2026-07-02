import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PromptVersion } from "@/types";

export function useVersions(promptId: number | null) {
  return useQuery({
    queryKey: ["versions", promptId],
    queryFn: () => api.get<PromptVersion[]>(`/prompts/${promptId}/versions`),
    enabled: promptId != null,
  });
}

export function useVersion(promptId: number | null, versionId: number | null) {
  return useQuery({
    queryKey: ["versions", promptId, versionId],
    queryFn: () =>
      api.get<PromptVersion>(`/prompts/${promptId}/versions/${versionId}`),
    enabled: promptId != null && versionId != null,
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      promptId,
      ...data
    }: {
      promptId: number;
      content: string;
      system_prompt?: string | null;
      variables?: Record<string, string> | null;
      commit_message: string;
    }) => api.post<PromptVersion>(`/prompts/${promptId}/versions`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["versions", vars.promptId] });
      qc.invalidateQueries({ queryKey: ["prompts", vars.promptId] });
    },
  });
}

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      promptId,
      versionId,
    }: {
      promptId: number;
      versionId: number;
    }) =>
      api.post<PromptVersion>(
        `/prompts/${promptId}/versions/${versionId}/restore`,
        {}
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["versions", vars.promptId] });
      qc.invalidateQueries({ queryKey: ["prompts", vars.promptId] });
    },
  });
}

export function useVersionDiff(
  promptId: number | null,
  v1Id: number | null,
  v2Id: number | null
) {
  const version1 = useVersion(promptId, v1Id);
  const version2 = useVersion(promptId, v2Id);
  return { version1, version2 };
}
