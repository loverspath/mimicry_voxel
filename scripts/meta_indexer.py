#!/usr/bin/env python3
"""
scripts/meta_indexer.py
Mimicry Voxel Engine - Automated Code Meta Indexer & Whitelist Header Parser

Features:
- Scans all JavaScript source files in src/
- Parses standard whitelist JSDoc meta headers (@module, @category, @description, @purity, @dependencies, @exports)
- Extracts AST-like metadata: line counts, classes, functions, import dependencies, export symbols
- Generates machine-readable src/meta/code_meta_index.json
- Supports CLI flags: --scan, --output <path>, --update-wiki, --watch
"""

import os
import sys
import re
import json
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

VERSION = "1.2.0"

def get_project_root() -> Path:
    """Resolve project root directory from script location."""
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent

def parse_jsdoc_header(content: str) -> dict:
    """
    Extract standard whitelist JSDoc metadata header from JS file content.
    Supported tags:
    @module, @category, @description, @purity, @dependencies, @exports
    """
    meta = {
        "module": None,
        "category": None,
        "description": None,
        "purity": None,
        "dependencies": None,
        "exports": None
    }

    # Match the first top-level JSDoc comment block /** ... */
    jsdoc_match = re.search(r'/\*\*(.*?)\*/', content, re.DOTALL)
    if not jsdoc_match:
        return meta

    jsdoc_body = jsdoc_match.group(1)
    
    # Process each line, stripping leading asterisks and spaces
    clean_lines = []
    for line in jsdoc_body.splitlines():
        line = re.sub(r'^\s*\*+\s?', '', line).strip()
        if line:
            clean_lines.append(line)
    
    full_text = "\n".join(clean_lines)

    # Extract tags
    # @module
    module_m = re.search(r'@module\s+([^\n@]+)', full_text)
    if module_m:
        meta["module"] = module_m.group(1).strip()

    # @category
    cat_m = re.search(r'@category\s+([^\n@]+)', full_text)
    if cat_m:
        meta["category"] = cat_m.group(1).strip()

    # @description (can span across multiple lines until next tag)
    desc_m = re.search(r'@description\s+([^@]+)', full_text)
    if desc_m:
        # Collapse multi-line description into single clean line
        desc_text = " ".join(desc_m.group(1).strip().split())
        meta["description"] = desc_text

    # @purity
    purity_m = re.search(r'@purity\s+([^\n@]+)', full_text)
    if purity_m:
        meta["purity"] = purity_m.group(1).strip()

    # @dependencies / @dependency
    deps_m = re.search(r'@dependenc(?:ies|y)\s+([^\n@]+)', full_text)
    if deps_m:
        deps_raw = deps_m.group(1).strip()
        if deps_raw and deps_raw.lower() not in ["none", "없음", "null"]:
            meta["dependencies"] = [d.strip() for d in re.split(r'[,|;]', deps_raw) if d.strip()]

    # @exports
    exports_m = re.search(r'@exports\s+([^\n@]+)', full_text)
    if exports_m:
        exports_raw = exports_m.group(1).strip()
        if exports_raw and exports_raw.lower() not in ["none", "없음", "null"]:
            meta["exports"] = [e.strip() for e in re.split(r'[,|;]', exports_raw) if e.strip()]

    return meta

def extract_js_ast_features(content: str) -> dict:
    """Extract classes, functions, imports, and exports using comprehensive regex analysis."""
    classes = []
    functions = []
    imports = []
    exports = []

    # 1. Imports
    # Matches: import ... from './path.js' or import './path.js'
    import_matches = re.finditer(r'import\s+(?:.*?from\s+)?[\'"]([^\'"]+)[\'"]', content)
    for m in import_matches:
        raw_path = m.group(1)
        # Extract filename (e.g. '../entities/Tags.js' -> 'Tags.js')
        dep_name = Path(raw_path).name
        if dep_name and dep_name not in imports:
            imports.append(dep_name)

    # 2. Exports
    # export class ClassName
    for m in re.finditer(r'export\s+class\s+([A-Za-z0-9_$]+)', content):
        name = m.group(1)
        if name not in exports:
            exports.append(name)
        if name not in classes:
            classes.append(name)

    # export function fnName
    for m in re.finditer(r'export\s+(?:async\s+)?function\*?\s+([A-Za-z0-9_$]+)', content):
        name = m.group(1)
        if name not in exports:
            exports.append(name)
        if name not in functions:
            functions.append(name)

    # export const / let / var IDENTIFIER
    for m in re.finditer(r'export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)', content):
        name = m.group(1)
        if name not in exports:
            exports.append(name)

    # export { a, b as c }
    for m in re.finditer(r'export\s*\{([^}]+)\}', content):
        items = m.group(1).split(',')
        for item in items:
            item = item.strip()
            if not item:
                continue
            if ' as ' in item:
                exported_name = item.split(' as ')[1].strip()
            else:
                exported_name = item.strip()
            if exported_name and exported_name not in exports:
                exports.append(exported_name)

    # export default [name]
    for m in re.finditer(r'export\s+default\s+(?:class\s+|function\s+)?([A-Za-z0-9_$]+)?', content):
        name = m.group(1) if m.group(1) else "default"
        if name and name not in exports:
            exports.append(name)

    # 3. Non-exported Classes
    for m in re.finditer(r'(?<!export\s)class\s+([A-Za-z0-9_$]+)', content):
        name = m.group(1)
        if name not in classes:
            classes.append(name)

    # 4. Top-level functions / Arrow functions
    for m in re.finditer(r'(?:function\*?\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)', content):
        fn_name = m.group(1) or m.group(2)
        if fn_name and fn_name not in functions:
            functions.append(fn_name)

    return {
        "classes": sorted(classes),
        "functions": sorted(functions),
        "imports": sorted(imports),
        "exports": sorted(exports)
    }

def scan_file(file_path: Path, project_root: Path) -> dict:
    """Scan and parse a single JS file."""
    rel_path = file_path.relative_to(project_root).as_posix()
    
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    lines = len(content.splitlines())
    mtime = file_path.stat().st_mtime
    last_mod_dt = datetime.fromtimestamp(mtime, tz=timezone.utc)
    last_modified_iso = last_mod_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    jsdoc_meta = parse_jsdoc_header(content)
    ast_features = extract_js_ast_features(content)

    # Module Name: header -> filename stem
    module_name = jsdoc_meta["module"] or file_path.stem

    # Category: header -> parent folder name under src/
    if jsdoc_meta["category"]:
        category = jsdoc_meta["category"]
    else:
        parts = rel_path.split("/")
        if len(parts) > 2 and parts[0] == "src":
            category = parts[1]
        else:
            category = "root"

    # Description / Responsibility
    responsibility = jsdoc_meta["description"] or f"{module_name} module"

    # Purity
    if jsdoc_meta["purity"]:
        purity = jsdoc_meta["purity"]
    else:
        # Inferred purity defaults
        if category == "configs":
            purity = "Pure Constants"
        elif category in ["renderer", "ui"]:
            purity = "DOM / Canvas Renderer"
        elif category in ["entities", "map"]:
            purity = "Data Model / State Store"
        elif category in ["core", "systems"]:
            purity = "Stateless System / Logic"
        else:
            purity = "Unspecified"

    # Dependencies: merge header + AST imports
    dependencies = []
    if jsdoc_meta["dependencies"]:
        dependencies.extend(jsdoc_meta["dependencies"])
    for imp in ast_features["imports"]:
        if imp not in dependencies:
            dependencies.append(imp)

    # Exports: merge header + AST exports
    exports = []
    if jsdoc_meta["exports"]:
        exports.extend(jsdoc_meta["exports"])
    for exp in ast_features["exports"]:
        if exp not in exports:
            exports.append(exp)

    return {
        "filePath": rel_path,
        "moduleName": module_name,
        "category": category,
        "lines": lines,
        "responsibility": responsibility,
        "purity": purity,
        "dependencies": dependencies,
        "exports": exports,
        "classes": ast_features["classes"],
        "functions": ast_features["functions"],
        "lastModified": last_modified_iso
    }

def run_scan(project_root: Path, output_file: Path) -> dict:
    """Scan all JS files in src/ and generate code_meta_index.json."""
    src_dir = project_root / "src"
    if not src_dir.exists():
        print(f"[ERROR] Source directory does not exist: {src_dir}")
        sys.exit(1)

    js_files = sorted(src_dir.rglob("*.js"))
    modules = []
    category_counts = {}
    total_lines = 0

    for js_path in js_files:
        mod_info = scan_file(js_path, project_root)
        modules.append(mod_info)
        total_lines += mod_info["lines"]
        cat = mod_info["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    result = {
        "version": VERSION,
        "generatedAt": now_iso,
        "summary": {
            "totalModules": len(modules),
            "totalLines": total_lines,
            "categories": category_counts
        },
        "modules": modules
    }

    # Ensure target directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✅ [MetaIndexer] Scanned {len(modules)} modules ({total_lines:,} total lines).")
    print(f"📦 [MetaIndexer] Index saved to: {output_file}")
    print(f"📊 [MetaIndexer] Categories: {dict(category_counts)}")

    return result

def update_wiki_doc(project_root: Path, meta_data: dict):
    """Generate or update wiki architecture markdown document."""
    wiki_path = project_root.parent / "llm_wiki" / "wiki" / "미미크리 Voxel 엔진 코드 메타 인덱스.md"
    if not wiki_path.parent.exists():
        print(f"[WARN] Wiki directory not found: {wiki_path.parent}")
        return

    modules = meta_data.get("modules", [])
    summary = meta_data.get("summary", {})

    lines = [
        "# 📑 미미크리 Voxel 엔진 코드 메타 인덱스 (Code Meta Index)",
        "",
        "> **자동 생성 메타데이터**",
        f"> - **엔진 버전**: `v{meta_data.get('version', '1.2.0')}`",
        f"> - **생성 일시**: `{meta_data.get('generatedAt', '')}`",
        f"> - **총 모듈 수**: `{summary.get('totalModules', len(modules))}개`",
        f"> - **총 코드 라인 수**: `{summary.get('totalLines', 0):,}줄`",
        "",
        "---",
        "",
        "## 1. 카테고리별 모듈 분포",
        "",
        "| 카테고리 | 모듈 수 | 주요 역할 |",
        "| :--- | :--- | :--- |"
    ]

    cat_descriptions = {
        "configs": "게임 밸런스, 렌더러 지오메트리, 테마 색상 등 중앙 격리 설정",
        "core": "전투 연산, 전리품 시스템, 세이브/로드, 턴 스케줄링 핵심 엔진",
        "entities": "플레이어, 몬스터, 미믹 코어, 아이템, 태그 등 게임 엔티티",
        "map": "2D 던전 맵 생성기 및 3D 다층 복셀 높이맵 브릿지",
        "renderer": "2.5D 아이소메트릭 3D 복셀 렌더러 및 파티클 물리 시스템",
        "ui": "가상 컨트롤러 및 뷰 컴포넌트",
        "root": "애플리케이션 진입점 (main.js 등)"
    }

    for cat, count in summary.get("categories", {}).items():
        desc = cat_descriptions.get(cat, "모듈 집합")
        lines.append(f"| `{cat}` | {count}개 | {desc} |")

    lines.extend([
        "",
        "---",
        "",
        "## 2. 전체 모듈 상세 메타 인덱스 명세",
        "",
        "| 파일 경로 | 모듈명 | 카테고리 | 라인 | 책임 (Responsibility) | 순수성 (Purity) | 공개 심볼 (Exports) |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
    ])

    for m in modules:
        exports_str = ", ".join(m.get("exports", [])[:3])
        if len(m.get("exports", [])) > 3:
            exports_str += f" 외 {len(m.get('exports')) - 3}개"
        if not exports_str:
            exports_str = "-"
        lines.append(
            f"| [`{m['filePath']}`](file:///{project_root}/{m['filePath']}) | **{m['moduleName']}** | `{m['category']}` | {m['lines']} | {m['responsibility']} | {m['purity']} | `{exports_str}` |"
        )

    lines.append("")

    with open(wiki_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"📖 [MetaIndexer] Wiki documentation updated: {wiki_path}")

def watch_mode(project_root: Path, output_file: Path):
    """Monitor src/ directory and rebuild index on file changes."""
    print(f"👀 [MetaIndexer] Watching src/ for changes... (Press Ctrl+C to stop)")
    last_mtimes = {}

    def get_all_mtimes():
        src_dir = project_root / "src"
        mtimes = {}
        for p in src_dir.rglob("*.js"):
            try:
                mtimes[p] = p.stat().st_mtime
            except OSError:
                pass
        return mtimes

    last_mtimes = get_all_mtimes()
    run_scan(project_root, output_file)

    try:
        while True:
            time.sleep(2.0)
            curr_mtimes = get_all_mtimes()
            if curr_mtimes != last_mtimes:
                print("\n🔄 [MetaIndexer] File change detected! Updating index...")
                last_mtimes = curr_mtimes
                run_scan(project_root, output_file)
    except KeyboardInterrupt:
        print("\n👋 [MetaIndexer] Watcher stopped.")

def main():
    parser = argparse.ArgumentParser(description="Mimicry Voxel Engine Code Meta Indexer")
    parser.add_argument("--scan", action="store_true", help="Scan source code and generate JSON index")
    parser.add_argument("--output", type=str, default=None, help="Custom output JSON path")
    parser.add_argument("--update-wiki", action="store_true", help="Sync index to LLM Wiki documentation")
    parser.add_argument("--watch", action="store_true", help="Watch mode: live update on file changes")

    args = parser.parse_args()

    project_root = get_project_root()
    default_output = project_root / "src" / "meta" / "code_meta_index.json"
    output_file = Path(args.output).resolve() if args.output else default_output

    if args.watch:
        watch_mode(project_root, output_file)
        return

    # Default to scan if no specific mode or --scan is specified
    meta_data = run_scan(project_root, output_file)

    if args.update_wiki:
        update_wiki_doc(project_root, meta_data)

if __name__ == "__main__":
    main()
