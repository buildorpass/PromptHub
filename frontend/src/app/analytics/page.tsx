"use client";

import React from "react";
import {
  useAnalyticsSummary,
  useCostByModel,
  useCostByPrompt,
  useEfficiency,
  useRecentRuns,
} from "@/hooks/useAnalytics";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ModelBadge } from "@/components/shared/ModelBadge";
import { CostDisplay } from "@/components/shared/CostDisplay";
import { formatLatency, timeAgo } from "@/lib/utils";

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-brand-elevated rounded-full overflow-hidden max-w-[120px]">
        <div
          className="h-full bg-brand-primary rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-brand-text-muted w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-brand-text-primary">{title}</h2>
      {description && (
        <p className="text-xs text-brand-text-muted mt-0.5">{description}</p>
      )}
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-brand-border rounded-md px-4 py-3 bg-brand-elevated/30">
      <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-brand-text-primary font-mono">{value}</p>
      {sub && <p className="text-xs text-brand-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: costByModel = [], isLoading: costByModelLoading } = useCostByModel();
  const { data: costByPrompt = [], isLoading: costByPromptLoading } = useCostByPrompt();
  const { data: efficiency = [], isLoading: efficiencyLoading } = useEfficiency();
  const { data: recentRuns = [], isLoading: recentRunsLoading } = useRecentRuns(20);

  const maxCost = costByModel[0]?.total_cost ?? 1;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Analytics"
        description="Cost and performance overview across all runs"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        {/* Summary cards */}
        <section>
          <SectionHeader title="Overview" />
          {summaryLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Prompts" value={summary?.total_prompts ?? 0} />
              <StatCard label="Total Runs" value={summary?.total_runs ?? 0} />
              <StatCard
                label="Total Cost"
                value={`$${(summary?.total_cost ?? 0).toFixed(4)}`}
              />
              <StatCard
                label="Models Used"
                value={summary?.total_models_used ?? 0}
              />
            </div>
          )}
        </section>

        {/* Cost by Model */}
        <section>
          <SectionHeader
            title="Cost by Model"
            description="Total spending aggregated per model, sorted by cost"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Input Tokens</TableHead>
                <TableHead>Output Tokens</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead className="w-40">Cost Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costByModelLoading ? (
                <SkeletonRows cols={7} />
              ) : costByModel.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-brand-text-muted py-8">
                    No run data yet.
                  </TableCell>
                </TableRow>
              ) : (
                costByModel.map((row) => (
                  <TableRow key={row.model_name}>
                    <TableCell className="font-mono text-xs text-brand-text-primary">
                      {row.model_name}
                    </TableCell>
                    <TableCell>
                      <ModelBadge provider={row.provider ?? "unknown"} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.total_runs}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.total_input_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.total_output_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <CostDisplay cost={row.total_cost} />
                    </TableCell>
                    <TableCell>
                      <Bar value={row.total_cost} max={maxCost} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {/* Cost by Prompt */}
        <section>
          <SectionHeader
            title="Cost by Prompt"
            description="Spending aggregated per prompt across all versions"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Total Runs</TableHead>
                <TableHead>Total Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costByPromptLoading ? (
                <SkeletonRows cols={4} />
              ) : costByPrompt.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-brand-text-muted py-8">
                    No run data yet.
                  </TableCell>
                </TableRow>
              ) : (
                costByPrompt.map((row) => (
                  <TableRow key={row.prompt_id}>
                    <TableCell className="text-brand-text-primary">
                      {row.prompt_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.version_count}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.total_runs}
                    </TableCell>
                    <TableCell>
                      <CostDisplay cost={row.total_cost} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {/* Efficiency */}
        <section>
          <SectionHeader
            title="Efficiency"
            description="Cost, latency, and quality balance per model (cheapest first)"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Avg Latency</TableHead>
                <TableHead>Avg Cost / Run</TableHead>
                <TableHead>Avg Rating</TableHead>
                <TableHead>Rated Runs</TableHead>
                <TableHead>Total Runs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {efficiencyLoading ? (
                <SkeletonRows cols={6} />
              ) : efficiency.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-brand-text-muted py-8">
                    No run data yet.
                  </TableCell>
                </TableRow>
              ) : (
                efficiency.map((row) => (
                  <TableRow key={row.model_name}>
                    <TableCell className="font-mono text-xs text-brand-text-primary">
                      {row.model_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatLatency(row.avg_latency_ms)}
                    </TableCell>
                    <TableCell>
                      <CostDisplay cost={row.avg_cost_per_run} />
                    </TableCell>
                    <TableCell>
                      {row.avg_rating != null ? (
                        <span className="font-mono text-xs text-amber-400">
                          {row.avg_rating.toFixed(1)} ★
                        </span>
                      ) : (
                        <span className="text-xs text-brand-text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.total_rated}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.total_runs}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {/* Recent Runs */}
        <section>
          <SectionHeader title="Recent Runs" description="Last 20 run results across all prompts" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRunsLoading ? (
                <SkeletonRows cols={8} />
              ) : recentRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-brand-text-muted py-8">
                    No runs yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentRuns.map((run) => (
                  <TableRow key={`${run.run_id}-${run.model_name}`}>
                    <TableCell className="font-mono text-xs text-brand-text-muted">
                      #{run.run_id}
                    </TableCell>
                    <TableCell className="text-xs text-brand-text-secondary max-w-[160px] truncate">
                      {run.prompt_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-brand-text-primary">
                      {run.model_name}
                    </TableCell>
                    <TableCell>
                      <CostDisplay cost={run.cost} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatLatency(run.latency_ms)}
                    </TableCell>
                    <TableCell>
                      {run.rating != null ? (
                        <span className="font-mono text-xs text-amber-400">
                          {run.rating} ★
                        </span>
                      ) : (
                        <span className="text-xs text-brand-text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.error ? "failed" : run.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-brand-text-muted">
                        {timeAgo(run.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
