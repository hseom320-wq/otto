"""표정 바꾸기 (NovelAI V4.5 인페인트, 아날스 사용)

장면 그림에서 얼굴 부분만 잘라 표정만 다시 그리고, 바뀐 부분(눈·눈썹·입)만 투명 배경 조각으로 저장한다.
앱은 원래 장면 그림 위에 이 조각을 겹쳐서 표정을 바꾼다 (자세·옷·배경은 그대로).

  python3 tools/expr.py <장면키> [표정 …]        예: python3 tools/expr.py ns-morning smile angry
  장면키·얼굴 위치·프롬프트는 아래 FACES 에 적는다.
출력: assets/<코드>/face/<장면>-<표정>.webp (+ characters/prompts/<코드>-face-<장면>-<표정>.json)
필요: 환경 변수 NOVELAI_TOKEN. 요청 사이에 쉬어 가며 천천히 보낸다.
"""
import base64, io, json, os, random, sys, time, zipfile
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g

ROOT = g.ROOT
MODEL = 'nai-diffusion-4-5-full-inpainting'
STEPS = 29        # 28 이하 + 1024x1024 이하는 무료 생성 칸이라 막혀 있다. 한 단계 더 써서 유료(아날스)로 보낸다
CROP = 704        # 얼굴 주변을 이만큼 잘라서 다시 그린다

# 표정 태그 (앱의 기분 값과 짝: happy·sparkle→smile, angry→angry, sweat→shy, confused→surprised, sleepy→sleepy, 눈 깜빡임→blink)
EXPR = {
    'smile': '1.3::smile::, 1.2::happy::, 1.1::light blush::, curved eyes, eyebrows relaxed',
    'angry': '1.3::annoyed::, 1.3::v-shaped eyebrows::, glaring, frown, narrowed eyes',
    'shy': '1.5::blush::, 1.3::embarrassed::, looking away, wavy mouth, sweatdrop, raised eyebrows',
    'surprised': '1.4::surprised::, 1.3::wide-eyed::, raised eyebrows, small pupils',
    'sleepy': '1.4::sleepy::, 1.3::half-closed eyes::, drooping eyes, tired',
    'blink': '1.6::closed eyes::, eyelashes',
}
# 얼굴 위치 (잘라 낸 칸 안의 좌표). face: 눈썹~턱 다각형, eyes: 눈·눈썹 다각형. blink 는 eyes 만 다시 그린다
FACES = {
    'ns-morning': dict(
        img='assets/ns/scene/morning.webp', prompt='characters/prompts/ns-scene-morning.json', crop=(120, 200),
        eyes=[(120, 300), (250, 240), (470, 170), (500, 280), (270, 370), (125, 385)],
        face=[(118, 300), (250, 245), (300, 238), (470, 178), (500, 275), (440, 330), (400, 420), (335, 470), (240, 455), (175, 420), (125, 385)],
        vibe=None,  # 인페인트에 참고 그림을 넣으면 노벨AI가 500 오류를 낸다
        keep='1girl, solo, short hair, 1.6::black hair::, 1.3::dark hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, '
             '1.2::messy hair::, bedhead, 1.2::portrait::, close-up, head tilt, 1.4::toothbrush in mouth::, holding toothbrush, '
             'looking at viewer, indoors'),
}


def style_prefix(prompt):
    """원본 프롬프트에서 1girl 앞(품질·작가·그림체 태그)과 맨 뒤 꼬리(음수 가중치)를 가져온다."""
    head = prompt[:prompt.index('1girl')]
    tail = prompt[prompt.index('-2::upscaled, blurry::'):]
    return head, tail


def mask_for(f, expr):
    m = Image.new('L', (CROP, CROP), 0)
    d = ImageDraw.Draw(m)
    d.polygon(f['eyes'] if expr == 'blink' else f['face'], fill=255)
    return m


def b64png(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return base64.b64encode(buf.getvalue()).decode()


_vibes = {}
def infill(crop_im, mask, prompt, neg, seed, vibe=None):
    p = {
        'params_version': 3, 'width': CROP, 'height': CROP, 'scale': 6.0, 'sampler': 'k_euler_ancestral', 'steps': STEPS,
        'n_samples': 1, 'seed': seed, 'cfg_rescale': 0.5, 'noise_schedule': 'karras', 'ucPreset': 4, 'qualityToggle': False,
        'dynamic_thresholding': False, 'controlnet_strength': 1, 'legacy': False, 'add_original_image': True,
        'legacy_v3_extend': False, 'use_coords': False, 'legacy_uc': False, 'normalize_reference_strength_multiple': True,
        'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True, 'characterPrompts': [],
        'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True},
        'v4_negative_prompt': {'caption': {'base_caption': neg, 'char_captions': []}, 'legacy_uc': False},
        'negative_prompt': neg,
        'image': b64png(crop_im.convert('RGB')), 'mask': b64png(mask.convert('RGB')),
        'strength': 1, 'noise': 0, 'inpaintImg2ImgStrength': 1, 'extra_noise_seed': seed,
    }
    if vibe:  # 원래 캐릭터 그림을 참고로 줘서 머리색·얼굴을 맞춘다
        # 인페인트는 미리 인코딩한 바이브 대신 그림을 그대로 받는다
        if vibe not in _vibes: _vibes[vibe] = b64png(Image.open(os.path.join(ROOT, 'characters', 'vibes', vibe + '.webp')).convert('RGB'))
        p.update({'reference_image_multiple': [_vibes[vibe]], 'reference_strength_multiple': [0.5],
                  'reference_information_extracted_multiple': [1.0]})
    data = g.post('/ai/generate-image', {'input': prompt, 'model': MODEL, 'action': 'infill', 'parameters': p})
    z = zipfile.ZipFile(io.BytesIO(data))
    return Image.open(io.BytesIO(z.read(z.namelist()[0]))).convert('RGB')


def make(key, expr):
    f = FACES[key]
    code, scene = key.split('-', 1)
    base = Image.open(os.path.join(ROOT, f['img'])).convert('RGB')
    x0, y0 = f['crop']
    crop_im = base.crop((x0, y0, x0 + CROP, y0 + CROP))
    src = json.load(open(os.path.join(ROOT, f['prompt'])))
    head, tail = style_prefix(src['prompt'])
    prompt = f"{head}{f['keep']}, {EXPR[expr]}, {tail}"
    neg = src['negative'] + ', 1.5::grey hair::, 1.4::brown hair::, 1.4::blonde hair::, 1.3::light hair::' + (', 1.3::open eyes::' if expr == 'blink' else '')
    mask = mask_for(f, expr)
    seed = random.randint(1, 2**32 - 1)
    # 노벨AI는 다시 그린 칸의 가장자리에 회색 띠를 남긴다. 그래서 칸은 넉넉히 넓혀 다시 그리고, 붙일 때는 안쪽만 쓴다
    out = infill(crop_im, mask.filter(ImageFilter.MaxFilter(25)), prompt, neg, seed, f.get('vibe'))
    if out.size != crop_im.size:
        out = out.resize(crop_im.size, Image.LANCZOS)
    if os.environ.get('PREVIEW_DIR'): out.save(os.path.join(os.environ['PREVIEW_DIR'], f'{key}-{expr}-raw.png'))
    out = match_color(crop_im, out, mask.filter(ImageFilter.MaxFilter(25)))
    # 붙일 조각: 바뀐 부분만, 가장자리는 부드럽게
    alpha = mask.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(6))  # 안쪽만, 경계는 부드럽게
    patch = out.convert('RGBA'); patch.putalpha(alpha)
    bx = alpha.getbbox()
    patch = patch.crop(bx)
    d = os.path.join(ROOT, 'assets', code, 'face'); os.makedirs(d, exist_ok=True)
    name = f'{scene}-{expr}'
    patch.save(os.path.join(d, name + '.webp'), 'WEBP', quality=90, method=6)
    meta = {'character': code, 'scene': scene, 'expression': expr, 'source': f'NovelAI Diffusion V4.5 ({MODEL})',
            'based_on': f['img'], 'seed': seed, 'steps': STEPS, 'crop': [x0, y0, CROP, CROP],
            'patch': {'x': x0 + bx[0], 'y': y0 + bx[1], 'w': bx[2] - bx[0], 'h': bx[3] - bx[1]},
            'prompt': prompt, 'negative': neg}
    json.dump(meta, open(os.path.join(ROOT, 'characters', 'prompts', f'{code}-face-{name}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 확인용 미리보기 (원본 위에 붙인 얼굴 부분)
    prev = crop_im.copy(); prev.paste(out, (0, 0), alpha)
    return meta, prev


def match_color(src, out, region):
    """다시 그린 칸 안에서 결과의 색 분포(채널별 평균·표준편차)를 원본에 맞춘다. 노벨AI 결과가 뿌옇게 밝아지는 걸 잡는다."""
    import numpy as np
    a = np.asarray(src, dtype=np.float32); r = np.asarray(out, dtype=np.float32).copy()
    m = np.asarray(region) > 127
    for c in range(3):
        ma, sa = a[..., c][m].mean(), a[..., c][m].std()
        mr, sr = r[..., c][m].mean(), r[..., c][m].std() or 1
        r[..., c][m] = (r[..., c][m] - mr) * (sa / sr) + ma
    return Image.fromarray(np.clip(r, 0, 255).astype('uint8'))


if __name__ == '__main__':
    key = sys.argv[1]
    exprs = sys.argv[2:] or list(EXPR)
    prevdir = os.environ.get('PREVIEW_DIR')
    for i, e in enumerate(exprs):
        if i: time.sleep(20)  # 천천히
        meta, prev = make(key, e)
        if prevdir: prev.save(os.path.join(prevdir, f'{key}-{e}.png'))
        print('ok', key, e, meta['patch'], flush=True)
