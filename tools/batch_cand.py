"""검수용 후보를 한꺼번에 뽑는다 (무료 크기). 이미 있는 건 건너뛰어서 끊겨도 이어서 돌릴 수 있다.

  python3 tools/batch_cand.py <출력폴더> [n=5]
출력: <폴더>/<코드>-<슬롯>/<phone|tablet>/<번호>.png + .json
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_scenes as g

OUT = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 5
SIZES = {'phone': (832, 1216), 'tablet': (1280, 768)}
# 수현 시간대 장면은 이미 끝났으니 빼고, 나머지 장면 + 보상씬 전부
todo = [s for s in g.SPECS if not (s['code'] == 'ns' and not s['slot'].startswith('r_'))]
# 6번부터는 자세·표정을 바꿔 가며 뽑는다 (1~5번은 기본 장면 그대로)
VARIANTS = [
    'head tilt, 1.2::light smile::',
    '1.2::hand on own cheek::, blush',
    '1.2::waving::, smile, open mouth',
    '1.2::looking away::, 1.2::embarrassed::, blush',
    '1.2::peace sign::, grin',
    '1.2::hand in own hair::, half-closed eyes',
    '1.2::surprised::, :o',
    '1.2::smug::, closed mouth',
    '1.2::pout::, blush',
    '1.2::laughing::, closed eyes',
]
vibes = {}
done = total = 0
for s in todo:
    for dev, size in SIZES.items():
        d = os.path.join(OUT, f"{s['code']}-{s['slot']}", dev); os.makedirs(d, exist_ok=True)
        for i in range(1, N + 1):
            total += 1
            png = os.path.join(d, f'{i}.png')
            if os.path.exists(png): done += 1; continue
            if s['vibe'] not in vibes: vibes[s['vibe']] = g.encode_vibe(s['vibe'])
            sv = s if i <= 5 else dict(s, scene=s['scene'] + ', ' + VARIANTS[(i - 6) % len(VARIANTS)])
            meta = g.make_meta(sv); meta['width'], meta['height'] = size
            if i > 5: meta['variant'] = VARIANTS[(i - 6) % len(VARIANTS)]
            for attempt in range(3):
                try:
                    im = g.run('generate', meta, size, vibes[s['vibe']]); break
                except SystemExit as e:
                    print('retry', s['code'], s['slot'], dev, i, e, flush=True); time.sleep(10)
            else:
                continue
            im.save(png)
            json.dump(meta, open(png[:-4] + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            done += 1
            print(f'{done}/{total} {s["code"]}-{s["slot"]} {dev} {i}', flush=True)
            time.sleep(1)
print('ALL DONE', done, 'of', len(todo) * len(SIZES) * N, flush=True)
