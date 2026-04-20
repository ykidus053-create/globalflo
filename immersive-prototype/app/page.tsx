"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ImmersiveScene } from "@/components/ImmersiveScene";
import { NarrativeRail } from "@/components/NarrativeRail";
import { behaviorEngine } from "@/lib/behavior-engine";
import { getPersonalizedVariant } from "@/lib/personalization";
import { playSceneCue } from "@/lib/audio";
import { WebXRExtensionNote } from "@/components/WebXRExtensionNote";

export default function HomePage() {
  const [variant, setVariant] = useState("A");
  useEffect(() => {
    behaviorEngine.trackScene("hero");
    behaviorEngine.trackIntent("guided");
    getPersonalizedVariant().then((v) => setVariant(v.variant));
  }, []);

  return (
    <main className="shell" style={{ padding: 28 }}>
      <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
        <p style={{ color: "var(--accent-0)", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700 }}>GlobalFlow Protocol</p>
        <h1 style={{ fontFamily: "Syne, Sora, sans-serif", fontSize: "clamp(2.3rem,5vw,4.6rem)", margin: "8px 0 10px" }}>
          Storytelling-first immersive UI system
        </h1>
        <p style={{ color: "var(--ink-1)", maxWidth: 840 }}>
          Cinematic depth, narrative motion, premium material system, and AI-ready personalization architecture.
        </p>
      </motion.section>

      <section style={{ marginTop: 20, display: "grid", gap: 16 }}>
        <NarrativeRail />
        <ImmersiveScene />
        <WebXRExtensionNote />
        <div className="glass" style={{ padding: 18 }}>
          <strong>Variant {variant}</strong>
          <p style={{ color: "var(--ink-1)" }}>
            Behavior-aware personalization hook is active. This scaffold is ready to wire OpenAI-driven dynamic UI decisions.
          </p>
          <button onClick={() => playSceneCue()} style={{ border: 0, padding: "10px 14px", borderRadius: 12 }}>
            Play scene cue
          </button>
        </div>
      </section>
    </main>
  );
}
