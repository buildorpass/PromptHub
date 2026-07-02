"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Save,
  Play,
  GitCompare,
  ChevronLeft,
  AlertCircle,
  Check,
} from "lucide-react";
import { usePrompt, useUpdatePrompt } from "@/hooks/usePrompts";
import { useVersions, useCreateVersion } from "@/hooks/useVersions";
import { useModels } from "@/hooks/useModels";
import { useCreateRun } from "@/hooks/useRuns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VersionTag } from "@/components/shared/VersionTag";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ModelBadge } from "@/components/shared/ModelBadge";
import { CostDisplay } from "@/components/shared/CostDisplay";
import { TokenCount } from "@/components/shared/TokenCount";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { extractVariables, timeAgo, formatLatency, cn } from "@/lib/utils";
import type { PromptVersion, RunResponse, ModelInfo } from "@/types";
import Link from "next/link";

// ----- Version sidebar item -----
function VersionItem({
  version,
  isActive,
  onClick,
}: {
  version: PromptVersion;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 border-b border-brand-border transition-colors",
        isActive
          ? "bg-brand-elevated border-l-2 border-l-brand-primary"
          : "hover:bg-brand-elevated/50"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <VersionTag version={version.version_number} />
        <span className="text-xs text-brand-text-muted">
          {timeAgo(version.created_at)}
        </span>
      </div>
      <p className="text-xs text-brand-text-secondary truncate">
        {version.commit_message || "No message"}
      </p>
      <p className="text-xs text-brand-text-muted mt-0.5">{version.author}</p>
    </button>
  );
}

// ----- Commit Message Dialog -----
const commitSchema = z.object({
  message: z.string().min(1, "Commit message is required"),
});
type CommitForm = z.infer<typeof commitSchema>;

function CommitDialog({
  open,
  onClose,
  onSave,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (message: string) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommitForm>({
    resolver: zodResolver(commitSchema),
  });

  const onSubmit = (data: CommitForm) => {
    onSave(data.message);
    reset();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="w-[440px]" onClose={onClose} title="Save New Version">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cmsg">Commit Message *</Label>
            <Input
              id="cmsg"
              placeholder="What changed in this version?"
              {...register("message")}
              autoFocus
            />
            {errors.message && (
              <p className="text-xs text-rose-400">{errors.message.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Version"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----- Run Result Panel -----
function RunResultPanel({
  result,
  loading,
}: {
  result: RunResponse | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (!result) return null;

  const r = result.results[0] ?? null;

  return (
    <div className="mt-4 border border-brand-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-brand-border bg-brand-elevated">
        <span className="text-xs font-medium text-brand-text-secondary">
          Output
        </span>
        <StatusBadge status={result.status} />
      </div>
      {r?.error ? (
        <div className="p-3">
          <p className="text-xs text-rose-400 font-mono">{r.error}</p>
        </div>
      ) : (
        <div className="p-3">
          <p className="text-xs font-mono text-brand-text-primary whitespace-pre-wrap max-h-48 overflow-y-auto">
            {r?.output_text ?? "No output"}
          </p>
        </div>
      )}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-brand-border bg-brand-elevated/50">
        <TokenCount inputTokens={r?.input_tokens ?? null} outputTokens={r?.output_tokens ?? null} />
        <CostDisplay
          cost={r?.cost ?? null}
          inputTokens={r?.input_tokens ?? null}
          outputTokens={r?.output_tokens ?? null}
        />
        <span className="font-mono text-xs text-brand-text-secondary">
          {formatLatency(r?.latency_ms ?? null)}
        </span>
      </div>
    </div>
  );
}

// ----- Main page -----
export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const promptId =
    params.promptId === "new" ? null : Number(params.promptId);

  const { data: prompt, isLoading: promptLoading, error: promptError } = usePrompt(promptId);
  const { data: versions = [], isLoading: versionsLoading } = useVersions(promptId);
  const { data: models = [], isLoading: modelsLoading } = useModels();

  const createVersion = useCreateVersion();
  const updatePrompt = useUpdatePrompt();
  const createRun = useCreateRun();

  // Editor state
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [activeTab, setActiveTab] = useState("prompt");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  // Detect variables in content
  const detectedVars = extractVariables(content);

  // Find active version
  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? versions[0] ?? null;

  // When versions load, select the latest
  useEffect(() => {
    if (versions.length > 0 && activeVersionId === null) {
      const latest = versions[versions.length - 1];
      setActiveVersionId(latest.id);
      setContent(latest.content);
      setSystemPrompt(latest.system_prompt ?? "");
    }
  }, [versions, activeVersionId]);

  // When prompt loads, set name
  useEffect(() => {
    if (prompt) setNameValue(prompt.name);
  }, [prompt]);

  // Pre-select first available model
  useEffect(() => {
    if (models.length > 0 && selectedModels.length === 0) {
      const first = models.find((m) => m.available);
      if (first) setSelectedModels([first.model]);
    }
  }, [models, selectedModels]);

  const handleVersionClick = useCallback(
    (v: PromptVersion) => {
      setActiveVersionId(v.id);
      setContent(v.content);
      setSystemPrompt(v.system_prompt ?? "");
    },
    []
  );

  const handleSaveName = async () => {
    if (!promptId || !nameValue.trim()) return;
    try {
      await updatePrompt.mutateAsync({ id: promptId, name: nameValue.trim() });
      setEditingName(false);
      toast({ type: "success", title: "Name updated" });
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to update name",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleSaveVersion = async (commitMessage: string) => {
    if (!promptId) return;
    try {
      const vars: Record<string, string> = {};
      detectedVars.forEach((v) => {
        vars[v] = "";
      });
      await createVersion.mutateAsync({
        promptId,
        content,
        system_prompt: systemPrompt || null,
        variables: Object.keys(vars).length > 0 ? vars : null,
        commit_message: commitMessage,
      });
      setShowCommitDialog(false);
      toast({ type: "success", title: "Version saved" });
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to save version",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleRun = async () => {
    if (!activeVersion || selectedModels.length === 0) return;
    setRunLoading(true);
    setRunResult(null);
    try {
      const result = await createRun.mutateAsync({
        prompt_version_id: activeVersion.id,
        model_names: [selectedModels[0]],
        variable_inputs: variableValues,
      });
      setRunResult(result);
    } catch (err) {
      toast({
        type: "error",
        title: "Run failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRunLoading(false);
    }
  };

  const toggleModel = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName]
    );
  };

  if (promptError) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <AlertCircle className="h-8 w-8 text-rose-400" />
        <p className="text-sm text-brand-text-secondary">
          Prompt not found or failed to load.
        </p>
        <Button variant="ghost" onClick={() => router.push("/library")}>
          <ChevronLeft className="h-4 w-4" />
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Version Sidebar */}
      <aside className="w-[220px] border-r border-brand-border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-3 border-b border-brand-border">
          <span className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
            Versions
          </span>
          {promptId && (
            <Link
              href={`/editor/${promptId}/diff`}
              className="text-xs text-brand-text-muted hover:text-brand-primary transition-colors flex items-center gap-1"
            >
              <GitCompare className="h-3 w-3" />
              Diff
            </Link>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {versionsLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-3 py-3 border-b border-brand-border space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="px-3 py-4 text-xs text-brand-text-muted">
              No versions yet. Save your first version.
            </p>
          ) : (
            [...versions].reverse().map((v) => (
              <VersionItem
                key={v.id}
                version={v}
                isActive={v.id === (activeVersion?.id ?? null)}
                onClick={() => handleVersionClick(v)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Center: Editor */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-brand-border">
        {/* Prompt name */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border">
          {promptLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="h-7 text-sm font-medium flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setNameValue(prompt?.name ?? "");
                    setEditingName(false);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={updatePrompt.isPending}
                className="h-7"
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <h2
              className="text-sm font-semibold text-brand-text-primary cursor-pointer hover:text-brand-primary transition-colors flex-1"
              onClick={() => setEditingName(true)}
              title="Click to edit name"
            >
              {prompt?.name ?? "Untitled Prompt"}
            </h2>
          )}
          {activeVersion && (
            <VersionTag version={activeVersion.version_number} />
          )}
        </div>

        {/* Tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="px-4 shrink-0">
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="system">System Prompt</TabsTrigger>
            </TabsList>

            <TabsContent
              value="prompt"
              className="flex-1 flex flex-col overflow-hidden p-4 gap-3"
            >
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your prompt here... Use {{variable_name}} for variables and {{asset:name}} for assets."
                className="flex-1 font-mono text-sm resize-none min-h-[200px]"
              />

              {/* Variables */}
              {detectedVars.length > 0 && (
                <div className="border border-brand-border rounded-md p-3 space-y-2">
                  <p className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                    Detected Variables
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {detectedVars.map((varName) => (
                      <div key={varName} className="space-y-1">
                        <Label className="font-mono">
                          {"{{"}{varName}{"}}"}
                        </Label>
                        <Input
                          placeholder={`${varName} description`}
                          className="text-xs h-7"
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
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="system"
              className="flex-1 flex flex-col overflow-hidden p-4"
            >
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Optional system prompt..."
                className="flex-1 font-mono text-sm resize-none min-h-[300px]"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-brand-border px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setShowCommitDialog(true)}
            disabled={!promptId || !content.trim()}
          >
            <Save className="h-3.5 w-3.5" />
            Save New Version
          </Button>
          {promptId && (
            <Button
              variant="ghost"
              onClick={() => router.push(`/editor/${promptId}/diff`)}
            >
              <GitCompare className="h-3.5 w-3.5" />
              View Diff
            </Button>
          )}
        </div>
      </div>

      {/* Right: Run panel */}
      <aside className="w-[260px] flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-brand-border">
          <span className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
            Run
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Model selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
              Models
            </p>
            {modelsLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : models.length === 0 ? (
              <p className="text-xs text-brand-text-muted">
                No models available. Check backend config.
              </p>
            ) : (
              models.map((m) => (
                <div key={m.model} className="flex items-center justify-between">
                  <Checkbox
                    id={`model-${m.model}`}
                    label={m.model}
                    checked={selectedModels.includes(m.model)}
                    disabled={!m.available}
                    onChange={() => m.available && toggleModel(m.model)}
                  />
                  {!m.available && (
                    <span className="text-xs text-brand-text-muted">No key</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Variable value inputs */}
          {detectedVars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                Variable Values
              </p>
              {detectedVars.map((varName) => (
                <div key={varName} className="space-y-1">
                  <Label className="font-mono text-xs">
                    {"{{"}{varName}{"}}"}
                  </Label>
                  <Input
                    placeholder="Value..."
                    className="text-xs h-7"
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
          )}

          <Button
            className="w-full"
            onClick={handleRun}
            disabled={
              runLoading ||
              !activeVersion ||
              selectedModels.length === 0
            }
          >
            {runLoading ? (
              <>
                <LoadingSpinner size="sm" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run
              </>
            )}
          </Button>

          <RunResultPanel result={runResult} loading={runLoading} />
        </div>
      </aside>

      <CommitDialog
        open={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        onSave={handleSaveVersion}
        isPending={createVersion.isPending}
      />
    </div>
  );
}
