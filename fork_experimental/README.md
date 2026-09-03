# 🏰 Mimicry Voxel: Next-Gen Experimental Fork (`v0.21.0`)
### 초기 둠/위저드리 시점 1인칭 3D 던전 탐험 & 나노바나나 전투 VFX 차세대 독립 포크

본 디렉토리(`fork_experimental/`)는 **미미크리 복셀(Mimicry Voxel) 엔진 `v0.21.0`의 차세대 독립 포크 버전**입니다. 정통 로그라이크(TomeNET / ToME 2.3.5)의 깊이 있는 규칙과 초기 3D 던전 크롤러(Doom, Wizardry)의 1인칭 공간 탐험감, 그리고 나노바나나(NanoBanana / Imagen) AI 에셋 기반의 전투 시각 효과를 유기적으로 융합한 실험적 릴리즈입니다.

---

## 🌟 5대 핵심 혁신 기능 (Core Feature Highlights)

### 1. 🏰 나노바나나 6대 테마 텍스처 & DDA 레이캐스팅 1인칭 3D 렌더러
- **DDA 레이캐스팅 (Digital Differential Analysis)**: 순수 HTML5 캔버스 2D 기반 광선 추적과 어안 왜곡 보정(Fish-eye Correction) 수직 거리($perpWallDist$) 연산.
- **6대 전용 텍스처 파이프라인**:
  - `CAVE_RUINS` (이끼 낀 고대 석조 유적 벽면)
  - `MINES_CATACOMBS` (암흑 해골 카타콤 벽면)
  - `VOLCANIC_FORTRESS` (마그마가 흐르는 흑요석 요새)
  - `DARK_ABYSS` (보랏빛 공허 룬 심연)
  - `DEEP_ANGBAND` (지옥석 지하던전)
  - `COMMON_FLOOR` (고대 석판 바닥재)
- **3D 빌보드(Billboard) 스프라이트 & Z-Buffer 오클루전 가드**: 카메라 역행렬 원근 투영과 `depthBuffer[x]` 비교를 통한 벽 뒤 몬스터/아이템 차폐(Z-Culling).
- **시선 기준 8방향 상대 이동 & 360도 터치/마우스 드래그 룩어라운드**: 가로 슬라이스로 자유롭게 시선을 회전하고, 바라보는 시선 방향 기준 물리 전진/후진/사이드스텝(스트레이프) 완벽 지원.

### 2. ⚔️ 레트로 사이버펑크 순수 아스키 그래픽 전투 VFX 엔진 (`CombatVFXEngine.js`)
- **외부 이미지 에셋 의존도 0% (ASCII as Graphics)**:
  - 8대 공격 유형별 고유 아스키 글리프 매트릭스 (`SLASH`, `BASH`, `FIRE_BURST`, `FROST_SHATTER`, `LIGHTNING_SPARK`, `ACID_POISON`, `ARCANE_NOVA`, `HOLY_SMITE`).
- **1인칭 스크린 스페이스 아크 & 3D 빌보드 룬 폭발**:
  - 베지어 곡선 궤적을 따라 회전하며 가르는 참격 글리프 시퀀스(`⚔`, `▓`, `▒`, `░`, `/`) 및 스파크.
  - 타겟 몬스터 좌표에 원근 투영되는 방사형 마법진 심볼(`✸`)과 룬 문자 파티클 비산.
- **네온 CRT 블룸 & 치명타 배너**:
  - `ctx.shadowColor` 및 `ctx.shadowBlur` 기반 네온 글로우 가산 혼합 렌더링.
  - 치명타 시 상단 팝인 볼드 배너 `[ 💥 CRITICAL 💥 ]` 및 실시간 지수 감쇄 화면 셰이크 & 핏빛 비네팅.

### 3. 💡 소지 광원량(`lightRange`) 비례 동적 조명 & 탐험 지도(`isExplored`) 완벽 동기화
- **유저 장착 램프/횃불 비례 광원 공식**:
  - $\text{clearDist} = \max(1.2, \text{lightRange} \times 1.5)$ (100% 원본 선명도 보장)
  - $\text{maxLightDist} = \max(4.0, \text{lightRange} \times 3.5)$ (부드러운 원거리 감쇄, 최소 30% 가시성 상시 확보)
  - 황금빛 횃불 앰비언트 글로우(`_renderTorchlightGlow`) 반경 및 밝기 동적 팽창/수축.
- **3D ➔ 2D 아스키/복셀 전장의 안개 해제 실시간 동기화**:
  - 1인칭 3D 시점에서 걸어간 통로와 레이캐스팅으로 관측한 모든 벽면/바닥 타일이 `isExplored = true`로 실시간 기록되어, 아스키 또는 복셀 뷰로 전환 시 암흑 없이 환하게 개방됨.

### 4. ⚖️ 4대 동적 밸런스 프리셋 엔진 & 4슬롯 스킬 플로팅 핫바
- **4대 밸런스 프리셋**:
  - `CLASSIC_TOME`: ToME 2.3.5 정통 하드코어 로그라이크 규격
  - `CASUAL_EXPLORER`: 여유로운 스폰과 넉넉한 인벤토리/시야
  - `CHAOS_VOXEL`: 엘리트 몬스터 대량 출몰 및 고밀도 드롭률
  - `NIGHTMARE_ABYSS`: 극한의 생존 난이도와 디트리멘탈 저주 패널티
- **4슬롯 스킬 플로팅 핫바 (`SkillHotbarView.js`)**: 모바일 원터치 격발, 실시간 쿨다운 방사형 카운트다운 애니메이션.

### 5. 📜 ToME 2.3.5 4단계 의사 감정(Pseudo-ID) & 18종 저주 시스템
- **4단계 점진적 감정 티어**: `UNIDENTIFIED` ➔ `PSEUDO_IDENTIFIED` (7대 육감 발현) ➔ `IDENTIFIED` ➔ `STAR_IDENTIFIED` (*감정*).
- **18종 디트리멘탈 저주 태그 & 착용 해제 가드**: 저주 장비 장착 시 탈착 차단 및 저주 해제 주문서(Scroll of Remove Curse) 메커니즘.
- **플레이어 아이덴티티 매트릭스 모달 (`PlayerIdentityModalView.js`)**: 6대 기본 스탯, 14대 원소 저항 칩, 슬레이 및 면역 매트릭스 모바일 반응형 시각화.

---

## 🚀 실행 및 접속 안내

개발 서버가 구동된 상태(`http://localhost:8080/`)에서 다음 URL로 즉시 접속할 수 있습니다:

- **독립 포크 버전**: `http://localhost:8080/fork_experimental/index.html`
- **루트 실험적 엔트리**: `http://localhost:8080/experimental.html`
- **메인 안정화 엔트리**: `http://localhost:8080/index.html`

### 단축키 요약
- `F8`: 3단 렌더러 순환 전환 (`2.5D 복셀` ➔ `1인칭 3D` ➔ `2D 아스키`)
- `W / A / S / D` 또는 `화살표`: 1인칭 시선 기준 전진/후진/좌우 사이드스텝 (8방향 지원)
- `화면 좌우 드래그 / 스와이프`: 360도 자유로운 시선 회전
- `C`: 플레이어 아이덴티티 매트릭스 모달 (스탯 & 저항)
- `1 ~ 4`: 4대 액티브 의태 스킬 시전
- `I`: 인벤토리 열기 / 닫기
- `T`: 원거리 자동사격 토글

---

**© 2026 OpenDCMart Engine Team & Mimicry Voxel Engineering Group.**  
*Maintained by developer_agent (Takumi Koharu).*
