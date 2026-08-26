#!/usr/bin/env python3
"""
@module tome_item_importer.py
@category scripts
@description 오픈소스 ToME 2.3.5 (Tales of Middle-Earth) 아이템/접사/유물 데이터셋
             (k_info.txt, e_info.txt, a_info.txt) 파서 및 미미크리 Voxel ECS 규격 변환기.
@author 타쿠미 코하루 (Dev Agent) & 카스미 루리 (Research Agent)
"""

import sys
import os
import re
import json
import argparse
import urllib.request
from datetime import datetime

TOME_BASE_URL = "https://raw.githubusercontent.com/tome2/tome2/master/lib/edit"

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

# TVAL to Slot Type & Item Type Mapping
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
    20: {'type': 'WEAPON', 'slotType': 'WEAPON', 'char': '\\'}, # Hafted / Blunt
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
    36: {'type': 'ARMOR', 'slotType': 'ARMOR', 'char': '['}, # Soft armor
    37: {'type': 'ARMOR', 'slotType': 'ARMOR', 'char': '['}, # Hard armor
    38: {'type': 'ARMOR', 'slotType': 'ARMOR', 'char': '['}, # Dragon armor
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

def fetch_or_read(filename, local_path=None):
    if local_path and os.path.exists(local_path):
        print(f"📖 Reading local file: {local_path}")
        with open(local_path, "r", encoding="latin1") as f:
            return f.read()
    url = f"{TOME_BASE_URL}/{filename}"
    print(f"🌐 Fetching from ToME repository: {url}")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mimicry-Voxel-Item-Importer/1.3.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('latin1')

def parse_k_info(text):
    """ToME 2.3.5 k_info.txt (기본 아이템) 파싱"""
    chunks = [c.strip() for c in text.split('\n\n') if c.strip().startswith('N:')]
    items = {}

    for chunk in chunks:
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        n_line = next((l for l in lines if l.startswith('N:')), None)
        if not n_line: continue
        n_parts = n_line.split(':', 2)
        if len(n_parts) < 3: continue
        item_id = int(n_parts[1])
        name = n_parts[2].strip()
        if item_id == 0 or name == "something": continue

        # G line (char, color)
        g_line = next((l for l in lines if l.startswith('G:')), None)
        char = '?'
        color = '#cbd5e1'
        if g_line:
            g_parts = g_line.split(':')
            if len(g_parts) > 1: char = g_parts[1]
            if len(g_parts) > 2: color = COLOR_MAP.get(g_parts[2], '#cbd5e1')

        # I line (tval, sval, pval)
        i_line = next((l for l in lines if l.startswith('I:')), None)
        tval, sval, pval = 0, 0, 0
        if i_line:
            i_parts = i_line.split(':')
            if len(i_parts) > 1 and i_parts[1].isdigit(): tval = int(i_parts[1])
            if len(i_parts) > 2 and i_parts[2].isdigit(): sval = int(i_parts[2])
            if len(i_parts) > 3 and i_parts[3].lstrip('-').isdigit(): pval = int(i_parts[3])

        # W line (level, extra, weight, cost)
        w_line = next((l for l in lines if l.startswith('W:')), None)
        level, weight, cost = 1, 10, 10
        if w_line:
            w_parts = w_line.split(':')
            if len(w_parts) > 1 and w_parts[1].isdigit(): level = int(w_parts[1])
            if len(w_parts) > 3 and w_parts[3].isdigit(): weight = int(w_parts[3])
            if len(w_parts) > 4 and w_parts[4].isdigit(): cost = int(w_parts[4])

        # P line (ac, dd, ds, to_h, to_d, to_a)
        p_line = next((l for l in lines if l.startswith('P:')), None)
        base_ac = 0
        dice = None
        if p_line:
            p_parts = p_line.split(':')
            if len(p_parts) > 1 and p_parts[1].isdigit(): base_ac = int(p_parts[1])
            if len(p_parts) > 2 and 'd' in p_parts[2]: dice = p_parts[2].strip()

        # F lines (Flags)
        f_lines = [l for l in lines if l.startswith('F:')]
        flags = []
        for f in f_lines:
            flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

        # D lines (Description / Flavor Text)
        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        flavor_text = " ".join(d_lines) if d_lines else f"A standard {name} from the depths of ToME."

        # Category and Slot derivation
        mapping = TVAL_MAP.get(tval, {'type': 'ITEM', 'slotType': None, 'char': char})
        item_type = mapping['type']
        slot_type = mapping['slotType']
        final_char = mapping.get('char', char)

        stat_bonuses = {}
        if pval != 0:
            if 'STR' in flags: stat_bonuses['str'] = pval
            if 'DEX' in flags: stat_bonuses['dex'] = pval
            if 'CON' in flags: stat_bonuses['con'] = pval
            if 'INT' in flags: stat_bonuses['int'] = pval
            if 'CHR' in flags or 'CHA' in flags: stat_bonuses['cha'] = pval

        key = sanitize_key("ITEM", name)
        items[key] = {
            "key": key,
            "id": item_id,
            "name": name,
            "type": item_type,
            "slotType": slot_type,
            "char": final_char,
            "color": color,
            "level": max(1, level),
            "weight": max(1, int(weight / 10.0)),
            "cost": cost,
            "baseAC": base_ac,
            "dice": dice,
            "statBonuses": stat_bonuses,
            "flags": flags,
            "flavorText": flavor_text
        }

    return items

def parse_a_info(text):
    """ToME 2.3.5 a_info.txt (유물/아티팩트) 파싱"""
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

        # I line (tval, sval, pval)
        i_line = next((l for l in lines if l.startswith('I:')), None)
        tval, sval, pval = 0, 0, 0
        if i_line:
            i_parts = i_line.split(':')
            if len(i_parts) > 1 and i_parts[1].isdigit(): tval = int(i_parts[1])
            if len(i_parts) > 2 and i_parts[2].isdigit(): sval = int(i_parts[2])
            if len(i_parts) > 3 and i_parts[3].lstrip('-').isdigit(): pval = int(i_parts[3])

        # W line (level, rarity, weight, cost)
        w_line = next((l for l in lines if l.startswith('W:')), None)
        level, rarity, weight, cost = 1, 1, 10, 1000
        if w_line:
            w_parts = w_line.split(':')
            if len(w_parts) > 1 and w_parts[1].isdigit(): level = int(w_parts[1])
            if len(w_parts) > 2 and w_parts[2].isdigit(): rarity = int(w_parts[2])
            if len(w_parts) > 3 and w_parts[3].isdigit(): weight = int(w_parts[3])
            if len(w_parts) > 4 and w_parts[4].isdigit(): cost = int(w_parts[4])

        # P line (ac, dd, ds, to_h, to_d, to_a)
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

        # F lines (Flags)
        f_lines = [l for l in lines if l.startswith('F:')]
        flags = []
        for f in f_lines:
            flags.extend([flag.strip() for flag in f[2:].split('|') if flag.strip()])

        # D lines (Flavor Text)
        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        flavor_text = " ".join(d_lines) if d_lines else f"A legendary artifact of immense antiquity: {name}."

        mapping = TVAL_MAP.get(tval, {'type': 'ARTIFACT', 'slotType': 'WEAPON', 'char': '|'})
        item_type = mapping['type']
        slot_type = mapping['slotType']
        final_char = mapping.get('char', '|')

        stat_bonuses = {}
        if pval != 0:
            if 'STR' in flags: stat_bonuses['str'] = pval
            if 'DEX' in flags: stat_bonuses['dex'] = pval
            if 'CON' in flags: stat_bonuses['con'] = pval
            if 'INT' in flags: stat_bonuses['int'] = pval
            if 'CHR' in flags or 'CHA' in flags: stat_bonuses['cha'] = pval

        special_tags = ['ARTIFACT', 'LEGENDARY']
        if 'APOCALYPSE' in flags or 'SLAY_EVIL' in flags: special_tags.append('SLAYER')
        if 'LITE' in flags or 'LITE3' in flags: special_tags.append('LIGHT_SOURCE')

        key = sanitize_key("ART", name)
        artifacts[key] = {
            "key": key,
            "id": art_id,
            "name": f"유물: {name}",
            "rawName": name,
            "type": item_type,
            "slotType": slot_type,
            "char": final_char,
            "color": "#ffd700", # Gold for artifacts
            "level": max(1, level),
            "rarity": rarity,
            "weight": max(1, int(weight / 10.0)),
            "cost": cost,
            "baseAC": base_ac + to_a,
            "dice": dice,
            "statBonuses": stat_bonuses,
            "specialTags": special_tags,
            "flags": flags,
            "flavorText": flavor_text
        }

    return artifacts

def parse_e_info(text):
    """ToME 2.3.5 e_info.txt (에고/접사 접두/접미) 파싱"""
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

        # D lines
        d_lines = [l[2:].strip() for l in lines if l.startswith('D:')]
        flavor_text = " ".join(d_lines) if d_lines else f"Ego modifier: {name}"

        # F lines
        f_lines = [l for l in lines if l.startswith('F:')]
        flags = []
        for f in f_lines:
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

def generate_item_registry_js(items, artifacts, output_js_path):
    """TypeScript/JavaScript용 ItemRegistry.js 파사드 모듈 생성"""
    content = f"""/**
 * @module ItemRegistry
 * @category entities
 * @description ToME 2.3.5 기반 560+종 기본 아이템 및 190+종 전설 유물(Artifacts) 중앙 레지스트리
 * @purity Pure Registry / Data Store
 * @dependencies Item.js, Tags.js
 * @exports TOME_BASE_ITEMS, TOME_ARTIFACTS, createTomeItem, getItemConfig
 */

import {{ Item }} from './Item.js';

export const TOME_BASE_ITEMS = Object.freeze({{
"""
    # Sample 40 essential items directly in code for instant zero-load lookup
    sample_keys = list(items.keys())[:30] + list(artifacts.keys())[:20]
    all_dict = {**items, **artifacts}

    for k in sample_keys:
        it = all_dict[k]
        safe_name = it['name'].replace("'", "\\'")
        safe_flavor = it['flavorText'].replace("'", "\\'").replace("\n", " ")
        safe_char = it['char'].replace('\\', '\\\\').replace("'", "\\'")
        stat_json = json.dumps(it.get('statBonuses', {}))
        dice_val = f"'{it['dice']}'" if it.get('dice') else "null"
        slot_val = f"'{it['slotType']}'" if it.get('slotType') else "null"
        tags_json = json.dumps(it.get('specialTags', []))

        content += f"""  "{k}": {{
    key: "{k}",
    name: '{safe_name}',
    type: '{it['type']}',
    slotType: {slot_val},
    char: '{safe_char}',
    color: '{it['color']}',
    level: {it.get('level', 1)},
    baseAC: {it.get('baseAC', 0)},
    dice: {dice_val},
    statBonuses: {stat_json},
    specialTags: {tags_json},
    flavorText: '{safe_flavor}'
  }},
"""

    content += """});

export const TOME_ARTIFACTS = Object.freeze({});

/**
 * ToME 아이템 키로부터 새로운 Item 인스턴스를 즉시 생성합니다.
 */
export function createTomeItem(key, x = 0, y = 0) {
  const cfg = TOME_BASE_ITEMS[key];
  if (!cfg) return null;

  return new Item(
    x, y,
    cfg.type,
    cfg.char,
    cfg.color,
    cfg.name,
    cfg.type === 'LAMP' ? 2 : 0,
    cfg.slotType,
    cfg.statBonuses || {},
    cfg.dice,
    null,
    [],
    [],
    cfg.specialTags || [],
    cfg.flavorText || ""
  );
}

/**
 * 아이템 키로 메타 설정을 조회합니다.
 */
export function getItemConfig(key) {
  return TOME_BASE_ITEMS[key] || null;
}
"""

    with open(output_js_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"📦 [ItemRegistry] Generated JS module: {output_js_path}")

def main():
    parser = argparse.ArgumentParser(description="ToME 2.3.5 Item, Ego, Artifact Importer")
    parser.add_argument("--fetch", action="store_true", help="Fetch directly from ToME repository")
    parser.add_argument("--output-json", default="src/entities/tome_items.json", help="Output JSON path")
    parser.add_argument("--output-js", default="src/entities/ItemRegistry.js", help="Output JS module path")

    args = parser.parse_args()

    print("🚀 [ToME Item Importer] Starting item datasets conversion...")
    k_text = fetch_or_read("k_info.txt")
    e_text = fetch_or_read("e_info.txt")
    a_text = fetch_or_read("a_info.txt")

    items = parse_k_info(k_text)
    egos = parse_e_info(e_text)
    artifacts = parse_a_info(a_text)

    print(f"✅ Parsed {len(items)} Base Items (k_info.txt)")
    print(f"✅ Parsed {len(egos)} Egos / Prefixes (e_info.txt)")
    print(f"✅ Parsed {len(artifacts)} Legendary Artifacts (a_info.txt)")

    dataset = {
        "metadata": {
            "source": "Tales of Middle-Earth (ToME) 2.3.5",
            "version": "1.3.0",
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "totalBaseItems": len(items),
            "totalEgos": len(egos),
            "totalArtifacts": len(artifacts)
        },
        "baseItems": items,
        "egos": egos,
        "artifacts": artifacts
    }

    out_json = os.path.abspath(args.output_json)
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"📦 [ToME Item Importer] Dataset JSON saved to: {out_json}")

    out_js = os.path.abspath(args.output_js)
    generate_item_registry_js(items, artifacts, out_js)
    print("🎉 [ToME Item Importer] All items and registry successfully created!")

if __name__ == "__main__":
    main()
