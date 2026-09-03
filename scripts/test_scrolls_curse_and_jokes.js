/**
 * @file test_scrolls_curse_and_jokes.js
 * @description 감정/저주해제 주문서 정식 등록 및 던전 드롭 연동, 저주 장착 경고 및 탈의 차단, 조크 몬스터 완전 박멸 단위 검증 스위트
 */

import { strict as assert } from 'assert';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { TomeConsumableEngine } from '../src/systems/TomeConsumableEngine.js';
import { TomeIdentificationEngine } from '../src/systems/TomeIdentificationEngine.js';
import { TomeTagSystem } from '../src/systems/TomeTagSystem.js';
import { Item } from '../src/entities/Item.js';
import { Player } from '../src/entities/Player.js';
import { Spawner } from '../src/core/Spawner.js';
import { uniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { isJokeMonster, JOKE_KEYWORDS } from '../src/configs/GameBalanceConfig.js';
import { renderItemDetailHTML } from '../src/ui/InventoryView.js';

console.log("==================================================");
console.log("🧪 RUNNING: test_scrolls_curse_and_jokes.js");
console.log("==================================================");

let passedAssertions = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  passedAssertions++;
}

// ----------------------------------------------------
// TEST SUITE 1: 감정 & 저주 해제 주문서 정적 메타데이터 검증
// ----------------------------------------------------
console.log("\n▶ [TEST 1] 감정 및 저주 해제 주문서 4종 TOME_KINDS_DATA 등록 검증");

const idScroll = TOME_KINDS_DATA["KIND_SCROLL_OF_IDENTIFY"];
testAssert(idScroll !== undefined, "Scroll of Identify가 TOME_KINDS_DATA에 존재해야 함");
testAssert(idScroll.tval === 70 && idScroll.sval === 13, "Scroll of Identify tval=70, sval=13 일치");
testAssert(idScroll.level === 1 && idScroll.cost === 50, "Scroll of Identify level=1, cost=50 일치");

const starIdScroll = TOME_KINDS_DATA["KIND_SCROLL_OF_STAR_IDENTIFY"];
testAssert(starIdScroll !== undefined, "Scroll of *Identify*가 TOME_KINDS_DATA에 존재해야 함");
testAssert(starIdScroll.tval === 70 && starIdScroll.sval === 14, "Scroll of *Identify* tval=70, sval=14 일치");
testAssert(starIdScroll.level === 20 && starIdScroll.cost === 500, "Scroll of *Identify* level=20, cost=500 일치");

const curseScroll = TOME_KINDS_DATA["KIND_SCROLL_OF_REMOVE_CURSE"];
testAssert(curseScroll !== undefined, "Scroll of Remove Curse가 TOME_KINDS_DATA에 존재해야 함");
testAssert(curseScroll.tval === 70 && curseScroll.sval === 15, "Scroll of Remove Curse tval=70, sval=15 일치");
testAssert(curseScroll.level === 3 && curseScroll.cost === 100, "Scroll of Remove Curse level=3, cost=100 일치");

const starCurseScroll = TOME_KINDS_DATA["KIND_SCROLL_OF_STAR_REMOVE_CURSE"];
testAssert(starCurseScroll !== undefined, "Scroll of *Remove Curse*가 TOME_KINDS_DATA에 존재해야 함");
testAssert(starCurseScroll.tval === 70 && starCurseScroll.sval === 16, "Scroll of *Remove Curse* tval=70, sval=16 일치");
testAssert(starCurseScroll.level === 25 && starCurseScroll.cost === 1000, "Scroll of *Remove Curse* level=25, cost=1000 일치");

// ----------------------------------------------------
// TEST SUITE 2: 감정 주문서 실시간 사용 및 식별 엔진 연동 검증
// ----------------------------------------------------
console.log("\n▶ [TEST 2] 감정 주문서(Scroll of Identify / *Identify*) 사용 검증");

const player = new Player(0, 0);
const weapon = new Item(0, 0, '웨폰', 'WEAPON', '|', '#fff', false, 'WEAPON');
weapon.idState = 'UNIDENTIFIED';
player.equipment.weapon = weapon;

const scrollItem1 = new Item(0, 0, 'Scroll of Identify', 'SCROLL', '?', '#38bdf8', false, null);
scrollItem1.tval = 70;
scrollItem1.sval = 13;
player.inventory = [scrollItem1];

const logs = [];
const mockAddLog = (msg, type) => logs.push({ msg, type });

const used1 = TomeConsumableEngine.useConsumable(scrollItem1, player, null, mockAddLog);
testAssert(used1 === true, "Scroll of Identify 사용 성공");
testAssert(weapon.idState === 'IDENTIFIED', "웨폰이 IDENTIFIED 상태로 식별되어야 함");
testAssert(logs.some(l => l.msg.includes('[Identify]') && l.msg.includes('드러났습니다')), "감정 식별 로그 정상 출력 확인");

// Scroll of *Identify*
const scrollItem2 = new Item(0, 0, 'Scroll of *Identify*', 'SCROLL', '?', '#a855f7', false, null);
scrollItem2.tval = 70;
scrollItem2.sval = 14;
player.inventory = [scrollItem2];

const used2 = TomeConsumableEngine.useConsumable(scrollItem2, player, null, mockAddLog);
testAssert(used2 === true, "Scroll of *Identify* 사용 성공");
testAssert(weapon.idState === 'STAR_IDENTIFIED', "웨폰이 STAR_IDENTIFIED 상태로 완전 식별되어야 함");

// ----------------------------------------------------
// TEST SUITE 3: 저주 장비 착용 및 저주 해제 주문서 연동 검증
// ----------------------------------------------------
console.log("\n▶ [TEST 3] 저주 장비 착용, 탈의 불가 및 저주 해제 주문서(Remove Curse) 검증");

const cursedArmor = new Item(0, 0, '저주받은 사슬 갑옷', 'ARMOR', '[', '#ef4444', false, 'ARMOR');
cursedArmor.isCursed = true;
cursedArmor.curses = ['NORMAL'];
cursedArmor.specialTags = ['CURSED'];

player.equipItem(cursedArmor);
testAssert(player.equipment.armor === cursedArmor, "저주받은 갑옷 착용 완료");
testAssert(cursedArmor.isCursed === true, "아이템 isCursed 플래그 활성화");

// 탈의 시도: 실패해야 함
const unequipResult1 = player.unequipItem(cursedArmor);
testAssert(unequipResult1 === false, "저주받은 장비는 unequipItem 호출 시 탈의가 거부되어야 함");
testAssert(player.equipment.armor === cursedArmor, "갑옷이 여전히 착용 상태로 유지되어야 함");

// 저주 해제 주문서 사용
const removeCurseScroll = new Item(0, 0, 'Scroll of Remove Curse', 'SCROLL', '?', '#fbcfe8', false, null);
removeCurseScroll.tval = 70;
removeCurseScroll.sval = 15;
player.inventory = [removeCurseScroll];

const usedCurseScroll = TomeConsumableEngine.useConsumable(removeCurseScroll, player, null, mockAddLog);
testAssert(usedCurseScroll === true, "Scroll of Remove Curse 사용 성공");
testAssert(cursedArmor.isCursed === false, "갑옷의 isCursed가 해제되어야 함");

// 이제 정상 탈의 가능
const unequipResult2 = player.unequipItem(cursedArmor);
testAssert(unequipResult2 === true, "저주 해제 후 갑옷이 정상 탈의되어야 함");
testAssert(player.equipment.armor === null, "갑옷 슬롯이 비워져야 함");

// ----------------------------------------------------
// TEST SUITE 4: 저주 장비 UI 배지 및 해제 불가 안내 렌더링 검증
// ----------------------------------------------------
console.log("\n▶ [TEST 4] 저주 장비 상세 인스펙터 UI 렌더링 검증");

const cursedHelm = new Item(0, 0, '저주의 강철 투구', 'HELMET', ']', '#ef4444', false, 'HELMET');
cursedHelm.isCursed = true;
cursedHelm.curses = ['HEAVY'];

const equippedHTML = renderItemDetailHTML(cursedHelm, player, true);
testAssert(equippedHTML.includes('☠️ 저주 결속 (해제 불가)'), "착용 중인 저주 아이템에 '☠️ 저주 결속 (해제 불가)' 배지가 포함되어야 함");
testAssert(equippedHTML.includes('저주 해제 주문서'), "해제 불가 경고 안내에 '저주 해제 주문서' 언급이 있어야 함");
testAssert(equippedHTML.includes('cursor: not-allowed;'), "착용 중인 저주 아이템의 버튼이 비활성화 스타일이어야 함");

const unequippedHTML = renderItemDetailHTML(cursedHelm, player, false);
testAssert(unequippedHTML.includes('☠️ 저주받음 (CURSED)'), "미착용 저주 아이템에 '☠️ 저주받음 (CURSED)' 배지가 포함되어야 함");

// ----------------------------------------------------
// TEST SUITE 5: 조크 몬스터 완전 박멸 및 스폰 차단 검증
// ----------------------------------------------------
console.log("\n▶ [TEST 5] 조크 몬스터(프로그래머, 해커, 메인테이너 등) 박멸 검증");

const jokeSamples = [
  { name: "The Variant Maintainer", flags: ["UNIQUE", "JOKEANGBAND"], flavorText: "A deranged programmer" },
  { name: "Random Number Generator", flags: ["MORTAL"], flavorText: "Pure RNG goddess" },
  { name: "Mad Hacker", flags: ["EVIL"], flavorText: "Writing exploits" },
  { name: "Bill Gates", flags: ["UNIQUE"], flavorText: "Master of Windows" },
  { name: "위험한 프로그래머", flags: ["HUMAN"], flavorText: "야근에 찌든 코더" }
];

for (const jm of jokeSamples) {
  testAssert(isJokeMonster(jm) === true, `조크 몬스터 [${jm.name}]은 isJokeMonster에 의해 100% 탐지 차단되어야 함`);
}

const normalSamples = [
  { name: "Small kobold", flags: ["EVIL"], flavorText: "A tiny lizard-like humanoid." },
  { name: "Cave orc", flags: ["ORC", "EVIL"], flavorText: "A fierce warrior of the depths." },
  { name: "Ancient red dragon", flags: ["DRAGON"], flavorText: "A terrifying colossal dragon." }
];

for (const nm of normalSamples) {
  testAssert(isJokeMonster(nm) === false, `일반 몬스터 [${nm.name}]은 차단되지 않아야 함`);
}

// Spawner 캐시 내 조크 몬스터 완전 배제 검증
const spawnerJokes = Spawner._cachedMonsters.filter(m => isJokeMonster(m));
testAssert(spawnerJokes.length === 0, `Spawner._cachedMonsters 내에 조크 몬스터가 0체여야 함 (현재: ${spawnerJokes.length})`);

// UniqueMonsterManager 캐시 내 조크 몬스터 완전 배제 검증
const availableUniques = uniqueMonsterManager.getAvailableUniqueMonsters(10, { minLevelOffset: -10, maxLevelOffset: 99 });
const uniqueJokes = availableUniques.filter(m => isJokeMonster(m));
testAssert(uniqueJokes.length === 0, `유니크 몬스터 목록에 조크 몬스터가 0체여야 함 (현재: ${uniqueJokes.length})`);

console.log("\n==================================================");
console.log(`🎉 ALL TESTS PASSED! (Total Assertions: ${passedAssertions})`);
console.log("==================================================");
