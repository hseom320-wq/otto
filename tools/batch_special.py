"""특수컷 후보를 한꺼번에 뽑는다 (무료 크기). 이미 있는 건 건너뛰어서 끊겨도 이어서 돌릴 수 있다.

프롬프트는 characters/kit/special_cuts.json (한울아파트 NAI 키트의 특수컷 49개)에서 가져온다.
몸매 강조 태그를 누그러뜨리고 노출 구도를 막는 네거티브를 붙인다 (예전 보상씬 안전 설정과 같다).

  python3 tools/batch_special.py <출력폴더> [n=15] [코드 …]
출력: <폴더>/<코드>-sp_<번호>/<phone|tablet>/<n>.png + .json
"""
import json, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g
SIZES = {'phone': (832, 1216), 'tablet': (1280, 768)}
# 6번부터는 자세·표정을 바꿔 가며 뽑는다 (batch_cand.py와 같은 목록)
VARIANTS = ['head tilt, 1.2::light smile::', '1.2::hand on own cheek::, blush', '1.2::waving::, smile, open mouth',
            '1.2::looking away::, 1.2::embarrassed::, blush', '1.2::peace sign::, grin',
            '1.2::hand in own hair::, half-closed eyes', '1.2::surprised::, :o', '1.2::smug::, closed mouth',
            '1.2::pout::, blush', '1.2::laughing::, closed eyes']

KIT = os.path.join(g.ROOT, 'characters', 'kit')
SOFT = [('thick thighs, ', ''), ('1.2::wide hips::, ', ''), ('wide hips, ', ''), ('curvy, ', ''),
        ('hourglass figure, ', ''), ('glossy skin, ', ''), ('shiny skin, ', ''),
        ('1.3::large breasts::', 'medium breasts'), ('large breasts', 'medium breasts'),
        ('1.2::partially unbuttoned::', '1.2::buttoned shirt::'),
        ('1.4::black off-shoulder sweater::', '1.4::black turtleneck sweater::'),
        ('bare shoulders, ', ''), ('collarbone, ', ''),
        ('1.1::off-shoulder shirt::', '1.1::loose t-shirt::'),
        ('1.3::black miniskirt::', '1.3::black knee-length skirt::')]
SAFE_NEG = (', 1.6::cleavage::, 1.5::huge breasts::, 1.4::large breasts::, 1.4::revealing clothes::, 1.3::skin tight::, '
            '1.3::side slit::, 1.5::panties::, 1.5::pantyshot::, 1.5::upskirt::, 1.3::bare shoulders::, 1.3::off-shoulder::, '
            '1.3::strapless::, 1.3::miniskirt::, 1.4::navel::, 1.4::midriff::, 1.4::crop top::, 1.5::spread legs::, '
            '1.4::crotch::, 1.4::unbuttoned::, 1.3::open shirt::, 1.3::breast focus::, 1.3::ass focus::, 1.4::thigh focus::, '
            '1.4::sexually suggestive::, 1.2::underboob::, 1.2::sideboob::, 1.4::from below::, 1.4::latex::, 1.3::shiny clothes::')
MARK = ', -2::upscaled, blurry::'


def soften(p):
    for a, b in SOFT:
        p = p.replace(a, b)
    # 아래에서 올려다보는 구도만 바꾼다 (네거티브 가중치 -1.5::from below:: 는 그대로 둔다)
    tags = [('straight-on' if t.strip() == 'from below' else t) for t in p.split(', ')]
    return ', '.join(tags)


def pick_vibe(code, prompt):
    """프롬프트 태그가 가장 많이 겹치는 원본 그림을 바이브로 쓴다 (기본복·서브복·작업복 등)."""
    tags = set(t.strip() for t in prompt.split(','))
    best, score = None, -1
    for f in sorted(os.listdir(g.PROMPTS)):
        if not f.startswith(code + '-') or '-scene' in f: continue
        o = set(t.strip() for t in json.load(open(os.path.join(g.PROMPTS, f)))['prompt'].split(','))
        if len(tags & o) > score: best, score = f[:-5], len(tags & o)
    return best


def meta_for(c, i, size):
    pre = json.load(open(os.path.join(KIT, 'negatives.json')))['uc_preset']
    negs = json.load(open(os.path.join(KIT, 'special_cuts.json'), encoding='utf-8'))['negs']
    p = soften(c['prompts'][0])
    variant = VARIANTS[(i - 6) % len(VARIANTS)] if i > 5 else None
    if variant: p = p.replace(MARK, ', ' + variant + MARK, 1)
    vibe = pick_vibe(c['code'], c['prompts'][0])
    m = {'character': c['code'], 'scene': 'sp_' + c['id'][1:], 'label': f"특수컷 · {c['title']}",
         'source': f'NovelAI Diffusion V4.5 ({g.MODEL})', 'based_on': f"characters/kit/special_cuts.json#{c['code']}-{c['id']}",
         'seed': random.randint(1, 2**32 - 1), 'width': size[0], 'height': size[1], 'steps': 28, 'scale': 6.0,
         'cfg_rescale': g.CFG_RESCALE, 'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras',
         'vibe': {'image': f'characters/vibes/{vibe}.webp', 'strength': g.VIBE_STRENGTH, 'information_extracted': g.VIBE_INFO},
         'prompt': p, 'negative': pre + negs[c['neg']] + SAFE_NEG}
    if variant: m['variant'] = variant
    return m, vibe


if __name__ == '__main__':
    OUT = sys.argv[1]
    N = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    only = set(sys.argv[3:])
    cuts = [c for c in json.load(open(os.path.join(KIT, 'special_cuts.json'), encoding='utf-8'))['cuts']
            if not only or c['code'] in only]
    vibes = {}; done = total = 0
    for c in cuts:
        for dev, size in SIZES.items():
            d = os.path.join(OUT, f"{c['code']}-sp_{c['id'][1:]}", dev); os.makedirs(d, exist_ok=True)
            for i in range(1, N + 1):
                total += 1
                png = os.path.join(d, f'{i}.png')
                if os.path.exists(png): done += 1; continue
                meta, vibe = meta_for(c, i, size)
                if vibe not in vibes: vibes[vibe] = g.encode_vibe(vibe)
                for attempt in range(3):
                    try:
                        im = g.run('generate', meta, size, vibes[vibe]); break
                    except SystemExit as e:
                        print('retry', c['code'], c['id'], dev, i, e, flush=True); time.sleep(10)
                else:
                    continue
                im.save(png)
                json.dump(meta, open(png[:-4] + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                done += 1
                print(f"{done}/{total} {c['code']}-{c['id']} {dev} {i}", flush=True)
                time.sleep(1)
    print('ALL DONE', done, 'of', len(cuts) * len(SIZES) * N, flush=True)
