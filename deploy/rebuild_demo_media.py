from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "globalflow" / "static"
FRONTEND_STATIC_DIR = ROOT / "frontend" / "static"
TEMP_DIR = ROOT / "temp" / "demo_media"
FFMPEG = next((ROOT / "temp").rglob("ffmpeg.exe"))
FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

WIDTH = 1280
HEIGHT = 720
NAVY = "#07152f"
NAVY_SOFT = "#0d2045"
ACCENT = "#72adff"
WHITE = "#f7fbff"
MUTED = "#b8c6df"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        probe = word if not current else f"{current} {word}"
        width = draw.textbbox((0, 0), probe, font=fnt)[2]
        if width <= max_width:
            current = probe
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_multiline(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fnt: ImageFont.FreeTypeFont, fill: str, max_width: int, line_gap: int) -> int:
    lines = wrap(draw, text, fnt, max_width)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        box = draw.textbbox((x, y), line, font=fnt)
        y += (box[3] - box[1]) + line_gap
    return y


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=28, fill=fill, outline=outline, width=width)


def fit_image(path: Path, size: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, NAVY_SOFT)
    x = (size[0] - image.width) // 2
    y = (size[1] - image.height) // 2
    canvas.paste(image, (x, y))
    return canvas


def base_slide() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), NAVY)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 118), fill="#061126")
    draw.text((72, 42), "GlobalFlow", font=font(FONT_BOLD, 34), fill=WHITE)
    draw.text((72, 80), "AI automation for calls, billing, files, and compliance", font=font(FONT_REG, 22), fill=MUTED)
    return image, draw


def make_slides() -> list[Path]:
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    slides: list[Path] = []
    screenshot_home = ROOT / "temp" / "home-check.png"
    screenshot_demo = ROOT / "temp" / "demo-check.png"

    # Slide 1
    image, draw = base_slide()
    draw.text((72, 182), "Product walkthrough", font=font(FONT_BOLD, 68), fill=WHITE)
    y = draw_multiline(
        draw,
        72,
        286,
        "GlobalFlow automates routine business work like call summaries, invoicing, tax organization, and workflow follow-up.",
        font(FONT_REG, 30),
        MUTED,
        620,
        12,
    )
    rounded(draw, (72, y + 28, 332, y + 100), fill=ACCENT)
    draw.text((110, y + 46), "See the flow", font=font(FONT_BOLD, 28), fill=NAVY)
    rounded(draw, (760, 170, 1180, 560), fill=NAVY_SOFT, outline="#294c84", width=2)
    draw.polygon([(930, 300), (930, 430), (1040, 365)], fill=WHITE)
    draw.text((838, 470), "Live workflow demo", font=font(FONT_REG, 30), fill=WHITE)
    path = TEMP_DIR / "slide01.png"
    image.save(path)
    slides.append(path)

    # Slide 2
    image, draw = base_slide()
    draw.text((72, 176), "Capture and organize work", font=font(FONT_BOLD, 58), fill=WHITE)
    draw_multiline(
        draw,
        72,
        270,
        "After a client call, GlobalFlow generates a summary, extracts action items, and updates the workflow automatically.",
        font(FONT_REG, 28),
        MUTED,
        520,
        10,
    )
    if screenshot_home.exists():
        shot = fit_image(screenshot_home, (560, 340))
        image.paste(shot, (650, 210))
        rounded(draw, (650, 210, 1210, 550), fill=None, outline="#294c84", width=2)
    path = TEMP_DIR / "slide02.png"
    image.save(path)
    slides.append(path)

    # Slide 3
    image, draw = base_slide()
    draw.text((72, 176), "Run automation with visibility", font=font(FONT_BOLD, 58), fill=WHITE)
    draw_multiline(
        draw,
        72,
        270,
        "Billing, files, and compliance tasks move through tracked runs so operators can inspect progress, results, and next steps in one place.",
        font(FONT_REG, 28),
        MUTED,
        520,
        10,
    )
    if screenshot_demo.exists():
        shot = fit_image(screenshot_demo, (560, 340))
        image.paste(shot, (650, 210))
        rounded(draw, (650, 210, 1210, 550), fill=None, outline="#294c84", width=2)
    path = TEMP_DIR / "slide03.png"
    image.save(path)
    slides.append(path)

    # Slide 4
    image, draw = base_slide()
    draw.text((72, 176), "Focus on growth, not admin work", font=font(FONT_BOLD, 58), fill=WHITE)
    y = draw_multiline(
        draw,
        72,
        270,
        "That removes repetitive operational work so teams can focus on decisions, client relationships, and revenue-generating tasks.",
        font(FONT_REG, 28),
        MUTED,
        560,
        10,
    )
    for i, label in enumerate(
        [
            "Call summaries",
            "Invoice matching",
            "Tax organization",
            "File routing",
        ]
    ):
        top = y + 42 + (i * 68)
        rounded(draw, (72, top, 420, top + 52), fill=NAVY_SOFT, outline="#294c84", width=2)
        draw.text((96, top + 13), label, font=font(FONT_REG, 24), fill=WHITE)
    path = TEMP_DIR / "slide04.png"
    image.save(path)
    slides.append(path)
    return slides


def build_media(slides: list[Path]) -> None:
    poster = slides[0]
    shutil.copy2(poster, STATIC_DIR / "globalflow-walkthrough-poster.png")
    shutil.copy2(poster, FRONTEND_STATIC_DIR / "globalflow-walkthrough-poster.png")

    input_pattern = TEMP_DIR / "slide%02d.png"
    output_mp4 = STATIC_DIR / "globalflow-walkthrough.mp4"
    cmd = [
        str(FFMPEG),
        "-y",
        "-framerate",
        "1/6",
        "-i",
        str(input_pattern),
        "-i",
        str(output_mp4),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-vf",
        "fps=30,format=yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-t",
        "24",
        "-shortest",
        str(TEMP_DIR / "globalflow-walkthrough-new.mp4"),
    ]
    subprocess.run(cmd, check=True)
    shutil.copy2(TEMP_DIR / "globalflow-walkthrough-new.mp4", output_mp4)
    shutil.copy2(TEMP_DIR / "globalflow-walkthrough-new.mp4", FRONTEND_STATIC_DIR / "globalflow-walkthrough.mp4")


if __name__ == "__main__":
    slides = make_slides()
    build_media(slides)
    print("rebuilt demo media")
