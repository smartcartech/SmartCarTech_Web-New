"""Export the SC Tech kit photos and footage for the static website.

Photos are the shop's own shots on the wooden desk, kept real (no AI background): each one is
cropped to 3:2, its desk/wall brightness and white balance are matched to the rest of the set,
and a little local contrast is added. Retouched masters go to "source image and video/SC Tech/edited/",
web copies to assets/img/sc-tech/ at 1536, 640 and 324 px wide.

Each video joins real clips with a short crossfade, with the colour matched to the photos.
Clips filmed by moving the phone are stabilised; the hand-held turnaround is not, as the moving
car fills the frame. The flower pot, figurines and toolbox behind some shots stay (the shop's choice).

Requires Pillow, numpy, opencv-python, ffmpeg and ffprobe (built with vidstab).
Originals are never overwritten. Run from any directory:
    python scripts/prepare-sc-tech-media.py [--images-only | --videos-only | --posters-only] [--force]
"""
from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source image and video' / 'SC Tech'
MASTERS = SOURCE / 'edited'
IMAGES = ROOT / 'assets' / 'img' / 'sc-tech'
VIDEOS = ROOT / 'assets' / 'video' / 'sc-tech'

# name: (source photo, crop box x0, y0, x1, y1 in source pixels, 3:2 like the SC Tech Pro photos)
PHOTOS = {
    'khung': ('Khung Xe/20260930_234710.jpg', (0, 339, 2252, 1840)),
    'khung-phu-kien': ('Khung Xe/20260930_235013.jpg', (334, 160, 3434, 2227)),
    'khung-dong-co-banh': ('Khung Xe_Dong Co_Banh Xe/20260930_233356.jpg', (0, 280, 2252, 1781)),
    'khung-dong-co-banh-goc-phai': ('Khung Xe_Dong Co_Banh Xe/20260930_233545.jpg', (0, 470, 2252, 1971)),
    'khung-dong-co-banh-mat-ben': ('Khung Xe_Dong Co_Banh Xe/20260930_233618.jpg', (0, 330, 2252, 1831)),
    'linh-kien-khung-dong-co-banh': ('Khung Xe_Dong Co_Banh Xe/20260930_225152.jpg', (0, 8, 3263, 2183)),
}
BG_TARGET = (80.0, 1.0, 4.5)  # Lab of the desk/wall after retouch, the same for every photo

# Brighter desk with the same slight warmth as the photos (measured: desk Lab ≈ 80/1/4.5)
LOOK_COOL = "curves=all='0/0 0.66/0.77 1/1',colorchannelmixer=rr=1:gg=1:bb=0.97"  # desk filmed at L≈70, b≈2.3
LOOK_WARM = "curves=all='0/0 0.70/0.77 1/1',colorchannelmixer=rr=1:gg=1:bb=0.99"  # turnaround, already warmer
VIDEO_EDITS = {
    'linh-kien-khung-dong-co-banh': {
        'segments': [
            ('Khung Xe_Dong Co_Banh Xe/20260930_224822.mp4', 0.2, 7.9),  # zoom out over the parts
            ('Khung Xe_Dong Co_Banh Xe/20260930_225004.mp4', 3.0, 8.0),  # slow move around the layout
        ],
        'look': LOOK_COOL, 'stabilize': True, 'poster': 6.0,
    },
    'khung-dong-co-banh': {
        'segments': [
            ('Khung Xe_Dong Co_Banh Xe/20260930_232827.mp4', 0.3, 9.2),   # on the desk, lifted: side and front
            ('Khung Xe_Dong Co_Banh Xe/20260930_232827.mp4', 13.0, 17.6),  # other side and rear
        ],
        'look': LOOK_WARM, 'stabilize': False, 'poster': 1.0,
    },
    'khung': {
        'segments': [
            ('Khung Xe/20260930_235238.mp4', 0.2, 2.9),  # whole frame with the accessories
            ('Khung Xe/20260930_235320.mp4', 0.3, 7.4),  # two decks and standoffs up close, then pull back
        ],
        'look': LOOK_COOL, 'stabilize': True, 'poster': 1.3,
    },
}
CROSSFADE = 0.4


def srgb_to_linear(f):
    return np.where(f <= 0.04045, f / 12.92, ((f + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(f):
    f = np.clip(f, 0, 1)
    return np.where(f <= 0.0031308, f * 12.92, 1.055 * f ** (1 / 2.4) - 0.055)


def lab_to_y(lightness):
    return np.where(lightness > 8, ((lightness + 16) / 116) ** 3, lightness / 903.3)


def retouch(rgb8):
    """Match exposure and white balance of the desk/wall to BG_TARGET, then add gentle local contrast."""
    f = rgb8.astype(np.float32) / 255
    small = cv2.cvtColor(cv2.resize(f, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2Lab)
    sl, sa, sb = cv2.split(small)
    bg = (sl > 60) & (np.hypot(sa, sb) < 30)  # bright, low-chroma pixels: the desk and the wall
    l_med, a_med, b_med = (float(np.median(c[bg])) for c in (sl, sa, sb))

    # Exposure in linear light, with a soft shoulder instead of clipping highlights
    lin = srgb_to_linear(f) * (lab_to_y(BG_TARGET[0]) / lab_to_y(l_med))
    lin = lin / (1 + np.maximum(lin - 0.9, 0) * 2)
    lab = cv2.cvtColor(linear_to_srgb(lin).astype(np.float32), cv2.COLOR_RGB2Lab)
    L, a, b = cv2.split(lab)

    # The same small white-balance shift everywhere: a few Lab units, the yellow wheels stay yellow
    a += BG_TARGET[1] - a_med
    b += BG_TARGET[2] - b_med

    # Local contrast, mostly in the midtones: depth on the black acrylic and the tyres
    detail = L - cv2.GaussianBlur(L, (0, 0), 20)
    mid = np.clip(1 - np.abs(L - 50) / 50, 0, 1)
    L = np.clip(L + 0.25 * detail * (0.4 + 0.6 * mid), 0, 100)
    out = cv2.cvtColor(cv2.merge([L, a, b]), cv2.COLOR_Lab2RGB)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), (l_med, a_med, b_med)


def export_images(force):
    MASTERS.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    # Real wood grain costs bytes: q82 keeps the 1536px copy near 140 KB without visible loss
    sizes = [('', 1536, 82), ('-640', 640, 85), ('-thumb', 324, 82)]
    for name, (source, box) in PHOTOS.items():
        master = MASTERS / f'{name}.png'
        outputs = [IMAGES / f'{name}{suffix}.webp' for suffix, _, _ in sizes]
        if not force and master.exists() and all(p.exists() for p in outputs):
            continue
        with Image.open(SOURCE / source) as im:
            rgb = np.asarray(ImageOps.exif_transpose(im).convert('RGB'))
        x0, y0, x1, y1 = box
        retouched, before = retouch(rgb[y0:y1, x0:x1])
        edited = Image.fromarray(retouched)
        edited.save(master)
        print(f'{master.relative_to(ROOT)}: {edited.width}x{edited.height}, desk/wall before Lab '
              f'{before[0]:.1f}/{before[1]:.1f}/{before[2]:.1f}')
        for (suffix, width, quality), dest in zip(sizes, outputs):
            scaled = edited.resize((width, round(edited.height * width / edited.width)), Image.Resampling.LANCZOS)
            scaled.save(dest, 'WEBP', quality=quality, method=6)
            print(f'  {dest.relative_to(ROOT)}: {scaled.width}x{scaled.height}, {dest.stat().st_size:,} bytes')


def duration(ffprobe, path):
    return float(subprocess.check_output([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)]))


def render(ffmpeg, ffprobe, name, edit, dest):
    with tempfile.TemporaryDirectory(prefix=f'{name}-') as tmp:
        parts = []
        for i, (source, start, end) in enumerate(edit['segments']):
            # ffmpeg applies the phone's rotation flag (the Khung Xe clips were filmed upside down)
            clip = ['-ss', str(start), '-to', str(end), '-i', str(SOURCE / source)]
            stabilise = ''
            if edit['stabilize']:
                # vidstab reads/writes its transforms relative to cwd: Windows paths break filter arguments
                subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *clip,
                                '-vf', 'vidstabdetect=shakiness=6:accuracy=15:result=motion.trf', '-f', 'null', '-'],
                               check=True, cwd=tmp)
                stabilise = 'vidstabtransform=input=motion.trf:smoothing=20:optzoom=1:interpol=bicubic,'
            part = f'part{i}.mp4'
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *clip,
                            '-vf', f'{stabilise}scale=1280:720:flags=lanczos,{edit["look"]},'
                                   'hqdn3d=1.0:1.0:2.0:2.0,fps=30,format=yuv420p',
                            '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', part],
                           check=True, cwd=tmp)
            parts.append(Path(tmp) / part)

        lengths = [duration(ffprobe, p) for p in parts]
        total = sum(lengths) - CROSSFADE * (len(parts) - 1)
        chain, offset = '[0:v]', 0.0
        filters = []
        for i in range(1, len(parts)):
            offset += lengths[i - 1] - CROSSFADE
            filters.append(f'{chain}[{i}:v]xfade=transition=fade:duration={CROSSFADE}:offset={offset:.3f}[x{i}]')
            chain = f'[x{i}]'
        filters.append(f'{chain}fade=t=in:st=0:d=0.25,fade=t=out:st={total - 0.25:.3f}:d=0.25,format=yuv420p[v]')

        # Replace a published clip only after the complete render succeeds
        handle, temp_name = tempfile.mkstemp(prefix=f'{name}-render-', suffix='.mp4', dir=VIDEOS)
        os.close(handle)
        temporary = Path(temp_name)
        try:
            command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y']
            for p in parts:
                command.extend(['-i', str(p)])
            command.extend([
                '-filter_complex', ';'.join(filters), '-map', '[v]', '-an',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-profile:v', 'high', '-level:v', '3.1', '-movflags', '+faststart',
                '-map_metadata', '-1', str(temporary),
            ])
            subprocess.run(command, check=True)
            temporary.replace(dest)
        finally:
            temporary.unlink(missing_ok=True)


def export_videos(force, posters_only=False, names=None):
    ffmpeg = shutil.which('ffmpeg')
    ffprobe = shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise SystemExit('ffmpeg and ffprobe must be on PATH.')
    VIDEOS.mkdir(parents=True, exist_ok=True)
    for name, edit in VIDEO_EDITS.items():
        if names and name not in names:
            continue
        dest = VIDEOS / f'{name}.mp4'
        if posters_only and not dest.exists():
            raise SystemExit(f'Missing clip: {dest.name}. Export videos before refreshing posters.')
        if not posters_only and (force or not dest.exists()):
            render(ffmpeg, ffprobe, name, edit, dest)
        poster = VIDEOS / f'{name}-poster.webp'
        if force or not poster.exists():
            subprocess.run([
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                '-ss', str(edit['poster']), '-i', str(dest), '-frames:v', '1',
                '-vf', 'scale=640:640:force_original_aspect_ratio=decrease',
                '-c:v', 'libwebp', '-quality', '85', str(poster),
            ], check=True)
        meta = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(dest)]))
        v = next(s for s in meta['streams'] if s['codec_type'] == 'video')
        print(f'{dest.relative_to(ROOT)}: {float(meta["format"]["duration"]):.2f}s, '
              f'{v["width"]}x{v["height"]}, {v["codec_name"]}, {dest.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--images-only', action='store_true')
    parser.add_argument('--videos-only', action='store_true')
    parser.add_argument('--posters-only', action='store_true', help='Refresh video cover frames without re-encoding MP4s.')
    parser.add_argument('--force', action='store_true', help='Replace derived outputs only; never source media.')
    parser.add_argument('--video', action='append', choices=VIDEO_EDITS,
                        help='Export only this clip; may be repeated.')
    args = parser.parse_args()
    if args.posters_only:
        export_videos(args.force, posters_only=True, names=args.video)
    else:
        if not args.videos_only:
            export_images(args.force)
        if not args.images_only:
            export_videos(args.force, names=args.video)
