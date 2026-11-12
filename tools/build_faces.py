"""표정 조각 목록 만들기: characters/prompts/<코드>-face-<장면>-<표정>.json → data/faces.json
앱(face.js)이 이 목록을 보고 장면 그림 위에 표정 조각을 겹친다.
  python3 tools/build_faces.py
"""
import glob, json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
json.dump(out, open(os.path.join(ROOT, 'data', 'faces.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({c: {b: sorted(v['faces']) for b, v in s.items()} for c, s in out.items()})
