# 📊 Mimicry Voxel: 파이프라인 & 품질 대시보드 (Pipeline Dashboard)
### Automated Test Suites, Quality Metrics, Static Meta Indexing & Server Status

본 문서는 **미미크리 복셀(Mimicry Voxel) 엔진**의 전체 테스트 스위트 현황, 정적 코드 분석 품질 지표, 서버 데몬 및 지속적 전달(CI/CD) 상태를 모니터링하는 공식 대시보드입니다.

---

## 🧪 1. 단위 및 회귀 테스트 파이프라인 현황

- **전체 테스트 스위트 수**: **59개** (`scripts/test_*.js`)
- **전체 검증 단언문(Assertions)**: **1,850개 이상**
- **회귀 통과율 (Pass Rate)**: **100.0% (59 / 59 PASSED, 0 FAILED)**

```
==================================================
TOTAL: 59 | PASSED: 59 | FAILED: 0
==================================================
🎉 ALL TEST SUITES PASSED 100%!
```

### 1.1 주요 핵심 테스트 스위트 하이라이트
| 테스트 스위트 파일명 | 검증 항목 | 결과 |
| :--- | :--- | :---: |
| [`test_first_person_3d_renderer.js`](file:///data/data/com.termux/files/home/opendcmart/mimicry_voxel/scripts/test_first_person_3d_renderer.js) | DDA 레이캐스팅, 어안 왜곡 보정, Z-Buffer 오클루전, 광원 비례 조명, 탐험 타일(`isExplored`) 동기화, 전투 VFX | **84/84 PASS** |
| [`test_tome_pseudo_id_and_tags.js`](file:///data/data/com.termux/files/home/opendcmart/mimicry_voxel/scripts/test_tome_pseudo_id_and_tags.js) | 4단계 의사 감정, 18종 저주 탈착 가드, 감정/해제 주문서 | **60/60 PASS** |
| [`test_balance_presets_and_hotbar.js`](file:///data/data/com.termux/files/home/opendcmart/mimicry_voxel/scripts/test_balance_presets_and_hotbar.js) | 4대 밸런스 프리셋 수치 불변성, 4슬롯 핫바 쿨다운 애니메이션 | **18/18 PASS** |
| [`test_import_integrity.js`](file:///data/data/com.termux/files/home/opendcmart/mimicry_voxel/scripts/test_import_integrity.js) | 75개 전 모듈 ESM 동적 임포트 및 런타임 전투 안전성 | **75/75 PASS** |
| [`test_encumbrance_ammo_and_archer_loot.js`](file:///data/data/com.termux/files/home/opendcmart/mimicry_voxel/scripts/test_encumbrance_ammo_and_archer_loot.js) | 화살 다발 보너스 전리품, 쿼버 슬롯 및 무게 인벤토리 시스템 | **1,039/1,039 PASS** |

---

## 🔍 2. 정적 코드 분석 및 메타 인덱서 (MetaIndexer)

- **도구**: `scripts/meta_indexer.py` (Python AST/정규식 기반 정적 분석기)
- **스캔 대상**: 75개 ESM 자바스크립트 모듈
- **총 코드 볼륨**: 108,289 라인
- **동기화 산출물**:
  - `src/meta/code_meta_index.json` (기계 가독형 전체 인덱스 데이터)
  - `CODE_META_INDEX.md` (저장소 루트 공식 메타 인덱스 문서)
  - `llm_wiki/wiki/미미크리 Voxel 엔진 코드 메타 인덱스.md` (LLM 위키 시스템 연동 문서)

---

## 🌐 3. 런타임 개발 서버 & 에셋 딜리버리

- **서버 데몬**: `scripts/dev_server.py` (Python 경량 HTTP 서버)
- **로컬 바인딩 포트**: `http://localhost:8080/` (포트 8080)
- **특징**:
  - `Cache-Control: no-store, no-cache` (브라우저 캐시 무효화로 실시간 개발 반영)
  - `Access-Control-Allow-Origin: *` (CORS 활성화로 모듈/텍스처 비동기 페치 보장)
- **정적 서빙 경로**:
  - `http://localhost:8080/public/textures/` (던전 6대 텍스처)
  - `http://localhost:8080/public/textures/effects/` (전투 VFX 3대 텍스처)
  - `http://localhost:8080/fork_experimental/index.html` (독립 포크 버전)

---

**© 2026 OpenDCMart Engine Team & Mimicry Voxel Engineering Group.**
