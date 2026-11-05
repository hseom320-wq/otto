"""캐릭터 시트(characters/HANUL_CHARACTERS.md)의 yaml 블록 + 앱 전용 설정 → data/characters.json

시트를 고친 뒤:  python3 tools/build_data.py
"""
import json, os, re, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, 'characters', 'HANUL_CHARACTERS.md')
OUT = os.path.join(ROOT, 'data', 'characters.json')

CODE = {'nam_suhyun': 'ns', 'ji_yeonseo': 'ys', 'yu_hyerin': 'hr', 'gil_soyoung': 'sy', 'kang_taerin': 'tr'}

# 앱에서만 쓰는 설정 (시트에는 없는 것)
APP = {
    'ns': {
        'color': '#6f8cff',
        'assistant': '결과보다 과정을 알아봐 준다. 할 일을 내기·승부처럼 걸고, 끝내면 "그니까, 너 오늘 꽤 했잖아" 식으로 짧게 인정한다. 미루면 과거 실수를 꺼내 놀린다.',
        'greet': ['야, 일어났냐. 오늘 뭐 할 건데.', '오늘 내가 봐준다. 할 거 불러 봐.', '그니까, 오늘은 뭐부터 할 건데?'],
        'praise': ['…오. 했네.', '그니까, 하면 되잖아.', '방금 거 좀 멋있었다. 한 번만 말한다.'],
        'alldone': ['다 했네. …수고했어, 진짜로.', '오늘 너 이겼다. 인정.'],
        'extra_outfits': [{'code': 'md', 'name': '메이드복', 'emoji': '🧹', 'use': '코스 (자택, 계기 있을 때만)', 'note': '시트에 없음 — 그림 메타데이터에서 추가'}],
    },
    'ys': {
        'color': '#e0b25a',
        'assistant': '옆에서 같이 해 준다. "나도 원고 할 테니까아… 같이 해" 식으로 함께 일하는 느낌을 준다. 끝내면 담담하게, 망상·작품 얘기로 칭찬한다.',
        'greet': ['아… 왔어어? 오늘은… 뭐 해야 돼?', '저기… 오늘도 옆에 있어 줄 거지이…', '밥… 먹었어어? 할 거… 같이 정하자아.'],
        'praise': ['오… 했다아. 이거 럽코였으면 지금 컷 넘어가는 장면인데에.', '…잘했어어.', '나보다… 부지런하네에.'],
        'alldone': ['다 했어어…? 그럼… 같이 쉬자아.', '오늘 회차… 해피엔딩이네에.'],
    },
    'hr': {
        'color': '#b07cff',
        'assistant': '밥·잠·건강부터 참견하고, 질문으로 시작해 결론까지 내 준다("그건 내일 해~ 오늘은 이거부터~"). 끝내면 넉살 좋게 칭찬하고 반찬 얘기를 꺼낸다.',
        'greet': ['{user} 씨, 밥은 먹었어~? 안 먹었지~', '오늘 할 거 뭐야~? 내가 순서 정해 줄게~', '어머, 일찍 일어났네~ 오늘 뭐부터 할까~?'],
        'praise': ['어머머, 벌써 했어~? 잘했다~', '그치~ 할 줄 알았어~', '수고했어~ 반찬 좀 갖다줄까~?'],
        'alldone': ['오늘 거 다 했네~ …진짜 잘했어.', '다 했으면 이제 쉬어~ 내 말 들어~'],
        'outfit_by_time': {'b': {'from': 19, 'to': 4}},
    },
    'sy': {
        'color': '#3fbf8f',
        'assistant': '엘리트 모드로 일정을 깔끔하게 정리해 준다(결론부터, 짧게). 동시에 "쉬어도 된다"는 허락을 준다. 퇴근 시간 이후엔 방전 모드로 같이 늘어진다.',
        'greet': ['응, 오늘 일정부터 보자. 할 거 말해.', '좋은 아침. 우선순위 세 개만 정하자.', '…일어났어? 오늘 거 같이 정리하자.'],
        'praise': ['좋아, 하나 끝. 다음.', '깔끔하네. 나보다 낫다.', '잘했어… 이따 칭찬 더 해줄게에.'],
        'alldone': ['오늘 거 끝. …이제 쉬어도 돼. 진짜로.', '다 했다아… 우리 둘 다 칭찬받아야 돼에.'],
        'outfit_by_time': {'a': {'from': 7, 'to': 19, 'weekday': True}},
        'default_outfit': 'b',
    },
    'tr': {
        'color': '#ff5a4f',
        'assistant': '할 일을 장부에 적듯 받아 적고 끝까지 받아낸다. 짧은 명령형("먹어", "해"). 끝내면 칭찬 대신 "갚았네" 식으로 인정. 유저에게 손대거나 진짜 겁주지 않는다.',
        'greet': ['일어났냐. 오늘 할 거 불러. 장부에 적는다.', '밥은? 안 먹었으면 먹고 시작해.', '야. 오늘 거 미루면 알지?'],
        'praise': ['갚았네. 장부에서 지운다.', '…제법인데.', '그래, 그렇게 하면 돼.'],
        'alldone': ['오늘 장부 깨끗하다. …잘했다, 동생.', '다 했냐? 국밥 먹으러 가자.'],
        'outfit_by_time': {'b': {'from': 15, 'to': 21, 'weekday': True}},
        'hidden_outfits': ['w'],
    },
}

# 화면에서 얼굴이 오게 할 가로 위치 (0~100%, 세로 화면에서 잘라 보여줄 때)
FOCUS = {
    'ns/a': 52, 'ns/b': 50, 'ns/c': 47, 'ns/nn': 50, 'ns/md': 52, 'ns/w': 48, 'ns/bn': 46, 'ns/t': 46,
    'ys/a': 50, 'ys/b': 50, 'hr/a': 52, 'hr/b': 52, 'sy/a': 44, 'sy/b': 34,
    'tr/a': 72, 'tr/b': 46, 'tr/s01': 66, 'tr/w': 62,
}

UNLOCK_COST = {'daily': 3, 'cos': 6, 'w': 12}
COS = {'nr', 'bn', 'xm', 'nn', 'md', 't'}


def main():
    text = open(SHEET, encoding='utf-8').read()
    block = re.search(r'```yaml\n(.*?)```', text, re.S).group(1)
    data = yaml.safe_load(block)
    out = {'version': data['version'], 'world': data['world'], 'characters': []}
    for c in data['characters']:
        code = CODE[c['id']]
        app = APP.get(code, {})
        outfits = list(c.get('outfits', [])) + app.get('extra_outfits', [])
        hidden = set(app.get('hidden_outfits', []))
        for o in outfits:
            o['code'] = str(o['code'])
            img = f"assets/{code}/{o['code']}/cover.webp"
            o['cover'] = img if os.path.exists(os.path.join(ROOT, img)) else None
            o['focus'] = FOCUS.get(f"{code}/{o['code']}", 50)
            folder = os.path.join(ROOT, 'assets', code, o['code'])
            o['cuts'] = sorted(int(f[:2]) for f in os.listdir(folder) if re.fullmatch(r'\d\d\.webp', f)) if os.path.isdir(folder) else []
            o['cost'] = 0 if o.get('default') else UNLOCK_COST['w'] if o['code'] == 'w' else UNLOCK_COST['cos'] if o['code'] in COS else UNLOCK_COST['daily']
        outfits = [o for o in outfits if o['code'] not in hidden]
        specials = []
        for d in sorted(os.listdir(os.path.join(ROOT, 'assets', code))) if os.path.isdir(os.path.join(ROOT, 'assets', code)) else []:
            if d.startswith('s') and d[1:].isdigit():
                specials.append({'code': d, 'cover': f'assets/{code}/{d}/cover.webp', 'focus': FOCUS.get(f'{code}/{d}', 50)})
        c['code'] = code
        c['outfits'] = outfits
        c['special_images'] = specials
        c['app'] = {k: v for k, v in app.items() if k not in ('extra_outfits', 'hidden_outfits')}
        if 'affection' not in c and 'trackers' in c:  # 남수현은 R 수치를 호감도로 쓴다
            c['affection'] = {'range': c['trackers']['R']['range'], 'start': c['trackers']['R']['start'], 'stages': c['trackers']['L']}
        out['characters'].append(c)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', OUT, [(c['code'], len(c['outfits'])) for c in out['characters']])


if __name__ == '__main__':
    main()
