"use client";

import { motion } from "framer-motion";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

const steps = ["Ingest", "Analyze", "Decide", "Execute", "Learn"];

export function NarrativeRail() {
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rail.current) return;
    const dots = rail.current.querySelectorAll(".rail-dot");
    const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power2.inOut", duration: 0.55 } });
    dots.forEach((dot) => {
      tl.to(dot, { scale: 1.22, opacity: 1 }).to(dot, { scale: 1, opacity: 0.58 }, "+=0.1");
    });
    return () => tl.kill();
  }, []);

  return (
    <div ref={rail} className="glass" style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        {steps.map((step, idx) => (
          <motion.div key={step} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: idx * 0.08 }}>
            <div className="rail-dot" style={{ width: 12, height: 12, borderRadius: 999, background: "var(--accent-0)", opacity: 0.58 }} />
            <small style={{ color: "var(--ink-1)" }}>{step}</small>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
