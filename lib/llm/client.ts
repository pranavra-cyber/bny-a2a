// Model clients behind callModel(). The OpenAI client is the only code that talks
// to the API; the mock client returns scripted decisions with no network calls.
import OpenAI from "openai";
import type { Usage } from "./budget";

export type ModelRequest = {
  model: string;
  system: string;
  input: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | null;
};

export type ModelResponse = { text: string; usage: Usage; complete: boolean; model: string };

export interface ModelClient {
  readonly kind: "openai" | "mock";
  create(req: ModelRequest): Promise<ModelResponse>;
}

export class OpenAIClient implements ModelClient {
  readonly kind = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    // Fail fast and retry: a stuck call should not hold a case for minutes.
    this.client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 2 });
  }

  async create(req: ModelRequest): Promise<ModelResponse> {
    const res = await this.client.responses.create({
      model: req.model,
      instructions: req.system,
      input: req.input,
      max_output_tokens: req.maxOutputTokens,
      store: false,
      text: { format: { type: "json_schema", name: req.schemaName, schema: req.jsonSchema, strict: true } },
      ...(req.reasoningEffort ? { reasoning: { effort: req.reasoningEffort } } : {}),
    });
    return {
      text: res.output_text ?? "",
      usage: {
        inputTokens: res.usage?.input_tokens ?? 0,
        cachedInputTokens: res.usage?.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
        reasoningTokens: res.usage?.output_tokens_details?.reasoning_tokens ?? 0,
      },
      complete: res.status === "completed",
      model: res.model,
    };
  }
}

type MockHandler = (input: string) => unknown;
const mockHandlers = new Map<string, MockHandler>();

/** Agents register a scripted decision per output schema for mock mode and tests. */
export function registerMock(schemaName: string, handler: MockHandler) {
  mockHandlers.set(schemaName, handler);
}

/** Approximate token count used by the mock client and the pre-call estimate. */
export const approxTokens = (text: string) => Math.ceil(text.length / 4);

export class MockClient implements ModelClient {
  readonly kind = "mock" as const;
  async create(req: ModelRequest): Promise<ModelResponse> {
    const handler = mockHandlers.get(req.schemaName);
    if (!handler) throw new Error(`No mock registered for ${req.schemaName}`);
    const text = JSON.stringify(handler(req.input));
    return {
      text,
      usage: {
        inputTokens: approxTokens(req.system + req.input),
        cachedInputTokens: 0,
        outputTokens: Math.min(req.maxOutputTokens, approxTokens(text)),
      },
      complete: true,
      model: `mock:${req.model}`,
    };
  }
}
