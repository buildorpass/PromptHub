"use client";

import React, { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, AlertTriangle } from "lucide-react";
import {
  usePricing,
  useCreatePricing,
  useUpdatePricing,
  useDeletePricing,
} from "@/hooks/usePricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ModelBadge } from "@/components/shared/ModelBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { timeAgo } from "@/lib/utils";
import type { ModelPricing } from "@/types";

const PROVIDERS = ["openai", "anthropic", "deepseek", "custom"];

const pricingSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  model_name: z.string().min(1, "Model name is required"),
  input_rate: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0, "Must be >= 0")),
  output_rate: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0, "Must be >= 0")),
  currency: z.string().default("USD"),
});
type PricingForm = z.infer<typeof pricingSchema>;

// ----- Add model dialog -----
function AddModelDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createPricing = useCreatePricing();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema),
    defaultValues: { currency: "USD" },
  });

  const onSubmit = async (data: PricingForm) => {
    try {
      await createPricing.mutateAsync({
        provider: data.provider,
        model_name: data.model_name,
        input_rate: data.input_rate,
        output_rate: data.output_rate,
        currency: data.currency ?? "USD",
      });
      toast({ type: "success", title: "Model pricing added" });
      reset();
      onClose();
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to add pricing",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="w-[440px]" onClose={onClose} title="Add Model Pricing">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-provider">Provider *</Label>
            <Select id="pr-provider" {...register("provider")}>
              <option value="">Select provider...</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
            {errors.provider && (
              <p className="text-xs text-rose-400">
                {String(errors.provider.message)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-model">Model Name *</Label>
            <Input
              id="pr-model"
              placeholder="e.g. gpt-4o"
              {...register("model_name")}
            />
            {errors.model_name && (
              <p className="text-xs text-rose-400">
                {errors.model_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-input">$ per 1K input tokens *</Label>
              <Input
                id="pr-input"
                type="number"
                step="0.0001"
                placeholder="0.0030"
                {...register("input_rate")}
              />
              {errors.input_rate && (
                <p className="text-xs text-rose-400">
                  {String(errors.input_rate.message)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-output">$ per 1K output tokens *</Label>
              <Input
                id="pr-output"
                type="number"
                step="0.0001"
                placeholder="0.0060"
                {...register("output_rate")}
              />
              {errors.output_rate && (
                <p className="text-xs text-rose-400">
                  {String(errors.output_rate.message)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPricing.isPending}>
              {createPricing.isPending ? "Adding..." : "Add Model"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----- Inline edit row -----
function PricingRow({
  pricing,
  onDelete,
}: {
  pricing: ModelPricing;
  onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const updatePricing = useUpdatePricing();
  const [editing, setEditing] = useState(false);
  const [inputRate, setInputRate] = useState(String(pricing.input_rate));
  const [outputRate, setOutputRate] = useState(String(pricing.output_rate));

  const handleSave = async () => {
    const ir = parseFloat(inputRate);
    const or = parseFloat(outputRate);
    if (isNaN(ir) || isNaN(or)) {
      toast({ type: "error", title: "Invalid rate values" });
      return;
    }
    try {
      await updatePricing.mutateAsync({
        id: pricing.id,
        input_rate: ir,
        output_rate: or,
      });
      toast({ type: "success", title: "Pricing updated" });
      setEditing(false);
    } catch (err) {
      toast({
        type: "error",
        title: "Update failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleCancel = () => {
    setInputRate(String(pricing.input_rate));
    setOutputRate(String(pricing.output_rate));
    setEditing(false);
  };

  return (
    <TableRow>
      <TableCell>
        <ModelBadge provider={pricing.provider} />
      </TableCell>
      <TableCell>
        <span className="font-mono text-xs text-brand-text-primary">
          {pricing.model_name}
        </span>
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={inputRate}
            onChange={(e) => setInputRate(e.target.value)}
            className="w-24 h-7 font-mono text-xs"
            type="number"
            step="0.0001"
            autoFocus
          />
        ) : (
          <span className="font-mono text-xs text-brand-text-secondary">
            ${pricing.input_rate.toFixed(4)}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={outputRate}
            onChange={(e) => setOutputRate(e.target.value)}
            className="w-24 h-7 font-mono text-xs"
            type="number"
            step="0.0001"
          />
        ) : (
          <span className="font-mono text-xs text-brand-text-secondary">
            ${pricing.output_rate.toFixed(4)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-brand-text-muted">{pricing.currency}</span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-brand-text-muted">
          {timeAgo(pricing.updated_at)}
        </span>
      </TableCell>
      <TableCell>
        {editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updatePricing.isPending}
            >
              <Check className="h-3 w-3" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(pricing.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// ----- Main page -----
export default function PricingPage() {
  const [showAdd, setShowAdd] = useState(false);
  const { data: pricing = [], isLoading, error } = usePricing();
  const deletePricing = useDeletePricing();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this pricing entry?")) return;
    try {
      await deletePricing.mutateAsync(id);
      toast({ type: "success", title: "Pricing entry deleted" });
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
        title="Pricing Config"
        description="Configure cost rates for each model to track usage costs"
        action={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Model
          </Button>
        }
      />

      {/* Warning banner */}
      <div className="mx-6 mt-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300">
          Placeholder values shown — verify and update rates before use to ensure accurate cost tracking.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mt-4">
        {isLoading ? (
          <div className="px-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-4 text-sm text-rose-400">
            Failed to load pricing. Is the backend running?
          </div>
        ) : pricing.length === 0 ? (
          <EmptyState
            title="No pricing configured"
            description="Add model pricing to track costs for each run."
            action={
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Model
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Input Rate ($/1K)</TableHead>
                <TableHead>Output Rate ($/1K)</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.map((p) => (
                <PricingRow key={p.id} pricing={p} onDelete={handleDelete} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AddModelDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
