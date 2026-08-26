#!/usr/bin/env python3
"""
@module tome_full_importer.py
@category scripts
@description ToME 2.3.5 4대 마스터 데이터베이스(r_info, k_info, e_info, a_info) 전수 파서 및 통합 ECS 데이터셋 생성기.
@author 타쿠미 코하루 (Dev Agent)
"""

import sys
import os
import re
import json
import argparse
import urllib.request
from datetime import datetime, timezone

TOME_BASE_URL = "https://raw.githubusercontent.com/tome2/tome2/master/lib/edit"

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

TVAL_MAP = {
    1: {'type': 'SKELETON', 'slotType': None, 'char': '&'},
    2: {'type': 'BOTTLE', 'slotType': None, 'char': '!'},
    3: {'type': 'JUNK', 'slotType': None, 'char': '~'},
    4: {'type': 'SPIKE', 'slotType': None, 'char': '~'},
    5: {'type': 'CHEST', 'slotType': None, 'char': '~'},
    10: {'type': 'AMMO', 'slotType': None, 'char': '{'},
    11: {'type': 'AMMO', 'slotType': None, 'char': '{'},
    12: {'type': 'AMMO', 'slotType': None, 'char': '{'},
    16: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '}'}, # Bow
    17: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '}'}, # Crossbow
    18: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '}'}, # Sling
    20: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '\\'}, # Blunt
    21: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '/'},  # Polearm
    22: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '|'},  # Sword
    23: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '|'},  # Dagger
    24: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '\\'}, # Axe
    30: {'type': 'BOOTS', 'slotType': 'ARMOR', 'char': ']'},
    31: {'type': 'GLOVES', 'slotType': 'ARMOR', 'char': ']'},
    32: {'type': 'HELMET', 'slotType': 'HELMET', 'char': ']'},
    33: {'type': 'CROWN', 'slotType': 'HELMET', 'char': ']'},
    34: {'type': 'SHIELD', 'slotType': 'ARMOR', 'char': ')'},
    35: {'type': 'CLOAK', 'slotType': 'ARMOR', 'char': '('},
    36: {'type': 'ARMOR', 'slotType': 'ARMOR', 'char': '['},
    37: {'type': 'ARMOR', 'slotType': 'ARMOR', 'char': '['},
    38: {'type': 'ARMOR', 'slotType': 'ARMOR', 'char': '['},
    39: {'type': 'LAMP', 'slotType': 'LIGHT', 'char': '~'},
    40: {'type': 'AMULET', 'slotType': 'AMULET', 'char': '"'},
    45: {'type': 'RING', 'slotType': 'RING', 'char': '='},
    55: {'type': 'STAFF', 'slotType': 'WEAPON', 'char': '/'},
    65: {'type': 'WAND', 'slotType': None, 'char': '-'},
    66: {'type': 'ROD', 'slotType': None, 'char': '-'},
    70: {'type': 'SCROLL', 'slotType': None, 'char': '?'},
    71: {'type': 'SCROLL', 'slotType': None, 'char': '?'},
    75: {'type': 'POTION', 'slotType': None, 'char': '!'},
    76: {'type': 'POTION', 'slotType': None, 'char': '!'},
    77: {'type': 'POTION', 'slotType': None, 'char': '!'},
    80: {'type': 'FOOD', 'slotType': None, 'char': ','},
    90: {'type': 'BOOK', 'slotType': None, 'char': '?'},
    100: {'type': 'GOLD', 'slotType': None, 'char': '$'},
}

def sanitize_key(prefix, name):
    clean = re.sub(r'[^a-zA-Z0-9]', '_', name).upper()
    clean = re.sub(r'_+', '_', clean).strip('_')
    return f"{prefix}_{clean}"

def fetch_file(filename):
    url = f"{TOME_BASE_URL}/{filename}"
    print(f"🌐 [Fetcher] Downloading {filename} from {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'ToME-Full-Importer/1.3.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('latin1')

def parse_dice_avg(formula):
    if not formula: return 5
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

def parse_monsters(text):
    chunks = [c.strip() for c in text.split('\n\n') if c.strip().startswith('N:')]
    monsters = {}
    for chunk in chunks:
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        n_line = next((l for l in lines if l.startswith('N:')), None)
        if not n_line: continue
        n_parts = n_line.split(':', 2)
        if len(n_parts) < 3: continue
        tome_id = int(n_parts[1])
        name = n_parts[2].strip()
        if tome_id == 0: continue

        g_line = next((l for l in lines if l.startswith('G:')), 'G:m:w')
        g_parts = g_line.split(':')
        char = g_parts[1] if len(g_parts) > 1 else 'm'
        color_code = g_parts[2] if len(g_parts) > 2 else 'w'
        hex_color = COLOR_MAP.get(color_code, '#cbd5e1')

        i_line = next((l for l in lines if l.startswith('I:')), 'I:110:1d4:10:1:10')
        i_parts = i_line.split(':')
        raw_speed = int(i_parts[1]) if len(i_parts) > 1 and i_parts[1].isdigit() else 110
        hp_formula = i_parts[2] if len(i_parts) > 2 else '1d4'
        ac_val = int(i_parts[4]) if len(i_parts) > 4 and i_parts[4].isdigit() else 1

        w_line = next((l for l in lines if l.startswith('W:')), 'W:1:1:0:1')
        w_parts = w_line.split(':')
        level = int(w_parts[1]) if len(w_parts) > 1 and w_parts[1].isdigit() else 1
        level = max(1, level)
        rarity = int(w_parts[2]) if len(w_parts) > 2 and w_parts[2].isdigit() else 1
        exp_val = int(w_parts[4]) if len(w_parts) > 4 and w_parts[4].isdigit() else 1

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

        flags = []
        for f in [l for l in lines if l.startswith('F:')]:
            flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

        spells = []
        for s in [l for l in lines if l.startswith('S:')]:
            spells.extend([spell.strip() for spell in s[2:].split('|') if spell.strip()])

        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        desc = ' '.join(d_lines) if d_lines else f"A dangerous creature from the depths of ToME (Level {level})."

        avg_hp = parse_dice_avg(hp_formula)
        dex = max(4, min(160, int(8 + (raw_speed - 110) * 0.8 + level * 0.5)))
        con = max(4, min(180, int(6 + (avg_hp / 6.0) + level * 0.5)))
        str_val = max(4, min(200, int(8 + total_atk_dmg * 1.2 + level * 0.7)))
        has_magic = len(spells) > 0 or 'SMART' in flags or 'SPELL' in flags
        int_val = max(3, min(180, int(10 + len(spells) * 3 + level * 0.8) if has_magic else int(4 + level * 0.3)))
        cha = max(4, min(180, int(14 + level * 0.8) if 'UNIQUE' in flags else int(6 + level * 0.3)))

        core_base = {'str': str_val, 'dex': dex, 'con': con, 'int': int_val, 'cha': cha}
        core_max = {
            'str': min(250, int(str_val + level * 1.5)),
            'dex': min(200, int(dex + level * 1.2)),
            'con': min(250, int(con + level * 1.5)),
            'int': min(250, int(int_val + level * 1.5)),
            'cha': min(200, int(cha + level * 1.0))
        }

        growth_type = 'MAGE' if int_val > str_val and int_val > dex else 'ROGUE' if dex > str_val and dex > con else 'TANK' if con > str_val and con > dex else 'WARRIOR' if str_val > dex and str_val > int_val else 'BALANCED'

        breath_elem = None
        ai_pattern = 'STANDARD'
        for s in spells:
            if s.startswith('BR_') or s.startswith('BA_'):
                breath_elem = 'FIRE' if 'FIRE' in s else 'COLD' if 'COLD' in s or 'FROS' in s else 'LIGHTNING' if 'ELEC' in s or 'LIGHT' in s else 'ACID' if 'ACID' in s or 'POIS' in s else 'DARK'
                ai_pattern = 'BREATH'
                break

        key = sanitize_key("MON", name)
        monsters[key] = {
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
            "attacks": attacks,
            "flags": flags,
            "spells": spells,
            "flavorText": desc,
            "description": desc
        }
    return monsters

def parse_kinds(text):
    chunks = [c.strip() for c in text.split('\n\n') if c.strip().startswith('N:')]
    kinds = {}
    for chunk in chunks:
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        n_line = next((l for l in lines if l.startswith('N:')), None)
        if not n_line: continue
        n_parts = n_line.split(':', 2)
        if len(n_parts) < 3: continue
        item_id = int(n_parts[1])
        name = n_parts[2].strip()
        if item_id == 0 or name == "something": continue

        g_line = next((l for l in lines if l.startswith('G:')), None)
        char = '?'
        color = '#cbd5e1'
        if g_line:
            g_parts = g_line.split(':')
            if len(g_parts) > 1: char = g_parts[1]
            if len(g_parts) > 2: color = COLOR_MAP.get(g_parts[2], '#cbd5e1')

        i_line = next((l for l in lines if l.startswith('I:')), None)
        tval, sval, pval = 0, 0, 0
        if i_line:
            i_parts = i_line.split(':')
            if len(i_parts) > 1 and i_parts[1].isdigit(): tval = int(i_parts[1])
            if len(i_parts) > 2 and i_parts[2].isdigit(): sval = int(i_parts[2])
            if len(i_parts) > 3 and i_parts[3].lstrip('-').isdigit(): pval = int(i_parts[3])

        w_line = next((l for l in lines if l.startswith('W:')), None)
        level, weight, cost = 1, 10, 10
        if w_line:
            w_parts = w_line.split(':')
            if len(w_parts) > 1 and w_parts[1].isdigit(): level = int(w_parts[1])
            if len(w_parts) > 3 and w_parts[3].isdigit(): weight = int(w_parts[3])
            if len(w_parts) > 4 and w_parts[4].isdigit(): cost = int(w_parts[4])

        p_line = next((l for l in lines if l.startswith('P:')), None)
        base_ac = 0
        dice = None
        if p_line:
            p_parts = p_line.split(':')
            if len(p_parts) > 1 and p_parts[1].isdigit(): base_ac = int(p_parts[1])
            if len(p_parts) > 2 and 'd' in p_parts[2]: dice = p_parts[2].strip()

        flags = []
        for f in [l for l in lines if l.startswith('F:')]:
            flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        flavor_text = " ".join(d_lines) if d_lines else f"A standard {name} from ToME."

        mapping = TVAL_MAP.get(tval, {'type': 'ITEM', 'slotType': None, 'char': char})
        key = sanitize_key("KIND", name)
        kinds[key] = {
            "key": key,
            "id": item_id,
            "name": name,
            "tval": tval,
            "sval": sval,
            "type": mapping['type'],
            "slotType": mapping['slotType'],
            "char": mapping.get('char', char),
            "color": color,
            "level": max(1, level),
            "weight": max(1, int(weight / 10.0)),
            "cost": cost,
            "baseAC": base_ac,
            "dice": dice,
            "flags": flags,
            "flavorText": flavor_text
        }
    return kinds

def parse_egos(text):
    chunks = [c.strip() for c in text.split('\n\n') if c.strip().startswith('N:')]
    egos = {}
    for chunk in chunks:
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        n_line = next((l for l in lines if l.startswith('N:')), None)
        if not n_line: continue
        n_parts = n_line.split(':', 2)
        if len(n_parts) < 3: continue
        ego_id = int(n_parts[1])
        name = n_parts[2].strip()

        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        flavor_text = " ".join(d_lines) if d_lines else f"Ego power: {name}"

        flags = []
        for f in [l for l in lines if l.startswith('F:')]:
            flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

        key = sanitize_key("EGO", name)
        egos[key] = {
            "key": key,
            "id": ego_id,
            "name": name,
            "flags": flags,
            "flavorText": flavor_text
        }
    return egos

def parse_artifacts(text):
    chunks = [c.strip() for c in text.split('\n\n') if c.strip().startswith('N:')]
    artifacts = {}
    for chunk in chunks:
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        n_line = next((l for l in lines if l.startswith('N:')), None)
        if not n_line: continue
        n_parts = n_line.split(':', 2)
        if len(n_parts) < 3: continue
        art_id = int(n_parts[1])
        name = n_parts[2].strip()
        if art_id == 0: continue

        i_line = next((l for l in lines if l.startswith('I:')), None)
        tval, sval, pval = 0, 0, 0
        if i_line:
            i_parts = i_line.split(':')
            if len(i_parts) > 1 and i_parts[1].isdigit(): tval = int(i_parts[1])
            if len(i_parts) > 2 and i_parts[2].isdigit(): sval = int(i_parts[2])
            if len(i_parts) > 3 and i_parts[3].lstrip('-').isdigit(): pval = int(i_parts[3])

        w_line = next((l for l in lines if l.startswith('W:')), None)
        level, rarity, weight, cost = 1, 1, 10, 1000
        if w_line:
            w_parts = w_line.split(':')
            if len(w_parts) > 1 and w_parts[1].isdigit(): level = int(w_parts[1])
            if len(w_parts) > 2 and w_parts[2].isdigit(): rarity = int(w_parts[2])
            if len(w_parts) > 3 and w_parts[3].isdigit(): weight = int(w_parts[3])
            if len(w_parts) > 4 and w_parts[4].isdigit(): cost = int(w_parts[4])

        p_line = next((l for l in lines if l.startswith('P:')), None)
        base_ac = 0
        dice = None
        to_h, to_d, to_a = 0, 0, 0
        if p_line:
            p_parts = p_line.split(':')
            if len(p_parts) > 1 and p_parts[1].isdigit(): base_ac = int(p_parts[1])
            if len(p_parts) > 2 and 'd' in p_parts[2]: dice = p_parts[2].strip()
            if len(p_parts) > 3 and p_parts[3].lstrip('-').isdigit(): to_h = int(p_parts[3])
            if len(p_parts) > 4 and p_parts[4].lstrip('-').isdigit(): to_d = int(p_parts[4])
            if len(p_parts) > 5 and p_parts[5].lstrip('-').isdigit(): to_a = int(p_parts[5])

        flags = []
        for f in [l for l in lines if l.startswith('F:')]:
            flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        flavor_text = " ".join(d_lines) if d_lines else f"A legendary artifact: {name}."

        mapping = TVAL_MAP.get(tval, {'type': 'ARTIFACT', 'slotType': 'WEAPON', 'char': '|'})
        key = sanitize_key("ART", name)
        artifacts[key] = {
            "key": key,
            "id": art_id,
            "name": f"유물: {name}",
            "rawName": name,
            "tval": tval,
            "sval": sval,
            "type": mapping['type'],
            "slotType": mapping['slotType'],
            "char": mapping.get('char', '|'),
            "color": "#ffd700",
            "level": max(1, level),
            "rarity": rarity,
            "weight": max(1, int(weight / 10.0)),
            "cost": cost,
            "baseAC": base_ac + to_a,
            "dice": dice,
            "flags": flags,
            "flavorText": flavor_text
        }
    return artifacts

def main():
    print("🚀 [ToME Full Importer] Fetching all 4 ToME 2.3.5 master databases...")
    r_text = fetch_file("r_info.txt")
    k_text = fetch_file("k_info.txt")
    e_text = fetch_file("e_info.txt")
    a_text = fetch_file("a_info.txt")

    monsters = parse_monsters(r_text)
    kinds = parse_kinds(k_text)
    egos = parse_egos(e_text)
    artifacts = parse_artifacts(a_text)

    print(f"✅ Parsed {len(monsters)} Monsters (r_info.txt)")
    print(f"✅ Parsed {len(kinds)} Base Kinds (k_info.txt)")
    print(f"✅ Parsed {len(egos)} Egos (e_info.txt)")
    print(f"✅ Parsed {len(artifacts)} Artifacts (a_info.txt)")

    base_dir = "/data/data/com.termux/files/home/opendcmart/mimicry_voxel/src/entities"
    os.makedirs(base_dir, exist_ok=True)

    # Save individual JSON datasets
    datasets = {
        "tome_monsters.json": monsters,
        "tome_kinds.json": kinds,
        "tome_egos.json": egos,
        "tome_artifacts.json": artifacts
    }

    for fname, data in datasets.items():
        fpath = os.path.join(base_dir, fname)
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump({
                "metadata": {
                    "source": f"ToME 2.3.5 {fname}",
                    "version": "1.3.0",
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "count": len(data)
                },
                "data": data
            }, f, indent=2, ensure_ascii=False)
        print(f"📦 Saved {fname} ({len(data)} entries) -> {fpath}")

    # Unified Master Dataset
    unified_path = os.path.join(base_dir, "tome_data.json")
    with open(unified_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "source": "ToME 2.3.5 Master Database",
                "version": "1.3.0",
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "totalMonsters": len(monsters),
                "totalKinds": len(kinds),
                "totalEgos": len(egos),
                "totalArtifacts": len(artifacts)
            },
            "monsters": monsters,
            "kinds": kinds,
            "egos": egos,
            "artifacts": artifacts
        }, f, indent=2, ensure_ascii=False)
    print(f"🎉 Unified dataset saved -> {unified_path}")

    # Generate Pure JS ESM Data Modules for 100% Synchronous Zero-Latency Browser & Node.js Execution
    js_modules = {
        "TomeMonstersData.js": ("TOME_MONSTERS_DATA", monsters),
        "TomeKindsData.js": ("TOME_KINDS_DATA", kinds),
        "TomeEgosData.js": ("TOME_EGOS_DATA", egos),
        "TomeArtifactsData.js": ("TOME_ARTIFACTS_DATA", artifacts),
    }

    for fname, (export_name, data_obj) in js_modules.items():
        jspath = os.path.join(base_dir, fname)
        with open(jspath, "w", encoding="utf-8") as f:
            f.write(f"/**\n * @module {fname}\n * @description ToME 2.3.5 Pure ESM Data Module ({len(data_obj)} entries)\n */\n\n")
            f.write(f"export const {export_name} = Object.freeze(")
            json.dump(data_obj, f, indent=2, ensure_ascii=False)
            f.write(");\n")
        print(f"📦 [ESM Module] Saved {fname} ({len(data_obj)} entries) -> {jspath}")

if __name__ == "__main__":
    main()
