"""표정 조각 목록 만들기: characters/prompts/<코드>-face-<장면>-<표정>.json → data/faces.json
앱(face.js)이 이 목록을 보고 장면 그림 위에 표정 조각을 겹친다.

장면에 반복 영상(<그림>.mp4)이 있으면, 영상 위에 잠깐 덮는 원래 그림과 표정 조각의 색을
영상 첫 장면에 맞춘 판(…-v.webp)도 만든다. 영상과 그림의 밝기·색이 조금 달라서
표정이 바뀔 때 화면이 어두워지거나 밝아지는 걸 막는다.
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
    img = os.path.join(ROOT, 'assets', code, 'face', f'{scene}-{expr}.webp')
    if not os.path.exists(img):
        continue
    base = m['based_on']
    w, h = Image.open(os.path.join(ROOT, base)).size
    s = out.setdefault(code, {}).setdefault(base, {'w': w, 'h': h, 'faces': {}})
    s['faces'][expr] = {'img': f'assets/{code}/face/{scene}-{expr}.webp', **m['patch']}

# 영상이 있는 장면: 색을 영상에 맞춘 그림·조각
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
        vs = base[:-5] + '-v.webp'
        apply(still, lut).save(os.path.join(ROOT, vs), 'WEBP', quality=88, method=6)
        s['vstill'] = vs
        for expr, f in s['faces'].items():
            pim = Image.open(os.path.join(ROOT, f['img'])).convert('RGBA')
            rgb = apply(pim.convert('RGB'), lut).convert('RGBA'); rgb.putalpha(pim.getchannel('A'))
            iv = f['img'][:-5] + '-v.webp'
            rgb.save(os.path.join(ROOT, iv), 'WEBP', quality=90, method=6)
            f['img_v'] = iv

json.dump(out, open(os.path.join(ROOT, 'data', 'faces.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({c: {b: (sorted(v['faces']), 'video' if 'vstill' in v else '') for b, v in s.items()} for c, s in out.items()})
