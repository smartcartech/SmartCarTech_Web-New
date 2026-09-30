"""Retouch the home-page hero image from the original xe-toan-canh AI render.

Removes the Gemini watermark, upscales 2x, sharpens the car and fades the
studio backdrop into the page background so the cyan ring stays visible.
Only the hero uses the output; xe-toan-canh.webp and other images are untouched.

Requires Pillow, numpy and opencv-python. The source file is never overwritten.
Run from any directory: python scripts/prepare-hero-image.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source image and video' / 'Hero' / 'xe-toan-canh-goc.jpg'
MASTER = SOURCE.with_name('xe-toan-canh-hero.png')
IMAGES = ROOT / 'assets' / 'img'
NAME = 'xe-toan-canh-hero'
# Rendered as the page background #04080C once .media-img applies contrast(1.08)
PAGE_BG = np.array([13, 17, 21], np.float32) / 255


def box(img, r):
    return cv2.boxFilter(img, -1, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)


def guided(guide, src, r, eps):
    mean_g, mean_s = box(guide, r), box(src, r)
    a = (box(guide * src, r) - mean_g * mean_s) / (box(guide * guide, r) - mean_g * mean_g + eps)
    b = mean_s - a * mean_g
    return box(a, r) * guide + box(b, r)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def remove_watermark(rgb8):
    # Light-grey sparkle on the dark floor in the bottom-right corner
    luma = cv2.cvtColor(rgb8, cv2.COLOR_RGB2GRAY)
    corner = luma[600:, 930:]
    mask = np.zeros(luma.shape, np.uint8)
    mask[600:, 930:] = (corner > np.median(corner) + 6).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8))
    return cv2.inpaint(rgb8, mask, 6, cv2.INPAINT_TELEA)


def flatten_horizon(rgb):
    # Darken the backdrop beside the car to the floor level so the table edge
    # (y ~258) does not draw a line across the page
    h, w = rgb.shape[:2]
    luma = rgb.mean(axis=2)
    above = cv2.GaussianBlur(np.median(luma[240:255], axis=0)[None], (0, 0), 8)[0]
    below = cv2.GaussianBlur(np.median(luma[263:281], axis=0)[None], (0, 0), 8)[0]
    k = np.clip(below / np.maximum(above, 1e-4), 0.3, 1.0)
    x = np.arange(w, dtype=np.float32)
    side = np.maximum(1 - smoothstep(120, 200, x), smoothstep(880, 950, x))
    gain = 1 - side * (1 - k)
    rows = 1 - smoothstep(257, 261, np.arange(h, dtype=np.float32))
    return rgb * (1 - rows[:, None] * (1 - gain[None, :]))[..., None]


def retouch(rgb):
    h, w = rgb.shape[:2]
    W, H = w * 2, h * 2
    ones3 = np.ones((3, 3), np.uint8)

    # Where the car and its reflection have structure; flat backdrop stays out
    luma = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mean = cv2.GaussianBlur(luma, (0, 0), 3)
    std = np.sqrt(np.maximum(cv2.GaussianBlur(luma * luma, (0, 0), 3) - mean * mean, 0))
    detail = smoothstep(0.006, 0.02, std)
    detail = cv2.GaussianBlur(cv2.dilate(detail, np.ones((9, 9), np.uint8)), (0, 0), 6)
    detail = cv2.resize(detail, (W, H), interpolation=cv2.INTER_LINEAR)

    # 2x upscale; back-projection keeps the new luma consistent with the source
    ycc = cv2.cvtColor(np.clip(cv2.resize(rgb, (W, H), interpolation=cv2.INTER_LANCZOS4), 0, 1),
                       cv2.COLOR_RGB2YCrCb)
    y_src = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)[..., 0]
    Y = ycc[..., 0].copy()
    for _ in range(3):
        err = y_src - cv2.resize(Y, (w, h), interpolation=cv2.INTER_AREA)
        Y += cv2.resize(err, (W, H), interpolation=cv2.INTER_CUBIC) * 0.8
    Y = np.clip(Y, cv2.erode(ycc[..., 0], ones3) - 0.01, cv2.dilate(ycc[..., 0], ones3) + 0.01)

    # Snap the 4:2:0 JPEG chroma to luma edges
    for c in (1, 2):
        ycc[..., c] = guided(Y, ycc[..., c], 3, 1e-4)

    # Smooth JPEG blocking in flat areas, then edge-preserving clarity on the car
    smooth = guided(Y, Y, 6, 4e-4)
    Y = smooth + (Y - smooth) * np.clip(0.35 + 0.65 * detail, 0, 1)
    base = guided(Y, Y, 14, 2e-3)
    mid = smoothstep(0.0, 0.25, Y) * (1 - smoothstep(0.75, 1.0, Y))
    Y = base + (Y - base) * (1 + 0.45 * detail * (0.4 + 0.6 * mid))

    # Fine sharpening, overshoot clamped to the local range so edges get no halo
    sharp = Y + 0.9 * detail * (Y - cv2.GaussianBlur(Y, (0, 0), 1.1))
    Y = np.clip(sharp, cv2.erode(Y, ones3) - 0.012, cv2.dilate(Y, ones3) + 0.012)
    ycc[..., 0] = Y
    out = np.clip(cv2.cvtColor(ycc, cv2.COLOR_YCrCb2RGB), 0, 1)

    # Vibrance on the car: muted colours gain more than the saturated yellow wheels
    lab = cv2.cvtColor(out, cv2.COLOR_RGB2Lab)
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    gain = 1 + 0.22 * detail * (1 - smoothstep(20, 80, chroma))
    lab[..., 1] *= gain
    lab[..., 2] *= gain
    out = np.clip(cv2.cvtColor(lab, cv2.COLOR_Lab2RGB), 0, 1)

    # Fade the backdrop to the page colour outside an ellipse around the car
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - 0.52 * W) / (0.50 * W)) ** 2 + ((yy - 0.53 * H) / (0.56 * H)) ** 2)
    out += (PAGE_BG - out) * (0.85 * smoothstep(0.74, 1.08, r))[..., None]
    return np.clip(out, 0, 1)


def main():
    with Image.open(SOURCE) as im:
        rgb8 = np.asarray(im.convert('RGB'))
    if rgb8.shape[:2] != (697, 1024):
        raise SystemExit(f'Expected the 1024x697 original render, got {rgb8.shape[1]}x{rgb8.shape[0]}.')
    rgb = flatten_horizon(remove_watermark(rgb8).astype(np.float32) / 255)
    master = Image.fromarray((retouch(rgb) * 255 + 0.5).astype(np.uint8))
    master.save(MASTER)
    print(f'{MASTER.relative_to(ROOT)}: {master.width}x{master.height}')
    # Same 1024:697 ratio as .hero__img, so the hotspot positions still match
    for suffix, width, quality in [('', 1600, 88), ('-640', 640, 85)]:
        dest = IMAGES / f'{NAME}{suffix}.webp'
        scaled = master.resize((width, round(master.height * width / master.width)), Image.Resampling.LANCZOS)
        scaled.save(dest, 'WEBP', quality=quality, method=6)
        print(f'{dest.relative_to(ROOT)}: {scaled.width}x{scaled.height}, {dest.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
