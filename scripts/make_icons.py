"""Draws the app icons into icons/. Run: python3 scripts/make_icons.py (needs Pillow)."""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
SS = 4  # supersampling for smooth edges

COLORS = {
    "R": "#f04848",
    "O": "#ff9330",
    "Y": "#ffcf33",
    "G": "#5acb4e",
    "C": "#35c6ea",
    "B": "#3f73ee",
    "P": "#9b5cf0",
    "K": "#f262b5",
}
# 3x3 arrangement of blocks; '.' leaves a gap.
PATTERN = ["RO.", "YGC", ".BP"]


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def shade(rgb, t):
    target = 255 if t > 0 else 0
    return tuple(round(v + (target - v) * abs(t)) for v in rgb)


def block(draw, x, y, s, color):
    rgb = hex_rgb(color)
    b = s * 0.15
    draw.rounded_rectangle([x, y, x + s, y + s], radius=s * 0.12, fill=shade(rgb, -0.38))
    draw.polygon([(x, y), (x + s, y), (x + s - b, y + b), (x + b, y + b)], fill=shade(rgb, 0.42))
    draw.polygon([(x, y), (x + b, y + b), (x + b, y + s - b), (x, y + s)], fill=shade(rgb, 0.18))
    draw.polygon([(x + s, y), (x + s, y + s), (x + s - b, y + s - b), (x + s - b, y + b)], fill=shade(rgb, -0.2))
    draw.rectangle([x + b, y + b, x + s - b, y + s - b], fill=shade(rgb, 0.05))
    draw.rounded_rectangle(
        [x + b * 1.4, y + b * 1.3, x + b * 1.4 + s * 0.26, y + b * 1.3 + s * 0.12],
        radius=s * 0.06,
        fill=shade(rgb, 0.4),
    )


def icon(size, inset=0.16, rounded=True):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg = Image.new("RGBA", (S, S))
    top, bottom = hex_rgb("#5a80e0"), hex_rgb("#1d2c66")
    grad = ImageDraw.Draw(bg)
    for yy in range(S):
        t = yy / (S - 1)
        grad.line([(0, yy), (S, yy)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22 if rounded else 0, fill=255)
    img.paste(bg, (0, 0), mask)

    draw = ImageDraw.Draw(img)
    area = S * (1 - 2 * inset)
    board_pad = area * 0.05
    draw.rounded_rectangle(
        [S * inset, S * inset, S * inset + area, S * inset + area], radius=area * 0.08, fill=hex_rgb("#1d2858")
    )
    cell = (area - board_pad * 2) / 3
    gap = cell * 0.05
    for r, row in enumerate(PATTERN):
        for c, key in enumerate(row):
            x = S * inset + board_pad + c * cell + gap
            y = S * inset + board_pad + r * cell + gap
            if key == ".":
                draw.rounded_rectangle([x, y, x + cell - 2 * gap, y + cell - 2 * gap], radius=cell * 0.1, fill=hex_rgb("#26336b"))
            else:
                block(draw, x, y, cell - 2 * gap, COLORS[key])
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    # iOS rounds the corners itself, so apple-touch-icon is square.
    icon(180, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
    icon(192).save(OUT / "icon-192.png")
    icon(512).save(OUT / "icon-512.png")
    icon(512, inset=0.24, rounded=False).convert("RGB").save(OUT / "icon-maskable-512.png")
    icon(32, inset=0.06).save(OUT / "favicon-32.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
