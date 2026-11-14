"""표정 조각 목록 만들기: characters/prompts/<코드>-face-<장면>-<표정>.json → data/faces.json
앱(face.js)이 이 목록을 보고 장면 그림 위에 표정 조각을 겹친다.

장면에 반복 영상(<그림>.mp4)이 있으면, 표정마다 "영상 첫 장면 + 표정"을 짧은 영상(<표정>.mp4)으로 만든다.
앱은 표정을 보여 줄 때 이 영상으로 바꿔서, 영상과 그림의 색 차이로 밝기가 튀는 일이 없다.
  python3 tools/build_faces.py
"""
import glob, json, os
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def video_frame(mp4):
    import cv2
    v = cv2.VideoCapture(mp4); ok, f = v.read()
    return cv2.cvtColor(f, cv2.COLOR_BGR2RGB) if ok else None


def luts(still, frame):
    """원래 그림(영상과 같은 방식으로 꽉 채워 자른 것) → 영상 첫 장면, 채널마다 색 맞춤표(0~255)."""
    H, W = frame.shape[:2]
    k = max(W / still.width, H / still.height)
    s = still.resize((round(still.width * k), round(still.height * k)), Image.LANCZOS)
    x, y = (s.width - W) // 2, (s.height - H) // 2
    a = np.asarray(s.crop((x, y, x + W, y + H)).convert('RGB'))
    out = []
    for c in range(3):
        src = np.sort(a[..., c].ravel()); dst = np.sort(frame[..., c].ravel())
        q = np.linspace(0, len(src) - 1, 257).astype(int)
        xs, ys = src[q].astype(float), dst[q].astype(float)
        xs, idx = np.unique(xs, return_index=True); ys = ys[idx]
        lut = np.interp(np.arange(256), xs, ys)
        out.append(np.clip(lut, 0, 255).astype(np.uint8))
    return out


def apply(im, lut):
    a = np.asarray(im).copy()
    for c in range(3):
        a[..., c] = lut[c][a[..., c]]
    return Image.fromarray(a)


out = {}
for p in sorted(glob.glob(os.path.join(ROOT, 'characters', 'prompts', '*-face-*.json'))):
    m = json.load(open(p, encoding='utf-8'))
    code, scene, expr = m['character'], m['scene'], m['expression']
    if expr == 'surprised':
        continue  # 놀람은 눈이 원래 그림과 너무 달라져서 쓰지 않는다
    img = os.path.join(ROOT, 'assets', code, 'face', f'{scene}-{expr}.webp')
    if not os.path.exists(img):
        continue
    base = m['based_on']
    w, h = Image.open(os.path.join(ROOT, base)).size
    s = out.setdefault(code, {}).setdefault(base, {'w': w, 'h': h, 'faces': {}})
    s['faces'][expr] = {'img': f'assets/{code}/face/{scene}-{expr}.webp', **m['patch']}

# 영상이 있는 장면: 표정마다 "영상 첫 장면 + 표정"을 짧은 영상으로 만든다.
# 폰은 영상과 그림의 색을 다르게 그려서, 영상 위에 그림을 덮으면 밝기가 튄다. 표정도 영상으로 만들면 같은 방식으로 그려져서 똑같다.
import subprocess
def encode(rgb, out):
    h, w = rgb.shape[:2]
    p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', '24', '-i', '-',
                          '-frames:v', '12', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    p.stdin.write(rgb.tobytes() * 12); p.stdin.close(); p.wait()
for code, scenes in out.items():
    for base, s in scenes.items():
        mp4 = os.path.join(ROOT, base[:-5] + '.mp4')
        if not os.path.exists(mp4):
            continue
        frame = video_frame(mp4)
        if frame is None:
            continue
        still = Image.open(os.path.join(ROOT, base)).convert('RGB')
        lut = luts(still, frame)
        H, W = frame.shape[:2]
        k = max(W / still.width, H / still.height)
        cx, cy = (still.width * k - W) / 2, (still.height * k - H) / 2
        fdir = os.path.join(ROOT, 'assets', code, 'face')
        for expr, f in s['faces'].items():
            pim = Image.open(os.path.join(ROOT, f['img'])).convert('RGBA')
            rgb = apply(pim.convert('RGB'), lut).convert('RGBA'); rgb.putalpha(pim.getchannel('A'))
            rgb = rgb.resize((max(1, round(pim.width * k)), max(1, round(pim.height * k))), Image.LANCZOS)
            canvas = Image.fromarray(frame).convert('RGBA')
            canvas.alpha_composite(rgb, (round(f['x'] * k - cx), round(f['y'] * k - cy)))
            name = os.path.basename(f['img'])[:-5]
            vout = os.path.join(fdir, f'{name}.mp4')
            encode(np.asarray(canvas.convert('RGB')), vout)
            f['vid'] = os.path.relpath(vout, ROOT)
        s['video'] = os.path.relpath(mp4, ROOT)

json.dump(out, open(os.path.join(ROOT, 'data', 'faces.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({c: {b: (sorted(v['faces']), 'video' if 'video' in v else '') for b, v in s.items()} for c, s in out.items()})
