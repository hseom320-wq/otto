"""시청실 수현 (NovelAI V4.5 Full, 아날스 사용)
방 그림(힉스필드)과 따로 만든다: 단색 배경에 TV 뒤에서 몸을 기울여 빼꼼 내다보는 수현 전신.
고른 그림은 rembg(isnet-anime)로 배경을 지워 assets/tv/ns.webp(584×1400)로 저장했다.
앱(tv.js)이 까만 바탕에서 TV 그림(assets/tv/tv.webp) 뒤 왼쪽에 놓는다.
  python3 tools/gen_tvgirl.py <출력폴더> [장수]
"""
import json, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g

src = json.load(open(os.path.join(g.ROOT, 'characters', 'prompts', 'ns-scene-night.json')))
p = src['prompt']
head, tail = p[:p.index('1girl')], p[p.index('-2::upscaled, blurry::'):]
head = head.replace('depth of field, ', '')
CHAR = ('1girl, short hair, 1.4::black hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, plain choker, medium breasts, '
        '1.2::white hoodie::, oversized hoodie, hood down, black t-shirt, long sleeves, 1.2::cargo pants::, olive pants, sneakers')
SCENE = ('1.5::full body::, standing, 1.4::leaning to the side::, 1.3::peeking out::, 1.2::head tilt::, '
         '1.3::one hand raised to chest height::, palm forward, looking at viewer, 1.3::sparkling eyes::, 1.2::shiny eyes::, '
         '1.1::light smile::, closed mouth, playful, 1.4::straight-on::, 1.4::eye level::, 1.2::vertical view::, 1.3::neat hair::, tidy hair, '
         '1.6::simple background::, 1.6::plain grey background::, night lighting, 1.2::blue rim light::, warm light from side')
PROMPT = f'{head}{CHAR}, {SCENE}, {tail}'
DROP = {'1.4::thighs::', '1.3::legs::', '1.3::lower body::', 'cowboy shot', 'full body', 'knees'}
NEG = (g.strip_neg(src['negative'], DROP) + ', 1.5::cleavage::, 1.4::midriff::, 1.4::navel::, 1.4::crop top::, 1.4::large breasts::, '
       '1.3::from below::, 1.7::from above::, 1.4::foreshortening::, 1.3::perspective::, high angle, looking up, text, logo, watermark, scenery, furniture, 1.3::detailed background::, 1.3::cropped legs::, out of frame')
SIZE = (832, 1792)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    vibe = g.encode_vibe('ns-a')
    for i in range(1, n + 1):
        meta = {'prompt': PROMPT, 'negative': NEG, 'seed': random.randint(1, 2**32 - 1), 'steps': 28, 'scale': 6.0,
                'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras', 'vibe': {'strength': 0.55}, 'width': SIZE[0], 'height': SIZE[1]}
        im = g.run('generate', meta, SIZE, vibe)
        im.save(os.path.join(out, f'girl-{i}.png'))
        json.dump(meta, open(os.path.join(out, f'girl-{i}.json'), 'w'), ensure_ascii=False, indent=1)
        print('ok', i, flush=True); time.sleep(12)
