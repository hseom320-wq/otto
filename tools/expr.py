"""표정 바꾸기 (NovelAI 감정 바꾸기 · Director Tools, 아날스 사용. 예전 인페인트 방식 make()도 남겨 둠)

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
        img='assets/ns/scene/morning.webp', prompt='characters/prompts/ns-scene-morning.json', crop=(120, 200), hint='toothbrush in mouth',
        eyes=[(120, 300), (250, 240), (470, 170), (500, 280), (270, 370), (125, 385)],
        face=[(118, 300), (250, 245), (300, 238), (470, 178), (500, 275), (440, 330), (400, 420), (335, 470), (240, 455), (175, 420), (125, 385)],
        vibe=None,  # 인페인트에 참고 그림을 넣으면 노벨AI가 500 오류를 낸다
        keep='1girl, solo, short hair, 1.6::black hair::, 1.3::dark hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, '
             '1.2::messy hair::, bedhead, 1.2::portrait::, close-up, head tilt, 1.4::toothbrush in mouth::, holding toothbrush, '
             'looking at viewer, indoors'),
    'ns-day': dict(
        img='assets/ns/scene/day.webp', prompt='characters/prompts/ns-scene-day.json', crop=(376, 368),
        eyes=[(295, 205), (400, 195), (440, 320), (665, 345), (665, 435), (520, 435), (400, 335), (295, 325)],
        face=[(290, 200), (405, 190), (520, 300), (665, 345), (665, 445), (560, 455), (470, 520), (380, 525), (318, 470), (288, 330)],
        vibe=None,
        keep='1girl, solo, short hair, 1.6::black hair::, 1.3::dark hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, '
             '1.4::glasses::, 1.3::round eyewear::, black-framed eyewear, 1.2::portrait::, close-up, head tilt, dutch angle, '
             'looking at viewer, looking over eyewear, indoors'),
    'ns-evening': dict(
        img='assets/ns/scene/evening.webp', prompt='characters/prompts/ns-scene-evening.json', crop=(98, 128),
        eyes=[(178, 318), (300, 285), (370, 228), (532, 222), (538, 322), (300, 405), (182, 405)],
        face=[(178, 318), (290, 280), (370, 228), (532, 220), (540, 322), (470, 425), (412, 485), (318, 485), (228, 442), (178, 400)],
        vibe=None,
        keep='1girl, solo, short hair, 1.6::black hair::, 1.3::dark hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, '
             'bartender, white dress shirt, black bow tie, 1.2::portrait::, close-up, head tilt, looking down at viewer, indoors, bar, dim lighting'),
    'ns-night': dict(
        img='assets/ns/scene/night.webp', prompt='characters/prompts/ns-scene-night.json', crop=(0, 288),
        eyes=[(118, 280), (265, 248), (380, 212), (542, 198), (552, 300), (300, 360), (120, 362)],
        face=[(118, 280), (260, 248), (380, 212), (542, 198), (552, 300), (472, 422), (420, 485), (298, 495), (198, 432), (118, 362)],
        vibe=None,
        keep='1girl, solo, short hair, 1.6::black hair::, 1.3::dark hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, '
             'white hoodie, 1.2::portrait::, close-up, looking up at viewer, from above, indoors, dark room, screen light'),
    # 태블릿(가로) 그림 — 감정 바꾸기용이라 얼굴 범위(face)와 자를 자리(crop)만 적는다
    'ns-wide_morning': dict(img='assets/ns/scene-wide/morning.webp', crop=(1088, 168), hint='blue toothbrush in mouth, blue eyes',
        face=[(175, 270), (300, 258), (420, 330), (522, 372), (518, 452), (440, 505), (350, 545), (250, 532), (188, 470), (163, 380)]),
    'ns-wide_day': dict(img='assets/ns/scene-wide/day.webp', crop=(1188, 168),
        face=[(28, 212), (160, 222), (342, 268), (352, 342), (300, 402), (220, 428), (130, 422), (58, 382), (18, 300)]),
    'ns-wide_evening': dict(img='assets/ns/scene-wide/evening.webp', crop=(1028, 208),
        face=[(213, 168), (340, 172), (450, 228), (532, 248), (532, 322), (470, 382), (380, 422), (290, 412), (228, 352), (203, 260)]),
    'ns-wide_night': dict(img='assets/ns/scene-wide/night.webp', crop=(888, 128), hint='blue eyes',
        face=[(213, 318), (380, 318), (480, 298), (622, 288), (627, 382), (570, 472), (480, 552), (380, 572), (288, 522), (223, 430)]),
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


# 표정 → 노벨AI 감정 바꾸기 값
# sleepy 는 'tired'가 눈 밑을 시커멓게 그려서 'bored'(반쯤 감긴 눈)를 쓴다
EMOTION = {'smile': 'happy', 'angry': 'angry', 'shy': 'embarrassed', 'surprised': 'surprised', 'sleepy': 'bored'}
BIG = 1088  # 무료 칸(1024x1024 이하)은 막혀 있어서 조금 키워 보낸다 (아날스 사용)


def emotion(crop_im, emo, defry=0, hint=''):
    """얼굴 주변 그림을 통째로 보내 표정만 바꾼 그림을 받는다. 눈 색·머리·빛은 그대로 유지된다."""
    big = crop_im.resize((BIG, BIG), Image.LANCZOS)
    data = g.post('/ai/augment-image', {'req_type': 'emotion', 'prompt': f'{emo};;{hint}', 'defry': defry,
                                         'width': BIG, 'height': BIG, 'image': b64png(big)})
    try:
        z = zipfile.ZipFile(io.BytesIO(data)); im = Image.open(io.BytesIO(z.read(z.namelist()[0])))
    except zipfile.BadZipFile:
        im = Image.open(io.BytesIO(data))
    return im.convert('RGB').resize(crop_im.size, Image.LANCZOS)


def make_emotion(key, expr):
    f = FACES[key]
    code, scene = key.split('-', 1)
    base = Image.open(os.path.join(ROOT, f['img'])).convert('RGB')
    x0, y0 = f['crop']
    crop_im = base.crop((x0, y0, x0 + CROP, y0 + CROP))
    out = emotion(crop_im, EMOTION[expr], hint=f.get('hint', ''))  # hint: 꼭 남겨야 할 것 (예: 입에 문 칫솔)
    if os.environ.get('PREVIEW_DIR'): out.save(os.path.join(os.environ['PREVIEW_DIR'], f'{key}-{expr}-raw.png'))
    # 얼굴(눈썹~턱) 부분만 넉넉히, 가장자리는 부드럽게 붙인다
    m = Image.new('L', (CROP, CROP), 0); ImageDraw.Draw(m).polygon(f['face'], fill=255)
    alpha = m.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(10))
    patch = out.convert('RGBA'); patch.putalpha(alpha)
    bx = alpha.getbbox(); patch = patch.crop(bx)
    d = os.path.join(ROOT, 'assets', code, 'face'); os.makedirs(d, exist_ok=True)
    name = f'{scene}-{expr}'
    patch.save(os.path.join(d, name + '.webp'), 'WEBP', quality=90, method=6)
    meta = {'character': code, 'scene': scene, 'expression': expr, 'source': 'NovelAI Director Tools (emotion)',
            'emotion': EMOTION[expr], 'based_on': f['img'], 'crop': [x0, y0, CROP, CROP],
            'patch': {'x': x0 + bx[0], 'y': y0 + bx[1], 'w': bx[2] - bx[0], 'h': bx[3] - bx[1]}}
    json.dump(meta, open(os.path.join(ROOT, 'characters', 'prompts', f'{code}-face-{name}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    prev = crop_im.copy(); prev.paste(out, (0, 0), alpha)
    return meta, prev


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
    exprs = sys.argv[2:] or [e for e in EXPR if e != 'blink']
    prevdir = os.environ.get('PREVIEW_DIR')
    for i, e in enumerate(exprs):
        if i: time.sleep(20)  # 천천히
        meta, prev = make_emotion(key, e)
        if prevdir: prev.save(os.path.join(prevdir, f'{key}-{e}.png'))
        print('ok', key, e, meta['patch'], flush=True)
