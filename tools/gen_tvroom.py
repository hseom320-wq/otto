"""시청실 그림 만들기 (NovelAI V4.5 Full, 아날스 사용)
수현이 거실 TV 뒤에 서서 TV 왼쪽으로 몸이 반쯤 보이고 정면을 보며 눈을 반짝인다. TV 화면은 비워 둔다(앱이 그 위에 버튼을 올린다).
  python3 tools/gen_tvroom.py <출력폴더> [폰 장수] [태블릿 장수]
"""
import json, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g

src = json.load(open(os.path.join(g.ROOT, 'characters', 'prompts', 'ns-scene-night.json')))
p = src['prompt']
head, tail = p[:p.index('1girl')], p[p.index('-2::upscaled, blurry::'):]
CHAR = ('1girl, short hair, 1.4::black hair::, blue eyes, ear piercing, stud earrings, 1.3::black choker::, plain choker, medium breasts, '
        '1.2::white hoodie::, oversized hoodie, black t-shirt, long sleeves, cargo pants, olive pants')
SCENE = ('1.6::large flat-screen television in the center of the frame::, 1.3::television on a low tv stand::, '
         '1.5::girl hiding behind the television::, 1.5::peeking out::, 1.4::partially hidden by the television::, '
         '1.3::only the left side of her body is visible at the left edge of the television::, half of face, one eye hidden behind tv edge, '
         'one hand gripping the left edge of the tv, one leg visible below, looking at viewer, 1.3::sparkling eyes::, 1.2::shiny eyes::, '
         'light smile, closed mouth, straight-on, eye level, 1.5::tv screen is plain dark and empty::, blank screen, wide shot, '
         'indoors, cozy living room at night, potted plant, warm floor lamp, 1.2::soft glow::, 1.3::blurry background::')
PROMPT = f'{head}{CHAR}, {SCENE}, {tail}'
NEG = src['negative'] + ', 1.5::cleavage::, 1.4::midriff::, 1.4::navel::, 1.4::crop top::, 1.4::large breasts::, 1.3::from below::, text, logo, watermark, 1.3::glowing screen::, 1.3::image on screen::'
SIZES = {'phone': (832, 1792), 'tablet': (1536, 1024)}

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    n = {'phone': int(sys.argv[2]) if len(sys.argv) > 2 else 2, 'tablet': int(sys.argv[3]) if len(sys.argv) > 3 else 2}
    vibe = g.encode_vibe('ns-a')
    for dev, size in SIZES.items():
        for i in range(1, n[dev] + 1):
            meta = {'prompt': PROMPT, 'negative': NEG, 'seed': random.randint(1, 2**32 - 1), 'steps': 28, 'scale': 6.0,
                    'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras', 'vibe': {'strength': 0.55}, 'width': size[0], 'height': size[1]}
            im = g.run('generate', meta, size, vibe)
            im.save(os.path.join(out, f'{dev}-{i}.png'))
            json.dump(meta, open(os.path.join(out, f'{dev}-{i}.json'), 'w'), ensure_ascii=False, indent=1)
            print('ok', dev, i, flush=True); time.sleep(12)
