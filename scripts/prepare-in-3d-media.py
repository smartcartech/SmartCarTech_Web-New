"""Export the In 3D photos and footage (in-3d.html) for the static website.

Photos are the shop's phone shots, portrait, in "source image and video/In 3D/". They are used as
filmed: no crop, no colour change. Each one is turned upright (EXIF orientation) and saved as WebP at
1080, 640 and 324 px wide in assets/img/in-3d/. The WebP files carry no EXIF, so no camera or location
data goes online. The page crops the small tiles with CSS ("focus" in products.json → print3d), and
the viewer shows the whole photo.

Videos have no sound and keep the filmed colour: 720 x 1280, 30 fps, H.264, like the SC Tech Pro clips.
- bang-ten: the one hand-held take of the two plates, trimmed, with a short fade in and out.
- gia-do-dien-thoai: re-cut from the shop's CapCut edit. The template effects (sparkle intro, flashes,
  dark and blur transitions) are dropped, and so is the laptop screen showing the 3D model with a
  name on it. The real shots are joined with short crossfades in story order: printer → fresh print →
  engraved name → unfolding → phone on the stand → the three colours.
- may-in-3d (still photo, not a clip): one frame of the printer from that edit, for the
  "In theo file" card.

Requires Pillow, ffmpeg and ffprobe. Originals are never overwritten. Run from any directory:
    python scripts/prepare-in-3d-media.py [--images-only | --videos-only | --posters-only] [--force]
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
SOURCE = ROOT / 'source image and video' / 'In 3D'
IMAGES = ROOT / 'assets' / 'img' / 'in-3d'
VIDEOS = ROOT / 'assets' / 'video' / 'in-3d'

STAND_EDIT = 'Gia do dien thoai/lv_7692578897409395974_20261016223248_1.mp4'  # the shop's CapCut edit, 19.5 s

# name: source photo in SOURCE, then what it shows
PHOTOS = {
    'bang-ten-hong-va-den': 'Bang ten/20261016_230611_1.jpg',  # pink and black "Thủy Phương" plates in the hand
    'bang-ten-hong': 'Bang ten/20261016_230432_1.jpg',         # pink plate: TikTok icon, name, bow
    'gia-do-ba-mau': 'Gia do dien thoai/20261015_222244_1.jpg',               # three folded stands with names
    'gia-do-ba-mau-mo': 'Gia do dien thoai/20261015_222357_1.jpg',            # the three stands opened
    'gia-do-xanh-mo': 'Gia do dien thoai/20261015_172508_1.jpg',              # blue stand opened, close-up
    'gia-do-dung-dien-thoai': 'Gia do dien thoai/20261015_172607_1.jpg',      # phone upright on it, front
    'gia-do-dien-thoai-nghieng': 'Gia do dien thoai/20261015_172532_1.jpg',   # phone leaning on it, side
    'gia-do-ba-mau-dien-thoai': 'Gia do dien thoai/20261015_222426_1.jpg',    # three stands, phone on the blue one
    'gia-do-gap-canh-dien-thoai': 'Gia do dien thoai/20261015_172437_1.jpg',  # folded beside a phone: its size
}
# Not used: Gia do dien thoai/20261015_172545_1.jpg (phone from behind, stand hidden) and
# 20261015_222502_1.jpg (same scene as 222426).

# name: (clip in SOURCE, second): a still photo taken from a video frame
STILLS = {
    'may-in-3d': (STAND_EDIT, 11.0),  # the printer with its AMS lite and pink filament
}

VIDEO_EDITS = {
    'bang-ten': {
        'segments': [
            ('Bang ten/20261016_230940_1.mp4', 0.1, 7.0),  # both plates held in front of the aquarium
        ],
        'poster': 2.0,
    },
    'gia-do-dien-thoai': {
        'segments': [
            (STAND_EDIT, 10.5, 12.1),   # the printer, AMS lite with pink filament
            (STAND_EDIT, 0.8, 1.7),     # blue stand on the print bed (sparkle intro dropped)
            (STAND_EDIT, 4.0, 5.45),    # folded stand in the hand: "SƠN PHAN" engraved
            (STAND_EDIT, 8.0, 10.15),   # unfolding it
            (STAND_EDIT, 6.1, 7.25),    # phone resting on it, side view
            (STAND_EDIT, 15.6, 16.8),   # phone on the stand, wider, hands out of frame
            (STAND_EDIT, 13.0, 14.0),   # pink, orange and blue stands on the desk
        ],
        'poster': 3.6,
    },
}
CROSSFADE = 0.3

# Detailed backgrounds (plants, gravel): a little lower quality than the dark studio photos
SIZES = [('', 1080, 82), ('-640', 640, 80), ('-thumb', 324, 78)]


def save_webp(name, photo):
    for suffix, width, quality in SIZES:
        dest = IMAGES / f'{name}{suffix}.webp'
        scaled = photo.resize((width, round(photo.height * width / photo.width)), Image.Resampling.LANCZOS)
        scaled.save(dest, 'WEBP', quality=quality, method=6)  # no exif= : camera and location data stay offline
        print(f'  {dest.relative_to(ROOT)}: {scaled.width}x{scaled.height}, {dest.stat().st_size:,} bytes')


def export_images(force, ffmpeg):
    IMAGES.mkdir(parents=True, exist_ok=True)
    def done(name):
        return not force and all((IMAGES / f'{name}{suffix}.webp').exists() for suffix, _, _ in SIZES)

    for name, source in PHOTOS.items():
        if done(name):
            continue
        with Image.open(SOURCE / source) as im:
            photo = ImageOps.exif_transpose(im).convert('RGB')
        print(f'{source}: {photo.width}x{photo.height}')
        save_webp(name, photo)

    for name, (source, second) in STILLS.items():
        if done(name):
            continue
        with tempfile.TemporaryDirectory(prefix=f'{name}-') as tmp:
            frame = Path(tmp) / 'frame.png'
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(second),
                            '-i', str(SOURCE / source), '-frames:v', '1', str(frame)], check=True)
            with Image.open(frame) as im:
                photo = im.convert('RGB')
        print(f'{source} @ {second}s: {photo.width}x{photo.height}')
        save_webp(name, photo)


def duration(ffprobe, path):
    return float(subprocess.check_output([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)]))


def render(ffmpeg, ffprobe, name, edit, dest):
    with tempfile.TemporaryDirectory(prefix=f'{name}-') as tmp:
        parts = []
        for i, (source, start, end) in enumerate(edit['segments']):
            # ffmpeg applies the phone's rotation flag: the plate clip is stored sideways
            part = Path(tmp) / f'part{i}.mp4'
            subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                            '-ss', str(start), '-to', str(end), '-i', str(SOURCE / source),
                            '-vf', 'scale=720:1280:flags=lanczos,hqdn3d=1.0:1.0:2.0:2.0,fps=30,format=yuv420p',
                            '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', str(part)],
                           check=True)
            parts.append(part)

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


def export_videos(ffmpeg, ffprobe, force, posters_only=False, names=None):
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
        audio = any(s['codec_type'] == 'audio' for s in meta['streams'])
        print(f'{dest.relative_to(ROOT)}: {float(meta["format"]["duration"]):.2f}s, '
              f'{v["width"]}x{v["height"]}, {v["codec_name"]}, {"with" if audio else "no"} audio, {dest.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--images-only', action='store_true')
    parser.add_argument('--videos-only', action='store_true')
    parser.add_argument('--posters-only', action='store_true', help='Refresh video cover frames without re-encoding MP4s.')
    parser.add_argument('--force', action='store_true', help='Replace derived outputs only; never source media.')
    parser.add_argument('--video', action='append', choices=VIDEO_EDITS,
                        help='Export only this clip; may be repeated.')
    args = parser.parse_args()
    ffmpeg = shutil.which('ffmpeg')
    ffprobe = shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise SystemExit('ffmpeg and ffprobe must be on PATH.')
    if args.posters_only:
        export_videos(ffmpeg, ffprobe, args.force, posters_only=True, names=args.video)
    else:
        if not args.videos_only:
            export_images(args.force, ffmpeg)
        if not args.images_only:
            export_videos(ffmpeg, ffprobe, args.force, names=args.video)
