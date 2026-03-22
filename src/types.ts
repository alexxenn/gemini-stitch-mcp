export type GeminiModel =
  | "gemini-3.1-pro-preview"
  | "gemini-3.1-flash-lite-preview"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | (string & {});

export type Framework = "react" | "vue" | "html";

export type Styling = "tailwind" | "css" | "styled-components";

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope?: string;
}

export interface StitchScreen {
  id: string;
  projectId: string;
  title: string;
  htmlUrl?: string;
  imageUrl?: string;
  createTime?: string;
}

export interface StitchProject {
  id: string;
  title: string;
}

export interface PipelineContext {
  contextId: string;
  prompt: string;
  framework: Framework;
  styling: Styling;
  screenId: string;
  projectId: string;
  imageUrl?: string;
  rawHtml: string;
  generatedCode: string;
  model: GeminiModel;
  iterations: PipelineIteration[];
  createdAt: number;
}

export interface PipelineIteration {
  feedback: string;
  screenId: string;
  rawHtml: string;
  generatedCode: string;
  timestamp: number;
}

export interface GenerateUIParams {
  prompt: string;
  framework?: Framework;
  styling?: Styling;
  componentType?: string;
  model?: GeminiModel;
}

export interface RefineCodeParams {
  code: string;
  instructions: string;
  model?: GeminiModel;
}

export interface ReviewUIParams {
  code: string;
  checkAccessibility?: boolean;
  checkResponsiveness?: boolean;
  model?: GeminiModel;
}

export interface ChatParams {
  message: string;
  context?: string;
  model?: GeminiModel;
}

export interface GenerateScreenParams {
  prompt: string;
  projectId?: string;
}

export interface GetHtmlParams {
  screenId: string;
  minify?: boolean;
}

export interface EditScreenParams {
  screenId: string;
  instructions: string;
}

export interface GetVariantsParams {
  screenId: string;
  prompt?: string;
  count?: number;
  creativeRange?: "REFINE" | "EXPLORE" | "REIMAGINE";
  aspects?: string[];
}

export interface GetImageParams {
  screenId: string;
}

export interface ListScreensParams {
  projectId: string;
}

export interface DesignToCodeParams {
  prompt: string;
  framework?: Framework;
  styling?: Styling;
  model?: GeminiModel;
}

export interface IterateDesignParams {
  contextId: string;
  feedback: string;
  model?: GeminiModel;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: unknown) => boolean;
}

export interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
}
