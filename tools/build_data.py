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
        # 레나식: 캐릭터를 누르면 반응, 5번 연속이면 tap_stop. 들어올 때 시간대 인사 + 할 일 요약
        'taps': ['뭐. 왜 찔러.', '야, 간지럽다고.', '…할 말 있으면 말로 해.', '한 번만 더 하면 너도 맞는다.', '심심하냐? 할 일이나 해.'],
        'tap_stop': '그만. …진짜 그만해. 얼굴 빨개지잖아.',
        'greet_time': {'morning': ['…일어났냐. 나 아직 양치 중.', '아침부터 뭐야. …들어와.'],
                       'day': ['어, 왔냐. 나 과제 중인데.', '마침 심심했어. 아니, 그냥.'],
                       'evening': ['어서 오세요— 아, 너구나. 앉아.', '오늘 손님 너 하나면 좋겠다.'],
                       'night': ['야, 한 판 할래? 아니면 그냥 있어.', '이 시간에 웬일이냐.']},
        'todo_left': '할 거 {n}개 남았다. 그니까, 빨리 해.',
        'todo_none': '오늘 할 거 아직 없지? 불러 봐.',
        'reward': ['…뭘 봐. 내기 진 거니까 입은 거야.', '한 번만 보여 주는 거다. 그니까 빨리 봐.', '어울리냐…? 아, 대답하지 마.'],
        'color': '#6f8cff',
        'assistant': '결과보다 과정을 알아봐 준다. 할 일을 내기·승부처럼 걸고, 끝내면 "그니까, 너 오늘 꽤 했잖아" 식으로 짧게 인정한다. 미루면 과거 실수를 꺼내 놀린다.',
        'greet': ['야, 일어났냐. 오늘 뭐 할 건데.', '오늘 내가 봐준다. 할 거 불러 봐.', '그니까, 오늘은 뭐부터 할 건데?'],
        'praise': ['…오. 했네.', '그니까, 하면 되잖아.', '방금 거 좀 멋있었다. 한 번만 말한다.'],
        'alldone': ['다 했네. …수고했어, 진짜로.', '오늘 너 이겼다. 인정.'],
    },
    'ys': {
        'taps': ['으응…? 왜애…', '거기 누르면… 원고 날아가아…', '…헤헤. 아, 아니야아.', '저기… 간지러워어.', '…이거 럽코였으면 지금 플래그인데에.'],
        'tap_stop': '그, 그만… 심장이 마감 날 같아아…',
        'greet_time': {'morning': ['…아, 아침이야아? 밤샌 줄도 몰랐어어…'],
                       'day': ['왔어어? 나 지금… 콘티 중이야아.'],
                       'evening': ['…밥 시간이지이? 컵라면… 같이 먹을래애?'],
                       'night': ['쉿… 지금 제일 잘 그려지는 시간이야아.']},
        'todo_left': '할 거… {n}개 남았어어. 같이 하자아.',
        'todo_none': '오늘은… 아직 할 거 없어어?',
        'reward': ['이거어… 다음 화 의상 자료로… 입어 본 거야아.', '저기… 이상하면… 말해 줘어…', '럽코였으면… 여기서 서비스 컷이야아.'],
        'color': '#e0b25a',
        'assistant': '옆에서 같이 해 준다. "나도 원고 할 테니까아… 같이 해" 식으로 함께 일하는 느낌을 준다. 끝내면 담담하게, 망상·작품 얘기로 칭찬한다.',
        'greet': ['아… 왔어어? 오늘은… 뭐 해야 돼?', '저기… 오늘도 옆에 있어 줄 거지이…', '밥… 먹었어어? 할 거… 같이 정하자아.'],
        'praise': ['오… 했다아. 이거 럽코였으면 지금 컷 넘어가는 장면인데에.', '…잘했어어.', '나보다… 부지런하네에.'],
        'alldone': ['다 했어어…? 그럼… 같이 쉬자아.', '오늘 회차… 해피엔딩이네에.'],
    },
    'hr': {
        'taps': ['어머, {user} 씨~ 왜 그래~?', '간지러워~ 반찬 안 준다~?', '후훗, 심심했구나~', '{user} 씨, 손 차갑네~ 밥 먹었어~?', '어머머, 누가 보면 어쩌려고~'],
        'tap_stop': '…그만. 진짜로. 나도 설레는 거 알아?',
        'greet_time': {'morning': ['{user} 씨, 일어났어~? 반찬 좀 가져왔어~'],
                       'day': ['어머, 왔어~? 마침 국 끓였는데~'],
                       'evening': ['저녁 먹고 가~ 오므라이스 했어~'],
                       'night': ['…이 시간엔 다들 모르는 얼굴이야. 쉿.']},
        'todo_left': '할 거 {n}개 남았네~ 순서는 내가 정해 줄게~',
        'todo_none': '오늘 할 거 없으면~ 쉬는 것도 일이야~',
        'reward': ['어머, {user} 씨 수고했으니까~ 특별히~', '이런 거 입는 거 오랜만이네~ 어때~?', '다른 사람한텐 비밀이야~'],
        'color': '#b07cff',
        'assistant': '밥·잠·건강부터 참견하고, 질문으로 시작해 결론까지 내 준다("그건 내일 해~ 오늘은 이거부터~"). 끝내면 넉살 좋게 칭찬하고 반찬 얘기를 꺼낸다.',
        'greet': ['{user} 씨, 밥은 먹었어~? 안 먹었지~', '오늘 할 거 뭐야~? 내가 순서 정해 줄게~', '어머, 일찍 일어났네~ 오늘 뭐부터 할까~?'],
        'praise': ['어머머, 벌써 했어~? 잘했다~', '그치~ 할 줄 알았어~', '수고했어~ 반찬 좀 갖다줄까~?'],
        'alldone': ['오늘 거 다 했네~ …진짜 잘했어.', '다 했으면 이제 쉬어~ 내 말 들어~'],
        'outfit_by_time': {'b': {'from': 19, 'to': 4}},
    },
    'sy': {
        'taps': ['응? 왜. …아, 쓰다듬는 거면 계속해.', '회사에선 이런 거 안 돼. 여긴 괜찮아.', '…으응, 좋아아.', '잠깐, 지금 집중 중— 아니, 계속해.', '피곤하다아… 더 해 줘어.'],
        'tap_stop': '…그만. 이러다 진짜 잠들어. 책임질 거야?',
        'greet_time': {'morning': ['좋은 아침. 3분만 기다려, 엘리트 장착 중.'],
                       'day': ['지금 통화 중— 아, 너구나. 잠깐만.'],
                       'evening': ['…다녀왔어. 오늘 진짜 힘들었어어.'],
                       'night': ['맥주 하나 남았는데… 반 나눠 줄게에.']},
        'todo_left': '남은 거 {n}개. 우선순위부터 정하자.',
        'todo_none': '오늘 일정 비었네. …쉬어도 돼.',
        'reward': ['…오늘 고생했으니까. 보상. 회사엔 비밀.', '이거 입으니까 더 피곤하다아… 칭찬해 줘어.', '잘했어. 이건… 그냥 서비스야.'],
        'color': '#3fbf8f',
        'assistant': '엘리트 모드로 일정을 깔끔하게 정리해 준다(결론부터, 짧게). 동시에 "쉬어도 된다"는 허락을 준다. 퇴근 시간 이후엔 방전 모드로 같이 늘어진다.',
        'greet': ['응, 오늘 일정부터 보자. 할 거 말해.', '좋은 아침. 우선순위 세 개만 정하자.', '…일어났어? 오늘 거 같이 정리하자.'],
        'praise': ['좋아, 하나 끝. 다음.', '깔끔하네. 나보다 낫다.', '잘했어… 이따 칭찬 더 해줄게에.'],
        'alldone': ['오늘 거 끝. …이제 쉬어도 돼. 진짜로.', '다 했다아… 우리 둘 다 칭찬받아야 돼에.'],
        'outfit_by_time': {'a': {'from': 7, 'to': 19, 'weekday': True}},
        'default_outfit': 'b',
    },
    'tr': {
        'taps': ['뭐야, 새끼야. …왜.', '손 치워라. …아니, 됐다.', '야, 장부에 적는다?', '하— 심심하냐? 따라 나와.', '…닥쳐. 귀 빨개진 거 아니다.'],
        'tap_stop': '그만. …더 하면 진짜 갚는다.',
        'greet_time': {'morning': ['일어났냐. 타. 헬멧 써.'],
                       'day': ['과외 가는 길이다. 할 말 있으면 빨리.'],
                       'evening': ['국밥 먹으러 갈 건데. 너도 와.'],
                       'night': ['장부 쓰는 중이다. …너 오늘 거 적어 줄까.']},
        'todo_left': '남은 거 {n}개. 장부에 적어 놨다.',
        'todo_none': '오늘 거 없냐? 그럼 쉬어. 명령이다.',
        'reward': ['갚는 거다. 오해하지 마.', '뭘 봐, 새끼야. …어울리냐?', '닥쳐. 한 번만 보여 준다.'],
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

# 보상씬: 할 일을 하나 끝낼 때마다 하나씩 나온다. 5명 공용 복장 (수현의 서비스 복장 기준)
REWARDS = [
    {'key': 'bt', 'name': '바텐더', 'emoji': '🍸', 'from': 'b'},
    {'key': 'md', 'name': '메이드', 'emoji': '🧹', 'from': 'md'},
    {'key': 'nr', 'name': '간호사', 'emoji': '🩺', 'from': 'nr'},
    {'key': 'bn', 'name': '바니', 'emoji': '🐰', 'from': 'bn'},
    {'key': 'xm', 'name': '산타', 'emoji': '🎄', 'from': 'xm'},
    {'key': 'nn', 'name': '수녀', 'emoji': '📿', 'from': 'nn'},
    {'key': 't', 'name': '비키니', 'emoji': '👙', 'from': 't'},
    {'key': 'w', 'name': '웨딩드레스', 'emoji': '💍', 'from': 'w', 'need_aff': 240},
]
# 수현만 더 있는 보상 (일상 복장)
REWARDS_EXTRA = {'ns': [
    {'key': 'c', 'name': '겨울코트', 'emoji': '🧥', 'from': 'c'},
    {'key': 'g', 'name': '헬스복', 'emoji': '🎽', 'from': 'g'},
    {'key': 'p', 'name': '놀이공원룩', 'emoji': '🎡', 'from': 'p'},
]}
SLOTS = ['morning', 'day', 'evening', 'night']  # 아침 6~11 · 낮 11~17 · 저녁 17~21 · 밤 21~6


def media(rel):
    """그림(.webp)과 움직이는 영상(.mp4)이 있으면 경로를 돌려준다."""
    out = {}
    for ext, k in (('webp', 'img'), ('mp4', 'video')):
        if os.path.exists(os.path.join(ROOT, f'{rel}.{ext}')):
            out[k] = f'{rel}.{ext}'
    return out


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
        rewards = []
        for r in REWARDS + REWARDS_EXTRA.get(code, []):
            m = media(f'assets/{code}/reward/{r["key"]}')
            if not m and code == 'ns':  # 수현은 예전 가로 그림이라도 쓴다
                m = media(f'assets/ns/{r["from"]}/cover')
                if m: m['focus'] = FOCUS.get(f'ns/{r["from"]}', 50)
            if (w := media(f'assets/{code}/reward-wide/{r["key"]}')):
                m['wide'] = w
            rewards.append({k: v for k, v in r.items() if k != 'from'} | m)
        c['rewards'] = rewards
        # 세로(폰) scene/, 가로(태블릿) scene-wide/ — 앱이 화면 방향에 맞춰 고른다
        c['scenes'] = {}
        for slot in SLOTS:
            m, w = media(f'assets/{code}/scene/{slot}'), media(f'assets/{code}/scene-wide/{slot}')
            if w: m['wide'] = w
            if m: c['scenes'][slot] = m
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
