/**
 * @module CombatCalculator
 * @category core
 * @description 전투 주사위 롤링, 대미지 계산, 치명타 판정, 방어력 감쇄 및 시너지 효과 연산 전담 수학 연산 엔진
 * @purity Stateless System
 * @dependencies Tags.js, ReactionRegistry.js, MimicBody.js
 * @exports COMBAT_CONFIG, SYNERGY_TRIGGERS, SPELL_SYNERGY_TRIGGERS, CombatCalculator
 */

import { PREFIX_TAGS, ELEMENT_METADATA } from '../entities/Tags.js';
import { ELEMENTAL_REACTIONS, applyMonsterDebuff } from './ReactionRegistry.js';
import { TOME_SLAY_CONFIG, RANGED_COMBAT_CONFIG, calculateDexCritChance, calculateToHitVsAc, MONSTER_DEFENSE_ARCHETYPES, COMBAT_ACCURACY_CONFIG, WEAPON_MASTERY_CONFIG } from '../configs/GameBalanceConfig.js';
import { getSpeciesConfig } from '../entities/MonsterRegistry.js';
import { TomeEgoEngine } from '../systems/TomeEgoEngine.js';
import { UnifiedTraitEngine } from '../systems/UnifiedTraitEngine.js';

// 1. 전투 공식 및 한계 조율 데이터 레지스트리 (Hardcoding Eradication)
export const COMBAT_CONFIG = {
    FEAR_AURA: { maxDistance: 5.5, accuracyPenaltyPerStack: 3 },
    UPGRADE: { armorPenPerLevel: 0.02, conModPenLimit: 0.90, dmgMultPerLevel: 0.03 },
    CRIT: { baseThreshold: 20, minThreshold: 15, baseMultiplier: 1.5, multiplierPerStack: 0.15 },
    BERSERK_RAGE: { hpPercentageTrigger: 0.50, damageAmpPerStack: 0.40 },
    ELEMENTAL_MELEE: { diceFormula: "1d4", coldVulnerabilityAmp: 1.30 },
    MONSTER: {
        SLIME_REFLECTION: { chance: 0.15, diceFormula: "1d4" },
        OGRE_REGEN: { chance: 0.30, maxHpPercentageHeal: 0.10, cooldown: 4 }
    },
    PLAYER_DEFENSE: { baseAC: 10, protectPrayerReduction: 3 },
    SPELL_SYNERGY: {
        MANA_LEAK_DEBUFF: 0.80,         // -20% spell damage
        ELEMENTAL_BOOST_AMP: 0.50,      // +50% breath damage per stack
        MAGIC_BOOST_AMP: 0.20,         // +20% spell damage per stack
        FOCUS_AMP: 0.20,               // +20% damage per stack
        SPELL_CHARGE_ENERGY: 15,
        SAGE_HEAL_PCT: 0.10,
        QUICKCAST_CD_REDUCTION: 0.80    // 20% cooldown reduction compound
    }
};

// 2. 시너지 규격 정의 레지스트리
export const SYNERGY_TRIGGERS = {
    // A. 종말의 무구 시너지
    APOCALYPSE: {
        name: "종말의 무구",
        checkCondition: (player, monster, activeTags) => (activeTags["APOCALYPSE"] || 0) > 0,
        calcDamage: (player, monster, activeTags) => {
            const stacks = activeTags["APOCALYPSE"];
            let extraDmg = 0;
            for (let a = 0; a < stacks; a++) {
                extraDmg += CombatCalculator.rollDice("2d4");
            }
            return { extraDmg, meta: { stacks } };
        },
        logFormat: (extraDmg, meta) => `[ItemSkill] 💥 종말의 무구 시너지 격동! (+${extraDmg} 추가 종말 피해, ${meta.stacks}중첩)`,
        logType: "loot",
        damageTarget: "physical" // 가산될 데미지 유형
    },
    // B. 화염 원화 대폭발 (5스택 충족 시)
    FIRE_INFUSION: {
        name: "화염 원화 대폭발",
        checkCondition: (player, monster, activeTags) => (monster.elementalInfusions?.FIRE || 0) >= 5,
        calcDamage: (player, monster, activeTags) => {
            monster.elementalInfusions.FIRE = 0; // 스택 초기화
            const extraDmg = Math.max(5, CombatCalculator.rollDice("3d6") + player.intMod);
            return { extraDmg, meta: {} };
        },
        logFormat: (extraDmg) => `[Reaction] 🔥 화염 원화(Combustion) 대폭발 격발! +${extraDmg} 격렬한 화염 폭사 피해!`,
        logType: "combat",
        damageTarget: "elemental",
        elementKey: "FIRE"
    },
    // C. 2원소 조합 반응
    ELEMENT_REACTION: {
        name: "원소 반응",
        checkCondition: (player, monster, activeTags) => {
            if (!monster.elementalInfusions) return false;
            const activeElements = Object.keys(monster.elementalInfusions).filter(k => monster.elementalInfusions[k] > 0);
            return activeElements.length >= 2;
        },
        calcDamage: (player, monster, activeTags, game) => {
            const activeElements = Object.keys(monster.elementalInfusions).filter(k => monster.elementalInfusions[k] > 0);
            const key1 = `${activeElements[0]}_${activeElements[1]}`;
            const key2 = `${activeElements[1]}_${activeElements[0]}`;
            const react = ELEMENTAL_REACTIONS[key1] || ELEMENTAL_REACTIONS[key2];
            if (react) {
                const res = react.effect(game, monster, player);
                // 사용된 원소 스택 소멸
                res.consume.forEach(c => {
                    monster.elementalInfusions[c] = Math.max(0, monster.elementalInfusions[c] - 1);
                });
                return { 
                    extraDmg: res.extraDmg, 
                    meta: { reactionName: react.name, consume: res.consume, element: activeElements[1] } 
                };
            }
            return { extraDmg: 0, meta: {} };
        },
        logFormat: (extraDmg, meta) => `[Reaction] ${meta.reactionName} 발생! 추가 피해 +${extraDmg}`, 
        logType: "combat",
        damageTarget: "elemental",
        skipLog: true, // Reaction Registry 내부에서 이미 고유 로그를 발생시켰으므로 로그 이중 출력 방지
        getElementKey: (meta) => meta.element
    }
};

// 3. 주문 연쇄 시너지 데이터 레지스트리 (SPELL_CHARGE, SAGE_HEAL 등 주문 적중/처치 트리거 확장 가능)
export const SPELL_SYNERGY_TRIGGERS = {
    // A. 마력전도 (SPELL_CHARGE) - 주문 적중 시 에너지 충전
    SPELL_CHARGE: {
        name: "마력전도",
        checkCondition: (player, targetMonster, activeTags, isDead) => (activeTags["SPELL_CHARGE"] || 0) > 0,
        executeEffect: (player, targetMonster, activeTags, isDead) => {
            const stacks = activeTags["SPELL_CHARGE"];
            const energyGain = COMBAT_CONFIG.SPELL_SYNERGY.SPELL_CHARGE_ENERGY * stacks;
            player.energy += energyGain;
            return {
                triggered: true,
                log: `[Skill] 마력전도 발동! 마법 적중으로 행동 에너지 +${energyGain} 충전!`
            };
        }
    },
    // B. 현자의 가호 (SAGE_HEAL) - 주문 처치 시 잃은 체력 비례 힐
    SAGE_HEAL: {
        name: "현자의 가호",
        checkCondition: (player, targetMonster, activeTags, isDead) => {
            const isVulnerable = targetMonster.debuffs && targetMonster.debuffs.magicVulnerability > 0;
            return isDead && isVulnerable && (activeTags["SAGE_HEAL"] || 0) > 0;
        },
        executeEffect: (player, targetMonster, activeTags, isDead) => {
            const stacks = activeTags["SAGE_HEAL"];
            const healPct = COMBAT_CONFIG.SPELL_SYNERGY.SAGE_HEAL_PCT * stacks;
            const healAmt = Math.max(1, Math.floor((player.stats.maxHp - player.stats.hp) * healPct));
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmt);
            return {
                triggered: true,
                log: `[Skill] 현자의가호 발동! 마법 취약 상태인 적을 처치하여 체력을 +${healAmt} 회복했습니다! (HP: ${player.stats.hp}/${player.stats.maxHp})`
            };
        }
    }
};

export class CombatCalculator {
    /**
     * 주사위 수식(예: '2d6', '1d3')을 파싱하여 랜덤 주사위 합계를 반환합니다.
     * @param {string} formula - 주사위 공식
     * @returns {number}
     */
    static rollDice(formula) {
        if (!formula) return 2;
        let t = formula.split(`d`),
          n = parseInt(t[0]),
          r = parseInt(t[1]),
          i = 0;
        for (let e = 0; e < n; e++) i += Math.floor(Math.random() * r) + 1;
        return i;
    }

    /**
     * 플레이어의 속성 저항 여부를 반환합니다.
     * @param {Object} player 
     * @param {string} element 
     * @returns {boolean}
     */
    static getPlayerResistance(player, element, activeTags = null) {
        if (!player || !element) return false;
        const trait = UnifiedTraitEngine.getElementalTrait(player, element);
        if (trait && (trait.isImmune || trait.isResistant)) return true;
        if (TomeEgoEngine.hasElementalResistance(player, element)) return true;
        return player.getCombinedResistances ? player.getCombinedResistances(activeTags).includes(element) : false;
    }

    /**
     * 플레이어의 현재 무기 및 아우라 설정에 따른 근접 평타 최종 원소 공격 속성을 도출합니다.
     * @param {Object} player 
     * @returns {string} (e.g. PHYSICAL, FIRE, COLD, APOCALYPSE 등)
     */
    static resolvePlayerAttackElement(player) {
        const activeTags = player.compileActiveTags();
        if ((activeTags["APOCALYPSE"] || 0) > 0) {
            return "APOCALYPSE";
        }
        let weapon = player.equipment.weapon;
        if (weapon && weapon.prefixes) {
            for (let pref of weapon.prefixes) {
                let tag = PREFIX_TAGS[pref];
                if (tag && tag.element) {
                    return tag.element;
                }
            }
        }
        return "PHYSICAL";
    }

    /**
     * 플레이어의 현재 코어, 장비, 아머 설정에 따른 액티브 브레스 최종 속성을 도출합니다.
     * @param {Object} player 
     * @returns {string}
     */
    static resolvePlayerBreathElement(player) {
        // 플레이어가 명시적으로 선택한 속성 오버라이드가 최우선 순위
        if (player.selectedBreathElement) return player.selectedBreathElement;

        const checkCore = (core) => {
            if (core && core.prefixes) {
                for (let pref of core.prefixes) {
                    let tag = PREFIX_TAGS[pref];
                    if (tag && tag.element) return tag.element;
                }
            }
            return null;
        };

        let element = checkCore(player.equipment.subCore1) || checkCore(player.equipment.subCore2);
        if (element) return element;

        let weapon = player.equipment.weapon;
        if (weapon && weapon.prefixes) {
            for (let pref of weapon.prefixes) {
                let tag = PREFIX_TAGS[pref];
                if (tag && tag.element) return tag.element;
            }
        }

        const checkArmor = (gear) => {
            if (gear && gear.prefixes) {
                for (let pref of gear.prefixes) {
                    let tag = PREFIX_TAGS[pref];
                    if (tag && tag.element) return tag.element;
                }
            }
            return null;
        };
        element = checkArmor(player.equipment.armor) || 
                  checkArmor(player.equipment.shield) || 
                  checkArmor(player.equipment.helmet) || 
                  checkArmor(player.equipment.gloves) || 
                  checkArmor(player.equipment.boots) || 
                  checkArmor(player.equipment.cloak);
        if (element) return element;

        return "FIRE"; // 기본 디폴트 속성
    }

    /**
     * 플레이어가 장착 중인 모든 장비 및 등불 중에서 특정 특수 태그(예: QUICKCAST 등)를 하나라도 가졌는지 판별합니다.
     * @param {Object} player 
     * @param {string} tagName 
     * @returns {boolean}
     */
    static hasEquipmentTag(player, tagName) {
        for (let key in player.equipment) {
            const gear = player.equipment[key];
            if (gear && gear.specialTags && gear.specialTags.includes(tagName)) {
                return true;
            }
        }
        if (player.equippedLamp && player.equippedLamp.specialTags && player.equippedLamp.specialTags.includes(tagName)) {
            return true;
        }
        return false;
    }

    /**
     * 전투 중 만족되는 모든 특수 시너지 및 원소 격발 데미지를 정적 순회하여 일괄 처리합니다.
     */
    static processCombatSynergies(game, player, monster, activeTags) {
        let physicalAdd = 0;
        let elementalAdd = 0;
        let appliedElemDmgs = {};

        for (const key in SYNERGY_TRIGGERS) {
            const trigger = SYNERGY_TRIGGERS[key];
            if (trigger.checkCondition(player, monster, activeTags)) {
                // 1. 데미지 및 연쇄 결과 산출
                const res = trigger.calcDamage(player, monster, activeTags, game);
                if (res.extraDmg > 0) {
                    // 2. 데미지 대상별 수치 가산
                    if (trigger.damageTarget === "physical") {
                        physicalAdd += res.extraDmg;
                    } else if (trigger.damageTarget === "elemental") {
                        elementalAdd += res.extraDmg;
                        const elemKey = trigger.getElementKey ? trigger.getElementKey(res.meta) : trigger.elementKey;
                        if (elemKey) {
                            appliedElemDmgs[elemKey] = (appliedElemDmgs[elemKey] || 0) + res.extraDmg;
                        }
                    }

                    // 3. 로그 피드백 격발
                    if (!trigger.skipLog) {
                        game.addLogEntry(trigger.logFormat(res.extraDmg, res.meta), trigger.logType);
                    }
                }
            }
        }

        return { physicalAdd, elementalAdd, appliedElemDmgs };
    }

    /**
     * 플레이어의 최종 평타 타수를 순수 함수로 연산합니다.
     */
    static calculateNumHits(player, activeTags) {
        const frenzyStacks = activeTags["FRENZY"] || 0;
        const strikeStacks = activeTags["STRIKE_UNIT"] || 0;
        
        let weapon = player.equipment.weapon;
        let category = "UNARMED";
        if (weapon && weapon.slotType === 'WEAPON') {
            category = weapon.weaponCategory || "SWORD";
        }
        const masteryLvl = player.body.getWeaponMasteryLevel(category);

        const levelConfig = WEAPON_MASTERY_CONFIG.levels.find(l => l.lvl === masteryLvl) || { extraAttacks: 0 };
        const masteryExtraAttacks = levelConfig.extraAttacks || 0;

        const reqResult = player.getWeaponRequirement();
        const requirementExtraAttack = reqResult.isMet ? 1 : 0;

        let numHits = 1;
        let log = null;
        
        if (frenzyStacks > 0 && Math.random() < (0.20 * frenzyStacks)) {
            numHits = 2;
            log = `[Skill] 광폭화 발동! 연속으로 2회 공격합니다!`;
        }
        
        const gearExtraAttack = Math.min(6, strikeStacks);
        if (gearExtraAttack > 0) {
            numHits += gearExtraAttack;
        }

        if (masteryExtraAttacks > 0) {
            numHits += masteryExtraAttacks;
        }

        if (requirementExtraAttack > 0) {
            numHits += requirementExtraAttack;
        }

        return { numHits, log };
    }

    /**
     * 몬스터의 종족, 이름, 플래그를 분석하여 5대 생태/신체 방어 아키타입을 도출합니다.
     * @param {Object} monster
     * @returns {Object|null} MONSTER_DEFENSE_ARCHETYPES 정의 객체
     */
    static resolveMonsterArchetype(monster) {
        if (!monster) return null;
        const type = (monster.type || '').toUpperCase();
        const name = (monster.name || monster.displayName || '').toUpperCase();
        const flags = monster.flags || [];

        for (const key in MONSTER_DEFENSE_ARCHETYPES) {
            const arch = MONSTER_DEFENSE_ARCHETYPES[key];
            if (arch.types && arch.types.some(t => type.includes(t) || name.includes(t))) {
                return arch;
            }
            if (arch.flagCheck && arch.flagCheck(flags)) {
                return arch;
            }
        }
        return null;
    }

    /**
     * 플레이어 평타 공격의 명중률 및 판정을 연산합니다.
     * ToME 2.3.5 정통 Base-To-Hit (BTH) 백분율 명중 공식 + 5대 생태 방어 아키타입 기반
     */
    static calculateHitChance(player, monster, activeTags, naturalRoll) {
        const cfg = COMBAT_ACCURACY_CONFIG;
        let weapon = player.equipment.weapon;
        let weaponToHit = (weapon ? (weapon.to_h || weapon.toHit || weapon.upgradeLevel || 0) : 0) * cfg.WEAPON_TO_H_WEIGHT;
        let category = weapon ? (weapon.weaponCategory || "SWORD") : "UNARMED";
        const masteryLvl = player.body ? player.body.getWeaponMasteryLevel(category) : 1;

        const level = player.level || 1;
        const playerDex = player.stats?.dex || (10 + (player.dexMod || 0) * 2);
        const dexBonus = Math.floor((playerDex - 10) * 1.5);
        const masteryBonus = (masteryLvl - 1) * cfg.MASTERY_HIT_WEIGHT;
        const accBoost = (activeTags["ACCURACY_BOOST"] || 0) * 4;

        // 몬스터 5대 방어 아키타입 해석
        const archetype = this.resolveMonsterArchetype(monster);
        let archetypeHitBonus = 0;
        let log = null;

        if (archetype && archetype.hitBonus) {
            archetypeHitBonus += archetype.hitBonus;
        }

        // FEAR_AURA 명중률 디버프
        const monsterTags = monster.compileActiveTags ? monster.compileActiveTags() : {};
        const fearAuraStacks = monsterTags["FEAR_AURA"] || 0;
        let fearPenalty = 0;
        
        if (fearAuraStacks > 0) {
            let dx = monster.x - player.x, dy = monster.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const fearCfg = COMBAT_CONFIG.FEAR_AURA;
            if (dist <= fearCfg.maxDistance) {
                fearPenalty = fearAuraStacks * fearCfg.accuracyPenaltyPerStack * 2;
                log = `[Combat] ${monster.displayName}의 초월적 지배 위압감으로 인해 명중률이 감소합니다! (-${fearPenalty} BTH)`;
            }
        }

        // ToME Base-To-Hit (BTH)
        let bHit = cfg.BASE_HIT_SCORE + (level * cfg.LEVEL_HIT_WEIGHT) + dexBonus + weaponToHit + masteryBonus + accBoost + archetypeHitBonus - fearPenalty;
        let targetAC = (monster.baseAC !== undefined ? monster.baseAC : 10) + (archetype?.effectiveAcBonus || 0);

        // ToME 2.3.5 정통 Hit Chance Formula:
        let rawHitChance = bHit / (bHit + targetAC * cfg.AC_SCALING_FACTOR);
        let hitChance = Math.max(cfg.MIN_HIT_CHANCE, Math.min(cfg.MAX_HIT_CHANCE, rawHitChance));

        let isHit = Math.random() < hitChance;

        // 몬스터 고유 방어 특성 반응 판정
        if (isHit && archetype) {
            if (archetype.id === 'AGILE_FLYING' && Math.random() < archetype.dodgeRate) {
                isHit = false;
                log = archetype.flavorLog;
            } else if (archetype.id === 'ETHEREAL_GHOST') {
                const isElementalWeapon = weapon && (weapon.prefixes?.some(p => PREFIX_TAGS[p]?.element) || weapon.element);
                if (!isElementalWeapon && Math.random() < archetype.phaseMissRate) {
                    isHit = false;
                    log = archetype.flavorLog;
                }
            }
        }

        return { isHit, hitChance, bHit, targetAC, log, archetype };
    }

    /**
     * 플레이어 물리 공격 피해량을 계산합니다.
     */
    static calculatePhysicalDamage(player, monster, activeTags, naturalRoll) {
        let weapon = player.equipment.weapon;
        let weaponDmgRoll = CombatCalculator.rollDice(weapon ? weapon.dice : `1d3`);
        let category = weapon ? (weapon.weaponCategory || "SWORD") : "UNARMED";
        const masteryLvl = player.body.getWeaponMasteryLevel(category);
        
        let upgradeLvl = weapon ? (weapon.upgradeLevel || 0) : 0;
        const upgCfg = COMBAT_CONFIG.UPGRADE;
        let armorPen = upgradeLvl * upgCfg.armorPenPerLevel;
        let effectiveConMod = monster.conMod;
        if (armorPen > 0) {
            effectiveConMod = Math.max(0, Math.floor(monster.conMod * (1 - Math.min(upgCfg.conModPenLimit, armorPen))));
        }
        
        let baseDmg = weaponDmgRoll + player.strMod + upgradeLvl - effectiveConMod;
        let physDmg = Math.max(1, baseDmg);
        
        let dmgMult = 1.0 + upgradeLvl * upgCfg.dmgMultPerLevel;
        physDmg = Math.floor(physDmg * dmgMult);

        // Weapon Mastery Damage Multiplier: *(1.0 + (lvl - 1) * 0.05)
        const masteryDmgMult = 1.0 + (masteryLvl - 1) * 0.05;
        physDmg = Math.floor(physDmg * masteryDmgMult);

        // CRIT_UNIT (치명타 예리함)
        const critStacks = activeTags["CRIT_UNIT"] || 0;
        const critCfg = COMBAT_CONFIG.CRIT;
        const critThreshold = Math.max(critCfg.minThreshold, critCfg.baseThreshold - critStacks);
        let isCritRoll = naturalRoll >= critThreshold;
        let critLog = null;
        if (isCritRoll) {
            const critMultiplier = critCfg.baseMultiplier + critStacks * critCfg.multiplierPerStack;
            physDmg = Math.floor(physDmg * critMultiplier);
            critLog = `[Combat] 🎯 치명타 예리함 격발! (내추럴 주사위 롤 ${naturalRoll} >= 임계치 ${critThreshold}) 치명 대미지 배율 x${critMultiplier.toFixed(2)} 적용!`;
        }

        // TROLL BERSERK_RAGE
        const berserkRage = activeTags["BERSERK_RAGE"] || 0;
        const bskCfg = COMBAT_CONFIG.BERSERK_RAGE;
        let berserkLog = null;
        if (berserkRage > 0 && player.stats.hp <= player.stats.maxHp * bskCfg.hpPercentageTrigger) {
            physDmg = Math.floor(physDmg * (1.0 + berserkRage * bskCfg.damageAmpPerStack));
            berserkLog = `[Skill] 🩸 광전사의 격노 격동! 물리 공격의 위력이 ${(1.0 + berserkRage * bskCfg.damageAmpPerStack).toFixed(1)}배 증폭됩니다!`;
        }

        // ToME 2.3.5 정통 슬레이(Slay) 배율 적용
        const slayResult = TomeEgoEngine.getSlayMultiplier(player, monster);
        let slayLog = null;
        if (slayResult && slayResult.multiplier > 1.0) {
            physDmg = Math.floor(physDmg * slayResult.multiplier);
            slayLog = `[Combat] 🗡️ ${slayResult.slayType} 격발! 대상에게 ${slayResult.multiplier}배의 치명적 슬레이 피해!`;
        }

        return { dmg: physDmg, isCritRoll, critLog, berserkLog, slayLog };
    }

    /**
     * 원소 평타 보너스 피해량을 연산합니다.
     */
    static calculateElementalMeleeDamage(player, monster, activeTags, physDmg = 10) {
        let appliedElemDmgs = {};
        let totalElemDmg = 0;
        const elements = ["FIRE", "COLD", "LIGHTNING", "ACID", "MANA"];
        const elemCfg = COMBAT_CONFIG.ELEMENTAL_MELEE;

        // 1. 접두사/태그 기반 고정 원소 대미지
        for (const element of elements) {
            const tagKey = element + "_MELEE";
            const stacks = activeTags[tagKey] || 0;
            if (stacks > 0) {
                let baseRoll = 0;
                for (let s = 0; s < stacks; s++) {
                    baseRoll += CombatCalculator.rollDice("1d4");
                }
                const statBonus = Math.max(0, player.intMod);
                let rawElemDmg = baseRoll + statBonus;
                
                // COLD 동결 취약 적용
                if (element === "COLD" && monster.isColdVulnerable && monster.isColdVulnerable > 0) {
                    rawElemDmg = Math.floor(rawElemDmg * elemCfg.coldVulnerabilityAmp);
                }

                const targetResPercent = monster.getResistancePercent ? monster.getResistancePercent(element) : 0;
                if (targetResPercent > 0) {
                    rawElemDmg = Math.floor(rawElemDmg * (1 - targetResPercent));
                }

                rawElemDmg = Math.max(1, rawElemDmg);

                if (rawElemDmg > 0) {
                    appliedElemDmgs[element] = rawElemDmg;
                    totalElemDmg += rawElemDmg;

                    // 원소 주입(Infusion) 스택 누산
                    monster.elementalInfusions = monster.elementalInfusions || { FIRE: 0, COLD: 0, LIGHTNING: 0, ACID: 0, MANA: 0 };
                    monster.elementalInfusions[element] = (monster.elementalInfusions[element] || 0) + 1;
                }
            }
        }

        // 2. ToME 2.3.5 정통 에고/유물 브랜드(Brand) 추가 피해
        const brandResult = TomeEgoEngine.getBrandDamage(player, physDmg);
        if (brandResult && brandResult.extraDmg > 0 && brandResult.element) {
            appliedElemDmgs[brandResult.element] = (appliedElemDmgs[brandResult.element] || 0) + brandResult.extraDmg;
            totalElemDmg += brandResult.extraDmg;
        }

        return { appliedElemDmgs, totalElemDmg };
    }

    /**
     * 평타 추가 시너지 및 오우거/슬라임 등의 몬스터 고유 반사 피해를 일괄 조율합니다.
     */
    static processGenericAttackSynergies(player, monster, activeTags, currentPhysDmg, game) {
        let physDmg = currentPhysDmg;

        // Ambush Tag Synergy (replaces Goblin 7pt)
        const ambushStacks = activeTags["AMBUSH"] || 0;
        if (ambushStacks > 0) {
            let isNearWall = false;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    let tile = game.map.getTile(monster.x + dx, monster.y + dy);
                    if (tile && !tile.isWalkable) {
                        isNearWall = true;
                        break;
                    }
                }
                if (isNearWall) break;
            }
            if (isNearWall) {
                physDmg += ambushStacks * 3;
            }
        }

        // Strong Attack Tag Synergy (replaces Traveler 3pt)
        const strongAttack = activeTags["STRONG_ATTACK"] || 0;
        let isStrong = strongAttack > 0 && player.incrementCount("strong_attack", 3);
        if (isStrong) {
            physDmg = Math.floor(physDmg * (1.0 + strongAttack * 0.50));
        }

        // Monster Flat Reduction
        if (monster.getFlatDamageReduction) {
            const flatReduction = monster.getFlatDamageReduction();
            if (flatReduction > 0) {
                physDmg = Math.max(1, physDmg - flatReduction);
                game.addLogEntry(`[MonsterSkill] 🛡️ ${monster.displayName}의 펄크 효과로 물리 피해가 -${flatReduction} 경감되었습니다!`, `combat`);
            }
        }

        // Curse Boost Tag Synergy (replaces Imp 5pt)
        const curseBoost = activeTags["CURSE_BOOST"] || 0;
        if (curseBoost > 0 && monster.stats.hp > 0 && Math.random() < (0.25 * curseBoost)) {
            if (!monster.debuffs) monster.debuffs = { poison: 0, frost: 0, paralyzed: false, magicVulnerability: 0 };
            monster.debuffs.magicVulnerability = 3;
            game.addLogEntry(`[Skill] 약화의 저주 발동! ${monster.name}에게 3턴간 [마법 취약] 상태를 부여했습니다! (마법 피해 +30% 증폭)`, `loot`);
        }

        // 몬스터 고유 기믹 - 오우거 자가 재생
        const mstCfg = COMBAT_CONFIG.MONSTER;
        if (monster.type === `OGRE` && monster.stats.hp > 0 && (!monster.giantBloodCooldown || monster.giantBloodCooldown <= 0) && Math.random() < mstCfg.OGRE_REGEN.chance) {
            let healAmt = Math.max(1, Math.floor((monster.stats.maxHp - monster.stats.hp) * mstCfg.OGRE_REGEN.maxHpPercentageHeal));
            monster.stats.hp = Math.min(monster.stats.maxHp, monster.stats.hp + healAmt);
            monster.giantBloodCooldown = mstCfg.OGRE_REGEN.cooldown;
            game.addLogEntry(`[MonsterSkill] 오우거 거인의피 발동! 강인한 심장박동으로 체력 +${healAmt} 회복 (HP: ${monster.stats.hp}/${monster.stats.maxHp})`, `combat`);
        }

        // 몬스터 고유 기믹 - 슬라임 산성반격
        if (monster.type === `SLIME` && monster.stats.hp > 0 && Math.random() < mstCfg.SLIME_REFLECTION.chance) {
            let reflDmg = CombatCalculator.rollDice(mstCfg.SLIME_REFLECTION.diceFormula);
            player.stats.hp = Math.max(0, player.stats.hp - reflDmg);
            game.addLogEntry(`[MonsterSkill] 슬라임 산성반격 발동! 산성 액체가 튀어 나에게 ${reflDmg}의 반사 피해! (HP: ${player.stats.hp}/${player.stats.maxHp})`, `loot`);
        }

        return { physDmg, isStrong };
    }

    /**
     * 플레이어의 흡혈 비율을 적용합니다.
     */
    static applyLifesteal(player, totalDmg) {
        let lifestealPct = player.getLifestealPercent();
        let healAmt = 0;
        let log = null;
        if (lifestealPct > 0) {
            let f = lifestealPct / 100;
            healAmt = Math.max(1, Math.floor(totalDmg * f));
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmt);
            log = `[Skill] 흡혈 태그 효과 발동! 체력 +${healAmt} 회복. (HP: ${player.stats.hp}/${player.stats.maxHp})`;
        }
        return { healAmt, log };
    }

    /**
     * 몬스터 평타 공격 피해량을 연산합니다.
     */
    static calculateMonsterAttackDamage(game, monster, player, skill) {
        let dmgRoll = CombatCalculator.rollDice("1d4");
        let totalDmg = Math.max(1, dmgRoll + monster.strMod - player.conMod);
        
        let skillInfo = {};
        if (skill && skill.calcDamage) {
            const res = skill.calcDamage(game, monster, player, totalDmg);
            totalDmg = res.dmg;
            skillInfo = res;
        }
        
        // 피의 갈망 버프
        if (monster.bloodLustTurns && monster.bloodLustTurns > 0) {
            totalDmg = Math.floor(totalDmg * 1.30);
        }
        
        let elemDmg = 0;
        let isFurious = monster.prefixes.includes('FURIOUS');
        if (isFurious) {
            elemDmg += CombatCalculator.rollDice("1d6");
        }
        let isChieftain = monster.suffixes.includes('CHIEFTAIN');
        if (isChieftain) {
            elemDmg += CombatCalculator.rollDice("1d8") + 2;
        }

        return { totalDmg, elemDmg, isFurious, isChieftain, skillInfo };
    }

    /**
     * ToME 2.3.5 정통 방어구 AC 물리 피해 감쇄 계산
     * @param {Object} player - 플레이어 인스턴스
     * @param {number} rawDmg - 몬스터가 가한 순수 물리 피해
     * @returns {number} 감쇄 후 실질 피해량
     */
    static calculateAcDamageReduction(player, rawDmg) {
        if (!player || rawDmg <= 0) return rawDmg;

        const playerTotalAC = player.getTotalAC ? player.getTotalAC() : (COMBAT_CONFIG.PLAYER_DEFENSE.baseAC + (player.dexMod || 0));
        
        // 1. 방어구 기본 AC 기반 감쇄 (AC / 8)
        const acReduction = Math.floor(playerTotalAC / 8);

        // 2. 생명력(CON) 기반 기본 신체 강도 감쇄 (CON / 10)
        const conModVal = player.stats?.con || player.baseStats?.con || 10;
        const conReduction = Math.floor(conModVal / 10);

        // 3. 방패 블록 (Shield Block) 판정
        let shieldBlockReduction = 0;
        if (player.equipment?.shield) {
            const shield = player.equipment.shield;
            const shieldBaseAC = shield.baseAC || 4;
            // 블록 확률: 기본 5% + 방패 AC * 2% (최대 35%)
            const blockChance = Math.min(0.35, 0.05 + shieldBaseAC * 0.02);
            if (Math.random() < blockChance) {
                shieldBlockReduction = Math.floor(shieldBaseAC * 0.75) + (player.dexMod || 0);
            }
        }

        const totalReduction = acReduction + conReduction + shieldBlockReduction;
        return Math.max(1, rawDmg - totalReduction);
    }

    /**
     * 플레이어가 받는 최종 피해량 경감 필터를 연산합니다.
     */
    static filterPlayerIncomingDamage(player, rawDmg, elemDmg, isFurious, isChieftain) {
        // 0. ToME 정통 AC 및 방패 블록 물리 감쇄 적용
        let totalDmg = CombatCalculator.calculateAcDamageReduction(player, rawDmg);
        const defenseCfg = COMBAT_CONFIG.PLAYER_DEFENSE;

        // Compile player active tags EXACTLY ONCE
        const activeTags = player.compileActiveTags ? player.compileActiveTags() : {};

        // Player Flat Reduction
        const flatReduction = player.getFlatDamageReduction ? player.getFlatDamageReduction(activeTags) : 0;
        if (flatReduction > 0) {
            totalDmg = Math.max(1, totalDmg - flatReduction);
        }

        // protectPrayer
        if (player.protectPrayerTurns && player.protectPrayerTurns > 0) {
            totalDmg = Math.max(1, totalDmg - defenseCfg.protectPrayerReduction);
        }

        let finalDmg = totalDmg + elemDmg;

        // Element Resistance
        if (isFurious && CombatCalculator.getPlayerResistance(player, "FIRE", activeTags)) {
            finalDmg = Math.max(1, finalDmg - Math.floor(elemDmg * 0.5));
        }
        if (isChieftain && CombatCalculator.getPlayerResistance(player, "ACID", activeTags)) {
            finalDmg = Math.max(1, finalDmg - Math.floor(elemDmg * 0.5));
        }

        return { finalDmg: Math.max(1, finalDmg) };
    }

    /**
     * 플레이어 액티브 마법/브레스 피해량 연산을 일괄 처리합니다.
     */
    static calculateActiveSkillDamage(player, targetMonster, activeTags, config) {
        const baseDamage = config.rollDamage();
        let totalDmg = Math.max(1, config.calcTotalDamage(player, baseDamage));
        const splCfg = COMBAT_CONFIG.SPELL_SYNERGY;

        // MANA_LEAK
        if (activeTags["MANA_LEAK"]) {
            totalDmg = Math.floor(totalDmg * splCfg.MANA_LEAK_DEBUFF);
        }

        // ELEMENTAL_BOOST or MAGIC_BOOST
        if (config.type === "BREATH") {
            const elemBoost = activeTags["ELEMENTAL_BOOST"] || 0;
            if (elemBoost > 0) {
                totalDmg = Math.floor(totalDmg * (1.0 + elemBoost * splCfg.ELEMENTAL_BOOST_AMP));
            }
        } else if (config.type === "PROJECTILE" || config.type === "SPELL") {
            const magicBoost = activeTags["MAGIC_BOOST"] || 0;
            if (magicBoost > 0) {
                totalDmg = Math.floor(totalDmg * (1.0 + magicBoost * splCfg.MAGIC_BOOST_AMP));
            }
        }

        // FOCUS
        const focusStacks = activeTags["FOCUS"] || 0;
        if (focusStacks > 0) {
            totalDmg = Math.floor(totalDmg * (1.0 + focusStacks * splCfg.FOCUS_AMP));
        }

        // Resolving active element
        let element = null;
        if (config.type === "BREATH") {
            element = config.defaultElement ? config.defaultElement : CombatCalculator.resolvePlayerBreathElement(player);
        } else {
            element = config.elementRes || "MAGIC";
        }

        // Resistance check
        const resists = targetMonster.getCombinedResistances ? targetMonster.getCombinedResistances() : [];
        const hasTagResist = targetMonster.prefixes && targetMonster.prefixes.some(pk => PREFIX_TAGS[pk] && PREFIX_TAGS[pk].element === element);
        const isResistant = hasTagResist || resists.includes(element);
        
        let isResistApplied = false;
        if (isResistant) {
            totalDmg = Math.max(1, Math.floor(totalDmg * 0.5));
            isResistApplied = true;
        }

        // Vulnerability check
        const isVulnerable = targetMonster.debuffs && targetMonster.debuffs.magicVulnerability > 0;
        let isVulnApplied = false;
        if (isVulnerable) {
            totalDmg = Math.floor(totalDmg * 1.3);
            isVulnApplied = true;
        }

        return { 
            totalDmg: Math.max(1, totalDmg), 
            isResistApplied, 
            isVulnApplied, 
            element, 
            elemName: (ELEMENT_METADATA[element] || ELEMENT_METADATA.FIRE || { name: "마법" }).name 
        };
    }

    /**
     * 플레이어 액티브 마법/브레스 적중 후 발생하는 각종 스펠 시너지 및 디버프/힐/쿨다운 연산을 순수 함수로 대통합합니다.
     */
    static processActiveSkillSynergies(game, player, targetMonster, activeTags, config, isDead, tagKey) {
        const splCfg = COMBAT_CONFIG.SPELL_SYNERGY;
        const synergyLogs = [];

        // 1. 주문 연쇄 시너지 레지스트리 동적 순회 및 효과 적용
        for (const key in SPELL_SYNERGY_TRIGGERS) {
            const trigger = SPELL_SYNERGY_TRIGGERS[key];
            if (trigger.checkCondition(player, targetMonster, activeTags, isDead)) {
                const res = trigger.executeEffect(player, targetMonster, activeTags, isDead);
                if (res.triggered && res.log) {
                    synergyLogs.push(res.log);
                }
            }
        }

        // 2. 기타 주문 부가 효과 (디버프 및 저주)
        if (!isDead) {
            if (config.type === "BREATH") {
                const element = config.defaultElement ? config.defaultElement : CombatCalculator.resolvePlayerBreathElement(player);
                applyMonsterDebuff(game, targetMonster, element, tagKey === "ACTIVE_HIGH_BREATH");
            }

            // Curse Boost
            const curseBoost = activeTags["CURSE_BOOST"] || 0;
            if (curseBoost > 0 && Math.random() < (0.25 * curseBoost)) {
                if (!targetMonster.debuffs) {
                    targetMonster.debuffs = { poison: 0, frost: 0, paralyzed: false, magicVulnerability: 0 };
                }
                targetMonster.debuffs.magicVulnerability = 3;
            }
        }

        // 3. Cooldown with QUICKCAST
        let baseCooldown = config.cooldown;
        const quickcastStacks = activeTags["QUICKCAST"] || 0;
        if (quickcastStacks > 0) {
            baseCooldown = Math.max(1, Math.floor(baseCooldown * Math.pow(splCfg.QUICKCAST_CD_REDUCTION, quickcastStacks)));
        }

        return { nextCooldown: baseCooldown, synergyLogs };
    }

    /**
     * 몬스터 종족/속성에 따른 ToME 슬레이(Slay) 배율을 연산합니다.
     */
    static calculateSlayMultiplier(player, monster, weapon, activeTags) {
        // 1. UnifiedTraitEngine ToME Slay Integration
        const traitSlay = UnifiedTraitEngine.calculateSlayMultiplier(player, monster);
        let maxMult = traitSlay ? traitSlay.multiplier : 1.0;
        let slayName = traitSlay ? traitSlay.bestSlay : null;

        const mType = (monster.type || '').toUpperCase();
        const mFlags = monster.flags || [];

        for (const [sKey, sCfg] of Object.entries(TOME_SLAY_CONFIG)) {
            const hasSlay = (activeTags && activeTags[sKey]) || (weapon && weapon.prefixes && weapon.prefixes.includes(sKey)) || (weapon && weapon.specialTags && weapon.specialTags.includes(sKey));
            if (!hasSlay) continue;

            let matches = false;
            if (sCfg.races && sCfg.races.some(r => mType.includes(r) || mFlags.includes(r))) {
                matches = true;
            } else if (sCfg.isAlignment && mFlags.includes('EVIL')) {
                matches = true;
            }

            if (matches && sCfg.multiplier > maxMult) {
                maxMult = sCfg.multiplier;
                slayName = sCfg.name;
            }
        }

        return { multiplier: maxMult, slayName };
    }

    /**
     * Bresenham 알고리즘을 사용한 2D 격자 시선(Line of Sight) 검사를 수행합니다.
     */
    static hasLineOfSight(map, x0, y0, x1, y1) {
        if (!map) return true;
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let cx = x0;
        let cy = y0;

        while (cx !== x1 || cy !== y1) {
            if (cx !== x0 || cy !== y0) {
                if (map && map.isWalkable && !map.isWalkable(cx, cy)) {
                    return false;
                }
            }
            let e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                cx += sx;
            }
            if (e2 < dx) {
                err += dx;
                cy += sy;
            }
        }
        return true;
    }

    /**
     * 원거리 무기(활/석궁/슬링) 사격 공격을 연산합니다.
     */
    static calculateRangedAttack(player, monster, weapon, arrows, activeTags, map) {
        const dx = monster.x - player.x;
        const dy = monster.y - player.y;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const maxRange = weapon ? (weapon.range || RANGED_COMBAT_CONFIG.defaultRange) : RANGED_COMBAT_CONFIG.defaultRange;

        if (dist > maxRange) {
            return { isHit: false, valid: false, reason: "OUT_OF_RANGE", dist, maxRange };
        }
        if (dist < RANGED_COMBAT_CONFIG.minRange) {
            return { isHit: false, valid: false, reason: "TOO_CLOSE", dist };
        }

        const hasLoS = CombatCalculator.hasLineOfSight(map, player.x, player.y, monster.x, monster.y);
        if (!hasLoS) {
            return { isHit: false, valid: false, reason: "NO_LOS", dist };
        }

        const masteryLvl = player.body ? player.body.getWeaponMasteryLevel("ARCHERY") : 1;
        const naturalRoll = Math.floor(Math.random() * 20) + 1;
        const toHit = (weapon ? (weapon.toHit || 0) : 0) + player.dexMod * 2 + player.proficiencyBonus + (masteryLvl - 1);
        const targetAC = monster.baseAC + monster.dexMod;

        const isHit = naturalRoll === 20 || (naturalRoll !== 1 && (naturalRoll + toHit >= targetAC));
        if (!isHit) {
            return { isHit: false, valid: true, dist, finalAccRoll: naturalRoll + toHit, targetAC, log: `[Archery] ${monster.name}에 대한 화살 사격이 빗나갔습니다! (명중 ${naturalRoll + toHit} vs AC ${targetAC})` };
        }

        // Damage calculation
        const damageDice = (weapon && weapon.dice) ? weapon.dice : (arrows && arrows.dice ? arrows.dice : RANGED_COMBAT_CONFIG.bowDamageDice);
        const baseDmgRoll = CombatCalculator.rollDice(damageDice);
        const multiplier = weapon ? (weapon.multiplier || RANGED_COMBAT_CONFIG.defaultMultiplier) : RANGED_COMBAT_CONFIG.defaultMultiplier;
        let rangedDmg = Math.max(1, Math.floor((baseDmgRoll + player.dexMod * RANGED_COMBAT_CONFIG.dexScalingFactor) * multiplier));

        // Archery Mastery scaling: +(lvl - 1) * 8%
        const masteryMult = 1.0 + (masteryLvl - 1) * 0.08;
        rangedDmg = Math.floor(rangedDmg * masteryMult);

        // DEX-based Critical Hit
        const critChance = calculateDexCritChance(player.getEffectiveStat('dex'));
        const isCrit = naturalRoll === 20 || Math.random() < critChance;
        if (isCrit) {
            rangedDmg = Math.floor(rangedDmg * 1.8);
        }

        // Slay Multiplier
        const slayRes = CombatCalculator.calculateSlayMultiplier(player, monster, weapon, activeTags);
        if (slayRes.multiplier > 1.0) {
            rangedDmg = Math.floor(rangedDmg * slayRes.multiplier);
        }

        return {
            isHit: true,
            valid: true,
            dist,
            damage: rangedDmg,
            isCrit,
            slayName: slayRes.slayName,
            log: `[Archery] 🏹 ${monster.name}(Lv.${monster.level})에게 화살 명중! ${isCrit ? '💥 치명타 ' : ''}${rangedDmg}의 물리 사격 피해를 입혔습니다! (사거리: ${dist}칸)`
        };
    }

    /**
     * 플레이어가 라운드당 시전할 수 있는 타수(Blows) 시퀀스를 산출합니다.
     */
    static calculatePlayerBlows(player, activeTags) {
        const weapon = player.equipment.weapon;
        let category = "UNARMED";
        if (weapon && weapon.slotType === 'WEAPON') {
            category = weapon.weaponCategory || "SWORD";
        }

        // 맨손/의태 본체 공격 시 메인 코어의 Blows 시퀀스 계승
        if (category === "UNARMED" && player.mimicCore) {
            const config = getSpeciesConfig(player.mimicCore.coreType);
            if (config && config.blows && config.blows.length > 0) {
                return config.blows.map(b => ({
                    method: b.method || "HIT",
                    effect: b.effect || "HURT",
                    dice: b.dice || "1d4",
                    isCoreInherited: true
                }));
            }
        }

        // 일반 무기 장착 시 Extra Attacks 기반 다중 타격 생성
        const hitResult = CombatCalculator.calculateNumHits(player, activeTags);
        const blows = [];
        for (let i = 0; i < hitResult.numHits; i++) {
            blows.push({
                method: "SLASH",
                effect: "HURT",
                dice: weapon ? weapon.dice : "1d4",
                isCoreInherited: false
            });
        }
        return blows;
    }

    /**
     * 몬스터의 라운드당 공격 Blows 시퀀스를 산출합니다.
     */
    static calculateMonsterBlows(monster) {
        if (monster.blows && monster.blows.length > 0) {
            return monster.blows;
        }
        return [{ method: "HIT", effect: "HURT", dice: "1d4" }];
    }
}
