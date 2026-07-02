"use client";

import React, { useState } from "react";
import { Plus, Play, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  useTestCases,
  useCreateTestCase,
  useDeleteTestCase,
  useRunTestCase,
  useTestCaseHistory,
} from "@/hooks/useTestCases";
import { usePrompts } from "@/hooks/usePrompts";
import { useVersions } from "@/hooks/useVersions";
import { useModels } from "@/hooks/useModels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetContent,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { timeAgo, cn } from "@/lib/utils";
import type { TestCase, TestRun } from "@/types";

const ASSERTION_TYPES = [
  "none",
  "exact_match",
  "contains",
  "regex",
  "manual_review",
];

// ----- Variable key-value pairs -----
interface KVPair {
  key: string;
  value: string;
}

function KVEditor({
  pairs,
  onChange,
}: {
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
}) {
  const addPair = () => onChange([...pairs, { key: "", value: "" }]);
  const removePair = (idx: number) =>
    onChange(pairs.filter((_, i) => i !== idx));
  const updatePair = (idx: number, field: "key" | "value", val: string) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <Input
            placeholder="key"
            value={pair.key}
            onChange={(e) => updatePair(idx, "key", e.target.value)}
            className="font-mono text-xs"
          />
          <span className="text-brand-text-muted text-xs">=</span>
          <Input
            placeholder="value"
            value={pair.value}
            onChange={(e) => updatePair(idx, "value", e.target.value)}
            className="text-xs"
          />
          <button
            type="button"
            onClick={() => removePair(idx)}
            className="text-brand-text-muted hover:text-rose-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addPair}
        className="h-7 text-xs"
      >
        <Plus className="h-3 w-3" />
        Add Variable
      </Button>
    </div>
  );
}

// ----- New test case form -----
const testCaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  prompt_id: z.string().min(1, "Select a prompt"),
  version_id: z.string().min(1, "Select a version"),
  assertion_type: z.string().default("none"),
  assertion_value: z.string().optional(),
});
type TestCaseForm = z.infer<typeof testCaseSchema>;

function NewTestCaseSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: prompts = [] } = usePrompts();
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const { data: versions = [] } = useVersions(selectedPromptId);
  const [kvPairs, setKvPairs] = useState<KVPair[]>([]);
  const createTestCase = useCreateTestCase();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TestCaseForm>({
    resolver: zodResolver(testCaseSchema),
    defaultValues: { assertion_type: "none" },
  });

  const assertionType = watch("assertion_type");

  const onSubmit = async (data: TestCaseForm) => {
    const vars = kvPairs.reduce<Record<string, string>>((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {});

    try {
      await createTestCase.mutateAsync({
        name: data.name,
        prompt_version_id: Number(data.version_id),
        variable_inputs: Object.keys(vars).length > 0 ? vars : null,
        assertion_type: data.assertion_type === "none" ? null : data.assertion_type,
        assertion_value:
          data.assertion_type === "none" || data.assertion_type === "manual_review"
            ? null
            : data.assertion_value || null,
      });
      toast({ type: "success", title: "Test case created" });
      reset();
      setKvPairs([]);
      setSelectedPromptId(null);
      onClose();
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to create test case",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader onClose={onClose}>
        <SheetTitle>New Test Case</SheetTitle>
      </SheetHeader>
      <SheetContent>
        <form id="tc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tc-name">Name *</Label>
            <Input id="tc-name" placeholder="e.g. Empty input test" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-rose-400">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Prompt *</Label>
            <Select
              {...register("prompt_id")}
              onChange={(e) => {
                setValue("prompt_id", e.target.value);
                setSelectedPromptId(Number(e.target.value) || null);
                setValue("version_id", "");
              }}
            >
              <option value="">Select prompt...</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {errors.prompt_id && (
              <p className="text-xs text-rose-400">{errors.prompt_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Version *</Label>
            <Select {...register("version_id")} disabled={!selectedPromptId}>
              <option value="">Select version...</option>
              {[...versions].reverse().map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.commit_message || "No message"}
                </option>
              ))}
            </Select>
            {errors.version_id && (
              <p className="text-xs text-rose-400">{errors.version_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Variable Inputs</Label>
            <KVEditor pairs={kvPairs} onChange={setKvPairs} />
          </div>

          <div className="space-y-1.5">
            <Label>Assertion Type</Label>
            <Select {...register("assertion_type")}>
              {ASSERTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </div>

          {assertionType !== "none" && assertionType !== "manual_review" && (
            <div className="space-y-1.5">
              <Label>Assertion Value</Label>
              <Input
                placeholder={
                  assertionType === "regex"
                    ? "^Expected.*pattern$"
                    : "Expected output text"
                }
                {...register("assertion_value")}
              />
            </div>
          )}
        </form>
      </SheetContent>
      <SheetFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="tc-form"
          disabled={createTestCase.isPending}
        >
          {createTestCase.isPending ? "Creating..." : "Create"}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

// ----- Run dialog -----
function RunDialog({
  open,
  onClose,
  testCase,
}: {
  open: boolean;
  onClose: () => void;
  testCase: TestCase | null;
}) {
  const { toast } = useToast();
  const { data: models = [] } = useModels();
  const [selected, setSelected] = useState<string[]>([]);
  const runTestCase = useRunTestCase();

  const toggle = (m: string) =>
    setSelected((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  const handleRun = async () => {
    if (!testCase) return;
    try {
      await runTestCase.mutateAsync({ id: testCase.id, model_names: selected });
      toast({ type: "success", title: "Test run started" });
      setSelected([]);
      onClose();
    } catch (err) {
      toast({
        type: "error",
        title: "Run failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="w-[400px]" onClose={onClose} title="Select Models">
        <div className="space-y-2 mb-4">
          {models.map((m) => (
            <div key={m.model} className="flex items-center justify-between">
              <Checkbox
                id={`run-${m.model}`}
                label={m.model}
                checked={selected.includes(m.model)}
                disabled={!m.available}
                onChange={() => m.available && toggle(m.model)}
              />
              {!m.available && (
                <span className="text-xs text-brand-text-muted">No key</span>
              )}
            </div>
          ))}
          {models.length === 0 && (
            <p className="text-xs text-brand-text-muted">No models available</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={selected.length === 0 || runTestCase.isPending}
          >
            {runTestCase.isPending ? "Running..." : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Test Case Row -----
function TestCaseRow({
  tc,
  promptName,
  onRun,
  onDelete,
}: {
  tc: TestCase;
  promptName: string;
  onRun: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="text-brand-text-primary font-medium">{tc.name}</TableCell>
      <TableCell>
        <span className="text-xs text-brand-secondary">{promptName}</span>
      </TableCell>
      <TableCell>
        {tc.assertion_type ? (
          <Badge variant="default">{tc.assertion_type.replace(/_/g, " ")}</Badge>
        ) : (
          <span className="text-brand-text-muted text-xs">None</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-brand-text-muted">{timeAgo(tc.created_at)}</span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onRun}>
            <Play className="h-3 w-3" />
            Run
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ----- Run History -----
function RunHistoryTab() {
  const { data: testCases = [] } = useTestCases();
  const [selectedTcId, setSelectedTcId] = useState<number | null>(null);
  const { data: history = [], isLoading } = useTestCaseHistory(selectedTcId);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

  return (
    <div className="p-6 space-y-4">
      <div className="w-72">
        <Label className="mb-1.5 block">Test Case</Label>
        <Select
          value={selectedTcId?.toString() ?? ""}
          onChange={(e) =>
            setSelectedTcId(Number(e.target.value) || null)
          }
        >
          <option value="">Select test case...</option>
          {testCases.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.name}
            </option>
          ))}
        </Select>
      </div>

      {selectedTcId && (
        <>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              title="No run history"
              description="Run this test case to see results here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((run) => (
                  <React.Fragment key={run.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedRunId(
                          expandedRunId === run.id ? null : run.id
                        )
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        #{run.id}
                        {expandedRunId === run.id ? (
                          <ChevronDown className="h-3 w-3 inline ml-1" />
                        ) : (
                          <ChevronRight className="h-3 w-3 inline ml-1" />
                        )}
                      </TableCell>
                      <TableCell>{timeAgo(run.created_at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                    </TableRow>
                    {expandedRunId === run.id && (
                      <TableRow>
                        <TableCell colSpan={3} className="bg-brand-elevated/50">
                          <p className="text-xs text-brand-text-muted font-mono">
                            Run ID: {run.id} | Version ID:{" "}
                            {run.prompt_version_id} | Status: {run.status}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {!selectedTcId && (
        <p className="text-sm text-brand-text-muted">
          Select a test case to view its history.
        </p>
      )}
    </div>
  );
}

// ----- Main page -----
export default function TestCasesPage() {
  const [tab, setTab] = useState("cases");
  const [showNew, setShowNew] = useState(false);
  const [runTarget, setRunTarget] = useState<TestCase | null>(null);

  const { data: testCases = [], isLoading, error } = useTestCases();
  const { data: prompts = [] } = usePrompts();
  const deleteTestCase = useDeleteTestCase();
  const { toast } = useToast();

  const promptMap = Object.fromEntries(prompts.map((p) => [p.id, p.name]));

  // We need to find the prompt name from the version_id — for simplicity show version id
  const handleDelete = async (id: number) => {
    try {
      await deleteTestCase.mutateAsync(id);
      toast({ type: "success", title: "Test case deleted" });
    } catch (err) {
      toast({ type: "error", title: "Delete failed", description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Test Cases"
        action={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Test Case
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="px-6 border-b border-brand-border">
          <TabsTrigger value="cases">Test Cases</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="flex-1">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-rose-400">Failed to load test cases.</div>
          ) : testCases.length === 0 ? (
            <EmptyState
              title="No test cases"
              description="Create test cases to automate prompt evaluation."
              action={
                <Button onClick={() => setShowNew(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New Test Case
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Assertion</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testCases.map((tc) => (
                  <TestCaseRow
                    key={tc.id}
                    tc={tc}
                    promptName={`Version #${tc.prompt_version_id}`}
                    onRun={() => setRunTarget(tc)}
                    onDelete={() => handleDelete(tc.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="history">
          <RunHistoryTab />
        </TabsContent>
      </Tabs>

      <NewTestCaseSheet open={showNew} onClose={() => setShowNew(false)} />
      <RunDialog
        open={runTarget !== null}
        onClose={() => setRunTarget(null)}
        testCase={runTarget}
      />
    </div>
  );
}
