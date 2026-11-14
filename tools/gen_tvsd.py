"""시청실 SD(꼬마) 수현 (NovelAI V4.5 Full, 아날스 사용)
  python3 tools/gen_tvsd.py <출력폴더> <종류: top|side> [장수]
  top : TV 위에 걸터앉아 다리를 늘어뜨린 수현 (고양이 옆)
  side: TV 옆 바닥에 무릎을 안고 앉아 TV를 같이 보는 수현 (옆모습)
단색 배경으로 뽑은 뒤 rembg(isnet-anime)로 배경을 지운다.
"""
import json, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g

src = json.load(open(os.path.join(g.ROOT, 'characters', 'prompts', 'ns-scene-night.json')))
p = src['prompt']
head, tail = p[:p.index('1girl')], p[p.index('-2::upscaled, blurry::'):]
head = head.replace('depth of field, ', '').replace('glossy skin, ', '').replace('perfect anatomy, ', '')
# 원래 그림체(작가 태그)는 몸을 8등신으로 끌고 가서 SD가 안 나온다 → 작가 태그를 빼고 꼬마 체형 태그를 세게 건다
import re
head = re.sub(r'(-?[\d.]+::)?artist:[^,]*?(::)?\s*,\s*', '', head)
head = re.sub(r'(-?[\d.]+::)?artist collaboration::,\s*', '', head)
CHAR = ('1girl, 2.2::chibi::, 1.8::super deformed::, 1.6::big head::, 1.4::small body::, 1.3::2.5 head tall::, cute, mascot, short hair, 1.4::black hair::, blue eyes, black choker, plain choker, '
        '1.2::white hoodie::, oversized hoodie, hood down, long sleeves, sleeves past wrists, olive cargo pants, white sneakers')
POSES = {
    'top': ('1.4::sitting on edge::, legs dangling, hands on lap, looking at viewer, 1.1::light smile::, closed mouth, '
            'full body, front view, eye level'),
    'side': ('1.4::sitting on floor::, 1.4::hugging own knees::, 1.3::from side::, profile, 1.3::looking ahead::, watching, '
             'relaxed, light smile, closed mouth, full body'),
}
TAIL = '1.6::simple background::, 1.6::plain grey background::, soft lighting, 1.1::blue rim light::'
NEG = (src['negative'] + ', 1.5::cleavage::, 1.4::midriff::, 1.4::navel::, 1.4::large breasts::, 1.3::realistic proportions::, '
       '1.6::long legs::, 1.5::tall::, 1.4::mature female::, text, logo, watermark, scenery, furniture, 1.3::detailed background::, 1.2::multiple girls::')
for w in ('1.4::thighs::', '1.3::legs::', '1.3::lower body::', 'cowboy shot', 'full body', 'knees', 'chibi'):
    NEG = NEG.replace(', ' + w + ',', ',')
SIZE = (1024, 1024 + 64)

if __name__ == '__main__':
    out, kind = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    prompt = f'{head}{CHAR}, {POSES[kind]}, {TAIL}, {tail}'
    vibe = g.encode_vibe('ns-a')
    for i in range(1, n + 1):
        meta = {'prompt': prompt, 'negative': NEG, 'seed': random.randint(1, 2**32 - 1), 'steps': 28, 'scale': 6.0,
                'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras', 'vibe': {'strength': 0.12}, 'width': SIZE[0], 'height': SIZE[1]}
        im = g.run('generate', meta, SIZE, vibe)
        im.save(os.path.join(out, f'{kind}-{i}.png'))
        json.dump(meta, open(os.path.join(out, f'{kind}-{i}.json'), 'w'), ensure_ascii=False, indent=1)
        print('ok', kind, i, flush=True); time.sleep(12)
