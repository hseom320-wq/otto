"""연서·혜린·소영·태린 시간대 장면 + 5명 보상씬 설정 (gen_scenes.py가 불러 쓴다)

보상씬 복장 (11/6 확정): 5명 공용 9종 — 메이드·간호사·바니·산타·수녀·비키니·겨울코트·아이돌 무대의상(모두 부끄러워함)·웨딩
                         + 수현 전용 바텐더. 복장 태그는 수현 기준에서 수현 고유 소품(초커)만 빼고 각자의 외형과 합친다.
수위: 15세 이용가 수준. 노출·몸매 강조 구도는 쓰지 않는다 (네거티브로 막음).
"""

# 각자의 기본(a) 복장 태그 — 보상씬에서는 이걸 빼고 복장을 넣는다
A_OUTFIT = {
    'ns': '1.3::cropped hoodie::, white hoodie, open hoodie, long sleeves, 1.3::black crop top::, black shirt under hoodie, midriff, navel, cargo pants, olive pants',
    'ys': '1.3::messy hair::, 1.3::glasses::, 1.3::round eyewear::, thin-framed eyewear, 1.2::light reflecting on glasses::, 1.4::olive green quilted jacket::, 1.2::padded jacket::, oversized jacket, 1.3::sleeves past fingers::, white t-shirt, 1.3::grey sweatpants::',
    'hr': '1.3::white ribbed sweater::, turtleneck, long sleeves, 1.2::sleeves rolled up::, 1.3::apron::, 1.2::blue jeans::, 1.3::wedding ring::',
    'sy': '1.2::ahoge::, 1.2::untying hair::, 1.3::hair tie in mouth::, 1.3::office lady::, 1.3::navy suit jacket::, 1.3::jacket partially removed::, 1.3::white collared shirt::, 1.2::untucked shirt::, open collar, 1.3::navy pencil skirt::, 1.2::black pantyhose::, 1.2::brown shoulder bag::',
    'tr': '1.4::black leather jacket::, biker jacket, open jacket, 1.2::jacket partially removed::, 1.3::arm tattoo::, 1.3::red shirt::, collared shirt, 1.2::partially unbuttoned::, 1.3::gold chain::, gold necklace, 1.2::gold watch::, wristwatch, 1.3::sunglasses::, eyewear on head, 1.3::black jeans::, torn jeans, combat boots',
}
# 복장을 바꿔도 남기는 상징
KEEP = {
    'ns': '', 'ys': '1.3::glasses::, 1.3::round eyewear::, thin-framed eyewear, ',
    'hr': '1.3::wedding ring::, ', 'sy': '', 'tr': '1.3::arm tattoo::, ',
}
BODY_FIX = [('thick thighs, ', '')]  # 허벅지에 시선이 쏠리는 것만 뺀다 (11/6 완화)
NEON = ('glowing city lights, neon lights, ', '')
SAFE_NEG = ', 1.4::deep cleavage::, 1.2::cleavage::, 1.4::huge breasts::, 1.4::leotard::, 1.4::lingerie::, 1.5::panties::, 1.5::pantyshot::, 1.4::upskirt::, 1.5::spread legs::, 1.4::crotch::, 1.4::breast focus::, 1.4::ass focus::, 1.4::thigh focus::, 1.4::sexually suggestive::, 1.3::underboob::, 1.3::sideboob::, 1.3::from below::, 1.3::latex::, 1.3::breast press::, 1.3::cleavage cutout::, 1.3::pelvic curtain::'
WARM = '1.3::warm lighting::, 1.2::orange tint::, morning sunlight'
WARM_NEG = ', 1.4::blue tint::, 1.3::cool lighting::, 1.2::blue theme::'
HR_OPEN = ('1.4::closed eyes::', '1.3::half-closed eyes::, 1.4::purple eyes::')  # 혜린이 눈을 뜨는 장면
BG = '1.3::blurry background::'

COSTUME = {
    'md': ('메이드', '🧹', '1.4::victorian maid::, 1.5::long maid dress::, 1.4::black long dress::, 1.4::floor length skirt::, 1.3::high collar::, 1.4::long sleeves::, 1.3::white cuffs::, 1.4::frilled shoulders::, 1.5::full length white apron::, maid headdress, 1.2::modest::'),
    'nr': ('간호사', '🩺', '1.4::nurse::, white nurse uniform, nurse cap, short sleeves, white dress, 1.2::knee-length skirt::, stethoscope around neck'),
    'bn': ('토끼 귀 잠옷', '🐰', '1.4::animal hood::, 1.4::rabbit hood::, 1.3::hood up::, 1.4::bunny pajamas::, 1.3::onesie::, fluffy, 1.3::long sleeves::, 1.3::loose clothes::, pastel pink, 1.2::modest::'),
    'xm': ('산타', '🎄', '1.4::santa costume::, red dress, 1.3::fur-trimmed dress::, fur-trimmed sleeves, long sleeves, 1.2::santa hat::, red thighhighs'),
    'nn': ('수녀', '📿', '1.4::nun::, 1.5::black long dress::, 1.4::high neck::, 1.3::black veil::, white headscarf, 1.3::detached sleeves::, black detached sleeves, white cuffs, 1.3::white thighhighs::, black shoes'),
    't': ('비키니', '👙', '1.4::bikini::, 1.3::open shirt::, 1.3::white shirt over swimsuit::, 1.2::shirt over bikini::, beach, barefoot'),
    'c': ('겨울코트', '🧥', '1.3::open coat::, beige long coat, winter coat, 1.4::turtleneck sweater::, knit sweater, ribbed sweater, long sleeves, 1.2::plaid scarf::, knit scarf, black skirt, black pantyhose, ankle boots, winter clothes'),
    'id': ('아이돌 무대의상', '🎤', '1.4::idol::, 1.3::idol clothes::, frilled dress, 1.2::sparkling costume::, short sleeves, 1.2::hair ribbon::, white boots, 1.3::holding microphone::'),
    'w': ('웨딩드레스', '💍', '1.5::wedding dress::, 1.4::white dress::, 1.3::lace sleeves::, 1.2::off-shoulder::, 1.4::bridal veil::, 1.3::lace::, 1.3::long skirt::, white gloves, 1.3::bouquet::'),
    'bt': ('바텐더', '🍸', '1.4::bartender::, black vest, white dress shirt, long sleeves, 1.3::black bow tie::, black slacks, rolled-up sleeves'),
}
EXTRA_NEG = {'nn': ['cross', 'necklace', 'pendant', 'jewelry'], 'xm': [], 'bn': []}
EXTRA_ADD = {'xm': ', 1.4::pom pom (clothes)::'}

# 보상씬 장면 (계획서 표 그대로 + 아이돌·겨울코트는 새로)
R = {
    'ns': {
        'md': 'cowboy shot, standing, indoors, living room, curtsey, 1.2::holding skirt::, looking away, 1.3::blush::, red ears, embarrassed, expressionless',
        'nr': 'cowboy shot, standing, indoors, bedroom, 1.3::holding thermometer::, pointing thermometer at viewer, looking at viewer, slight smirk',
        'bn': 'cowboy shot, standing, indoors, living room, 1.3::finger heart::, one eye closed, wink, light smile, blush',
        'xm': 'cowboy shot, standing, indoors, living room, christmas tree, 1.3::holding gift box::, offering gift, looking away, blush, string lights, warm lighting',
        'nn': 'cowboy shot, standing, indoors, night, lamp light, 1.2::own hands together::, shy smile, blush, looking at viewer',
        't': 'cowboy shot, standing, outdoors, beach, sunset, 1.2::holding beach ball::, looking away, blush, wind',
        'c': 'cowboy shot, standing, outdoors, winter, snow, street, night, holding coat open, looking at viewer, light smile, visible breath',
        'id': 'cowboy shot, standing, stage, stage lights, 1.3::covering face with microphone::, looking away, 1.4::blush::, embarrassed',
        'w': 'cowboy shot, standing, indoors, chapel, stained glass, holding bouquet, looking away, 1.3::blush::, embarrassed',
        'bt': 'cowboy shot, standing, indoors, bar, dim lighting, warm lighting, bar counter, bottles, leaning on counter, 1.2::headpat::, closed eyes, embarrassed, blush',
    },
    'ys': {
        'md': 'cowboy shot, standing, indoors, holding tray, teacup, 1.3::glasses slipping::, flustered, :o, blush',
        'nr': 'cowboy shot, 1.4::sitting::, indoors, 1.3::holding bandage::, tangled bandage, flustered, sweatdrop, :o',
        'bn': 'cowboy shot, standing, indoors, bedroom, 1.3::pulling hood down::, 1.4::blush::, looking away, embarrassed',
        'xm': 'cowboy shot, standing, indoors, christmas tree, decorating tree, holding ornament, stumbling, surprised, :o, string lights',
        'nn': 'cowboy shot, standing, indoors, candles, 1.3::holding manuscript::, praying, closed eyes, peaceful',
        't': 'cowboy shot, standing, outdoors, beach, day, beach umbrella, shade, 1.3::holding popsicle::, shy, blush, looking away',
        'c': 'cowboy shot, standing, outdoors, winter, snow, 1.3::face buried in scarf::, mittens, small wave, blush',
        'id': 'cowboy shot, standing, stage, stage lights, 1.3::hugging glowstick::, 1.4::blush::, embarrassed, looking down',
        'w': 'cowboy shot, standing, indoors, chapel, 1.3::tears in eyes::, happy tears, smile, looking at viewer',
    },
    'hr': {
        'md': 'cowboy shot, standing, indoors, pouring tea, teapot, teacup, 1.2::light smile::, head tilt',
        'nr': "cowboy shot, standing, indoors, pov, 1.3::hand on another's forehead::, reaching towards viewer, gentle smile, head tilt",
        'bn': 'cowboy shot, standing, indoors, kitchen, night, holding mug, hot cocoa, relaxed smile, head tilt',
        'xm': 'cowboy shot, standing, indoors, christmas, 1.3::holding cake::, christmas cake, smile, string lights, warm lighting',
        'nn': 'cowboy shot, standing, indoors, candles, 1.3::holding rosary::, light smile, peaceful',
        't': 'cowboy shot, standing, outdoors, beach, beach umbrella, shade, 1.3::sunglasses::, pulling down sunglasses, light smile, looking at viewer',
        'c': 'cowboy shot, standing, outdoors, winter, snow, street, 1.3::holding paper bag::, taiyaki, offering, smile, head tilt',
        'id': 'cowboy shot, standing, stage, stage lights, 1.3::holding microphone with both hands::, 1.4::blush::, embarrassed, nervous smile, sweatdrop',
        'w': 'cowboy shot, standing, indoors, chapel, 1.3::looking at own hand::, wedding ring, 1.3::smile::, happy, tears in eyes',
    },
    'sy': {
        'md': 'cowboy shot, 1.5::lying on couch::, 1.3::holding mop::, exhausted, half-closed eyes, indoors, living room',
        'nr': 'cowboy shot, 1.4::sitting on chair::, indoors, stethoscope in ears, 1.3::dozing::, head tilt, closed eyes',
        'bn': 'cowboy shot, standing, indoors, bedroom, 1.3::bent ears::, tired, v, weak smile, half-closed eyes, holding pillow',
        'xm': 'cowboy shot, 1.4::standing on ladder::, indoors, christmas stocking, hanging stocking, 1.3::yawning::, sleepy',
        'nn': 'cowboy shot, 1.4::sitting::, indoors, candles, candlelight, 1.3::dozing::, head tilt, closed eyes',
        't': 'cowboy shot, standing, outdoors, beach, sea, 1.4::holding swim ring::, 1.2::sleepy::, yawning, half-closed eyes, relaxed',
        'c': 'cowboy shot, standing, outdoors, winter, night, street lamp, snow, visible breath, 1.2::sleepy::, tired smile',
        'id': 'cowboy shot, standing, stage, stage lights, 1.3::failed wink::, laughing, embarrassed, blush',
        'w': 'cowboy shot, standing, indoors, chapel, aisle, 1.3::teary eyes::, trembling lips, about to cry',
    },
    'tr': {
        'md': 'cowboy shot, standing, indoors, 1.3::crossed arms::, looking at viewer, annoyed, blush, sharp teeth',
        'nr': 'cowboy shot, standing, indoors, 1.3::holding syringe::, toy syringe, grin, sharp teeth, playful',
        'bn': 'cowboy shot, 1.4::sitting on couch::, 1.3::hugging pillow::, pillow covering chest, pout, 1.3::blush::, looking away, sharp teeth',
        'xm': 'cowboy shot, standing, outdoors, night, motorcycle, 1.3::gift sack::, carrying sack over shoulder, grin, sharp teeth, snow',
        'nn': 'cowboy shot, standing, indoors, candles, 1.3::spinning rosary::, smirk, sharp teeth',
        't': 'cowboy shot, standing, outdoors, beach, day, 1.3::holding surfboard::, 1.4::oversized t-shirt::, grin, sharp teeth, wet hair',
        'c': 'cowboy shot, standing, outdoors, winter, night, snow, 1.3::hands in pockets::, canned coffee, smirk',
        'id': 'cowboy shot, standing, stage, stage lights, looking away, 1.3::holding microphone::, hand on own cheek, 1.4::blush::, red ears, embarrassed, pout',
        'w': 'cowboy shot, standing, indoors, chapel, 1.3::about to throw bouquet::, grin, sharp teeth, blush',
    },
}

# 시간대 장면 (계획서 표)
SCENES = [
    # 연서 — 깔깔이(a)
    dict(code='ys', slot='morning', base='ys-a', vibe='ys-a', vibe_strength=0.45, neg_add=WARM_NEG + ', 1.4::shorts::, 1.3::standing::',
         label='아침 · 🧥깔깔이 · 밤샘하고 책상에 엎드려 고개만 듦',
         scene=f'1.3::upper body::, 1.5::sitting at desk::, 1.5::head on desk::, 1.4::arms on desk::, 1.3::face on arms::, 1.3::lifting head::, looking up at viewer, sleepy, half-closed eyes, glasses askew, morning, indoors, 1.2::sunlight through curtains::, {WARM}, computer monitor, drawing tablet, messy room, {BG}'),
    dict(code='ys', slot='day', base='ys-a', vibe='ys-a', vibe_strength=0.45, neg_add=WARM_NEG,
         label='낮 · 🧥깔깔이 · 태블릿 펜 문 채 의자 돌려 봄',
         scene=f'1.4::upper body::, sitting on office chair, 1.2::turning around::, 1.3::stylus in mouth::, holding drawing tablet, looking at viewer, 1.2:::o::, blush, day, indoors, messy room, computer monitor, cardboard box, curtains, 1.2::sunlight through curtains::, daylight, {BG}'),
    dict(code='ys', slot='evening', base='ys-a', vibe='ys-a',
         label='저녁 · 🧥깔깔이 · 컵라면 들고 멍하니 봄',
         scene=f'1.4::upper body::, 1.4::sitting on floor::, 1.4::holding cup ramen::, chopsticks, steam, blank stare, :o, looking at viewer, evening, indoors, messy room, lamp light, {BG}'),
    dict(code='ys', slot='night', base='ys-a', vibe='ys-a',
         label='밤 · 🧥깔깔이 · 모니터 빛 아래 의자 위 무릎 안고',
         scene=f'1.3::upper body::, sitting on chair, 1.2::knees up::, hugging own legs, holding stylus, looking at viewer, 1.2:::o::, blush, night, indoors, 1.4::dark room::, 1.4::monitor glow::, 1.2::light on face::, computer monitor, drawing tablet, messy room, cardboard box, {BG}'),
    # 혜린 — 앞치마(a, 빨강) / 밤은 바 외출(b, 눈 뜸)
    dict(code='hr', slot='morning', base='hr-a', vibe='hr-a', fix=[('1.3::apron::', '1.3::red apron::')],
         label='아침 · 🍳앞치마 · 현관에서 반찬통 내밀기 (실눈)',
         scene=f'cowboy shot, standing, 1.3::holding food container::, offering, side dish, smile, head tilt, looking at viewer, morning, indoors, apartment hallway, door, 1.3::bright::, daylight, {BG}'),
    dict(code='hr', slot='day', base='hr-a', vibe='hr-a', fix=[('1.3::apron::', '1.3::red apron::')],
         neg_add=', 1.5::from behind::, 1.4::looking back::, 1.4::ass::, 1.3::back::',
         label='낮 · 🍳앞치마 · 주방에서 국자로 맛보다 눈 마주침',
         scene=f'1.4::upper body::, standing, 1.2::from side::, facing viewer, 1.3::holding ladle::, 1.3::tasting::, ladle near mouth, looking at viewer, light smile, indoors, kitchen, pot, steam, 1.3::bright::, daylight, sunlight through window, day, {BG}'),
    dict(code='hr', slot='evening', base='hr-a', vibe='hr-a', fix=[('1.3::apron::', '1.3::red apron::')],
         label='저녁 · 🍳앞치마 · 오므라이스 내려놓으며',
         scene=f'cowboy shot, standing, 1.3::holding plate::, omurice, ketchup heart, placing plate on table, smile, looking at viewer, indoors, dining table, evening, warm lighting, {BG}'),
    dict(code='hr', slot='night', base='hr-b', vibe='hr-b', vibe_strength=0.45,
         fix=[('1.4::black off-shoulder sweater::, ribbed sweater, bare shoulders, collarbone, 1.3::grey pencil skirt::, 1.2::knee-length skirt::',
               '1.4::black ribbed sweater::, 1.4::turtleneck::, long sleeves, 1.3::grey long skirt::')],
         neg_add=', 1.5::off-shoulder::, 1.4::bare shoulders::, 1.4::panties::, 1.5::pantyshot::, 1.4::upskirt::, 1.3::miniskirt::',
         label='밤 · 🍸바 외출 · 바 카운터에서 마스크 내리며 잔 듦 (눈 뜸)',
         scene=f'1.4::upper body::, 1.3::sitting at bar counter::, arm on counter, 1.4::mask pull::, pulling down mask, holding cup, wine glass, half-closed eyes, light smile, looking at viewer, night, indoors, bar (place), bar counter, bottle, liquor, {BG}'),
    # 소영 — 정장(a) / 밤은 홈웨어(b)
    dict(code='sy', slot='morning', base='sy-a', vibe='sy-a2', vibe_strength=0.45, neg_add=WARM_NEG,
         fix=[('1.2::untying hair::, 1.3::hair tie in mouth::, ', ''), ('1.3::jacket partially removed::, ', ''), ('1.2::untucked shirt::, open collar, ', 'shirt tucked in, '), ('1.2::messy hair::, ', '1.2::high ponytail::, neat hair, ')],
         label='아침 · 👔정장 · 현관 거울 앞 머리 묶으며 엘리트 장착',
         scene=f'cowboy shot, standing, 1.2::tying hair::, mirror, confident smile, looking at viewer, morning, indoors, entrance, sunlight through window, {WARM}, {BG}'),
    dict(code='sy', slot='day', base='sy-a', vibe='sy-a2',
         fix=[('1.2::untying hair::, 1.3::hair tie in mouth::, ', ''), ('1.3::jacket partially removed::, ', ''), ('1.2::untucked shirt::, open collar, ', 'shirt tucked in, '), ('1.2::messy hair::, ', 'neat hair, ')],
         label='낮 · 👔정장 · 통화하다 손가락 하나 들어 "잠깐"',
         scene=f'cowboy shot, standing, 1.3::talking on phone::, holding phone to ear, 1.3::index finger raised::, looking at viewer, day, indoors, office, window, daylight, {BG}'),
    dict(code='sy', slot='evening', base='sy-a', vibe='sy-a2',
         label='저녁 · 👔정장 · 퇴근해 문에 기대 머리끈 입에 묾',
         scene=f'cowboy shot, standing, leaning on door, looking at viewer, bored, tired, evening, indoors, entrance, doorway, light from doorway, {BG}'),
    dict(code='sy', slot='night', base='sy-b', vibe='sy-b',
         label='밤 · 🏠홈웨어 · 소파에서 맥주캔 들고 꾸벅',
         scene=f'cowboy shot, 1.4::sitting on couch::, slouching, 1.2::hugging pillow::, 1.3::holding can::, beer can, 1.3::dozing::, head tilt, half-closed eyes, looking at viewer, night, indoors, 1.3::dark room::, living room, television, cushion, {BG}'),
    # 태린 — 라이더(a) / 낮은 과외룩(b)
    dict(code='tr', slot='morning', base='tr-a', vibe='tr-a', vibe_strength=0.45, neg_add=WARM_NEG, fix=[NEON],
         label='아침 · 🧥라이더 · 오토바이에 기대 헬멧 내밀기',
         scene=f'cowboy shot, standing, leaning on motorcycle, motorcycle, pov, 1.4::holding out helmet::, offering helmet, smirk, sharp teeth, looking at viewer, morning, outdoors, parking lot, sunlight, {WARM}, {BG}'),
    dict(code='tr', slot='day', base='tr-b', vibe='tr-b',
         label='낮 · 🧤과외룩 · 과외 가는 길, 장갑 끼며 돌아봄',
         scene=f'cowboy shot, standing, 1.2::adjusting gloves::, turning head, looking at viewer, 1.2::smirk::, sharp teeth, day, outdoors, city street, sidewalk, winter, sunlight, {BG}'),
    dict(code='tr', slot='evening', base='tr-a', vibe='tr-a', fix=[NEON],
         label='저녁 · 🧥라이더 · 국밥집, 소주잔 들고 "먹어"',
         scene=f'cowboy shot, 1.4::sitting at table::, 1.3::holding shot glass::, soju bottle, bowl, grin, sharp teeth, looking at viewer, evening, indoors, restaurant, warm lighting, {BG}'),
    dict(code='tr', slot='night', base='tr-a', vibe='tr-a', 
         label='밤 · 🧥라이더 · 장부 쓰다 펜 들고 올려봄',
         scene=f'cowboy shot, 1.4::sitting on stairs::, 1.3::holding notebook::, holding pen, looking up, looking at viewer, light smirk, night, indoors, stairwell, dim lighting, {BG}'),
]


# 시간대 장면에도 몸매 강조 억제를 똑같이 건다. 연서는 늘 트레이닝 바지 (참고 그림의 반바지가 따라 나오지 않게)
for _s in SCENES:
    _s['soft'] = BODY_FIX + _s.get('soft', [])
    _s['neg_add'] = _s.get('neg_add', '') + SAFE_NEG
    if _s['code'] == 'ys' and 'shorts' not in _s['neg_add']:
        _s['neg_add'] += ', 1.4::shorts::, 1.3::bare legs::'


def reward_specs():
    out = []
    for code, rows in R.items():
        base = f'{code}-a'
        for key, scene in rows.items():
            name, emoji, tags = COSTUME[key]
            fix = [(A_OUTFIT[code], KEEP[code] + tags)]
            if code == 'hr' and key in ('t', 'w'): fix.append(HR_OPEN)
            if code == 'tr' and key == 'id': fix.append(('1.2::sparkling costume::', '1.4::white idol dress::, 1.3::pastel colors::, 1.3::matte fabric::, 1.2::loose clothes::'))
            if code == 'ns' and key == 'c': fix.append(('1.3::black choker::, plain choker, ', 'silver necklace, '))
            soft = BODY_FIX + [NEON]  # 있으면 바꾸고 없으면 넘어감
            neg_rm = EXTRA_NEG.get(key, [])
            extra = {}
            if code == 'tr': neg_extra = ', 1.4::shiny clothes::'
            else: neg_extra = ''
            out.append(dict(code=code, slot=f'r_{key}', base=base, vibe=f'{code}-a', fix=fix, soft=soft, **extra,
                            neg_add=SAFE_NEG + EXTRA_ADD.get(key, '') + neg_extra, neg_rm=neg_rm,
                            label=f'보상씬 · {emoji} {name}', scene=f'{scene}, {BG}'))
    return out


def all_specs():
    return SCENES + reward_specs()
