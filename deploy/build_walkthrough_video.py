from __future__ import annotations

import math
import os
import shutil
import subprocess
import textwrap
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / "temp" / "walkthrough_build"
STATIC_DIR = ROOT / "globalflow" / "static"
FRONTEND_STATIC_DIR = ROOT / "frontend" / "static"
LOCAL_FFMPEG = ROOT / "temp" / "ffmpeg" / "unzipped" / "ffmpeg-master-latest-winarm64-gpl" / "bin" / "ffmpeg.exe"
LOCAL_FFPROBE = ROOT / "temp" / "ffmpeg" / "unzipped" / "ffmpeg-master-latest-winarm64-gpl" / "bin" / "ffprobe.exe"
EDGE_CANDIDATES = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]
VOICE_SCRIPT = """
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.Volume = 100
$s.SetOutputToWaveFile('{wav_path}')
$s.Speak(@"
{text}
"@)
$s.Dispose()
"""

SLIDES = [
    {
        "slug": "overview",
        "url": "https://globalflow.onrender.com/#overview",
        "title": "Overview",
        "caption": "One control room for billing, calls, files, and compliance.",
        "script": (
            "GlobalFlow gives operators one control room for billing, calls, files, and compliance. "
            "The overview section shows the product layout, the core message, and the main workflows in one view."
        ),
    },
    {
        "slug": "demo",
        "url": "https://globalflow.onrender.com/#demo",
        "title": "Demo",
        "caption": "The product walkthrough sits directly inside the site.",
        "script": (
            "The demo section keeps the walkthrough inside the website. "
            "Operators can review the interface before launching any workflow."
        ),
    },
    {
        "slug": "use-cases",
        "url": "https://globalflow.onrender.com/#use-cases",
        "title": "Use Cases",
        "caption": "Start with one workflow, then expand by outcome.",
        "script": (
            "Use cases are organized by business outcome. "
            "Teams can start with call follow up, billing recovery, tax preparation, or document handling and expand from there."
        ),
    },
    {
        "slug": "workflow",
        "url": "https://globalflow.onrender.com/#flowboard",
        "title": "Workflow Engine",
        "caption": "Launch orchestration, inspect telemetry, and review next steps.",
        "script": (
            "The workflow engine lets you launch orchestration, inspect telemetry, review next steps, and watch activity without leaving the page."
        ),
    },
    {
        "slug": "automation",
        "url": "https://globalflow.onrender.com/automation",
        "title": "Automation Workspace",
        "caption": "A focused execution view for connectors and live activity.",
        "script": (
            "Inside the automation workspace, the paid control room focuses on execution, connectors, and real time activity for day to day operations."
        ),
    },
]


def find_edge() -> Path:
    for candidate in EDGE_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Microsoft Edge executable not found.")


def ensure_dirs() -> None:
    TEMP.mkdir(parents=True, exist_ok=True)
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    FRONTEND_STATIC_DIR.mkdir(parents=True, exist_ok=True)


def get_ffmpeg() -> str:
    if LOCAL_FFMPEG.exists():
        return str(LOCAL_FFMPEG)
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def get_ffprobe() -> str:
    if LOCAL_FFPROBE.exists():
        return str(LOCAL_FFPROBE)
    ffmpeg = Path(get_ffmpeg())
    probe = ffmpeg.with_name("ffprobe.exe")
    if probe.exists():
        return str(probe)
    raise FileNotFoundError("ffprobe executable not found.")


def capture_slide(edge_path: Path, url: str, out_path: Path) -> None:
    cmd = [
        str(edge_path),
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1440,900",
        "--virtual-time-budget=12000",
        f"--screenshot={out_path}",
        url,
    ]
    subprocess.run(cmd, check=True)


def synthesize_wav(text: str, out_path: Path) -> None:
    script = VOICE_SCRIPT.format(wav_path=str(out_path), text=text)
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", script],
        check=True,
    )


def audio_duration_seconds(path: Path) -> float:
    ffprobe = get_ffprobe()
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    completed = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(completed.stdout.strip())


def concat_wavs(paths: list[Path], out_path: Path) -> None:
    ffmpeg = get_ffmpeg()
    cmd = [ffmpeg, "-y"]
    for path in paths:
        cmd.extend(["-i", str(path)])
    filter_graph = f"concat=n={len(paths)}:v=0:a=1[a]"
    cmd.extend(
        [
            "-filter_complex",
            filter_graph,
            "-map",
            "[a]",
            "-ar",
            "24000",
            "-ac",
            "1",
            str(out_path),
        ]
    )
    subprocess.run(cmd, check=True)


def get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path(r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"),
        Path(r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def fit_image(path: Path, width: int, height: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    src_ratio = image.width / image.height
    target_ratio = width / height
    if src_ratio > target_ratio:
        new_height = height
        new_width = int(height * src_ratio)
    else:
        new_width = width
        new_height = int(width / src_ratio)
    resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    left = max(0, (new_width - width) // 2)
    top = max(0, (new_height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def build_frame(
    screenshot_path: Path,
    title: str,
    caption: str,
    progress: float,
    width: int = 1280,
    height: int = 720,
) -> np.ndarray:
    base = fit_image(screenshot_path, width, height)
    zoom = 1.0 + (0.035 * progress)
    zoomed = base.resize(
        (int(width * zoom), int(height * zoom)),
        Image.Resampling.LANCZOS,
    )
    left = max(0, (zoomed.width - width) // 2)
    top = max(0, (zoomed.height - height) // 2)
    frame = zoomed.crop((left, top, left + width, top + height))

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, height - 220, width, height), fill=(0, 0, 0, 148))
    draw.rectangle((0, 0, width, 96), fill=(0, 0, 0, 76))

    title_font = get_font(38, bold=True)
    body_font = get_font(24, bold=False)
    small_font = get_font(20, bold=False)

    draw.text((64, 54), "GLOBALFLOW WALKTHROUGH", font=small_font, fill=(255, 255, 255, 230))
    draw.text((64, height - 170), title, font=title_font, fill=(255, 255, 255, 255))
    wrapped = textwrap.fill(caption, width=54)
    draw.multiline_text((64, height - 116), wrapped, font=body_font, fill=(255, 255, 255, 235), spacing=8)

    frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")
    return np.array(frame)


def build_video(slides: list[dict], out_path: Path, audio_path: Path) -> None:
    fps = 30
    silent_tail = 0.45
    video_temp = TEMP / "walkthrough_video_only.mp4"
    os.environ["IMAGEIO_FFMPEG_EXE"] = get_ffmpeg()
    writer = imageio.get_writer(str(video_temp), fps=fps, codec="libx264", quality=8, pixelformat="yuv420p")
    try:
        for slide in slides:
            duration = slide["duration"] + silent_tail
            frame_count = max(int(math.ceil(duration * fps)), fps)
            for idx in range(frame_count):
                progress = idx / max(frame_count - 1, 1)
                frame = build_frame(slide["image"], slide["title"], slide["caption"], progress)
                writer.append_data(frame)
        writer.close()
    finally:
        if hasattr(writer, "close"):
            writer.close()

    ffmpeg = get_ffmpeg()
    mux_cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(video_temp),
        "-i",
        str(audio_path),
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(out_path),
    ]
    subprocess.run(mux_cmd, check=True)


def main() -> None:
    ensure_dirs()
    edge_path = find_edge()

    wavs: list[Path] = []
    for slide in SLIDES:
        image_path = TEMP / f"{slide['slug']}.png"
        wav_path = TEMP / f"{slide['slug']}.wav"
        capture_slide(edge_path, slide["url"], image_path)
        synthesize_wav(slide["script"], wav_path)
        slide["image"] = image_path
        slide["wav"] = wav_path
        slide["duration"] = audio_duration_seconds(wav_path)
        wavs.append(wav_path)

    combined_wav = TEMP / "walkthrough_narration.wav"
    concat_wavs(wavs, combined_wav)

    output_video = STATIC_DIR / "globalflow-walkthrough.mp4"
    build_video(SLIDES, output_video, combined_wav)

    poster_source = fit_image(TEMP / "overview.png", 1280, 720)
    poster_source.save(STATIC_DIR / "globalflow-walkthrough-poster.png", format="PNG")

    shutil.copy2(STATIC_DIR / "globalflow-walkthrough.mp4", FRONTEND_STATIC_DIR / "globalflow-walkthrough.mp4")
    shutil.copy2(STATIC_DIR / "globalflow-walkthrough-poster.png", FRONTEND_STATIC_DIR / "globalflow-walkthrough-poster.png")

    print(f"Built {output_video}")


if __name__ == "__main__":
    main()
