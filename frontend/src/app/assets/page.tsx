"use client";

import React, { useState } from "react";
import { Plus, Copy, Pencil, Trash2, Check } from "lucide-react";
import {
  useAssets,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
} from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { timeAgo } from "@/lib/utils";
import type { Asset } from "@/types";

const ASSET_TYPES = ["snippet", "system_prompt", "format_spec", "other"];

const assetSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[\w-]+$/, "Use only letters, numbers, - and _"),
  type: z.string().min(1, "Type is required"),
  content: z.string().min(1, "Content is required"),
  team_shared: z.boolean().default(false),
});
type AssetForm = z.infer<typeof assetSchema>;

// ----- Asset form -----
function AssetFormFields({
  register,
  errors,
  watch,
  setValue,
}: {
  register: ReturnType<typeof useForm<AssetForm>>["register"];
  errors: ReturnType<typeof useForm<AssetForm>>["formState"]["errors"];
  watch: ReturnType<typeof useForm<AssetForm>>["watch"];
  setValue: ReturnType<typeof useForm<AssetForm>>["setValue"];
}) {
  const name = watch("name");
  const teamShared = watch("team_shared");

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="asset-name">Name *</Label>
        <Input
          id="asset-name"
          placeholder="e.g. customer_tone"
          {...register("name")}
        />
        {name && (
          <p className="text-xs text-brand-text-muted font-mono">
            Reference as: {"{{asset:"}
            {name}
            {"}}"}
          </p>
        )}
        {errors.name && (
          <p className="text-xs text-rose-400">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asset-type">Type *</Label>
        <Select id="asset-type" {...register("type")}>
          <option value="">Select type...</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </Select>
        {errors.type && (
          <p className="text-xs text-rose-400">{errors.type.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asset-content">Content *</Label>
        <Textarea
          id="asset-content"
          rows={6}
          className="font-mono text-xs"
          placeholder="Asset content here..."
          {...register("content")}
        />
        {errors.content && (
          <p className="text-xs text-rose-400">{errors.content.message}</p>
        )}
      </div>

      <Checkbox
        id="team-shared"
        label="Team shared (visible to all team members)"
        checked={!!teamShared}
        onChange={(e) => setValue("team_shared", e.target.checked)}
      />
    </>
  );
}

// ----- New Asset Dialog -----
function NewAssetDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createAsset = useCreateAsset();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AssetForm>({
    resolver: zodResolver(assetSchema),
    defaultValues: { team_shared: false },
  });

  const onSubmit = async (data: AssetForm) => {
    try {
      await createAsset.mutateAsync(data);
      toast({ type: "success", title: "Asset created" });
      reset();
      onClose();
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to create asset",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="w-[520px]" onClose={onClose} title="New Asset">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AssetFormFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAsset.isPending}>
              {createAsset.isPending ? "Creating..." : "Create Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----- Edit Asset Dialog -----
function EditAssetDialog({
  asset,
  onClose,
}: {
  asset: Asset | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const updateAsset = useUpdateAsset();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AssetForm>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: asset?.name ?? "",
      type: asset?.type ?? "",
      content: asset?.content ?? "",
      team_shared: asset?.team_shared ?? false,
    },
  });

  React.useEffect(() => {
    if (asset) {
      reset({
        name: asset.name,
        type: asset.type,
        content: asset.content,
        team_shared: asset.team_shared,
      });
    }
  }, [asset, reset]);

  const onSubmit = async (data: AssetForm) => {
    if (!asset) return;
    try {
      await updateAsset.mutateAsync({ id: asset.id, ...data });
      toast({ type: "success", title: "Asset updated" });
      onClose();
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to update asset",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={asset !== null} onClose={onClose}>
      <DialogContent className="w-[520px]" onClose={onClose} title="Edit Asset">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AssetFormFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAsset.isPending}>
              {updateAsset.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----- Copy button -----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-brand-text-muted hover:text-brand-text-secondary transition-colors"
      title={`Copy ${text}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ----- Type badge -----
function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    snippet: "bg-orange-500/10 border-orange-500/30 text-orange-400",
    system_prompt: "bg-violet-500/10 border-violet-500/30 text-violet-400",
    format_spec: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
    other: "bg-zinc-800 border-zinc-700 text-zinc-400",
  };
  const style =
    colors[type] ?? "bg-zinc-800 border-zinc-700 text-zinc-400";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${style}`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

// ----- Main page -----
export default function AssetsPage() {
  const [showNew, setShowNew] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);

  const { data: assets = [], isLoading, error } = useAssets();
  const deleteAsset = useDeleteAsset();
  const { toast } = useToast();

  const handleDelete = async (asset: Asset) => {
    if (
      !window.confirm(
        `Delete asset "${asset.name}"? This cannot be undone.`
      )
    )
      return;
    try {
      await deleteAsset.mutateAsync(asset.id);
      toast({ type: "success", title: "Asset deleted" });
    } catch (err) {
      toast({
        type: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Assets"
        description="Reusable snippets, system prompts, and format specs referenced via {{asset:name}}"
        action={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Asset
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-rose-400">
            Failed to load assets. Is the backend running?
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            description="Create reusable content blocks to insert into your prompts."
            action={
              <Button onClick={() => setShowNew(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Asset
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Shared</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-brand-text-primary">
                        {asset.name}
                      </span>
                      <CopyButton text={`{{asset:${asset.name}}}`} />
                      <span className="font-mono text-xs text-brand-text-muted">
                        {"{{asset:"}
                        {asset.name}
                        {"}}"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={asset.type} />
                  </TableCell>
                  <TableCell>
                    {asset.team_shared ? (
                      <Badge variant="success">Shared</Badge>
                    ) : (
                      <Badge variant="default">Private</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-brand-text-muted">
                      {asset.owner}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-brand-text-muted">
                      {timeAgo(asset.updated_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditAsset(asset)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(asset)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <NewAssetDialog open={showNew} onClose={() => setShowNew(false)} />
      <EditAssetDialog asset={editAsset} onClose={() => setEditAsset(null)} />
    </div>
  );
}
