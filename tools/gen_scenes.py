"""시간대 장면 그림 만들기 (NovelAI V4.5 Full)

공통 스택(작가·스타일 태그, 네거티브, 설정값)은 각 캐릭터 원본 그림의 메타데이터
(characters/prompts/<코드>-<세트>.json)에서 그대로 가져오고, 구도·장면 부분만 바꾼다.
바이브는 캐릭터당 1장 (characters/vibes/<코드>-<세트>.webp).

  python3 tools/gen_scenes.py gen ns ys        # 새로 뽑기 (640x1408, 무료 범위)
  python3 tools/gen_scenes.py cand <폴더> ns [morning…]  # 검수용 후보 5장씩
  python3 tools/gen_scenes.py up  <그림.png> ns-night [후보.json]  # 키우기: 832x1792 img2img → 1080x2340

필요: 환경 변수 NOVELAI_TOKEN. 요청은 curl로 보낸다.
"""
import base64, io, json, os, random, subprocess, sys, tempfile, time, zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS = os.path.join(ROOT, 'characters', 'prompts')
API = 'https://image.novelai.net'
MODEL = 'nai-diffusion-4-5-full'
GEN_SIZE = (704, 1472)      # 무료(넓이 1024x1024 이하) 중 화면 비율에 가장 가까움. 좌우 3%만 잘림
UP_SIZE = (832, 1792)       # 키우기 크기 (Anlas 사용)
FINAL = (1080, 2340)        # 갤럭시 S26 화면
UP_SIZE_WIDE = (1920, 1152)  # 태블릿 키우기 (1280x768 → 1.5배 다시 그림)
FINAL_WIDE = (2560, 1536)    # 태블릿 키운 크기 (탭 A11 비율)
FINAL_TALLWIDE = (2560, 1792)  # 위아래를 늘린 태블릿 최종: iPad(1.44)에서 전부 보이고, 탭 A11은 늘린 띠만 잘림
UP_STRENGTH = 0.45          # 키우기 때 다시 그리는 정도 (낮을수록 원본 유지)
VIBE_STRENGTH, VIBE_INFO = 0.6, 1.0
CFG_RESCALE = 0.5

KIT = os.path.join(ROOT, 'characters', 'kit')
HIGH = '1.2::from above::'  # 레나처럼 위에서 내려다보는 구도

# 수현: 「남수현 복장 프롬프트」(characters/kit/ns_outfits.json)의 01 프롬프트를 바탕으로 장면만 바꾼다.
# 밤(a)은 실제 원본 그림(야간) 메타데이터를 쓴다 (키트의 a 01은 주간판).
WARM = '1.3::warm lighting::, 1.2::orange tint::, morning sunlight'  # 아침·낮: 주황빛
WARM_NEG = ', 1.4::blue tint::, 1.3::cool lighting::, 1.2::blue theme::'
SOFT_VIBE = 0.35  # 바이브(야경)의 파란 색감이 덜 따라오게
NO_LEGS = ', 1.4::thighs::, 1.3::legs::, 1.3::lower body::, cowboy shot, full body, knees'  # 하반신 안 나오게
NO_KNEES = ', 1.3::legs::, full body, knees'  # 골반선에서 끊는 컷
# 상반신 컷에서는 체형 태그의 thick thighs가 허벅지를 화면에 끌어들인다 → 빼고 골반 가중치를 낮춘다
UPPER_FIX = [('thick thighs, ', ''), ('1.2::wide hips::', 'wide hips')]

# 수현 성격: 시크·털털 톰보이. 무표정=도도, 웃으면 부드러워짐. 애교·큰 웃음 없음.
# 연출: 상반신 위주로 가깝게(얼굴이 화면 위 1/3), 앞쪽 물건(문·바·소파)으로 "문 열자 마주친" 느낌,
#       손은 움직이는 중간 동작(나중에 영상 반복용).
SPECS = [
    dict(code='ns', slot='morning', base='kit:d', vibe='ns-a', vibe_strength=SOFT_VIBE, neg_add=WARM_NEG + NO_LEGS,
         label='아침 · 🩳실내복 · 문 뒤에서 상체만 내밀고 칫솔 문 채 귀찮은 무표정', fix=UPPER_FIX,
         scene='1.5::upper body::, 1.1::dutch angle::, 1.5::peeking out::, 1.4::behind door::, '
               '1.4::door covering half of body::, door edge, hand on door, leaning out, head tilt, '
               '1.4::toothbrush in mouth::, 1.3::sleepy::, half-closed eyes, expressionless, 1.2::messy hair::, '
               'bedhead, looking at viewer, morning, indoors, apartment entrance, 1.3::bright::, '
               f'{WARM}, 1.2::sunlight from behind::, 1.3::blurry background::'),
    dict(code='ns', slot='day', base='kit:e', vibe='ns-a', vibe_strength=SOFT_VIBE, neg_add=WARM_NEG + NO_KNEES, variety=True,
         label='낮 · 👓캠퍼스룩 · 비스듬히 내려다본 구도, 필기하다 고개만 돌려 옅은 눈웃음',
         scene='1.3::upper body::, 1.1::hips::, 1.4::dutch angle::, 1.3::from above::, 1.2::from side::, '
               'standing, 1.2::facing left::, 1.3::holding notebook::, 1.3::writing::, holding pen, '
               '1.2::turning head::, looking at viewer, 1.2::looking over eyewear::, 1.1::light smile::, '
               'closed mouth, half-closed eyes, day, indoors, library, bookshelf, '
               f'1.2::sunlight through window::, daylight, {WARM}, 1.3::blurry background::'),
    dict(code='ns', slot='evening', base='kit:b', vibe='ns-b', neg_add=NO_LEGS + ', 1.2::shaking::, pouring, 1.2::grin::, teeth',
         label='저녁 · 🍸바텐더복 · 바 카운터 뒤, 셰이커를 천으로 닦으며 내려다보는 눈웃음', fix=UPPER_FIX,
         scene='1.4::upper body::, pov, 1.2::from below::, 1.4::behind bar counter::, '
               '1.5::bar counter in foreground::, 1.4::counter covering lower body::, standing, '
               '1.5::wiping cocktail shaker with cloth::, 1.3::holding cloth::, 1.2::holding cocktail shaker::, '
               '1.3::looking down at viewer::, 1.2::light smile::, closed mouth, 1.2::half-closed eyes::, '
               'gentle eyes, head tilt, indoors, bar, dim lighting, 1.2::warm lighting::, amber lighting, evening, '
               'bottles, 1.3::blurry background::'),
    dict(code='ns', slot='night', base='ns-a', vibe='ns-a', neg_add=NO_LEGS,
         label='밤 · 👕후드카고 · 소파에서 컨트롤러 든 채 손 흔들며 올려다봄',
         fix=[('glowing city lights, neon lights, ', '')] + UPPER_FIX,
         scene=f'1.3::upper body::, 1.3::from above::, 1.1::dutch angle::, sitting on couch, couch armrest, '
               '1.3::holding game controller::, 1.3::waving::, 1.2::looking up at viewer::, 1.1::light smile::, '
               'closed mouth, half-closed eyes, relaxed, night, indoors, living room, 1.3::dark room::, '
               '1.3::screen light::, 1.2::light on face::, television, cushion, 1.3::blurry background::'),
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
        'add_original_image': True, 'legacy_v3_extend': False,
        'skip_cfg_above_sigma': meta.get('skip_cfg_above_sigma'),  # Variety+
        'use_coords': False, 'legacy_uc': False, 'normalize_reference_strength_multiple': True,
        'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True, 'characterPrompts': [],
        'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True},
        'v4_negative_prompt': {'caption': {'base_caption': neg, 'char_captions': []}, 'legacy_uc': False},
        'negative_prompt': neg,
        'reference_image_multiple': [vibe],
        'reference_strength_multiple': [meta['vibe']['strength']],
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


def save_final(im, code, slot, wide=False):
    d = os.path.join(ROOT, 'assets', code, 'scene-wide' if wide else 'scene'); os.makedirs(d, exist_ok=True)
    fit(im, FINAL_WIDE if wide else FINAL).save(os.path.join(d, slot + '.webp'), 'WEBP', quality=90, method=6)


def load_base(name):
    """'kit:<세트>' = 수현 복장 프롬프트(키트), 그 외 = characters/prompts/<이름>.json (실제 그림 메타데이터).
    키트 글은 UC 프리셋 켠 상태라 네거티브 앞에 프리셋을 붙인다 (메타데이터와 같아진다)."""
    if name.startswith('kit:'):
        o = {x['code']: x for x in json.load(open(os.path.join(KIT, 'ns_outfits.json')))}[name[4:]]
        pre = json.load(open(os.path.join(KIT, 'negatives.json')))['uc_preset']
        return {'prompt': o['pos'], 'negative': pre + o['neg'], 'steps': 28, 'scale': 6.0,
                'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras',
                'path': f"characters/kit/ns_outfits.json#{name[4:]}"}
    d = json.load(open(os.path.join(PROMPTS, name + '.json')))
    d['path'] = f'characters/prompts/{name}.json'
    return d


def make_meta(s):
    base = load_base(s['base'])
    return {
            'character': s['code'], 'scene': s['slot'], 'label': s['label'],
            'source': f'NovelAI Diffusion V4.5 ({MODEL})', 'based_on': base['path'],
        'seed': random.randint(1, 2**32 - 1), 'width': GEN_SIZE[0], 'height': GEN_SIZE[1],
            'steps': base['steps'], 'scale': base['scale'], 'cfg_rescale': CFG_RESCALE,
            'sampler': base['sampler'], 'noise_schedule': base['noise_schedule'],
            'vibe': {'image': f"characters/vibes/{s['vibe']}.webp", 'strength': s.get('vibe_strength', VIBE_STRENGTH),
                     'information_extracted': VIBE_INFO},
            'prompt': build_prompt(base, s), 'negative': base['negative'] + s.get('neg_add', ''),
            **({'skip_cfg_above_sigma': 19, 'variety_plus': True} if s.get('variety') else {}),
        }


def gen(codes):
    for s in SPECS:
        if codes and s['code'] not in codes:
            continue
        meta = make_meta(s)
        im = run('generate', meta, GEN_SIZE, encode_vibe(s['vibe']))
        im.save(os.path.join(ROOT, f"{s['code']}-{s['slot']}.png"))  # 키우기 단계 입력 (커밋하지 않음)
        save_final(im, s['code'], s['slot'])
        json.dump(meta, open(os.path.join(PROMPTS, f"{s['code']}-scene-{s['slot']}.json"), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print('gen', s['code'], s['slot'], meta['seed'])
        time.sleep(3)


def cand(out_dir, code, slots, n):
    """검수용 후보: 장면마다 n장 (시드만 다름). out_dir/<코드>-<시간대>-<번호>.png + .json"""
    os.makedirs(out_dir, exist_ok=True)
    vibes = {}
    for s in SPECS:
        if s['code'] != code or (slots and s['slot'] not in slots):
            continue
        vibes.setdefault(s['vibe'], encode_vibe(s['vibe']))
        for i in range(1, n + 1):
            meta = make_meta(s)
            name = f"{code}-{s['slot']}-{i}"
            run('generate', meta, GEN_SIZE, vibes[s['vibe']]).save(os.path.join(out_dir, name + '.png'))
            json.dump(meta, open(os.path.join(out_dir, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('cand', name, meta['seed'], flush=True)
            time.sleep(2)


def pick(src_png, meta_src, key):
    """고른 후보를 그대로 1080x2340으로 맞춰 넣고 프롬프트·시드를 characters/prompts/로 옮긴다."""
    code, slot = key.split('-')
    meta = json.load(open(meta_src))
    save_final(Image.open(src_png).convert('RGB'), code, slot)
    meta['width'], meta['height'] = Image.open(src_png).size
    meta['final'] = list(FINAL)
    json.dump(meta, open(os.path.join(PROMPTS, f'{code}-scene-{slot}.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('pick', key, meta['seed'])


def up(src, key, meta_src=None, wide=False):
    """고른 후보를 다시 그려(img2img) 디테일을 올리고 최종 크기로 맞춘다.
    폰: 832x1792로 다시 그림 → 1080x2340 / 태블릿(wide): 1920x1152 → 2560x1536.
    meta_src: 후보의 .json (고른 후보의 프롬프트·시드를 characters/prompts/로 옮긴다)"""
    code, slot = key.split('-')
    path = os.path.join(PROMPTS, f"{code}-scene{'-wide' if wide else ''}-{slot}.json")
    meta = json.load(open(meta_src or path))
    size = UP_SIZE_WIDE if wide else UP_SIZE
    im = fit(Image.open(src).convert('RGB'), size)
    out = run('img2img', meta, size, encode_vibe(os.path.basename(meta['vibe']['image'])[:-5]),
              {'image': b64png(im), 'strength': UP_STRENGTH, 'noise': 0, 'extra_noise_seed': meta['seed']})
    save_final(out, code, slot, wide)
    meta['upscale'] = {'method': 'img2img', 'size': list(size), 'strength': UP_STRENGTH, 'noise': 0,
                       'seed': meta['seed'], 'final': list(FINAL_WIDE if wide else FINAL)}
    json.dump(meta, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('up', key, 'wide' if wide else 'phone', out.size)



def extend_wide(key):
    """태블릿 그림 위아래를 아웃페인트로 늘려 iPad 비율로 만든다 (1920x1152 → 1920x1344 → 2560x1792).
    iPad에서는 그림 전체가 보이고, 탭 A11에서는 늘린 띠만 잘려 원래 그림이 그대로 보인다."""
    code, slot = key.split('-')
    path = os.path.join(PROMPTS, f'{code}-scene-wide-{slot}.json')
    meta = json.load(open(path))
    W, H, PAD, OV = 1920, 1344, 96, 24
    final = os.path.join(ROOT, 'assets', code, 'scene-wide', slot + '.webp')
    src = Image.open(final).convert('RGB').resize((W, 1152), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H)); canvas.paste(src, (0, PAD))
    canvas.paste(src.crop((0, 0, W, 1)).resize((W, PAD)), (0, 0))
    canvas.paste(src.crop((0, 1151, W, 1152)).resize((W, PAD)), (0, PAD + 1152))
    mask = Image.new('L', (W, H), 0)
    mask.paste(255, (0, 0, W, PAD + OV)); mask.paste(255, (0, PAD + 1152 - OV, W, H))
    p = params(meta, (W, H), encode_vibe(os.path.basename(meta['vibe']['image'])[:-5]))
    p.update({'image': b64png(canvas), 'mask': b64png(mask.convert('RGB')), 'add_original_image': True,
              'strength': 1, 'noise': 0, 'inpaintImg2ImgStrength': 1, 'extra_noise_seed': meta['seed']})
    data = post('/ai/generate-image', {'input': meta['prompt'], 'model': MODEL + '-inpainting', 'action': 'infill', 'parameters': p})
    z = zipfile.ZipFile(io.BytesIO(data))
    out = Image.open(io.BytesIO(z.read(z.namelist()[0]))).convert('RGB')
    fit(out, FINAL_TALLWIDE).save(final, 'WEBP', quality=90, method=6)
    meta['extend'] = {'method': 'outpaint top/bottom', 'canvas': [W, H], 'pad': PAD, 'final': list(FINAL_TALLWIDE)}
    json.dump(meta, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('extend', key, FINAL_TALLWIDE)

if __name__ == '__main__':
    if sys.argv[1] == 'gen':
        gen(set(sys.argv[2:]))
    elif sys.argv[1] == 'cand':  # cand <출력폴더> <코드> [시간대…]
        cand(sys.argv[2], sys.argv[3], set(sys.argv[4:]), 5)
    elif sys.argv[1] == 'pick':  # pick <후보.png> <후보.json> <코드>-<시간대>
        pick(sys.argv[2], sys.argv[3], sys.argv[4])
    elif sys.argv[1] == 'extend-wide':  # extend-wide <코드>-<시간대>
        extend_wide(sys.argv[2])
    elif sys.argv[1] in ('up', 'up-wide'):  # up[-wide] <그림.png> <코드>-<시간대> [후보.json]
        up(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None, wide=sys.argv[1] == 'up-wide')
