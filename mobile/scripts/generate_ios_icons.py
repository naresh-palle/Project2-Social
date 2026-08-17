#!/usr/bin/env python3
"""Generate CR8 Studio iOS AppIcon PNGs (no extra deps)."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "ios" / "Runner" / "Assets.xcassets" / "AppIcon.appiconset"

# (filename, pixels)
ICONS = [
    ("Icon-App-20x20@1x.png", 20),
    ("Icon-App-20x20@2x.png", 40),
    ("Icon-App-20x20@3x.png", 60),
    ("Icon-App-29x29@1x.png", 29),
    ("Icon-App-29x29@2x.png", 58),
    ("Icon-App-29x29@3x.png", 87),
    ("Icon-App-40x40@1x.png", 40),
    ("Icon-App-40x40@2x.png", 80),
    ("Icon-App-40x40@3x.png", 120),
    ("Icon-App-60x60@2x.png", 120),
    ("Icon-App-60x60@3x.png", 180),
    ("Icon-App-76x76@1x.png", 76),
    ("Icon-App-76x76@2x.png", 152),
    ("Icon-App-83.5x83.5@2x.png", 167),
    ("Icon-App-1024x1024@1x.png", 1024),
]


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int) -> None:
    """Solid #FF3B30 rounded-square with a simple light glyph."""
    rows = []
    r, g, b = 255, 59, 48
    radius = max(2, size // 5)
    for y in range(size):
        row = bytearray()
        for x in range(size):
            # rounded-rect mask
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            inside = True
            if dx < radius and dy < radius:
                inside = (radius - dx) ** 2 + (radius - dy) ** 2 <= radius * radius
            if not inside:
                row.extend((0, 0, 0, 0))
                continue
            # inner "C" ring
            cx, cy = size / 2, size / 2
            dist = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            outer, inner = size * 0.34, size * 0.22
            in_ring = inner <= dist <= outer
            # open the C on the right
            open_c = x > cx and abs(y + 0.5 - cy) < size * 0.14
            if in_ring and not open_c:
                row.extend((255, 244, 240, 255))
            else:
                row.extend((r, g, b, 255))
        rows.append(b"\x00" + bytes(row))
    raw = b"".join(rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(raw, 9)) + _chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, px in ICONS:
        write_png(OUT / name, px)
        print(f"wrote {name} ({px}px)")


if __name__ == "__main__":
    main()
