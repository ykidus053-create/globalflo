import OpenAI from "openai";
import { behaviorEngine } from "./behavior-engine";

/**
 * AI personalization adapter.
 * Intentionally isolated so UI can call one function while provider logic evolves.
 */
export async function generatePersonalizedSceneHints() {
  const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const snapshot = behaviorEngine.snapshot();
  if (!key) {
    return {
      provider: "stub",
      hints: ["guided-story", "focus-primary-action", "reduce-secondary-controls"]
    };
  }
  const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
  const completion = await client.responses.create({
    model: "gpt-5-mini",
    input: `Return JSON with scene_hints only. Behavior snapshot: ${JSON.stringify(snapshot)}`
  });
  return {
    provider: "openai",
    raw: completion.output_text
  };
}
