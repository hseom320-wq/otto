"""시청실 뒷모습 수현 (NovelAI V4.5 Full, 아날스 사용)
TV 앞에 앉아서 TV를 보는 수현의 뒷모습(살짝 옆얼굴이 보이는 3/4 뒷모습), 앱 그림체(ns-scene-night + 바이브 ns-a) 그대로.
단색 배경으로 뽑아 rembg(isnet-anime)로 배경을 지워 assets/tv/ns-back.webp(669×900)로 저장했다. 앱이 TV 앞 오른쪽에 놓는다.
  python3 tools/gen_tvback.py <출력폴더> [장수]
"""
import json, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g

src = json.load(open(os.path.join(g.ROOT, 'characters', 'prompts', 'ns-scene-night.json')))
p = src['prompt']
head, tail = p[:p.index('1girl')], p[p.index('-2::upscaled, blurry::'):]
head = head.replace('depth of field, ', '')
CHAR = ('1girl, short hair, 1.4::black hair::, ear piercing, stud earrings, 1.2::black choker::, plain choker, '
        '1.3::white hoodie::, 1.3::fully clothed::, hood down, long sleeves, black t-shirt under hoodie, crew neck')
SCENE = ('1.6::from behind::, 1.4::back view::, 1.2::three-quarter back view::, 1.2::looking away::, 1.2::facing away::, '
         'slight profile, cheek visible, 1.6::upper body::, 1.3::head and shoulders::, sitting, 1.3::watching tv::, '
         'head tilt, relaxed, 1.3::screen light::, 1.2::blue light on hair::, 1.3::rim light::, night, '
         '1.6::simple background::, 1.6::plain grey background::')
PROMPT = f'{head}{CHAR}, {SCENE}, {tail}'
DROP = {'from behind', 'other focus', '1.3::lower body::'}
NEG = (g.strip_neg(src['negative'], DROP) + ', 1.5::cleavage::, 1.4::large breasts::, 1.5::looking at viewer::, 1.3::facing viewer::, '
       '1.4::front view::, 1.6::bare shoulders::, 1.6::off shoulder::, 1.6::bare back::, 1.5::bare legs::, 1.4::shorts::, 1.4::skin::, 1.3::knees::, 1.4::undressing::, '
       'text, logo, watermark, scenery, furniture, 1.5::television::, 1.5::monitor::, 1.3::detailed background::')
SIZE = (1024, 1024 + 64)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    vibe = g.encode_vibe('ns-a')
    for i in range(1, n + 1):
        meta = {'prompt': PROMPT, 'negative': NEG, 'seed': random.randint(1, 2**32 - 1), 'steps': 28, 'scale': 6.0,
                'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras', 'vibe': {'strength': 0.5}, 'width': SIZE[0], 'height': SIZE[1]}
        im = g.run('generate', meta, SIZE, vibe)
        im.save(os.path.join(out, f'back-{i}.png'))
        json.dump(meta, open(os.path.join(out, f'back-{i}.json'), 'w'), ensure_ascii=False, indent=1)
        print('ok', i, flush=True); time.sleep(12)
