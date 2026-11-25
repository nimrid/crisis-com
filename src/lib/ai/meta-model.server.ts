import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

export const META_MODEL_ID = "muse-spark-1.3";

const META_CONNECTOR_BASE_URL = "https://connector-gateway.lovable.dev/udc_meta_model_api/v1";

export function createMetaModelCall(
  request: Request,
  config: { lovableApiKey: string; connectionApiKey: string },
  messages: ModelMessage[],
  instructions: string,
) {
  const provider = createOpenAI({
    baseURL: META_CONNECTOR_BASE_URL,
    apiKey: config.lovableApiKey,
    headers: { "X-Connection-Api-Key": config.connectionApiKey },
  });

  const result = streamText({
    model: provider.chat(META_MODEL_ID),
    messages: [{ role: "system", content: instructions }, ...messages],
    abortSignal: request.signal,
    providerOptions: { openai: { reasoningEffort: "medium" } },
  });

  return { result };
}