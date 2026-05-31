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
    # ("Name", "WhatsApp number (10 or 12 digit)"),
    # ("Rajesh", "9876543210"),
    # ("Priya",  "8765432109"),
]
# ────────────────────────────────────────────────────────────────────────────

def norm(num):
    n = re.sub(r"\D", "", num)
    if len(n) == 10: n = "91" + n
    return n

os.makedirs(OUT_DIR, exist_ok=True)

for name, raw in SCS:
    num  = norm(raw)
    url  = f"{BASE_URL}?sc={num}"
    slug = re.sub(r"\s+", "_", name.strip().lower())

    qr = qrcode.QRCode(version=2, box_size=18, border=3,
                        error_correction=qrcode.constants.ERROR_CORRECT_H)
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#1F1B20", back_color="white").convert("RGB")

    # add label strip at bottom
    W, H = qr_img.size
    strip = 64
    canvas = Image.new("RGB", (W, H + strip), "white")
    canvas.paste(qr_img, (0, 0))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 26)
        small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
    except Exception:
        font = small = ImageFont.load_default()

    draw.text((W//2, H + 12), name, fill="#E52D31", font=font, anchor="mt")
    draw.text((W//2, H + 40), "robotekstock.vercel.app", fill="#6E6A6B", font=small, anchor="mt")

    out = os.path.join(OUT_DIR, f"sc-qr-{slug}.png")
    canvas.save(out)
    print(f"✅  {name:15s}  {url}")
    print(f"    saved → {out}")

if not SCS:
    print("⚠  No SCs defined. Edit the SCS list in this script and re-run.")
