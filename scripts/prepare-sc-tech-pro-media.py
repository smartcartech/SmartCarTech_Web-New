"""Export selected, retouched masters and real footage for the static website.

Requires Pillow, ffmpeg and ffprobe. Originals are never overwritten.
Only shots recorded without a green background are used.
Run from any directory: python scripts/prepare-sc-tech-pro-media.py
"""
from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source image and video' / 'SC Tech Pro'
MASTERS = SOURCE / 'edited'
IMAGES = ROOT / 'assets' / 'img' / 'sc-tech-pro'
VIDEOS = ROOT / 'assets' / 'video' / 'sc-tech-pro'
IMAGE_NAMES = (
    'toan-canh', 'mat-truoc', 'mat-sau', 'mach-va-pin',
    'khung-dong-co-banh', 'linh-kien-khung-dong-co-banh',
    'khung', 'linh-kien-khung',
)
VIDEO_EDITS = {
    'cau-tao': [
        ('SC Tech Pro day du/video 3.mp4', 1.0, 4.5),
        ('SC Tech Pro day du/video 3.mp4', 7.0, 9.5),
        ('SC Tech Pro day du/video 3.mp4', 17.7, 21.5),
    ],
    'khung': [
        ('Khung Xe/video 1.mp4', 2.2, 10.2),
        ('Khung Xe/video 1.mp4', 15.2, 19.2),
        ('Khung Xe/video 1.mp4', 24.0, 27.0),
    ],
}
POSTER_TIMES = {'cau-tao': 0.8, 'khung': 5.3}


def export_images(force):
    IMAGES.mkdir(parents=True, exist_ok=True)
    for name in IMAGE_NAMES:
        master = MASTERS / f'{name}.png'
        if not master.exists():
            print(f'Missing edited master, skipped: {master.name}')
            continue
        with Image.open(master) as im:
            im = im.convert('RGB')
            # Format conversion and downscaling only. Retouching is in the master.
            for suffix, max_width, quality in [('', 1536, 88), ('-640', 640, 85), ('-thumb', 324, 82)]:
                dest = IMAGES / f'{name}{suffix}.webp'
                if dest.exists() and not force:
                    continue
                width = min(max_width, im.width)
                scaled = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
                scaled.save(dest, 'WEBP', quality=quality, method=6)
                print(f'{dest.relative_to(ROOT)}: {scaled.width}x{scaled.height}, {dest.stat().st_size:,} bytes')


def export_videos(force, names=None, posters_only=False):
    ffmpeg = shutil.which('ffmpeg')
    ffprobe = shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise SystemExit('ffmpeg and ffprobe must be on PATH.')
    VIDEOS.mkdir(parents=True, exist_ok=True)
    for name, segments in VIDEO_EDITS.items():
        if names and name not in names:
            continue
        dest = VIDEOS / f'{name}.mp4'
        if posters_only and not dest.exists():
            raise SystemExit(f'Missing clip: {dest.name}. Export videos before refreshing posters.')
        if not posters_only and (not dest.exists() or force):
            prepared = [(SOURCE / source, start, end) for source, start, end in segments]
            inputs = list(dict.fromkeys(s[0] for s in prepared))
            command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y']
            for source in inputs:
                command.extend(['-i', str(source)])
            filters = []
            duration = sum(end - start for _, start, end in segments)
            for i, (source, start, end) in enumerate(prepared):
                source_index = inputs.index(source)
                filters.append(f'[{source_index}:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,setsar=1[s{i}]')
            joins = ''.join(f'[s{i}]' for i in range(len(segments)))
            filters.append(
                f'{joins}concat=n={len(segments)}:v=1:a=0,'
                'eq=brightness=0.008:contrast=1.025:saturation=0.90:gamma=1.03,'
                'hqdn3d=1.0:1.0:2.0:2.0,'
                f'fade=t=in:st=0:d=0.25,fade=t=out:st={duration - 0.25:.3f}:d=0.25,'
                'fps=30,format=yuv420p[v]'
            )
            # Replace a published derivative only after the complete render succeeds.
            handle, temp_name = tempfile.mkstemp(prefix=f'{name}-render-', suffix='.mp4', dir=VIDEOS)
            os.close(handle)
            temporary = Path(temp_name)
            try:
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
        poster = VIDEOS / f'{name}-poster.webp'
        if not poster.exists() or force:
            subprocess.run([
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-y' if force else '-n',
                '-ss', str(POSTER_TIMES[name]), '-i', str(dest), '-frames:v', '1',
                '-vf', 'scale=640:640:force_original_aspect_ratio=decrease',
                '-c:v', 'libwebp', '-quality', '85', str(poster),
            ], check=True)
        meta = json.loads(subprocess.check_output([
            ffprobe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(dest),
        ]))
        v = next(s for s in meta['streams'] if s['codec_type'] == 'video')
        print(f'{dest.relative_to(ROOT)}: {meta["format"]["duration"]}s, '
              f'{v["width"]}x{v["height"]}, {v["codec_name"]}, {dest.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--images-only', action='store_true')
    parser.add_argument('--videos-only', action='store_true')
    parser.add_argument('--posters-only', action='store_true',
                        help='Refresh video cover frames without re-encoding MP4s.')
    parser.add_argument('--force', action='store_true', help='Replace derived outputs only; never source media.')
    parser.add_argument('--video', action='append', choices=VIDEO_EDITS,
                        help='Export only this clip; may be repeated.')
    args = parser.parse_args()
    if args.posters_only:
        export_videos(args.force, args.video, posters_only=True)
    else:
        if not args.videos_only:
            export_images(args.force)
        if not args.images_only:
            export_videos(args.force, args.video)
