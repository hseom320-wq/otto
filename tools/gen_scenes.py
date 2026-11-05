"""시간대 장면 그림 만들기 (NovelAI V4.5 Full)

공통 스택(작가·스타일 태그, 네거티브, 설정값)은 각 캐릭터 원본 그림의 메타데이터
(characters/prompts/<코드>-<세트>.json)에서 그대로 가져오고, 구도·장면 부분만 바꾼다.
바이브는 캐릭터당 1장 (characters/vibes/<코드>-<세트>.webp).

  python3 tools/gen_scenes.py gen ns ys        # 새로 뽑기 (640x1408, 무료 범위)
  python3 tools/gen_scenes.py up  <그림.png> ns-night   # 키우기: 832x1792 img2img → 1080x2340

필요: 환경 변수 NOVELAI_TOKEN. 요청은 curl로 보낸다.
"""
import base64, io, json, os, random, subprocess, sys, tempfile, time, zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS = os.path.join(ROOT, 'characters', 'prompts')
API = 'https://image.novelai.net'
MODEL = 'nai-diffusion-4-5-full'
GEN_SIZE = (640, 1408)      # 1:2.2, Opus 무료 범위
UP_SIZE = (832, 1792)       # 키우기 크기 (Anlas 사용)
FINAL = (1080, 2340)        # 갤럭시 S26 화면
UP_STRENGTH = 0.45          # 키우기 때 다시 그리는 정도 (낮을수록 원본 유지)
VIBE_STRENGTH, VIBE_INFO = 0.6, 1.0
CFG_RESCALE = 0.5

SPECS = [
    dict(code='ns', slot='night', base='ns-a', vibe='ns-a',
         label='밤 · 👕후드카고 · 거실 게임하다 패드 든 채 돌아봄',
         fix=[('glowing city lights, neon lights, ', '')],
         scene='cowboy shot, sitting on floor, 1.3::holding game controller::, turning head, looking at viewer, '
               '1.2::smirk::, blush, night, indoors, living room, 1.3::dark room::, 1.3::screen light::, '
               '1.2::light on face::, television, couch, cushion, 1.3::blurry background::'),
    dict(code='ys', slot='day', base='ys-a', vibe='ys-a',
         label='낮 · 🧥깔깔이 · 태블릿 펜 문 채 의자 돌려 봄',
         scene='cowboy shot, sitting on office chair, 1.2::turning around::, 1.3::stylus in mouth::, '
               'holding drawing tablet, looking at viewer, 1.2:::o::, blush, day, indoors, messy room, '
               'computer monitor, cardboard box, curtains, 1.2::sunlight through curtains::, daylight, '
               '1.3::blurry background::'),
    dict(code='hr', slot='morning', base='hr-a', vibe='hr-a',
         label='아침 · 🍳앞치마 · 현관에서 반찬통 내밀기 (실눈)',
         fix=[('1.3::apron::', '1.3::red apron::')],
         scene='cowboy shot, standing, 1.3::holding food container::, tupperware, 1.2::incoming food::, '
               'offering to viewer, looking at viewer, 1.2::light smile::, head tilt, morning, indoors, '
               'entrance, doorway, apartment, 1.3::bright::, daylight, sunlight, light rays, '
               '1.3::blurry background::'),
    dict(code='sy', slot='evening', base='sy-a', vibe='sy-a2',
         label='저녁 · 👔정장 · 퇴근해 문에 기대 머리끈 입에 묾',
         scene='cowboy shot, standing, 1.2::leaning on door::, looking at viewer, bored, tired, evening, '
               'indoors, entrance, doorway, light from doorway, 1.3::blurry background::'),
    dict(code='tr', slot='day', base='tr-b', vibe='tr-b',
         label='낮 · 🧤과외룩 · 과외 가는 길, 장갑 끼며 돌아봄',
         scene='cowboy shot, standing, 1.2::adjusting gloves::, turning head, looking at viewer, '
               '1.2::smirk::, sharp teeth, day, outdoors, city street, sidewalk, winter, sunlight, '
               '1.3::blurry background::'),
]


def post(path, body):
    """curl로 보낸다 (토큰은 표준 입력으로 헤더에만 넣는다)."""
    token = os.environ['NOVELAI_TOKEN']
    with tempfile.TemporaryDirectory() as td:
        bf, of = os.path.join(td, 'body.json'), os.path.join(td, 'out.bin')
        open(bf, 'w').write(json.dumps(body))
        for i in range(4):
            r = subprocess.run(['curl', '-sS', '-o', of, '-w', '%{http_code}', '-X', 'POST', API + path,
                                '-H', 'Content-Type: application/json', '-H', '@-', '--data-binary', '@' + bf,
                                '--max-time', '300'],
                               input=f'Authorization: Bearer {token}\n', capture_output=True, text=True)
            code = int(r.stdout or 0)
            if code == 200:
                return open(of, 'rb').read()
            msg = open(of, 'rb').read()[:300] if os.path.exists(of) else r.stderr
            if code in (0, 429, 500, 502, 503) and i < 3:
                time.sleep(5 * (i + 1)); continue
            raise SystemExit(f'HTTP {code} {path}: {msg}')


def b64png(im):
    buf = io.BytesIO(); im.convert('RGB').save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


def encode_vibe(name):
    im = Image.open(os.path.join(ROOT, 'characters', 'vibes', name + '.webp'))
    v = post('/ai/encode-vibe', {'image': b64png(im), 'information_extracted': VIBE_INFO, 'model': MODEL})
    return base64.b64encode(v).decode()


def build_prompt(base, spec):
    p = base['prompt']
    for a, b in spec.get('fix', []):
        assert a in p, a
        p = p.replace(a, b)
    start, end = p.index('cowboy shot'), p.index('-2::upscaled, blurry::')
    return p[:start] + spec['scene'] + ', ' + p[end:]


def params(meta, size, vibe):
    prompt, neg = meta['prompt'], meta['negative']
    return {
        'params_version': 3, 'width': size[0], 'height': size[1], 'scale': meta['scale'],
        'sampler': meta['sampler'], 'steps': meta['steps'], 'n_samples': 1, 'seed': meta['seed'],
        'cfg_rescale': CFG_RESCALE, 'noise_schedule': meta['noise_schedule'],
        'ucPreset': 4, 'qualityToggle': False,  # 품질 태그·UC 프리셋은 원문에 이미 들어 있음
        'dynamic_thresholding': False, 'controlnet_strength': 1, 'legacy': False,
        'add_original_image': True, 'legacy_v3_extend': False, 'skip_cfg_above_sigma': None,
        'use_coords': False, 'legacy_uc': False, 'normalize_reference_strength_multiple': True,
        'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True, 'characterPrompts': [],
        'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True},
        'v4_negative_prompt': {'caption': {'base_caption': neg, 'char_captions': []}, 'legacy_uc': False},
        'negative_prompt': neg,
        'reference_image_multiple': [vibe],
        'reference_strength_multiple': [VIBE_STRENGTH],
        'reference_information_extracted_multiple': [VIBE_INFO],
    }


def run(action, meta, size, vibe, extra=None):
    p = params(meta, size, vibe) | (extra or {})
    data = post('/ai/generate-image', {'input': meta['prompt'], 'model': MODEL, 'action': action, 'parameters': p})
    z = zipfile.ZipFile(io.BytesIO(data))
    return Image.open(io.BytesIO(z.read(z.namelist()[0]))).convert('RGB')


def fit(im, size):
    """비율을 유지해 화면을 꽉 채우고 넘치는 쪽을 가운데 기준으로 자른다."""
    s = max(size[0] / im.width, size[1] / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - size[0]) // 2, (im.height - size[1]) // 2
    return im.crop((x, y, x + size[0], y + size[1]))


def save_final(im, code, slot):
    d = os.path.join(ROOT, 'assets', code, 'scene'); os.makedirs(d, exist_ok=True)
    fit(im, FINAL).save(os.path.join(d, slot + '.webp'), 'WEBP', quality=90, method=6)


def gen(codes):
    for s in SPECS:
        if codes and s['code'] not in codes:
            continue
        base = json.load(open(os.path.join(PROMPTS, s['base'] + '.json')))
        meta = {
            'character': s['code'], 'scene': s['slot'], 'label': s['label'],
            'source': f'NovelAI Diffusion V4.5 ({MODEL})', 'based_on': f"characters/prompts/{s['base']}.json",
            'seed': random.randint(1, 2**32 - 1), 'width': GEN_SIZE[0], 'height': GEN_SIZE[1],
            'steps': base['steps'], 'scale': base['scale'], 'cfg_rescale': CFG_RESCALE,
            'sampler': base['sampler'], 'noise_schedule': base['noise_schedule'],
            'vibe': {'image': f"characters/vibes/{s['vibe']}.webp", 'strength': VIBE_STRENGTH,
                     'information_extracted': VIBE_INFO},
            'prompt': build_prompt(base, s), 'negative': base['negative'],
        }
        im = run('generate', meta, GEN_SIZE, encode_vibe(s['vibe']))
        im.save(os.path.join(ROOT, f"{s['code']}-{s['slot']}.png"))  # 키우기 단계 입력 (커밋하지 않음)
        save_final(im, s['code'], s['slot'])
        json.dump(meta, open(os.path.join(PROMPTS, f"{s['code']}-scene-{s['slot']}.json"), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print('gen', s['code'], s['slot'], meta['seed'])
        time.sleep(3)


def up(src, key):
    """1단계 그림을 832x1792로 다시 그려(img2img) 디테일을 올리고 1080x2340으로 맞춘다."""
    code, slot = key.split('-')
    path = os.path.join(PROMPTS, f'{code}-scene-{slot}.json')
    meta = json.load(open(path))
    im = fit(Image.open(src).convert('RGB'), UP_SIZE)
    out = run('img2img', meta, UP_SIZE, encode_vibe(os.path.basename(meta['vibe']['image'])[:-5]),
              {'image': b64png(im), 'strength': UP_STRENGTH, 'noise': 0, 'extra_noise_seed': meta['seed']})
    save_final(out, code, slot)
    meta['upscale'] = {'method': 'img2img', 'size': list(UP_SIZE), 'strength': UP_STRENGTH, 'noise': 0,
                       'seed': meta['seed'], 'final': list(FINAL)}
    json.dump(meta, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('up', key, out.size, '->', FINAL)


if __name__ == '__main__':
    if sys.argv[1] == 'gen':
        gen(set(sys.argv[2:]))
    elif sys.argv[1] == 'up':
        up(sys.argv[2], sys.argv[3])
