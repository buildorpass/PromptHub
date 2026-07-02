"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Plus,
  Search,
  ArrowRight,
} from "lucide-react";
import { usePrompts, useCreatePrompt } from "@/hooks/usePrompts";
import { useFolders, useCreateFolder } from "@/hooks/useFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { VersionTag } from "@/components/shared/VersionTag";
import { useToast } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { timeAgo, parseTags, cn } from "@/lib/utils";
import type { Folder as FolderType, Prompt } from "@/types";

// ----- Folder Tree -----
interface FolderNodeProps {
  folder: FolderType;
  all: FolderType[];
  promptCounts: Record<number, number>;
  selected: number | null;
  onSelect: (id: number | null) => void;
  depth?: number;
}

function FolderNode({
  folder,
  all,
  promptCounts,
  selected,
  onSelect,
  depth = 0,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const children = all.filter((f) => f.parent_id === folder.id);
  const isSelected = selected === folder.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(isSelected ? null : folder.id);
          if (children.length) setExpanded((e) => !e);
        }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors",
          isSelected
            ? "bg-orange-500/10 text-brand-primary"
            : "text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-elevated"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {children.length > 0 ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-brand-text-muted" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-brand-text-muted" />
          )
        ) : (
          <span className="w-3" />
        )}
        {isSelected ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-brand-text-muted" />
        )}
        <span className="flex-1 text-left truncate">{folder.name}</span>
        {promptCounts[folder.id] != null && (
          <span className="font-mono text-brand-text-muted">
            {promptCounts[folder.id]}
          </span>
        )}
      </button>
      {expanded &&
        children.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            all={all}
            promptCounts={promptCounts}
            selected={selected}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

// ----- New Prompt Form -----
const newPromptSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  folder_id: z.string().optional(),
  tags: z.string().optional(),
});
type NewPromptForm = z.infer<typeof newPromptSchema>;

function NewPromptDialog({
  open,
  onClose,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  folders: FolderType[];
}) {
  const { toast } = useToast();
  const createPrompt = useCreatePrompt();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewPromptForm>({
    resolver: zodResolver(newPromptSchema),
  });

  const onSubmit = async (data: NewPromptForm) => {
    try {
      const prompt = await createPrompt.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        folder_id: data.folder_id ? Number(data.folder_id) : null,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      });
      toast({ type: "success", title: "Prompt created" });
      reset();
      onClose();
      router.push(`/editor/${prompt.id}`);
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to create prompt",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="w-[480px]" onClose={onClose} title="New Prompt">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Customer Support Response"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-rose-400">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What does this prompt do?"
              rows={2}
              {...register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="folder_id">Folder</Label>
            <Select id="folder_id" {...register("folder_id")}>
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="e.g. gpt-4, summarize, marketing"
              {...register("tags")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPrompt.isPending}>
              {createPrompt.isPending ? "Creating..." : "Create Prompt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----- New Folder Form -----
const newFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
});
type NewFolderForm = z.infer<typeof newFolderSchema>;

function NewFolderDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createFolder = useCreateFolder();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewFolderForm>({ resolver: zodResolver(newFolderSchema) });

  const onSubmit = async (data: NewFolderForm) => {
    try {
      await createFolder.mutateAsync({ name: data.name });
      toast({ type: "success", title: "Folder created" });
      reset();
      onClose();
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to create folder",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="w-[360px]" onClose={onClose} title="New Folder">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fname">Folder Name *</Label>
            <Input
              id="fname"
              placeholder="e.g. Marketing"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-rose-400">{errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFolder.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----- Prompt Row -----
function PromptRow({
  prompt,
  folderName,
}: {
  prompt: Prompt;
  folderName?: string;
}) {
  const router = useRouter();
  const tags = parseTags(prompt.tags);

  return (
    <div
      onClick={() => router.push(`/editor/${prompt.id}`)}
      className="flex items-center gap-4 px-6 py-3 border-b border-brand-border hover:bg-brand-elevated/40 cursor-pointer group transition-colors"
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-brand-text-primary group-hover:text-white transition-colors">
          {prompt.name}
        </span>
      </div>

      {prompt.latest_version_number != null && (
        <VersionTag version={prompt.latest_version_number} />
      )}

      {folderName && (
        <Badge variant="default" className="shrink-0">
          {folderName}
        </Badge>
      )}

      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="shrink-0">
          #{tag}
        </Badge>
      ))}

      <span className="text-xs text-brand-text-muted shrink-0 w-16 text-right">
        {timeAgo(prompt.updated_at)}
      </span>

      <ArrowRight className="h-3.5 w-3.5 text-brand-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

// ----- Main Page -----
export default function LibraryPage() {
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showNewPrompt, setShowNewPrompt] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: prompts = [], isLoading: promptsLoading, error } = usePrompts({
    search: debouncedSearch || undefined,
    folder_id: selectedFolder,
  });

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const rootFolders = folders.filter((f) => f.parent_id == null);
  const folderMap = useMemo(
    () => Object.fromEntries(folders.map((f) => [f.id, f.name])),
    [folders]
  );

  const promptCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    prompts.forEach((p) => {
      if (p.folder_id != null) {
        counts[p.folder_id] = (counts[p.folder_id] ?? 0) + 1;
      }
    });
    return counts;
  }, [prompts]);

  return (
    <div className="flex h-full">
      {/* Folder sidebar */}
      <aside className="w-[280px] border-r border-brand-border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <span className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">
            Folders
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNewFolder(true)}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5 px-1">
          {foldersLoading ? (
            <div className="space-y-1 px-2 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 rounded" />
              ))}
            </div>
          ) : rootFolders.length === 0 ? (
            <p className="px-4 py-4 text-xs text-brand-text-muted">
              No folders yet
            </p>
          ) : (
            rootFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                all={folders}
                promptCounts={promptCounts}
                selected={selectedFolder}
                onSelect={setSelectedFolder}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            selectedFolder ? folderMap[selectedFolder] ?? "Library" : "Library"
          }
          description={`${prompts.length} prompt${prompts.length !== 1 ? "s" : ""}`}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
                <Input
                  placeholder="Search prompts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-52"
                />
              </div>
              <Button onClick={() => setShowNewPrompt(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Prompt
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto">
          {promptsLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-6 py-3 border-b border-brand-border"
                >
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-sm text-rose-400">
              Failed to load prompts. Is the backend running?
            </div>
          ) : prompts.length === 0 ? (
            <EmptyState
              title="No prompts found"
              description={
                search
                  ? `No prompts match "${search}"`
                  : "Create your first prompt to get started."
              }
              action={
                !search ? (
                  <Button onClick={() => setShowNewPrompt(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New Prompt
                  </Button>
                ) : undefined
              }
            />
          ) : (
            prompts.map((prompt) => (
              <PromptRow
                key={prompt.id}
                prompt={prompt}
                folderName={
                  prompt.folder_id ? folderMap[prompt.folder_id] : undefined
                }
              />
            ))
          )}
        </div>
      </div>

      <NewPromptDialog
        open={showNewPrompt}
        onClose={() => setShowNewPrompt(false)}
        folders={folders}
      />
      <NewFolderDialog
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
      />
    </div>
  );
}
