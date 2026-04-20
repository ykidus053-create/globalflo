export type BehaviorState = {
  scenesVisited: string[];
  scrollDepth: number;
  intentSignals: string[];
};

const state: BehaviorState = {
  scenesVisited: [],
  scrollDepth: 0,
  intentSignals: []
};

export const behaviorEngine = {
  trackScene(scene: string) {
    if (!state.scenesVisited.includes(scene)) state.scenesVisited.push(scene);
  },
  trackScroll(depth: number) {
    state.scrollDepth = Math.max(state.scrollDepth, Math.min(depth, 1));
  },
  trackIntent(intent: string) {
    state.intentSignals.push(intent);
    if (state.intentSignals.length > 60) state.intentSignals = state.intentSignals.slice(-60);
  },
  snapshot(): BehaviorState {
    return {
      scenesVisited: [...state.scenesVisited],
      scrollDepth: state.scrollDepth,
      intentSignals: [...state.intentSignals]
    };
  }
};
