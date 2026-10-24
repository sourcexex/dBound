"""Generate the dBound source icon (1024x1024 PNG) used by `tauri icon`."""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
TOP = (28, 28, 32)
BOTTOM = (12, 12, 14)
AMBER = (242, 201, 76, 255)
WHITE = (249, 249, 245, 236)

out = Path(__file__).resolve().parent.parent / "icon-source.png"

background = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(background)
for y in range(SIZE):
    t = y / (SIZE - 1)
    color = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)
    draw.line([(0, y), (SIZE, y)], fill=color)

mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=232, fill=255)

icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
icon.paste(background, (0, 0), mask)
draw = ImageDraw.Draw(icon)

heights = [190, 340, 560, 405, 245]
bar_width = 92
gap = 46
total = len(heights) * bar_width + (len(heights) - 1) * gap
start_x = (SIZE - total) // 2
baseline = 792

for index, height in enumerate(heights):
    left = start_x + index * (bar_width + gap)
    top = baseline - height
    color = AMBER if index == 2 else WHITE
    draw.rounded_rectangle(
        [left, top, left + bar_width, baseline],
        radius=bar_width // 2,
        fill=color,
    )

icon.save(out)
print(f"wrote {out} ({icon.size[0]}x{icon.size[1]})")
