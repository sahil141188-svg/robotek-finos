#!/usr/bin/env python3
"""Extract the red R mark from the Robotek horizontal logo and build PWA icons."""
from PIL import Image, ImageChops
import os

SRC = "/Users/sahilaggarwal/Desktop/Robotek/Brand & Creative/Logo.png"
OUT = "/Users/sahilaggarwal/robotek-project/public/stock/icons"
BG = (255, 255, 255)  # white background (matches the supplied logo)

im = Image.open(SRC).convert("RGBA")
# composite onto white so transparent areas read as background
base = Image.new("RGBA", im.size, BG + (255,))
base.alpha_composite(im)
rgb = base.convert("RGB")

# Isolate the red mark: where red channel clearly dominates green & blue.
r, g, b = rgb.split()
red_dom = ImageChops.subtract(r, ImageChops.lighter(g, b))
mask = red_dom.point(lambda p: 255 if p > 40 else 0)
bbox = mask.getbbox()
if not bbox:
    raise SystemExit("No red mark detected")
print("red mark bbox:", bbox, "of", im.size)

mark = rgb.crop(bbox)
mw, mh = mark.size

def icon(size, fill_frac):
    """Square white canvas with the mark centered at fill_frac of the side."""
    canvas = Image.new("RGB", (size, size), BG)
    target = int(size * fill_frac)
    scale = min(target / mw, target / mh)
    nw, nh = max(1, int(mw * scale)), max(1, int(mh * scale))
    resized = mark.resize((nw, nh), Image.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas

os.makedirs(OUT, exist_ok=True)
icon(512, 0.74).save(os.path.join(OUT, "icon-512.png"))
icon(192, 0.74).save(os.path.join(OUT, "icon-192.png"))
icon(180, 0.74).save(os.path.join(OUT, "apple-touch-icon.png"))
# maskable needs the logo inside the ~80% safe circle -> smaller fill
icon(512, 0.58).save(os.path.join(OUT, "maskable-512.png"))
print("wrote icons to", OUT)
