/**
 * @module LootSystem
 * @category core
 * @description 몬스터 처치 시 전리품(정수 코어, 유니크 전설 유물, 에고 장비) 드롭 확률 연산, 경험치(XP) 가산 공식, 
 *              로어 숙련도 계산 및 처치 로그 취합 등 몬스터 사망에 수반되는 모든 후처리 보상 라이프사이클을 제어하는 전담 모듈
 * @purity Stateless Logic / System
 * @dependencies Tags.js, MonsterRegistry.js, TomeLootGenerator.js, UniqueMonsterManager.js, BossPhaseEngine.js
 * @exports LootSystem
 */

import { determineRarity } from '../entities/Tags.js';
import { getSpeciesConfig } from '../entities/MonsterRegistry.js';
import { Item } from '../entities/Item.js';
import { TomeLootGenerator } from '../systems/TomeLootGenerator.js';
import { uniqueMonsterManager } from '../systems/UniqueMonsterManager.js';
import { bossPhaseEngine } from '../systems/BossPhaseEngine.js';

export class LootSystem {
    /**
     * 플레이어와 몬스터의 레벨 차이에 따라 스케일링된 보상 XP를 도출합니다.
     * @param {Object} player 
     * @param {Object} monster 
     * @returns {number}
     */
    static getScaledXpValue(player, monster) {
        const base = monster.xpValue;
        // 레벨 스케일 보너스: 1레벨 초과당 +20%
        let scaledXp = base * (1 + (monster.level - 1) * 0.20);
        // 플레이어보다 레벨이 높은 몬스터 처치 시 하드코어 보너스: 레벨 차이당 +10%
        if (monster.level > player.level) {
            scaledXp *= (1 + (monster.level - player.level) * 0.10);
        }
        return Math.floor(scaledXp);
    }

    /**
     * 몬스터 처치(사망) 판정 시점의 전리품 드롭, XP 가산, 로어 획득 및 로그 기록 처리를 통합적으로 수행합니다.
     * @param {Object} game - Game 핵심 인스턴스
     * @param {Object} player - Player 인스턴스
     * @param {Object} monster - 처치된 Monster 인스턴스
     * @param {string} killTypeStr - 처치 수단 설명 (e.g. '물리 공격', '냉기 브레스')
     */
    static processMonsterDeath(game, player, monster, killTypeStr) {
        const scaledXp = LootSystem.getScaledXpValue(player, monster);
        game.addLogEntry(`[System] ${monster.name}을(를) ${killTypeStr}(으)로 처치했습니다! (+${scaledXp} XP)`, `system`);
        
        // 1. 처치 카운트 및 로어 숙련도 가산 연산
        if (player && typeof player.recordKill === 'function') {
            if (monster.uniqueKey) player.recordKill(monster.uniqueKey);
            if (monster.key) player.recordKill(monster.key);
            if (monster.type) player.recordKill(monster.type);
            if (monster.name) player.recordKill(monster.name);
        }

        const slayLore = Math.max(1, Math.floor((monster.xpValue / 25) * (1 + Math.max(0, monster.level - player.level) * 0.20)));
        if (player.body && typeof player.body.gainLoreXp === 'function') {
            const loreLogs = player.body.gainLoreXp(monster.type, slayLore);
            loreLogs.forEach(l => game.addLogEntry(l, `loot`));

            // 현재 전투를 수행한 변신 본체 폼에도 처치 보너스 로어 XP 가산
            const currentMorphKey = player.mimicCore?.coreType || player.mimicCore?.name;
            if (currentMorphKey) {
                const morphKillBonus = Math.max(1, Math.floor(slayLore * 0.5));
                player.body.gainLoreXp(currentMorphKey, morphKillBonus);
            }
        }
        game.addLogEntry(`[System] ${monster.displayName} 처치 완료! 로어 숙련도 +${slayLore} 가산!`, `system`);

        // 2. 유니크 몬스터 판정
        const umm = game.uniqueMonsterManager || uniqueMonsterManager;
        const isUnique = Boolean(monster.isUnique || umm.isUnique(monster.uniqueKey || monster.type));

        // 2. 50F 모르고스 최종 보스 처치 판정 및 승천 파이프라인
        if (bossPhaseEngine.isMorgoth(monster)) {
            bossPhaseEngine.handleBossDeath(monster, player, game);
        } else if (isUnique) {
            // 3. 일반 유니크 몬스터 전용 전설 유물 / 에고 확정 드랍 파이프라인
            const uniqueDrops = umm.generateUniqueMonsterDrops(monster, game.floor || 1);
            for (const dropItem of uniqueDrops) {
                if (!game.items) game.items = [];
                game.items.push(dropItem);
                game.addLogEntry(`👑 [전설 유물 드랍] 유니크 처치 보상으로 [${dropItem.name}]이(가) 바닥에 떨어졌습니다!`, `loot`);
            }

            // 일반 유니크 코어 100% 드랍
            if (typeof monster.createCoreItem === 'function') {
                const coreItem = monster.createCoreItem();
                if (coreItem) {
                    if (!game.items) game.items = [];
                    game.items.push(coreItem);
                    game.addLogEntry(`[Loot] ${monster.name}가 바닥에 정수 코어 [${coreItem.name}]을(를) 떨어뜨렸습니다!`, `loot`);
                }
            }
        } else {
            // 4. 일반 몬스터 코어 드랍 계산
            let dropChance = 0.20;
            const loreLevel = player.body && typeof player.body.getLoreLevel === 'function' ? player.body.getLoreLevel(monster.type) : 1;
            dropChance += (loreLevel - 1) * 0.05;
            dropChance += (game.floor || 1) * 0.01;
            const lvlDiff = (monster.level || 1) - (player.level || 1);
            dropChance += Math.max(-0.10, Math.min(0.10, lvlDiff * 0.02));

            let starterBonus = 0;
            if (game.floor === 1) starterBonus = 0.25;
            else if (game.floor === 2) starterBonus = 0.15;
            else if (game.floor === 3) starterBonus = 0.08;
            dropChance += starterBonus;

            const monsterRarity = determineRarity(monster.prefixes || [], monster.suffixes || []);
            if (monsterRarity === "uncommon") dropChance += 0.10;
            else if (monsterRarity === "rare") dropChance += 0.20;
            else if (monsterRarity === "epic") dropChance += 0.35;

            const monsterConfig = getSpeciesConfig(monster.type);
            const isBoss = (monsterConfig && monsterConfig.growthType === "BOSS") || 
                           (monster.displayName && (monster.displayName.includes("군단장") || monster.displayName.includes("추장") || monster.displayName.includes("대룡") || monster.displayName.includes("군주") || monster.displayName.includes("대천사")));
            
            if (isBoss) {
                dropChance = 1.0;
            } else {
                dropChance = Math.max(0.05, Math.min(0.95, dropChance));
            }

            if (Math.random() < dropChance && typeof monster.createCoreItem === 'function') {
                const coreItem = monster.createCoreItem();
                if (coreItem) {
                    if (!game.items) game.items = [];
                    game.items.push(coreItem);
                    game.addLogEntry(`[Loot] ${monster.name}가 바닥에 정수 코어 [${coreItem.name}]을(를) 떨어뜨렸습니다! (드롭 확률: ${Math.round(dropChance * 100)}%)`, `loot`);
                }
            }

            // 5. 일반 / 보스 ToME 전리품(장비/소모품/유물) 동적 드롭 생성
            const monsterDrops = TomeLootGenerator.rollMonsterDrop(monster, game.floor || 1);
            for (const dropItem of monsterDrops) {
                if (!game.items) game.items = [];
                game.items.push(dropItem);
                game.addLogEntry(`[Loot] ${monster.displayName}이(가) 전리품 [${dropItem.name}]을(를) 떨어뜨렸습니다!`, `loot`);
            }
        }

        // 6. Arrow/궁수 계열 몬스터 처치 시 화살 다발(15~30발) 85% 보너스 드랍 연동
        const isArcher = Boolean(
            (Array.isArray(monster.spells) && monster.spells.some(s => (typeof s === 'string' ? s : (s.id || s.name || '')).toUpperCase().includes('ARROW'))) ||
            /archer|ranger|bowman|hunter|sniper|궁수|사수/i.test(monster.name || '') ||
            /archer|ranger|bowman|hunter|sniper|궁수|사수/i.test(monster.displayName || '') ||
            /archer|ranger|bowman|hunter|sniper|궁수|사수/i.test(monster.type || '') ||
            (Array.isArray(monster.specialTags) && monster.specialTags.some(t => ['ARCHER', 'ARROW'].includes(String(t).toUpperCase()))) ||
            (Array.isArray(monster.tags) && monster.tags.some(t => ['ARCHER', 'ARROW'].includes(String(t).toUpperCase())))
        );

        if (isArcher && Math.random() < 0.85) {
            const danger = Math.max(1, game.floor || monster.level || 1);
            const count = Math.floor(Math.random() * 16) + 15; // 15 ~ 30발 다발

            let arrowName = 'Bundle of Arrows';
            let dice = '1d4';
            let color = '#94a3b8';
            let flavor = 'A bundle of recovered flight arrows with sharp iron tips.';

            if (danger >= 40) {
                arrowName = 'Bundle of Seeker Arrows';
                dice = '4d4';
                color = '#4ade80';
                flavor = 'A bundle of deadly precision seeker arrows.';
            } else if (danger >= 25) {
                arrowName = 'Bundle of Silver Arrows';
                dice = '3d4';
                color = '#cbd5e1';
                flavor = 'A bundle of hallowed silver arrows that burn evil creatures.';
            } else if (danger >= 12) {
                arrowName = 'Bundle of Sheaf Arrows';
                dice = '1d5';
                color = '#f97316';
                flavor = 'A bundle of heavy-headed sheaf arrows.';
            }

            const arrowItem = new Item(
                monster.x || 0,
                monster.y || 0,
                'QUIVER',
                '{',
                color,
                arrowName,
                0,
                'QUIVER',
                {},
                dice,
                null,
                [],
                [],
                ['AMMO'],
                flavor
            );
            arrowItem.tval = 17; // TVAL.ARROW
            arrowItem.count = count;
            arrowItem.weight = 0.1;

            if (!game.items) game.items = [];
            game.items.push(arrowItem);
            game.addLogEntry(`🏹 [궁수 전리품] ${monster.displayName || monster.name} 처치 보상으로 화살 다발 [${arrowItem.name}] (${arrowItem.count}발)이 바닥에 떨어졌습니다!`, `loot`);
        }

        // 7. 월드 몬스터 리스트 제거 및 XP 획득 격발
        const monsterList = game.dungeon?.monsters || game.monsters;
        if (monsterList && Array.isArray(monsterList)) {
            const idx = monsterList.indexOf(monster);
            if (idx !== -1) monsterList.splice(idx, 1);
        }

        const xpResult = player.gainXp(scaledXp);
        if (xpResult && xpResult.leveledUp && Array.isArray(xpResult.logs)) {
            xpResult.logs.forEach(logLine => game.addLogEntry(logLine, `loot`));
        }
    }
}
