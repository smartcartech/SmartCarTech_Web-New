"""Export the In 3D photos for the Shopee and TikTok Shop listings.

Output goes to "source image and video/In 3D/Shopee TikTok/<product>/" (not on the website, not in git),
numbered in the suggested upload order (01 = cover image). Each photo is a square as wide as the shop's phone
photo (2252 px), placed so the product is whole, and is not resized. A landscape photo whose products would not
fit a square is shown whole instead, scaled to 2252 px wide, on a blurred copy of itself.

The pink Christmas tree was photographed on a black base; the shop sells it on the bronze base of the other trees
(asked 2026-11-07), so in the photos that show it the base is repainted with the light and colour of a real bronze
base (BASE_REPAINT). It is saved at the highest JPEG quality
that stays under 2,000,000 bytes (the shops allow 2 MB), with full colour resolution (4:4:4) so the edges of
the coloured plastic stay sharp. The photos get no colour change. EXIF (camera, location) is dropped, the colour
profile is kept.

The colour-variant images in "Gia do dien thoai/Phan loai mau/" (one per colour option of the listing) are the
photo of 02-gia-do-xanh-mo.jpg with the blue stand repainted in a colour of the website's palette
(products.json -> print3d.colors), keeping its light, shade, layer lines and engraved name.

Videos are re-encoded whole (nothing cut, sound kept) to just under the 30 MB the shops take.

Requires Pillow, numpy, OpenCV (opencv-python) and ffmpeg on PATH. Originals are never overwritten. Run from any directory:
    python scripts/prepare-in-3d-shop-media.py [--force]
"""
from pathlib import Path
import argparse
import io
import json
import subprocess
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source image and video' / 'In 3D'
OUT = SOURCE / 'Shopee TikTok'

MAX_SIDE = 2252        # the shop phone's short side: its photos are cut, never resized; larger ones are scaled to this
MAX_BYTES = 1_990_000  # under 2,000,000 bytes, so it passes however the shop counts a megabyte

TREE = 'Cay thong/'
TREE_ID = '1993625496683910204_g4933616870727587553'

# file name in OUT: (source photo in SOURCE, top of the square in the upright photo, px). The square is as
# wide as the photo; 01 is the cover.
PHOTOS = {
    'Bang ten/01-bang-ten-hong-va-den.jpg': ('Bang ten/20261016_230611_1.jpg', 1014),  # pink and black plates in the hand
    'Bang ten/02-bang-ten-hong.jpg': ('Bang ten/20261016_230432_1.jpg', 308),          # pink plate (the shop's own 2252 x 2560 crop)
    'Gia do dien thoai/01-gia-do-ba-mau.jpg': ('Gia do dien thoai/20261015_222244_1.jpg', 406),               # three folded stands with names
    'Gia do dien thoai/02-gia-do-xanh-mo.jpg': ('Gia do dien thoai/20261015_172508_1.jpg', 1334),             # blue stand opened, close-up
    'Gia do dien thoai/03-gia-do-ba-mau-mo.jpg': ('Gia do dien thoai/20261015_222357_1.jpg', 1634),           # the three stands opened
    'Gia do dien thoai/04-gia-do-dung-dien-thoai.jpg': ('Gia do dien thoai/20261015_172607_1.jpg', 839),      # phone upright, front: fills the frame
    'Gia do dien thoai/05-gia-do-dien-thoai-nghieng.jpg': ('Gia do dien thoai/20261015_172532_1.jpg', 864),   # phone leaning, side
    'Gia do dien thoai/06-gia-do-ba-mau-dien-thoai.jpg': ('Gia do dien thoai/20261015_222426_1.jpg', 1189),   # three stands, phone on the blue one
    'Gia do dien thoai/07-gia-do-ba-mau-dien-thoai-2.jpg': ('Gia do dien thoai/20261015_222502_1.jpg', 1214), # same scene, other angle
    'Gia do dien thoai/08-gia-do-gap-canh-dien-thoai.jpg': ('Gia do dien thoai/20261015_172437_1.jpg', 1454), # folded beside a phone: its size
    'Gia do dien thoai/09-gia-do-mat-sau-dien-thoai.jpg': ('Gia do dien thoai/20261015_172545_1.jpg', 876),   # phone on it, seen from behind
    'Gia do dien thoai/10-gia-do-xanh-la-mo.jpg': ('Gia do dien thoai/20261017_134157_1.jpg', 950),          # green stand opened, aquarium behind (the top edge only grazes a fish fin)
    'Gia do dien thoai/11-gia-do-xep-chong-dien-thoai.jpg': ('Gia do dien thoai/20261018_120903.jpg', 880),  # phone on a green stand, three folded ones stacked, a blue one opened
    'Gia do dien thoai/12-gia-do-cam-tay.jpg': ('Gia do dien thoai/20261018_000744.jpg', 760),               # green stand held in the hand: its size
    'Gia do dien thoai/13-gia-do-den-mo.jpg': ('Gia do dien thoai/20261019_002101.jpg', 950),                # black stand opened
    # Christmas-tree clickers (sent through Zalo: 1441 x 2560, so the square is 1441 px). top None = whole photo on a blurred fill.
    'Cay thong/01-cay-thong-sau-mau.jpg': (TREE + '1793977261038_' + TREE_ID + '_664ccc0f775043674297d4fe1c1aec7f.jpg', 374),            # six colours, aquarium behind
    'Cay thong/02-cay-thong-xep-hang.jpg': (TREE + '1793977260966_' + TREE_ID + '_5ae745f57f3afcc9b6264ba63421841b.jpg', None),          # six in a row: too wide for a square
    'Cay thong/03-cay-thong-xanh-la.jpg': (TREE + '1793977261466_' + TREE_ID + '_8eaeee0d99d14509ac0532f408c8e73d.jpg', 672),            # green, star, coloured balls
    'Cay thong/04-cay-thong-hong.jpg': (TREE + '1793977261166_' + TREE_ID + '_10981afe15457b9be6cf1852db9a065f.jpg', 813),               # pink, black base
    'Cay thong/05-cay-thong-xanh-da-troi.jpg': (TREE + '1793977261376_' + TREE_ID + '_1b2e813597a72794ee592629de0e80e2.jpg', 746),       # sky blue, pink balls
    'Cay thong/06-cay-thong-xanh-non.jpg': (TREE + '1793977261260_' + TREE_ID + '_2ba25d7f80b6eb959c0085d84b5e5821.jpg', 771),           # lime green, red balls
    'Cay thong/07-cay-thong-xanh-bac-ha-moc-khoa.jpg': (TREE + '1793977261099_' + TREE_ID + '_f5bf511c877ad50f4340fbc97a7d9285.jpg', 797), # mint (xanh bạc hà), key ring
    'Cay thong/08-cay-thong-xanh-nhat-moc-khoa.jpg': (TREE + '1793977261573_' + TREE_ID + '_fe691f34769acafd63622733020c268a.jpg', 688), # pale green, key ring
    'Cay thong/09-cay-thong-cam-tay.jpg': (TREE + '1794030701589_' + TREE_ID + '_477742fd85e94543852d232bb3234171.jpg', 948),            # green tree in the palm: its size (top below the monitor's logo)
}

# The pink tree's black base, repainted bronze before the photo is cut. source photo: (box around the black base,
# photo with a bronze base in the same light, strip of that bronze base: left edge, right edge, top, bottom), px.
BASE_REPAINT = {
    PHOTOS['Cay thong/04-cay-thong-hong.jpg'][0]: ((600, 1840, 920, 1990), PHOTOS['Cay thong/05-cay-thong-xanh-da-troi.jpg'][0], (682, 914, 1803, 1845)),
    PHOTOS['Cay thong/01-cay-thong-sau-mau.jpg'][0]: ((500, 1600, 800, 1780), PHOTOS['Cay thong/01-cay-thong-sau-mau.jpg'][0], (990, 1175, 1668, 1712)),
    PHOTOS['Cay thong/02-cay-thong-xep-hang.jpg'][0]: ((830, 1320, 1070, 1480), PHOTOS['Cay thong/02-cay-thong-xep-hang.jpg'][0], (1254, 1450, 1398, 1440)),
}
BASE_BINS = 24      # slices across the bronze cylinder
BASE_DETAIL = 0.5   # share of the black base's own light and dark (seams, the skirt's shadow) the bronze keeps

# Colour variants: the square of 02-gia-do-xanh-mo.jpg, where the sky-blue stand is the only large blue object
# (the tank's rim is blue too but separate). file name in OUT: colour id in products.json print3d.colors, or #RRGGBB.
RECOLOR_FROM = PHOTOS['Gia do dien thoai/02-gia-do-xanh-mo.jpg']
RECOLORS = {
    'Gia do dien thoai/Phan loai mau/gia-do-trang.jpg': 'trang',
    'Gia do dien thoai/Phan loai mau/gia-do-do.jpg': 'do',
    'Gia do dien thoai/Phan loai mau/gia-do-vang.jpg': 'vang',
    'Gia do dien thoai/Phan loai mau/gia-do-hong.jpg': 'hong',
    'Gia do dien thoai/Phan loai mau/gia-do-hong-nhat.jpg': '#CF97C9',  # the real pink stand (Gia Hân) as photo 03 shows its lit face
    'Gia do dien thoai/Phan loai mau/gia-do-cam.jpg': 'cam',
}
LUMA = np.array([0.2126, 0.7152, 0.0722])  # luminance of linear sRGB

MAX_VIDEO_BYTES = 29_500_000  # Shopee takes videos up to 30 MB: under 30,000,000 bytes however a megabyte is counted

# file name in OUT: source video in SOURCE. The whole video is re-encoded at its own size and frame rate (H.264 in
# two passes, at the bitrate that fills MAX_VIDEO_BYTES); the sound is copied unchanged.
VIDEOS = {
    'Gia do dien thoai/video-gia-do-dien-thoai.mp4': 'Shopee TikTok/Gia do dien thoai/lv_7518375404592188733_20261019224948.mp4',  # the shop's CapCut edit, 33 s
}


def load_square(source, top):
    """The upright square of a source photo, its colour profile and the top actually used.

    top None: the whole (landscape) photo, centred on a blurred, slightly darkened copy of itself that fills the square.
    """
    with Image.open(SOURCE / source) as im:
        icc = im.info.get('icc_profile')
        photo = ImageOps.exif_transpose(im).convert('RGB')
    if source in BASE_REPAINT:
        photo = repaint_base(photo, *BASE_REPAINT[source])
    if top is None:
        side = min(photo.width, MAX_SIDE)
        photo = photo.resize((side, round(photo.height * side / photo.width)), Image.Resampling.LANCZOS)
        scale = side / photo.height
        fill = photo.resize((round(photo.width * scale), side), Image.Resampling.LANCZOS)
        left = (fill.width - side) // 2
        fill = fill.crop((left, 0, left + side, side)).filter(ImageFilter.GaussianBlur(side / 40))
        fill = ImageEnhance.Brightness(fill).enhance(0.85)
        top = (side - photo.height) // 2
        fill.paste(photo, (0, top))
        return fill, icc, f'whole, {top} px fill above'
    side = photo.width
    top = max(0, min(top, photo.height - side))
    square = photo.crop((0, top, side, top + side))
    if side > MAX_SIDE:
        square = square.resize((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    return square, icc, top


def best_jpeg(square, icc):
    """The highest quality (60-100) whose JPEG fits MAX_BYTES, as (quality, file bytes), or None."""
    best = None
    low, high = 60, 100
    while low <= high:
        quality = (low + high) // 2
        buf = io.BytesIO()
        # no exif= : camera and location data are not copied
        square.save(buf, 'JPEG', quality=quality, subsampling=0, progressive=True, optimize=True, icc_profile=icc)
        if buf.tell() <= MAX_BYTES:
            best, low = (quality, buf.getvalue()), quality + 1
        else:
            high = quality - 1
    return best


def save(square, icc, name, note):
    dest = OUT / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    found = best_jpeg(square, icc)
    if found is None:
        raise SystemExit(f'{name}: no JPEG quality fits in {MAX_BYTES:,} bytes')
    quality, data = found
    dest.write_bytes(data)
    print(f'{dest.relative_to(OUT)}: {square.width}x{square.height}, quality {quality}, {len(data):,} bytes  <- {note}')


def export_photos(force):
    for name, (source, top) in PHOTOS.items():
        if (OUT / name).exists() and not force:
            continue
        square, icc, top = load_square(source, top)
        save(square, icc, name, f'{source} (top {top})')


def to_linear(srgb):
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


def to_srgb(linear):
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055)


def masked_blur(lin, sel, sigma):
    """Around each pixel, the average linear colour of the selected pixels."""
    weight = cv2.GaussianBlur(sel.astype(np.float32), (0, 0), sigma)
    total = cv2.GaussianBlur((lin * sel[..., None]).astype(np.float32), (0, 0), sigma)
    return total / np.maximum(weight, 1e-6)[..., None]


def stand_matte(rgb):
    """Linear photo, the stand's share of each pixel (alpha) and the stand's own linear colour there (fore)."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV_FULL)
    hue = hsv[..., 0] * (360 / 256)
    blue = (hue > 185) & (hue < 235) & (hsv[..., 1] > 51) & (hsv[..., 2] > 15)
    _, labels, stats, _ = cv2.connectedComponentsWithStats(blue.astype(np.uint8), connectivity=8)
    core = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # holes in the stand: specks in the engraving are stand; a bigger one is the desk seen through the stand
    seen_through = np.zeros_like(core)
    contours, hierarchy = cv2.findContours(core, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    for contour, (_, _, _, parent) in zip(contours, hierarchy[0]):
        if parent >= 0:
            cv2.drawContours(core if cv2.contourArea(contour) < 200 else seen_through, [contour], -1, 1, cv2.FILLED)
    seen_through = seen_through.astype(bool) & ~core.astype(bool)

    lin = to_linear(np.asarray(rgb) / 255.0)
    disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    # the desk seen through a hole loses the blue light the hole's walls throw on it
    ring = cv2.dilate(core, disk(60)).astype(bool) & ~cv2.dilate(core, disk(10)).astype(bool)
    desk = np.median(lin[ring], axis=0)
    lin[seen_through] = (lin[seen_through] @ LUMA)[:, None] * (desk / (desk @ LUMA))

    inner = cv2.erode(core, disk(2)).astype(bool)   # surely stand
    outer = cv2.dilate(core, disk(4)).astype(bool)  # past this, surely not
    edge = outer & ~inner
    fore = masked_blur(lin, inner, 3)   # the stand's colour next to each edge pixel
    back = masked_blur(lin, ~outer, 6)  # the background's colour next to each edge pixel
    span = fore - back
    share = np.clip(((lin - back) * span).sum(-1) / np.maximum((span * span).sum(-1), 1e-6), 0, 1)
    alpha = np.where(edge, share, inner.astype(float))
    # the stand's colour in an edge pixel: unmixed from the background where the stand dominates, else its neighbour's
    unmixed = (lin - (1 - share[..., None]) * back) / np.maximum(share, 0.5)[..., None]
    fore = np.where(edge[..., None], np.where((share >= 0.5)[..., None], np.clip(unmixed, 0, None), fore), lin)
    return lin, alpha, fore, inner


def repaint(lin, alpha, fore, lit, colour):
    """The photo with the stand painted colour (#RRGGBB): its lit top face (luminance lit) shows the swatch."""
    swatch = to_linear(np.array([int(colour[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0)
    paint = swatch * ((fore @ LUMA) / lit)[..., None]
    # brighter than the swatch can go: fade to white at the same luminance instead of shifting the hue
    peak = paint.max(-1, keepdims=True)
    luma = np.minimum(paint @ LUMA, 1.0)[..., None]
    fade = np.clip((peak - 1) / np.maximum(peak - luma, 1e-6), 0, 1)
    paint = paint * (1 - fade) + luma * fade
    out = lin + alpha[..., None] * (paint - fore)
    return Image.fromarray((to_srgb(out) * 255 + 0.5).astype(np.uint8))


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def largest(mask):
    """The largest connected patch of a boolean mask."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    if n < 2:
        raise SystemExit('base repaint: nothing found in the box')
    return labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])


def fill_holes(mask):
    m = mask.astype(np.uint8)
    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(m, contours, -1, 1, cv2.FILLED)
    return m.astype(bool)


def across(values, u):
    """Median of values (n x c) in BASE_BINS slices across a cylinder (u 0..1); empty slices copy their neighbours."""
    b = np.clip((u * BASE_BINS).astype(int), 0, BASE_BINS - 1)
    out = np.full((BASE_BINS, values.shape[1]), np.nan)
    for i in range(BASE_BINS):
        if (b == i).sum() >= 5:
            out[i] = np.median(values[b == i], axis=0)
    good = ~np.isnan(out[:, 0])
    for c in range(out.shape[1]):
        out[:, c] = np.interp(np.arange(BASE_BINS), np.nonzero(good)[0], out[good, c])
    return out


def bronze_across(rgb, strip):
    """Log-luminance and colour (at luminance 1) of a real bronze base, slice by slice across it."""
    left, right, top, bottom = strip
    rgb = np.ascontiguousarray(rgb[top:bottom, left:right])
    lin = to_linear(rgb / 255.0)
    u = np.broadcast_to((np.arange(right - left) + 0.5) / (right - left), lin.shape[:2])
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue, sat, val = hsv[..., 0] * (360 / 256), hsv[..., 1] / 255, hsv[..., 2] / 255
    skirt = (hue > 90) & (hue < 260) & (sat > 0.3)   # the green or blue tree above dips into the strip
    desk = (sat < 0.12) & (val > 0.55)               # the desk beside the curved bottom
    keep = (u > 0.04) & (u < 0.96) & ~skirt & ~desk
    lum = np.maximum(lin @ LUMA, 1e-5)
    stack = np.concatenate([np.log(lum)[..., None], lin / lum[..., None]], -1)
    return across(stack[keep], u[keep])


def black_base(rgb):
    """The black base (V < 50; the desk's shadows next to it are 60+): seams filled, cut to its straight sides."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV_FULL)
    dark = largest(hsv[..., 2] < 50)
    core = fill_holes(cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_CLOSE, disk(9)))
    ys, xs = np.nonzero(core)
    top, bottom = ys.min(), ys.max()
    rows = [y for y in np.unique(ys) if top + 0.3 * (bottom - top) < y < top + 0.6 * (bottom - top)]
    left = int(np.median([xs[ys == y].min() for y in rows]))
    right = int(np.median([xs[ys == y].max() for y in rows]))
    core[:, :max(left - 2, 0)] = False
    core[:, right + 3:] = False
    return largest(core), left, right


def repaint_base(photo, box, ref_source, strip):
    """The photo with the black base inside box repainted like the bronze base in ref_source."""
    full = np.array(photo)
    with Image.open(SOURCE / ref_source) as im:
        ref = bronze_across(np.asarray(ImageOps.exif_transpose(im).convert('RGB')), strip)
    x0, y0, x1, y1 = box
    rgb = np.ascontiguousarray(full[y0:y1, x0:x1])
    lin = to_linear(rgb / 255.0)
    core, left, right = black_base(rgb)
    inner = cv2.erode(core.astype(np.uint8), disk(2)).astype(bool)
    outer = cv2.dilate(core.astype(np.uint8), disk(4)).astype(bool)
    edge = outer & ~inner
    fore = masked_blur(lin, inner, 3)
    back = masked_blur(lin, ~outer, 6)
    span = fore - back
    share = np.clip(((lin - back) * span).sum(-1) / np.maximum((span * span).sum(-1), 1e-6), 0, 1)
    # where the base meets an equally dark shadow the colours cannot tell them apart: follow the outline instead
    outline = cv2.GaussianBlur(core.astype(np.float32), (0, 0), 1.2)
    trust = np.clip(np.sqrt((span * span).sum(-1)) / 0.04, 0, 1)
    share = trust * share + (1 - trust) * outline
    alpha = np.where(edge, share, inner.astype(float))
    unmixed = (lin - (1 - share[..., None]) * back) / np.maximum(share, 0.5)[..., None]
    fore = np.where(edge[..., None], np.where((share >= 0.5)[..., None], np.clip(unmixed, 0, None), fore), lin)

    # the bronze's light and colour across the cylinder, plus some of the black base's own detail
    u = np.broadcast_to(np.clip((np.arange(rgb.shape[1]) + 0.5 - left) / (right - left), 0, 1), rgb.shape[:2])
    lum_black = np.maximum(fore @ LUMA, 1e-5)
    own = across(np.log(lum_black)[inner][:, None], u[inner])[:, 0]
    pos = np.clip(u * BASE_BINS - 0.5, 0, BASE_BINS - 1)
    at = lambda table: np.interp(pos, np.arange(BASE_BINS), table)
    lum = np.exp(at(ref[:, 0]) + BASE_DETAIL * (np.log(lum_black) - at(own)))
    paint = np.stack([at(ref[:, c]) for c in (1, 2, 3)], -1) * lum[..., None]
    peak = paint.max(-1, keepdims=True)
    luma = np.minimum(paint @ LUMA, 1.0)[..., None]
    fade = np.clip((peak - 1) / np.maximum(peak - luma, 1e-6), 0, 1)
    paint = paint * (1 - fade) + luma * fade
    full[y0:y1, x0:x1] = (to_srgb(lin + alpha[..., None] * (paint - fore)) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(full)


def export_recolors(force):
    todo = {name: colour for name, colour in RECOLORS.items() if force or not (OUT / name).exists()}
    if not todo:
        return
    palette = {c['id']: c['hex'] for c in json.loads((ROOT / 'products.json').read_text(encoding='utf-8'))['print3d']['colors']}
    source, top = RECOLOR_FROM
    square, icc, top = load_square(source, top)
    lin, alpha, fore, inner = stand_matte(np.asarray(square))
    lit = np.percentile((lin @ LUMA)[inner], 90)
    for name, colour in todo.items():
        hexc = palette.get(colour, colour)
        save(repaint(lin, alpha, fore, lit, hexc), icc, name, f'{source} (top {top}), stand painted {colour} {hexc}')


def export_videos(force):
    for name, source in VIDEOS.items():
        dest = OUT / name
        if dest.exists() and not force:
            continue
        probe = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,bit_rate', '-of', 'json', str(SOURCE / source)]
        info = json.loads(subprocess.run(probe, capture_output=True, text=True, check=True).stdout)
        duration = float(info['format']['duration'])
        sound = sum(int(s.get('bit_rate', 0)) for s in info['streams'] if s['codec_type'] == 'audio')
        bitrate = int(MAX_VIDEO_BYTES * 8 / duration - sound - 40_000)  # 40 kbit/s for the MP4 container
        with tempfile.TemporaryDirectory() as tmp:
            # -map_metadata -1: the editing app's notes (template, phone, encoder) are not copied
            encode = ['ffmpeg', '-v', 'error', '-y', '-i', str(SOURCE / source), '-map_metadata', '-1', '-map', '0:v:0',
                      '-c:v', 'libx264', '-preset', 'slow', '-b:v', str(bitrate), '-pix_fmt', 'yuv420p',
                      '-passlogfile', str(Path(tmp) / 'x264')]
            subprocess.run(encode + ['-pass', '1', '-an', '-f', 'null', '-'], check=True)
            subprocess.run(encode + ['-pass', '2', '-map', '0:a?', '-c:a', 'copy', '-movflags', '+faststart', str(dest)], check=True)
        size = dest.stat().st_size
        if size > 30_000_000:
            raise SystemExit(f'{name}: {size:,} bytes, over 30 MB; lower MAX_VIDEO_BYTES')
        print(f'{name}: {duration:.1f} s, video {bitrate // 1000} kbit/s + sound copied, {size:,} bytes  <- {source}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--force', action='store_true', help='Replace earlier exports; never source media.')
    force = parser.parse_args().force
    export_photos(force)
    export_recolors(force)
    export_videos(force)
