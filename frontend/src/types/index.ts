export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  team_shared: boolean;
  created_at: string;
}

export interface Prompt {
  id: number;
  name: string;
  description: string | null;
  folder_id: number | null;
  owner: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  latest_version_number?: number;
}

export interface PromptVersion {
  id: number;
  prompt_id: number;
  version_number: number;
  content: string;
  system_prompt: string | null;
  variables: Record<string, string> | null;
  commit_message: string;
  author: string;
  created_at: string;
}

export interface ModelPricing {
  id: number;
  provider: string;
  model_name: string;
  input_rate: number;
  output_rate: number;
  currency: string;
  updated_at: string;
}

export interface TestRun {
  id: number;
  prompt_version_id: number;
  status: string;
  created_at: string;
}

export interface RunResult {
  id: number;
  test_run_id: number;
  model_name: string;
  output_text: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  latency_ms: number | null;
  error: string | null;
  rating: number | null;
  rating_tag: string | null;
  passed: boolean | null;
  created_at: string;
}

export interface Asset {
  id: number;
  name: string;
  content: string;
  type: string;
  team_shared: boolean;
  owner: string;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: number;
  name: string;
  prompt_version_id: number;
  variable_inputs: Record<string, string> | null;
  assertion_type: string | null;
  assertion_value: string | null;
  created_at: string;
}

export interface ModelInfo {
  model: string;
  provider: string;
  available: boolean;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
  page: number;
  page_size: number;
}

export interface RunRequest {
  prompt_version_id: number;
  model_names: string[];
  variable_inputs?: Record<string, string>;
  max_tokens?: number;
  temperature?: number;
}

export interface RunResponse {
  id: number;
  prompt_version_id: number;
  status: string;
  created_at: string;
  results: RunResult[];
}

export interface TestCaseRunRequest {
  model_names: string[];
}

export interface RateResultRequest {
  rating: number;
  tag?: string;
}

// Analytics types (mapped from backend schemas)
export interface AnalyticsSummary {
  total_prompts: number;
  total_runs: number;
  total_cost: number;
  total_models_used: number;
}

export interface CostByModelItem {
  model_name: string;
  provider: string | null;
  total_runs: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_cost_per_run: number;
  avg_latency_ms: number;
}

export interface CostByPromptItem {
  prompt_id: number;
  prompt_name: string;
  version_count: number;
  total_runs: number;
  total_cost: number;
}

export interface EfficiencyItem {
  model_name: string;
  provider: string | null;
  avg_latency_ms: number;
  avg_cost_per_run: number;
  avg_rating: number | null;
  total_rated: number;
  total_runs: number;
}

export interface RecentRunItem {
  run_id: number;
  prompt_name: string;
  model_name: string;
  cost: number | null;
  latency_ms: number | null;
  rating: number | null;
  status: string;
  error: string | null;
  created_at: string;
}
