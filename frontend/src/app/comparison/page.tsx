"use client";

import React, { useState } from "react";
import { Play, ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { usePrompts } from "@/hooks/usePrompts";
import { useVersions } from "@/hooks/useVersions";
import { useModels } from "@/hooks/useModels";
import { useCreateRun, useRateResult } from "@/hooks/useRuns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ModelBadge } from "@/components/shared/ModelBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CostDisplay } from "@/components/shared/CostDisplay";
import { TokenCount } from "@/components/shared/TokenCount";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/toast";
import { extractVariables, formatLatency, cn } from "@/lib/utils";
import type { RunResponse, ModelInfo } from "@/types";

// --- Star rating ---
function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hovered ?? value ?? 0) >= n;
        return (
          <button
            key={n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(n)}
            className="transition-colors"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                filled ? "fill-amber-400 text-amber-400" : "text-zinc-600"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// --- Result column ---
function ResultColumn({
  model,
  result,
  loading,
  onRate,
}: {
  model: ModelInfo;
  result: RunResponse | null;
  loading: boolean;
  onRate: (resultId: number, rating: number, tag?: string) => void;
}) {
  const [localRating, setLocalRating] = useState<number | null>(null);
  const r = result?.results[0] ?? null;

  const handleRate = (rating: number, tag?: string) => {
    if (!r) return;
    setLocalRating(rating);
    onRate(r.id, rating, tag);
  };

  return (
    <div
      className={cn(
        "flex flex-col border border-brand-border rounded-md overflow-hidden min-w-[280px] flex-1",
        result?.status === "completed" && !r?.error
          ? "border-t-2 border-t-emerald-500"
          : r?.error
          ? "border-t-2 border-t-rose-500"
          : loading
          ? "border-t-2 border-t-amber-400"
          : ""
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-elevated border-b border-brand-border">
        <span className="text-sm font-medium text-brand-text-primary truncate flex-1">
          {model.model}
        </span>
        <ModelBadge provider={model.provider} />
        {!model.available && (
          <Badge variant="default" className="text-xs">
            No key
          </Badge>
        )}
      </div>

      <div className="flex-1 p-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <LoadingSpinner />
            <p className="text-xs text-brand-text-muted">Running...</p>
          </div>
        ) : !result ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-brand-text-muted">Awaiting run</p>
          </div>
        ) : r?.error ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-rose-400">Error</p>
            <p className="text-xs font-mono text-rose-300 bg-rose-950/40 border border-rose-500/20 rounded p-2">
              {r?.error}
            </p>
          </div>
        ) : (
          <>
            {/* Output */}
            <div className="max-h-64 overflow-y-auto">
              <p className="text-xs font-mono text-brand-text-primary whitespace-pre-wrap">
                {r?.output_text ?? "No output"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Stats footer */}
      {result && !loading && (
        <>
          <div className="border-t border-brand-border px-3 py-2 space-y-1 bg-brand-elevated/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-text-muted">Tokens</span>
              <TokenCount
                inputTokens={r?.input_tokens ?? null}
                outputTokens={r?.output_tokens ?? null}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-text-muted">Cost</span>
              <CostDisplay
                cost={r?.cost ?? null}
                inputTokens={r?.input_tokens ?? null}
                outputTokens={r?.output_tokens ?? null}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-text-muted">Latency</span>
              <span className="font-mono text-xs text-brand-text-secondary">
                {formatLatency(r?.latency_ms ?? null)}
              </span>
            </div>
          </div>

          <div className="border-t border-brand-border px-3 py-2 bg-brand-elevated/50 flex items-center justify-between">
            <StarRating
              value={localRating ?? r?.rating ?? null}
              onChange={(rating) => handleRate(rating)}
            />
            <div className="flex gap-1">
              <button
                onClick={() => handleRate(5, "thumbs_up")}
                className={cn(
                  "p-1 rounded transition-colors",
                  (localRating ?? r?.rating ?? 0) === 5 &&
                    r?.rating_tag === "thumbs_up"
                    ? "text-emerald-400"
                    : "text-brand-text-muted hover:text-emerald-400"
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleRate(1, "thumbs_down")}
                className={cn(
                  "p-1 rounded transition-colors",
                  r?.rating_tag === "thumbs_down"
                    ? "text-rose-400"
                    : "text-brand-text-muted hover:text-rose-400"
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Provider group of models ---
function ModelGroup({
  provider,
  models,
  selected,
  onToggle,
}: {
  provider: string;
  models: ModelInfo[];
  selected: string[];
  onToggle: (model: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
        {provider}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {models.map((m) => (
          <div key={m.model} className="flex items-center justify-between gap-2">
            <Checkbox
              id={`cmp-${m.model}`}
              label={m.model}
              checked={selected.includes(m.model)}
              disabled={!m.available}
              onChange={() => m.available && onToggle(m.model)}
            />
            {!m.available && (
              <span className="text-xs text-brand-text-muted shrink-0">
                No key
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const { toast } = useToast();
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, RunResponse | null>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  const [hasRun, setHasRun] = useState(false);

  const { data: prompts = [] } = usePrompts();
  const { data: versions = [] } = useVersions(selectedPromptId);
  const { data: models = [], isLoading: modelsLoading } = useModels();
  const createRun = useCreateRun();
  const rateResult = useRateResult();

  // Group models by provider
  const modelsByProvider = models.reduce<Record<string, ModelInfo[]>>(
    (acc, m) => {
      const p = m.provider.toLowerCase();
      if (!acc[p]) acc[p] = [];
      acc[p].push(m);
      return acc;
    },
    {}
  );

  // When prompt changes, reset version
  const handlePromptChange = (id: number) => {
    setSelectedPromptId(id);
    setSelectedVersionId(null);
    setResults({});
  };

  // When versions load, auto-select latest
  React.useEffect(() => {
    if (versions.length > 0 && selectedVersionId === null) {
      setSelectedVersionId(versions[versions.length - 1].id);
    }
  }, [versions, selectedVersionId]);

  // Detect variables from the selected version
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const detectedVars = selectedVersion
    ? extractVariables(selectedVersion.content)
    : [];

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const handleRunAll = async () => {
    if (!selectedVersionId || selectedModels.length === 0) {
      toast({ type: "warning", title: "Select a prompt version and at least one model" });
      return;
    }

    setHasRun(true);
    const newLoading: Record<string, boolean> = {};
    const newResults: Record<string, RunResponse | null> = {};
    selectedModels.forEach((m) => {
      newLoading[m] = true;
      newResults[m] = null;
    });
    setLoadingModels(newLoading);
    setResults(newResults);

    // Fire all in parallel
    await Promise.all(
      selectedModels.map(async (modelName) => {
        try {
          const result = await createRun.mutateAsync({
            prompt_version_id: selectedVersionId,
            model_names: [modelName],
            variable_inputs: variableValues,
          });
          setResults((prev) => ({ ...prev, [modelName]: result }));
        } catch (err) {
          toast({
            type: "error",
            title: `${modelName} failed`,
            description: err instanceof Error ? err.message : undefined,
          });
          setResults((prev) => ({ ...prev, [modelName]: null }));
        } finally {
          setLoadingModels((prev) => ({ ...prev, [modelName]: false }));
        }
      })
    );
  };

  const handleRate = async (resultId: number, rating: number, tag?: string) => {
    try {
      await rateResult.mutateAsync({ resultId, rating, tag });
    } catch (err) {
      toast({
        type: "error",
        title: "Rating failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Comparison Runner"
        description="Run a prompt against multiple models side by side"
      />

      <div className="flex-1 overflow-y-auto">
        {/* Config bar */}
        <div className="border-b border-brand-border px-6 py-4 space-y-4">
          {/* Prompt + version selectors */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1.5 w-72">
              <Label>Prompt</Label>
              <Select
                value={selectedPromptId?.toString() ?? ""}
                onChange={(e) =>
                  e.target.value
                    ? handlePromptChange(Number(e.target.value))
                    : setSelectedPromptId(null)
                }
              >
                <option value="">Select prompt...</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5 w-56">
              <Label>Version</Label>
              <Select
                value={selectedVersionId?.toString() ?? ""}
                onChange={(e) =>
                  setSelectedVersionId(Number(e.target.value) || null)
                }
                disabled={!selectedPromptId}
              >
                <option value="">Select version...</option>
                {[...versions].reverse().map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} — {v.commit_message || "No message"}
                  </option>
                ))}
              </Select>
            </div>

            {/* Variable inputs */}
            {detectedVars.map((varName) => (
              <div key={varName} className="space-y-1.5">
                <Label className="font-mono">{"{{"}{varName}{"}}"}</Label>
                <Input
                  placeholder={varName}
                  className="w-40"
                  value={variableValues[varName] ?? ""}
                  onChange={(e) =>
                    setVariableValues((prev) => ({
                      ...prev,
                      [varName]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          {/* Model grid */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
              Models
            </p>
            {modelsLoading ? (
              <div className="flex gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-36" />
                ))}
              </div>
            ) : models.length === 0 ? (
              <p className="text-xs text-brand-text-muted">
                No models configured. Check backend.
              </p>
            ) : (
              <div className="flex flex-wrap gap-8">
                {Object.entries(modelsByProvider).map(([provider, ms]) => (
                  <ModelGroup
                    key={provider}
                    provider={provider}
                    models={ms}
                    selected={selectedModels}
                    onToggle={toggleModel}
                  />
                ))}
              </div>
            )}
          </div>

          <Button
            size="lg"
            onClick={handleRunAll}
            disabled={
              !selectedVersionId ||
              selectedModels.length === 0 ||
              Object.values(loadingModels).some(Boolean)
            }
            className="w-40"
          >
            {Object.values(loadingModels).some(Boolean) ? (
              <>
                <LoadingSpinner size="sm" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run All
              </>
            )}
          </Button>
        </div>

        {/* Results area */}
        {hasRun && selectedModels.length > 0 && (
          <div className="p-6 flex gap-4 flex-wrap">
            {selectedModels.map((modelName) => {
              const modelInfo = models.find((m) => m.model === modelName);
              if (!modelInfo) return null;
              return (
                <ResultColumn
                  key={modelName}
                  model={modelInfo}
                  result={results[modelName] ?? null}
                  loading={loadingModels[modelName] ?? false}
                  onRate={handleRate}
                />
              );
            })}
          </div>
        )}

        {!hasRun && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-2">
              <p className="text-sm text-brand-text-secondary">
                Configure your prompt and models above, then click Run All
              </p>
              <p className="text-xs text-brand-text-muted">
                Results will appear here side by side
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
