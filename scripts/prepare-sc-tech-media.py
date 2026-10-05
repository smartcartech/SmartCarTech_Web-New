"""Export the SC Tech kit photos and footage for the static website.

Every photo is retouched by the shop itself on a dark studio background, like the SC Tech Pro set.
The script only saves each master as WebP at 1536, 640 and 324 px wide in assets/img/sc-tech/:
no crop, no colour change. Masters live in "source image and video/SC Tech/":
- edited/: the two frame kits. The shop's own files were not kept, so these PNGs are lossless copies
  of the published 1536 px photos; drop a better original in under the same name and re-export
  with --images-only --force.
- SC Tech day du/: the full kit, under the camera file names.
The earlier wood-desk retouch, which the shop dropped, is archived in edited/previous-wood-desk/.

Each video joins real clips with a short crossfade. The frame-kit clips get a light colour
correction (brighter, slightly warm desk); those filmed by moving the phone are stabilised, the
hand-held turnarounds are not, as the moving car fills the frame. The flower pot, figurines and
toolbox behind some shots stay (the shop's choice). The full-kit clip is only cut and joined
(the shop's request): its colour is left as filmed.

Requires Pillow, ffmpeg and ffprobe (built with vidstab).
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

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source image and video' / 'SC Tech'
IMAGES = ROOT / 'assets' / 'img' / 'sc-tech'
VIDEOS = ROOT / 'assets' / 'video' / 'sc-tech'

# name: master photo in SOURCE (3:2, already retouched by the shop), then the camera shot it shows
PHOTOS = {
    'khung': 'edited/khung.png',                                                # Khung Xe/20260930_234710.jpg
    'khung-phu-kien': 'edited/khung-phu-kien.png',                              # Khung Xe/20260930_235013.jpg
    'khung-dong-co-banh': 'edited/khung-dong-co-banh.png',                      # Khung Xe_Dong Co_Banh Xe/20260930_233356.jpg
    'khung-dong-co-banh-goc-phai': 'edited/khung-dong-co-banh-goc-phai.png',    # Khung Xe_Dong Co_Banh Xe/20260930_233545.jpg
    'khung-dong-co-banh-mat-ben': 'edited/khung-dong-co-banh-mat-ben.png',      # Khung Xe_Dong Co_Banh Xe/20260930_233618.jpg
    'linh-kien-khung-dong-co-banh': 'edited/linh-kien-khung-dong-co-banh.png',  # Khung Xe_Dong Co_Banh Xe/20260930_225152.jpg
    'xe-day-du': 'SC Tech day du/20261002_181650.png',              # front left, main photo
    'xe-day-du-mat-truoc': 'SC Tech day du/20261002_181706.png',    # front: LEDs, IO Shield, Bluetooth
    'xe-day-du-mat-ben': 'SC Tech day du/20261002_181738.png',      # left side: boards, switch, battery holder
    'xe-day-du-goc-sau': 'SC Tech day du/20261002_181759.png',      # rear left: three 18650 cells
    'xe-day-du-mach-va-pin': 'SC Tech day du/20261002_181858.png',  # from above, front right
}

# Frame-kit clips: brighter, slightly warm desk (desk Lab ≈ 80/1/4.5)
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
    'xe-day-du': {
        'segments': [
            ('SC Tech day du/sc tech day du.mp4', 2.4, 14.3),   # lifted: top, front, then round to the right side
            ('SC Tech day du/sc tech day du.mp4', 17.4, 23.0),  # rear: battery holder, then from above
            ('SC Tech day du/sc tech day du.mp4', 33.5, 35.6),  # set down on the desk, hands out of frame
        ],
        'look': None, 'stabilize': False, 'poster': 17.8,
    },
}
CROSSFADE = 0.4


def export_images(force):
    IMAGES.mkdir(parents=True, exist_ok=True)
    # Smooth dark background compresses well: the same settings as the SC Tech Pro photos
    sizes = [('', 1536, 88), ('-640', 640, 85), ('-thumb', 324, 82)]
    for name, source in PHOTOS.items():
        outputs = [IMAGES / f'{name}{suffix}.webp' for suffix, _, _ in sizes]
        if not force and all(p.exists() for p in outputs):
            continue
        with Image.open(SOURCE / source) as im:
            photo = ImageOps.exif_transpose(im).convert('RGB')
        print(f'{source}: {photo.width}x{photo.height}')
        for (suffix, width, quality), dest in zip(sizes, outputs):
            scaled = photo.resize((width, round(photo.height * width / photo.width)), Image.Resampling.LANCZOS)
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
            look = f'{edit["look"]},' if edit['look'] else ''
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *clip,
                            '-vf', f'{stabilise}scale=1280:720:flags=lanczos,{look}'
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
