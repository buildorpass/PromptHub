import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ModelInfo } from "@/types";

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<ModelInfo[]>("/models"),
    staleTime: 60_000,
  });
}
