import { behaviorEngine } from "./behavior-engine";

export async function getPersonalizedVariant() {
  const state = behaviorEngine.snapshot();
  const heuristic = state.scrollDepth > 0.62 || state.intentSignals.includes("rapid") ? "B" : "A";
  return {
    variant: heuristic,
    layoutHints: heuristic === "B" ? ["compact-nav", "fast-transitions"] : ["guided-nav", "story-pacing"]
  };
}
