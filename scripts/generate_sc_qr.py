#!/usr/bin/env python3
"""
Generate per-SC QR codes for Robotek stock app.
Each SC gets a unique link: robotekstock.vercel.app/stock?sc=91XXXXXXXXXX

Usage:
  python3 scripts/generate_sc_qr.py

Add SCs to the list below, then run. QR PNGs are written to public/stock/sc-qr/
"""
import qrcode, os, re
from PIL import Image, ImageDraw, ImageFont

BASE_URL = "https://robotekstock.vercel.app/stock"
OUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "public", "stock", "sc-qr")

# ── ADD YOUR SCS HERE ────────────────────────────────────────────────────────
SCS = [
    # (label, ref_code, tagline)
    ("Robotek Orders HO1",       "HO1",   "Order in Seconds!"),
    ("Robotek Orders HO2",       "HO2",   "Order in Seconds!"),
    ("Robotek Experience Store", "Store", "Scan & Order Now!"),
    ("Robotek Gorakhpur",        "GKP",   "Order in Seconds!"),
]
# ────────────────────────────────────────────────────────────────────────────

def norm(num):
    n = re.sub(r"\D", "", num)
    if len(n) == 10: n = "91" + n
    return n

os.makedirs(OUT_DIR, exist_ok=True)

for name, ref, tagline in SCS:
    url  = f"{BASE_URL}?ref={ref}"
    slug = re.sub(r"\s+", "_", name.strip().lower())

    qr = qrcode.QRCode(version=2, box_size=18, border=3,
                        error_correction=qrcode.constants.ERROR_CORRECT_H)
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#1F1B20", back_color="white").convert("RGB")

    # label strip: tagline + name + url (3 lines)
    W, H = qr_img.size
    strip = 90
    canvas = Image.new("RGB", (W, H + strip), "white")
    canvas.paste(qr_img, (0, 0))
    draw = ImageDraw.Draw(canvas)
    try:
        big   = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        med   = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        big = med = small = ImageFont.load_default()

    draw.text((W//2, H + 8),  tagline, fill="#1F1B20", font=big,   anchor="mt")
    draw.text((W//2, H + 42), name,    fill="#E52D31", font=med,   anchor="mt")
    draw.text((W//2, H + 70), "robotekstock.vercel.app", fill="#6E6A6B", font=small, anchor="mt")

    out = os.path.join(OUT_DIR, f"sc-qr-{slug}.png")
    canvas.save(out)
    print(f"✅  {name:25s}  {tagline}")
    print(f"    {url}")
    print(f"    saved → {out}")

if not SCS:
    print("⚠  No SCs defined. Edit the SCS list in this script and re-run.")
