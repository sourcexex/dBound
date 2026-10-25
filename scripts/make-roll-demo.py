"""Build a frame strip + GIF that demonstrates the rolling digit animation."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "output" / "screenshots"
OUT = ROOT / "output" / "roll"


def load(prefix: str, count: int) -> list[Image.Image]:
    frames = []
    for index in range(count):
        path = SHOTS / f"{prefix}-{index}.png"
        if path.exists():
            frames.append(Image.open(path).convert("RGB"))
    return frames


def crop_main(image: Image.Image) -> Image.Image:
    # 630x960 screenshots; the number sits around y=200..420
    return image.crop((120, 190, 510, 430))


def crop_full(image: Image.Image) -> Image.Image:
    # 2560x1600 screenshots
    return image.crop((740, 360, 1840, 1010))


def strip(frames: list[Image.Image], path: Path, scale: float = 1.0) -> None:
    if not frames:
        return
    gap = 10
    width = sum(frame.width for frame in frames) + gap * (len(frames) - 1)
    height = max(frame.height for frame in frames)
    canvas = Image.new("RGB", (width, height), (250, 250, 248))
    x = 0
    for frame in frames:
        canvas.paste(frame, (x, 0))
        x += frame.width + gap
    if scale != 1.0:
        canvas = canvas.resize((int(width * scale), int(height * scale)), Image.LANCZOS)
    canvas.save(path)
    print(f"wrote {path} ({canvas.size[0]}x{canvas.size[1]})")


def gif(frames: list[Image.Image], path: Path, duration: int = 120) -> None:
    if not frames:
        return
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        optimize=True,
    )
    print(f"wrote {path} ({len(frames)} frames)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    main_frames = [crop_main(image) for image in load("roll-main", 8)]
    full_frames = [crop_full(image) for image in load("roll-full", 8)]

    strip(main_frames, OUT / "roll-main-strip.png", scale=1.0)
    strip(full_frames, OUT / "roll-full-strip.png", scale=0.42)

    gif(main_frames, OUT / "roll-main.gif", duration=100)
    gif(full_frames, OUT / "roll-full.gif", duration=100)

    # label the strip for the report
    labeled = Image.open(OUT / "roll-main-strip.png").convert("RGB")
    draw = ImageDraw.Draw(labeled)
    draw.rectangle([0, 0, labeled.width - 1, labeled.height - 1], outline=(220, 219, 213))
    labeled.save(OUT / "roll-main-strip-labeled.png")
    print("done")


if __name__ == "__main__":
    main()
