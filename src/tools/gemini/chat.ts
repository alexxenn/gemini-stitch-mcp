import type { GeminiClient } from "../../clients/gemini-client.js";
import type { ChatParams } from "../../types.js";
import { CHAT_PROMPT } from "../../prompts/system-prompts.js";

export async function geminiChat(client: GeminiClient, params: ChatParams) {
  const { message, context, model } = params;

  const prompt = context ? `Context:\n${context}\n\nQuestion:\n${message}` : message;

  const response = await client.generate(prompt, {
    model: model ?? "gemini-2.5-flash",
    systemPrompt: CHAT_PROMPT,
  });

  return {
    response,
    model: client.resolveModel(model ?? "gemini-2.5-flash"),
  };
}
