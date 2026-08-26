#!/usr/bin/env python3
"""
@module tome_monster_importer.py
@category scripts
@description 오픈소스 ToME 2.3.5 (Tales of Middle-Earth) 몬스터 데이터셋(r_info.txt) 파서 및
             미미크리 Voxel Data-Oriented ECS 몬스터/코어 데이터 변환기.
@author 타쿠미 코하루 (Dev Agent) & 카스미 루리 (Research Agent)
"""

import sys
import os
import re
import json
import argparse
import urllib.request
from datetime import datetime

TOME_RAW_URL = "https://raw.githubusercontent.com/tome2/tome2/master/lib/edit/r_info.txt"

# ToME / Angband 16-Color Hex Mapping
COLOR_MAP = {
    'w': '#f8fafc',  # White
    's': '#94a3b8',  # Slate / Grey
    'o': '#f97316',  # Orange
    'r': '#ef4444',  # Red
    'g': '#22c55e',  # Green
    'b': '#3b82f6',  # Blue
    'u': '#b45309',  # Umber / Brown
    'D': '#475569',  # Dark Grey
    'W': '#cbd5e1',  # Light Slate / Silver
    'P': '#a855f7',  # Purple / Violet
    'y': '#eab308',  # Yellow
    'R': '#f87171',  # Light Red
    'G': '#4ade80',  # Light Green
    'B': '#38bdf8',  # Light Blue / Cyan
    'U': '#d97706',  # Light Umber
    'v': '#ec4899',  # Violet / Pink
}

# Element Mappings from Spells / Flags
ELEMENT_SPELL_MAP = {
    'BR_FIRE': 'FIRE',
    'BA_FIRE': 'FIRE',
    'BO_FIRE': 'FIRE',
    'BR_COLD': 'COLD',
    'BA_COLD': 'COLD',
    'BO_COLD': 'COLD',
    'BR_FROS': 'COLD',
    'BR_ELEC': 'LIGHTNING',
    'BA_ELEC': 'LIGHTNING',
    'BO_ELEC': 'LIGHTNING',
    'BR_LIGHT': 'LIGHTNING',
    'BR_ACID': 'ACID',
    'BA_ACID': 'ACID',
    'BO_ACID': 'ACID',
    'BR_POIS': 'ACID',
    'BA_POIS': 'ACID',
    'BR_NETH': 'DARK',
    'BA_NETH': 'DARK',
    'BR_DARK': 'DARK',
    'BR_MANA': 'MANA',
    'BA_MANA': 'MANA',
}

# Perk Mapping from ToME Flags
FLAG_PERK_MAP = {
    'IM_FIRE': 'FIRE_RESIST',
    'RES_FIRE': 'FIRE_RESIST',
    'IM_COLD': 'COLD_RESIST',
    'RES_COLD': 'COLD_RESIST',
    'IM_ELEC': 'LIGHTNING_RESIST',
    'RES_ELEC': 'LIGHTNING_RESIST',
    'IM_ACID': 'ACID_RESIST',
    'RES_ACID': 'ACID_RESIST',
    'IM_POIS': 'ACID_RESIST',
    'REGENERATE': 'REGEN_UNIT',
    'FAST': 'HASTE_UNIT',
    'INVISIBLE': 'STEALTH_UNIT',
    'EVIL': 'DARK_AURA',
    'FORCE_SLEEP': 'SLEEP_AURA',
}

def parse_dice_avg(formula):
    """주사위 수식(예: 2d8+10, 1d4, 5)의 기댓값 평균을 산출합니다."""
    if not formula:
        return 5
    m = re.match(r'(\d+)d(\d+)(?:([+-])(\d+))?', formula.strip())
    if m:
        num, sides = int(m.group(1)), int(m.group(2))
        avg = num * (sides + 1) / 2.0
        if m.group(3) and m.group(4):
            sign = 1 if m.group(3) == '+' else -1
            avg += sign * int(m.group(4))
        return max(1.0, avg)
    try:
        return max(1.0, float(formula.strip()))
    except ValueError:
        return 5.0

def sanitize_key(name):
    """몬스터 이름을 식별자 키(e.g. TOME_ANCIENT_RED_DRAGON)로 변환합니다."""
    clean = re.sub(r'[^a-zA-Z0-9]', '_', name).upper()
    clean = re.sub(r'_+', '_', clean).strip('_')
    return f"TOME_{clean}"

def convert_tome_monster(chunk):
    """ToME 몬스터 텍스트 청크를 파싱하여 Mimicry Voxel ECS 규격 데이터로 변환합니다."""
    lines = [l.strip() for l in chunk.strip().split('\n') if l.strip()]
    if not lines:
        return None

    # N 라인 (Index & Name)
    n_line = next((l for l in lines if l.startswith('N:')), None)
    if not n_line:
        return None
    
    n_parts = n_line.split(':', 2)
    if len(n_parts) < 3:
        return None
    
    tome_id = int(n_parts[1])
    name = n_parts[2].strip()
    if tome_id == 0:  # Skip Player template
        return None

    # G 라인 (Glyph & Color)
    g_line = next((l for l in lines if l.startswith('G:')), 'G:m:w')
    g_parts = g_line.split(':')
    char = g_parts[1] if len(g_parts) > 1 else 'm'
    color_code = g_parts[2] if len(g_parts) > 2 else 'w'
    hex_color = COLOR_MAP.get(color_code, '#cbd5e1')

    # I 라인 (Speed, HP dice, AAF, AC, Alertness)
    i_line = next((l for l in lines if l.startswith('I:')), 'I:110:1d4:10:1:10')
    i_parts = i_line.split(':')
    raw_speed = int(i_parts[1]) if len(i_parts) > 1 and i_parts[1].isdigit() else 110
    hp_formula = i_parts[2] if len(i_parts) > 2 else '1d4'
    ac_val = int(i_parts[4]) if len(i_parts) > 4 and i_parts[4].isdigit() else 1

    # W 라인 (Level, Rarity, Depth, Exp)
    w_line = next((l for l in lines if l.startswith('W:')), 'W:1:1:0:1')
    w_parts = w_line.split(':')
    level = int(w_parts[1]) if len(w_parts) > 1 and w_parts[1].isdigit() else 1
    level = max(1, level)
    rarity = int(w_parts[2]) if len(w_parts) > 2 and w_parts[2].isdigit() else 1
    exp_val = int(w_parts[4]) if len(w_parts) > 4 and w_parts[4].isdigit() else 1

    # B 라인들 (Attacks)
    b_lines = [l for l in lines if l.startswith('B:')]
    attacks = []
    total_atk_dmg = 0
    for b in b_lines:
        b_parts = b.split(':')
        method = b_parts[1] if len(b_parts) > 1 else 'HIT'
        effect = b_parts[2] if len(b_parts) > 2 else 'HURT'
        dmg = b_parts[3] if len(b_parts) > 3 else '1d2'
        attacks.append({'method': method, 'effect': effect, 'damage': dmg})
        total_atk_dmg += parse_dice_avg(dmg)

    # F 라인들 (Flags)
    f_lines = [l for l in lines if l.startswith('F:')]
    flags = []
    for f in f_lines:
        flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

    # S 라인들 (Spells)
    s_lines = [l for l in lines if l.startswith('S:')]
    spells = []
    for s in s_lines:
        spells.extend([spell.strip() for spell in s[2:].split('|') if spell.strip()])

    # D 라인들 (Description)
    d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
    desc = ' '.join(d_lines) if d_lines else f"A dangerous creature from the depths of ToME (Level {level})."

    # --- 카스미 루리 공식 기반 5대 스탯 (STR/DEX/CON/INT/CHA) 수학적 산출 ---
    avg_hp = parse_dice_avg(hp_formula)
    
    # 1. DEX: ToME speed 110 = base 8 + Level bonus + Haste offset
    dex_calc = int(8 + (raw_speed - 110) * 0.8 + level * 0.5)
    dex = max(4, min(160, dex_calc))

    # 2. CON: HP 기댓값 비례 + Level 스케일링
    con_calc = int(6 + (avg_hp / 6.0) + level * 0.5)
    con = max(4, min(180, con_calc))

    # 3. STR: 공격 기댓값 합산 비례 + Level 스케일링
    str_calc = int(8 + total_atk_dmg * 1.2 + level * 0.7)
    str_val = max(4, min(200, str_calc))

    # 4. INT: 마법/스펠 보유 개수 + Level 스케일링
    has_magic = len(spells) > 0 or 'SMART' in flags or 'SPELL' in flags
    if has_magic:
        int_calc = int(10 + len(spells) * 3 + level * 0.8)
    else:
        int_calc = int(4 + level * 0.3)
    int_val = max(3, min(180, int_calc))

    # 5. CHA: Unique(보스)/Rarity/Level 비례
    is_unique = 'UNIQUE' in flags
    if is_unique:
        cha_calc = int(14 + level * 0.8)
    else:
        cha_calc = int(6 + level * 0.3)
    cha = max(4, min(180, cha_calc))

    # ECS 스탯 성장 한계선 (Core Base & Core Max)
    core_base = {'str': str_val, 'dex': dex, 'con': con, 'int': int_val, 'cha': cha}
    core_max = {
        'str': min(250, int(str_val + level * 1.5)),
        'dex': min(200, int(dex + level * 1.2)),
        'con': min(250, int(con + level * 1.5)),
        'int': min(250, int(int_val + level * 1.5)),
        'cha': min(200, int(cha + level * 1.0))
    }

    # Growth Type 판별
    if int_val > str_val and int_val > dex:
        growth_type = 'MAGE'
    elif dex > str_val and dex > con:
        growth_type = 'ROGUE'
    elif con > str_val and con > dex:
        growth_type = 'TANK'
    elif str_val > dex and str_val > int_val:
        growth_type = 'WARRIOR'
    else:
        growth_type = 'BALANCED'

    # AI 패턴 및 브레스/스킬 판별
    breath_elem = None
    ai_pattern = 'STANDARD'
    for s in spells:
        if s.startswith('BR_') or s.startswith('BA_'):
            breath_elem = ELEMENT_SPELL_MAP.get(s, 'FIRE')
            ai_pattern = 'BREATH'
            break

    if ai_pattern != 'BREATH':
        if 'ANIMAL' in flags and ('FRIENDS' in flags or 'MULTIPLY' in flags) and level <= 3:
            ai_pattern = 'FLEE'
        elif 'MULTIPLY' in flags or 'FRIENDS' in flags:
            ai_pattern = 'SWARM'

    # Perks & Synergy Tags 도출
    perks = []
    for f in flags:
        if f in FLAG_PERK_MAP:
            perks.append(FLAG_PERK_MAP[f])
    if is_unique:
        perks.append('BOSS_MAJESTY')
    if raw_speed >= 120:
        perks.append('HASTE_UNIT')

    perks = list(set(perks))

    # 5단계 코어 스킬트리 자동 합성
    elem_name_kor = "화염" if breath_elem == "FIRE" else "냉기" if breath_elem == "COLD" else "전격" if breath_elem == "LIGHTNING" else "산성" if breath_elem == "ACID" else "원소"
    skill_tree = [
        {"pt": 1, "name": f"{name}의 본능", "desc": f"신체 능력이 단련되어 기본 스탯({growth_type})이 +10% 증폭됩니다.", "type": "PASSIVE"},
        {"pt": 3, "name": f"{name}의 감각", "desc": "주변 위협을 기민하게 감지하고 명중 및 회피 판정에 보너스를 받습니다.", "type": "PASSIVE"},
        {"pt": 5, "name": f"{name}의 격타" if ai_pattern != "BREATH" else f"{elem_name_kor} 브레스", "desc": f"적에게 강력한 {elem_name_kor} 일격을 가합니다.", "type": "ACTIVE"},
        {"pt": 7, "name": f"{name}의 혈통", "desc": "영혼의 유대가 깊어져 관련 저항 및 시너지 효과가 영구 증대됩니다.", "type": "PASSIVE"},
        {"pt": 10, "name": f"태고의 {name} 각성", "desc": f"{name}의 진정한 권능을 해방하여 파괴적인 광역 폭발을 발동합니다.", "type": "ACTIVE"}
    ]

    key = sanitize_key(name)
    
    return {
        "key": key,
        "tomeId": tome_id,
        "name": name,
        "char": char,
        "baseColor": hex_color,
        "level": level,
        "rarity": rarity,
        "exp": exp_val,
        "baseAC": min(45, max(8, ac_val)),
        "coreBaseHp": max(5, int(avg_hp)),
        "speed": max(3.5, min(14.0, 4.0 + (raw_speed - 100) * 0.15)),
        "growthType": growth_type,
        "coreBase": core_base,
        "coreMax": core_max,
        "aiPattern": ai_pattern,
        "breathElement": breath_elem,
        "perks": perks,
        "attacks": attacks,
        "flags": flags,
        "spells": spells,
        "skillTree": skill_tree,
        "description": desc
    }

def main():
    parser = argparse.ArgumentParser(description="ToME 2.3.5 r_info.txt Monster Importer for Mimicry Voxel ECS")
    parser.add_argument("--fetch", action="store_true", help="Fetch r_info.txt from ToME official GitHub repository")
    parser.add_argument("--input", "-i", type=str, help="Local r_info.txt file path")
    parser.add_argument("--output", "-o", type=str, default="src/entities/tome_monsters.json", help="Output JSON path")
    parser.add_argument("--limit", "-l", type=int, default=None, help="Limit number of imported monsters")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose conversion log")

    args = parser.parse_args()

    raw_text = None
    if args.input and os.path.exists(args.input):
        print(f"📖 [ToME Importer] Reading local file: {args.input}")
        with open(args.input, "r", encoding="latin1") as f:
            raw_text = f.read()
    else:
        print(f"🌐 [ToME Importer] Fetching from official repository: {TOME_RAW_URL}")
        req = urllib.request.Request(TOME_RAW_URL, headers={'User-Agent': 'Mimicry-Voxel-Importer/1.3.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_text = resp.read().decode('latin1')

    if not raw_text:
        print("❌ [ToME Importer] Failed to obtain r_info.txt content.")
        sys.exit(1)

    raw_chunks = raw_text.split('\n\n')
    print(f"🔍 [ToME Importer] Found {len(raw_chunks)} raw definition chunks.")

    monsters = {}
    total_parsed = 0

    for chunk in raw_chunks:
        if not chunk.strip().startswith('N:'):
            continue
        try:
            m_data = convert_tome_monster(chunk)
            if m_data:
                monsters[m_data["key"]] = m_data
                total_parsed += 1
                if args.verbose:
                    print(f"  + Converted [#{m_data['tomeId']}] {m_data['name']} (Lv.{m_data['level']} {m_data['growthType']})")
                if args.limit and total_parsed >= args.limit:
                    break
        except Exception as e:
            if args.verbose:
                print(f"  ! Skipped chunk due to error: {e}")

    # Save output JSON
    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    dataset_payload = {
        "metadata": {
            "source": "Tales of Middle-Earth (ToME) 2.3.5 r_info.txt",
            "version": "1.3.0",
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "totalMonsters": len(monsters)
        },
        "monsters": monsters
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dataset_payload, f, indent=2, ensure_ascii=False)

    print(f"✅ [ToME Importer] Successfully converted {len(monsters)} monsters to ECS format!")
    print(f"📦 [ToME Importer] Output saved to: {output_path}")

if __name__ == "__main__":
    main()
