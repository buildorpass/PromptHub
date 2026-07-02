"use client";

import React, { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { diffLines } from "diff";
import { useVersions, useRestoreVersion } from "@/hooks/useVersions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { VersionTag } from "@/components/shared/VersionTag";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/toast";
import { timeAgo, cn } from "@/lib/utils";
import type { PromptVersion } from "@/types";
import { ChevronLeft, RotateCcw } from "lucide-react";
import Link from "next/link";

// Diff viewer component
function DiffViewer({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = diffLines(oldText, newText);

  return (
    <div className="font-mono text-xs border border-brand-border rounded-md overflow-hidden">
      {changes.map((part, idx) => {
        const lines = part.value.split("\n").filter((_, i, arr) =>
          i < arr.length - 1 || arr[arr.length - 1] !== ""
        );
        if (lines.length === 0) return null;

        return lines.map((line, lineIdx) => (
          <div
            key={`${idx}-${lineIdx}`}
            className={cn(
              "px-4 py-0.5 leading-5",
              part.added
                ? "bg-emerald-950 text-emerald-300"
                : part.removed
                ? "bg-rose-950 text-rose-300"
                : "text-zinc-500"
            )}
          >
            <span className="mr-3 select-none opacity-50 w-4 inline-block">
              {part.added ? "+" : part.removed ? "−" : " "}
            </span>
            {line || " "}
          </div>
        ));
      })}
      {changes.length === 0 && (
        <div className="px-4 py-3 text-brand-text-muted">No changes</div>
      )}
    </div>
  );
}

// Variables diff
function VariablesDiff({
  v1: v1Vars,
  v2: v2Vars,
}: {
  v1: Record<string, string> | null;
  v2: Record<string, string> | null;
}) {
  const old_ = v1Vars ?? {};
  const new_ = v2Vars ?? {};
  const allKeys = Array.from(
    new Set([...Object.keys(old_), ...Object.keys(new_)])
  );

  if (allKeys.length === 0) {
    return (
      <p className="text-xs text-brand-text-muted px-2">No variables in either version.</p>
    );
  }

  return (
    <div className="border border-brand-border rounded-md overflow-hidden">
      <div className="grid grid-cols-2">
        <div className="border-r border-brand-border">
          <div className="px-4 py-2 border-b border-brand-border bg-brand-elevated">
            <span className="text-xs font-medium text-brand-text-muted">Before</span>
          </div>
          {allKeys.map((key) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border-b border-brand-border text-xs",
                !(key in old_)
                  ? "opacity-30"
                  : old_[key] !== new_[key]
                  ? "bg-rose-950"
                  : ""
              )}
            >
              <span className="font-mono text-brand-text-muted">{key}</span>
              <span className="text-brand-text-secondary">=</span>
              <span className="font-mono text-rose-300">{old_[key] ?? "—"}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="px-4 py-2 border-b border-brand-border bg-brand-elevated">
            <span className="text-xs font-medium text-brand-text-muted">After</span>
          </div>
          {allKeys.map((key) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border-b border-brand-border text-xs",
                !(key in new_)
                  ? "opacity-30"
                  : old_[key] !== new_[key]
                  ? "bg-emerald-950"
                  : ""
              )}
            >
              <span className="font-mono text-brand-text-muted">{key}</span>
              <span className="text-brand-text-secondary">=</span>
              <span className="font-mono text-emerald-300">{new_[key] ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DiffPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const promptId = Number(params.promptId);

  const { data: versions = [], isLoading } = useVersions(promptId);
  const restoreVersion = useRestoreVersion();

  const [v1Id, setV1Id] = useState<number | null>(
    searchParams.get("v1") ? Number(searchParams.get("v1")) : null
  );
  const [v2Id, setV2Id] = useState<number | null>(
    searchParams.get("v2") ? Number(searchParams.get("v2")) : null
  );

  // Default to last two versions when loaded
  React.useEffect(() => {
    if (versions.length >= 2 && v1Id === null && v2Id === null) {
      setV1Id(versions[versions.length - 2].id);
      setV2Id(versions[versions.length - 1].id);
    } else if (versions.length === 1 && v1Id === null) {
      setV1Id(versions[0].id);
    }
  }, [versions, v1Id, v2Id]);

  const v1 = versions.find((v) => v.id === v1Id) ?? null;
  const v2 = versions.find((v) => v.id === v2Id) ?? null;

  const handleRestore = async (version: PromptVersion) => {
    try {
      await restoreVersion.mutateAsync({
        promptId,
        versionId: version.id,
      });
      toast({
        type: "success",
        title: `Restored to v${version.version_number}`,
      });
      router.push(`/editor/${promptId}`);
    } catch (err) {
      toast({
        type: "error",
        title: "Restore failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Version Diff"
        action={
          <Link href={`/editor/${promptId}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to Editor
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Version selectors */}
        <div className="grid grid-cols-2 gap-4">
          {/* v1 selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                Base Version
              </label>
              {v1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRestore(v1)}
                  disabled={restoreVersion.isPending}
                  className="h-6 text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </Button>
              )}
            </div>
            <Select
              value={v1Id?.toString() ?? ""}
              onChange={(e) => setV1Id(Number(e.target.value) || null)}
            >
              <option value="">Select version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.commit_message || "No message"} (
                  {timeAgo(v.created_at)})
                </option>
              ))}
            </Select>
            {v1 && (
              <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                <VersionTag version={v1.version_number} />
                <span>{v1.author}</span>
                <span>·</span>
                <span>{timeAgo(v1.created_at)}</span>
              </div>
            )}
          </div>

          {/* v2 selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                Compare Version
              </label>
              {v2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRestore(v2)}
                  disabled={restoreVersion.isPending}
                  className="h-6 text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </Button>
              )}
            </div>
            <Select
              value={v2Id?.toString() ?? ""}
              onChange={(e) => setV2Id(Number(e.target.value) || null)}
            >
              <option value="">Select version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.commit_message || "No message"} (
                  {timeAgo(v.created_at)})
                </option>
              ))}
            </Select>
            {v2 && (
              <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                <VersionTag version={v2.version_number} />
                <span>{v2.author}</span>
                <span>·</span>
                <span>{timeAgo(v2.created_at)}</span>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !v1 || !v2 ? (
          <div className="text-center py-12 text-sm text-brand-text-muted">
            {versions.length < 2
              ? "Need at least 2 versions to compare."
              : "Select two versions to compare."}
          </div>
        ) : (
          <>
            {/* Content diff */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                Content Diff
              </h3>
              <DiffViewer oldText={v1.content} newText={v2.content} />
            </div>

            {/* System prompt diff */}
            {(v1.system_prompt || v2.system_prompt) && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                  System Prompt Diff
                </h3>
                <DiffViewer
                  oldText={v1.system_prompt ?? ""}
                  newText={v2.system_prompt ?? ""}
                />
              </div>
            )}

            {/* Variables diff */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
                Variables Diff
              </h3>
              <VariablesDiff v1={v1.variables} v2={v2.variables} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
