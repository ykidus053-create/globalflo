# GlobalFlow Immersive Prototype (Strict Stack)

This prototype implements the storytelling-first immersive UI protocol with the required stack:

- Next.js + React
- Three.js + React Three Fiber
- Framer Motion + GSAP
- WebGL + custom GLSL shader layer
- Howler.js (audio cue hook)
- OpenAI adapter hook
- Vercel Analytics + Sentry-ready structure

## Run

```bash
npm install
npm run dev
```

## Architecture

- `app/page.tsx`: narrative shell + progressive reveal orchestration
- `components/ImmersiveScene.tsx`: 3D scene + custom GLSL backdrop
- `components/NarrativeRail.tsx`: timeline-driven storytelling rail
- `lib/behavior-engine.ts`: behavior tracking engine
- `lib/personalization.ts`: behavior-driven variant logic
- `lib/openai-personalization.ts`: AI personalization adapter
- `lib/audio.ts`: optional motion/audio synchronization

## Protocol Mapping

- Cinematic foundation: camera scene + shader depth + material lighting
- Storytelling interaction: narrative rail and scene-led sequencing
- Motion system: organic easing and timeline control
- Premium depth: glass surfaces + layered materials + reflective highlights
- Brand edge: variable typography + cinematic cyan/amber accents
- AI-ready architecture: variant + behavior + OpenAI adapter
