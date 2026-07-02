import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

export function formatCost(cost: number | null | undefined): string {
  if (cost == null) return "—";
  if (cost < 0.000001) return "$0.000000";
  return `$${cost.toFixed(6)}`;
}

export function formatTokens(
  input: number | null | undefined,
  output: number | null | undefined
): string {
  if (input == null && output == null) return "—";
  return `${input ?? 0} in / ${output ?? 0} out`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function extractVariables(content: string): string[] {
  const regex = /\{\{(?!asset:)([^}]+)\}\}/g;
  const vars: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim();
    if (!vars.includes(varName)) {
      vars.push(varName);
    }
  }
  return vars;
}

export function parseTags(tags: string | string[] | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  // Fallback: comma-separated string
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}
