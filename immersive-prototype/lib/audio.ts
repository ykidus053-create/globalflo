import { Howl } from "howler";

let pulse: Howl | null = null;

export function initAudio() {
  if (pulse) return pulse;
  pulse = new Howl({
    src: ["/audio/pulse.mp3"],
    volume: 0.2,
    preload: false
  });
  return pulse;
}

export function playSceneCue() {
  const sfx = initAudio();
  if (!sfx.playing()) sfx.play();
}
