/**
 * @module CombatSystem
 * @category core
 * @description 전투 판정 및 격발 오케스트레이션을 일괄 처리하는 중앙 조율 시스템 모듈.
 *              세부적인 수학 연산, 원소 결합 레지스트리, 전리품 루팅 및 50F 보스 페이즈 전환 제어를 슬림하게 조율합니다.
 * @purity Stateless System / Orchestrator
 * @dependencies ReactionRegistry.js, LootSystem.js, CombatCalculator.js, Tags.js, Effects.js, MonsterRegistry.js, Skills.js, Perks.js, BossPhaseEngine.js, CombatVFXEngine.js
 * @exports CombatSystem
 */

import { MeleeSlashEffect, ProjectileEffect, ConeBreathEffect, FloatingTextEffect, AoEExplosionEffect, SkillBeamEffect, SkillVisualEffectFactory } from './Effects.js';
import { MONSTER_SKILLS, CORE_SKILL_TREES, ACTIVE_SKILL_CONFIGS } from './Skills.js';
import { WEAPON_MASTERY_CONFIG } from '../entities/MimicBody.js';
import { ELEMENT_METADATA } from '../entities/Tags.js';
import { MAGIC_RESOURCE_CONFIG, ARCHERY_CONFIG } from '../configs/GameBalanceConfig.js';

// 신설 3분할 전담 모듈 import 연동
import { LootSystem } from './LootSystem.js';
import { CombatCalculator, COMBAT_CONFIG } from './CombatCalculator.js';
import { bossPhaseEngine } from '../systems/BossPhaseEngine.js';
import { TomeSpellEngine } from '../systems/TomeSpellEngine.js';
import { combatVFXEngine, VFX_TYPES } from '../systems/CombatVFXEngine.js';

export class CombatSystem {
    /**
     * [하위 호환 래퍼] 주사위 수식(예: '2d6', '1d3') 파싱 및 랜덤 값 롤링을 계산 모듈로 위임합니다.
     */
    static rollDice(formula) {
        return CombatCalculator.rollDice(formula);
    }

    /**
     * [하위 호환 래퍼] 플레이어 속성 저항 여부를 계산 모듈로 위임합니다.
     */
    static getPlayerResistance(player, element) {
        return CombatCalculator.getPlayerResistance(player, element);
    }

    /**
     * [하위 호환 래퍼] 플레이어 근접 평타의 원소 속성 해소를 계산 모듈로 위임합니다.
     */
    static resolvePlayerAttackElement(player) {
        return CombatCalculator.resolvePlayerAttackElement(player);
    }

    /**
     * [하위 호환 래퍼] 플레이어 브레스 스킬의 최종 원소 속성 해소를 계산 모듈로 위임합니다.
     */
    static resolvePlayerBreathElement(player) {
        return CombatCalculator.resolvePlayerBreathElement(player);
    }

    /**
     * [하위 호환 래퍼] 플레이어 장비의 특정 특수 태그 보유 여부 판별을 계산 모듈로 위임합니다.
     */
    static hasEquipmentTag(player, tagName) {
        return CombatCalculator.hasEquipmentTag(player, tagName);
    }

    /**
     * [하위 호환 래퍼] 레벨 차이에 따라 보정된 처치 보상 XP 가산 수치 도출을 전리품 시스템으로 위임합니다.
     */
    static getScaledXpValue(player, monster) {
        return LootSystem.getScaledXpValue(player, monster);
    }

    /**
     * 플레이어의 몬스터 근접 및 원거리 평타 격발 라이프사이클을 오케스트레이션합니다.
     * @param {Object} game - Game 핵심 인스턴스
     * @param {Object} player - Player 인스턴스
     * @param {Object} monster - 대상 Monster 인스턴스
     */
    static attackMonster(game, player, monster) {
        const activeTags = player.compileActiveTags();
        let weapon = player.equipment.weapon;

        // 원거리 무기(bow 슬롯 또는 무기 슬롯) 장착 및 사거리 내 원거리 사격 분기
        const dx = monster.x - player.x;
        const dy = monster.y - player.y;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const bow = player.equipment.bow || (weapon && (weapon.slotType === 'BOW' || weapon.char === '}' || weapon.weaponCategory === 'ARCHERY' || weapon.weaponCategory === 'RANGED') ? weapon : null);
        const isRangedWeapon = bow !== null;

        if (isRangedWeapon && dist >= 2) {
            if (player.autoFireEnabled) {
                if (player.rangedCooldownTracker > 0) {
                    if (game && game.addLogEntry) {
                        game.addLogEntry(`[Archery] 🏹 원거리 무기 재장전/조준 중입니다. (${player.rangedCooldownTracker}턴 대기 필요)`, `system`);
                    }
                    return;
                }

                if (ARCHERY_CONFIG && ARCHERY_CONFIG.mode === 'BURST_RATE') {
                    const numShots = player.getRangedShotsPerRound ? player.getRangedShotsPerRound(bow) : 1;
                    for (let s = 0; s < numShots && !(monster.stats.hp <= 0); s++) {
                        CombatSystem.fireRangedAttack(game, player, monster);
                    }
                } else {
                    CombatSystem.fireRangedAttack(game, player, monster);
                    const cd = player.getRangedCooldown ? player.getRangedCooldown(bow) : 2;
                    player.rangedCooldownTracker = cd;
                }
            } else {
                if (game && game.addLogEntry) {
                    game.addLogEntry(`[Archery] ⏸️ 원거리 자동사격이 [OFF] 상태입니다. (단축키 'T'로 활성화 가능)`, `system`);
                }
            }
            return;
        }

        // Determine weapon category
        let category = "UNARMED";
        if (weapon && weapon.slotType === 'WEAPON') {
            category = weapon.weaponCategory || "SWORD";
        }

        // 1. Calculate Blows Sequence (Inherits core blows when unarmed, or mastery extra attacks when armed)
        const blows = CombatCalculator.calculatePlayerBlows(player, activeTags);

        for (let h = 0; h < blows.length && !(monster.stats.hp <= 0); h++) {
            const currentBlow = blows[h];
            let naturalRoll = Math.floor(Math.random() * 20) + 1;
            
            // 2. Perform Hit Test (dex, masteries, upgrades, accuracy boost, Fear Aura debuff)
            const hitResult = CombatCalculator.calculateHitChance(player, monster, activeTags, naturalRoll);
            if (hitResult.log && h === 0) {
                game.addLogEntry(hitResult.log, `combat`);
            }

            if (hitResult.isHit) {
                // Gain Weapon Mastery Hit Count on Successful hit
                if (player.body && player.body.gainWeaponMasteryXp) {
                    const masteryLogs = player.body.gainWeaponMasteryXp(category, 1, game);
                    masteryLogs.forEach(l => game.addLogEntry(l, `loot`));
                }

                // Gain Morph Lore Mastery XP on Successful hit when in monster form
                const currentMorphKey = player.mimicCore?.coreType || player.mimicCore?.name;
                if (currentMorphKey && player.body && player.body.gainLoreXp) {
                    player.body.gainLoreXp(currentMorphKey, 1);
                }

                // 3. Calculate Base Physical Damage (upgrade, conMod pen, critical, berserk, slay)
                const physResult = CombatCalculator.calculatePhysicalDamage(player, monster, activeTags, naturalRoll);
                if (physResult.critLog && h === 0) {
                    game.addLogEntry(physResult.critLog, `loot`);
                }
                if (physResult.berserkLog && h === 0) {
                    game.addLogEntry(physResult.berserkLog, `loot`);
                }
                let physDmg = physResult.dmg;

                // 4. Calculate Melee Elemental Damage (FIRE, COLD, etc.)
                const elemResult = CombatCalculator.calculateElementalMeleeDamage(player, monster, activeTags);
                let appliedElemDmgs = elemResult.appliedElemDmgs;
                let extraElemDmgTotal = elemResult.totalElemDmg;

                // 5. Unified Core/Reaction Synergies (Apocalypse, Fire Infusion, Element Reactions)
                const synergyResult = CombatCalculator.processCombatSynergies(game, player, monster, activeTags);
                physDmg += synergyResult.physicalAdd;
                extraElemDmgTotal += synergyResult.elementalAdd;
                for (const elemKey in synergyResult.appliedElemDmgs) {
                    appliedElemDmgs[elemKey] = (appliedElemDmgs[elemKey] || 0) + synergyResult.appliedElemDmgs[elemKey];
                }

                // 6. Generic Synergies & Monster Quirks (Ambush, Strong Attack, flat reductions, Ogre regen, Slime reflection, Curse boost)
                const genericResult = CombatCalculator.processGenericAttackSynergies(player, monster, activeTags, physDmg, game);
                physDmg = genericResult.physDmg;

                const totalDmg = physDmg + extraElemDmgTotal;
                let attackEl = CombatSystem.resolvePlayerAttackElement(player);
                game.effects.push(new MeleeSlashEffect(monster.x, monster.y, attackEl));
                game.effects.push(new FloatingTextEffect(monster.x, monster.y, `-${totalDmg}`, genericResult.isStrong ? "#ffd700" : "#f43f5e", genericResult.isStrong, h * 0.08));

                let methodKey = currentBlow.method || 'SLASH';
                if (methodKey === 'HIT') methodKey = 'SLASH';
                else if (methodKey === 'CLAW') methodKey = 'CLAW';
                else if (methodKey === 'BITE') methodKey = 'BITE';
                else if (methodKey === 'STING' || methodKey === 'PIERCE') methodKey = 'PIERCE';
                else if (methodKey === 'CRUSH' || methodKey === 'BASH') methodKey = 'CRUSH';

                const vfxType = attackEl ? `${attackEl}_BURST` : methodKey;
                combatVFXEngine.triggerAttackFX(vfxType, player, monster, genericResult.isStrong, game?.renderer, h, blows.length, totalDmg, methodKey);
                let d = monster.takeDamage(totalDmg);

                // Print Unified Combat Log with Blow method name
                const blowLabel = currentBlow.isCoreInherited ? `의태 연타 [${currentBlow.method}]` : null;
                CombatSystem.printMeleeDamageLog(game, monster, physDmg, appliedElemDmgs, totalDmg, genericResult.isStrong, blowLabel);

                // Lifesteal
                const lifestealResult = CombatCalculator.applyLifesteal(player, totalDmg);
                if (lifestealResult.healAmt > 0) {
                    game.addLogEntry(lifestealResult.log, `loot`);
                    game.updateUI();
                }
                
                // Death Process
                if (d) {
                    LootSystem.processMonsterDeath(game, player, monster, "물리 공격");
                } else if (bossPhaseEngine.isMorgoth(monster)) {
                    bossPhaseEngine.checkPhaseTransition(monster, game);
                }
            } else {
                game.addLogEntry(`[Combat] ${monster.displayName || monster.name}에 대한 공격이 빗나갔습니다. (명중률: ${(hitResult.hitChance * 100).toFixed(1)}% | BTH: ${hitResult.bHit} vs AC: ${hitResult.targetAC})`, `system`);
            }
        }
        player.energy -= 20;
    }

    /**
     * 원거리 사격(Archery)을 직접 실행합니다.
     */
    static fireRangedAttack(game, player, monster) {
        const activeTags = player.compileActiveTags();
        const bow = player.equipment.bow || player.equipment.weapon;
        let arrows = player.equipment.quiver;
        if (!arrows || (arrows.count || 0) <= 0) {
            arrows = player.inventory.find(i => (i.char === '{' || i.slotType === 'QUIVER' || i.name.includes('Arrow') || i.name.includes('화살')) && (i.count || 0) > 0);
        }

        if (!arrows || (arrows.count || 0) <= 0) {
            game.addLogEntry(`[Archery] 🏹 발사할 화살(Arrow)이 부족합니다! 인벤토리에 화살을 구비하세요.`, `system`);
            return;
        }

        // Deduct 1 arrow
        arrows.count = (arrows.count || 1) - 1;
        if (arrows.count <= 0) {
            if (player.equipment.quiver === arrows) {
                player.equipment.quiver = null;
            }
            player.removeItem(arrows);
        }

        const res = CombatCalculator.calculateRangedAttack(player, monster, bow, arrows, activeTags, game.map);
        if (!res.valid) {
            if (res.reason === "NO_LOS") {
                game.addLogEntry(`[Archery] 🚫 벽이나 장애물에 가려 대상 몬스터를 조준할 수 없습니다!`, `system`);
            } else if (res.reason === "OUT_OF_RANGE") {
                game.addLogEntry(`[Archery] 🏹 사거리 초과! (대상 거리: ${res.dist}칸 / 최대 사거리: ${res.maxRange}칸)`, `system`);
            }
            return;
        }

        // Projectile visual effect
        game.effects.push(new ProjectileEffect(player.x, player.y, monster.x, monster.y, "PHYSICAL"));

        if (res.isHit) {
            if (player.body && player.body.gainWeaponMasteryXp) {
                const masteryLogs = player.body.gainWeaponMasteryXp("ARCHERY", 1, game);
                masteryLogs.forEach(l => game.addLogEntry(l, `loot`));
            }

            // Gain Morph Lore Mastery XP on Successful ranged hit when in monster form
            const currentMorphKey = player.mimicCore?.coreType || player.mimicCore?.name;
            if (currentMorphKey && player.body && player.body.gainLoreXp) {
                player.body.gainLoreXp(currentMorphKey, 1);
            }

            game.effects.push(new FloatingTextEffect(monster.x, monster.y, `-${res.damage}`, res.isCrit ? "#ffd700" : "#38bdf8", res.isCrit));
            if (combatVFXEngine) {
                combatVFXEngine.triggerSpellAction('ARROW', player, monster, 'PHYSICAL', res.damage);
            }
            const isDead = monster.takeDamage(res.damage);
            const weaponName = bow ? bow.name : '단궁';
            const critLabel = res.isCrit ? ' 💥 치명타!' : '';
            game.addLogEntry(`🏹 [원거리 저격] 플레이어가 ${weaponName}(으)로 [${monster.name}]에게 화살을 발사! (${res.damage} 피해)${critLabel}`, `combat`);

            if (isDead) {
                LootSystem.processMonsterDeath(game, player, monster, "원거리 사격");
            } else if (bossPhaseEngine.isMorgoth(monster)) {
                bossPhaseEngine.checkPhaseTransition(monster, game);
            }
        } else {
            game.addLogEntry(res.log || `[Archery] 🏹 ${monster.name}에 대한 화살 사격이 빗나갔습니다!`, `system`);
        }

        player.energy -= 20;
    }

    /**
     * 플레이어의 현재 의태 스킬들을 사거리, 쿨다운 및 대상 상태에 맞춰 매 턴 자동으로 검사 및 격발합니다.
     * @param {Object} game - Game 인스턴스
     * @param {Object} player - Player 인스턴스
     * @returns {boolean} 스킬 격발 성공 여부
     */
    static checkAndCastAutoSkills(game, player) {
        if (!game || !player || !player.activeSkills || player.activeSkills.length === 0) return false;
        if (player.stats.hp <= 0) return false;

        const masteryLvl = player.getMorphMasteryLevel ? player.getMorphMasteryLevel() : 1;

        // 쿨다운이 0이고 해금된 스킬 필터링
        const availableSkills = player.activeSkills.filter(skill => {
            if (!skill) return false;
            if (!skill.isUnlocked(masteryLvl)) return false;
            const cd = player.getTracker ? player.getTracker(skill.id, 'cooldown') : 0;
            return cd <= 0;
        });

        if (availableSkills.length === 0) return false;

        // 1. 자가 치유/버프 스킬 우선 검사 (HP 70% 이하 시)
        const healSkill = availableSkills.find(s => s.type === 'SELF' || s.id.includes('HEAL') || s.id.includes('HASTE'));
        if (healSkill && player.stats.hp <= player.stats.maxHp * 0.70) {
            const castSuccess = healSkill.execute(game, player, null);
            if (castSuccess) return true;
        }

        // 2. 공격/투사체/브레스/AoE 스킬 검사
        const dungeonMonsters = (game.dungeon?.monsters || game.monsters || []).filter(m => {
            if (!m || !m.stats || m.stats.hp <= 0) return false;
            return true;
        });

        if (dungeonMonsters.length === 0) return false;

        const offensiveSkills = availableSkills.filter(s => s.type !== 'SELF' && !s.id.includes('HEAL'));

        for (const skill of offensiveSkills) {
            const maxRange = skill.maxRange || 5.5;
            
            const inRangeMonsters = dungeonMonsters.filter(m => {
                const dx = m.x - player.x;
                const dy = m.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxRange) return false;
                if (skill.type === 'MELEE_STRIKE' && dist > 1.5) return false;
                if (game.map && !game.map.isTransparent(player.x, player.y, m.x, m.y)) return false;
                return true;
            });

            if (inRangeMonsters.length > 0) {
                inRangeMonsters.sort((a, b) => {
                    const distA = Math.hypot(a.x - player.x, a.y - player.y);
                    const distB = Math.hypot(b.x - player.x, b.y - player.y);
                    return distA - distB;
                });

                const target = inRangeMonsters[0];
                const castSuccess = skill.execute(game, player, target);
                if (castSuccess) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 플레이어 턴(이동/대기) 종료 시, 시야 내에 유효한 적이 있고 자동사격이 켜져 있을 때 자동 원거리 사격을 격발합니다.
     * @param {Object} game - Game 인스턴스
     * @param {Object} player - Player 인스턴스
     * @returns {boolean} 사격 성공 여부
     */
    static tryAutoRangedAttack(game, player) {
        if (!game || !player || !player.autoFireEnabled) return false;

        const bow = player.equipment.bow || (player.equipment.weapon && (player.equipment.weapon.slotType === 'BOW' || player.equipment.weapon.char === '}' || player.equipment.weapon.weaponCategory === 'ARCHERY' || player.equipment.weapon.weaponCategory === 'RANGED') ? player.equipment.weapon : null);
        if (!bow) return false;

        if (ARCHERY_CONFIG && ARCHERY_CONFIG.mode === 'INTERVAL_COOLDOWN' && player.rangedCooldownTracker > 0) {
            return false;
        }

        const maxRange = bow.range || 5;
        const validMonsters = (game.dungeon?.monsters || game.monsters || []).filter(m => {
            if (!m || !m.stats || m.stats.hp <= 0) return false;
            const dx = m.x - player.x;
            const dy = m.y - player.y;
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            if (dist < 2 || dist > maxRange) return false;
            if (!game.map) return false;
            return game.map.isTransparent(player.x, player.y, m.x, m.y);
        });

        if (validMonsters.length === 0) return false;

        // 가장 가까운 몬스터 자동 타겟팅
        validMonsters.sort((a, b) => {
            const distA = Math.max(Math.abs(a.x - player.x), Math.abs(a.y - player.y));
            const distB = Math.max(Math.abs(b.x - player.x), Math.abs(b.y - player.y));
            return distA - distB;
        });

        const target = validMonsters[0];
        CombatSystem.attackMonster(game, player, target);
        return true;
    }

    /**
     * 평타 근접 대미지 로그 출력을 표준화합니다.
     */
    static printMeleeDamageLog(game, monster, physDmg, appliedElemDmgs, totalDmg, isStrong, blowLabel = null) {
        let prefix = blowLabel ? `[Combat] 🐾 ${blowLabel} - ` : `[Combat] `;
        let dmgLog = `${prefix}${monster.name}(Lv.${monster.level})에게 물리 피해 ${physDmg}`;
        
        const elemNames = { FIRE: "화염", COLD: "냉기", LIGHTNING: "전기", ACID: "산성", MANA: "마나" };
        const elemColors = { FIRE: "#f43f5e", COLD: "#60a5fa", LIGHTNING: "#fbbf24", ACID: "#34d399", MANA: "#c084fc" };
        
        let elemLogParts = [];
        for (const element in appliedElemDmgs) {
            const dmg = appliedElemDmgs[element];
            const color = elemColors[element];
            const name = elemNames[element];
            elemLogParts.push(`<span style="color: ${color}; font-weight: bold;">${name} +${dmg}</span>`);
        }
        
        if (elemLogParts.length > 0) {
            dmgLog += ` 및 ${elemLogParts.join(", ")}`;
        }
        
        if (isStrong) {
            dmgLog += `의 치명타를 입혔습니다! (HP: ${monster.stats.hp}/${monster.stats.maxHp})`;
        } else {
            dmgLog += `를 입혔습니다! (HP: ${monster.stats.hp}/${monster.stats.maxHp})`;
        }
        game.addLogEntry(dmgLog, `combat`);
    }

    /**
     * 몬스터의 플레이어 역습 평타 라이프사이클을 조율합니다 (다중 타수 Blows & 20 Methods x 27 Effects On-Hit 지원).
     */
    static attackPlayer(game, monster, player) {
        const attacks = TomeSpellEngine.resolveMonsterAttacks(monster);
        const activeAttacks = (attacks && attacks.length > 0) ? attacks : (monster.blows || [{ method: 'HIT', effect: 'HURT', damage: '1d4' }]);

        for (let _a = 0; _a < activeAttacks.length; _a++) {
            if (player.stats.hp <= 0) break;
            const currentAtk = activeAttacks[_a];
            
            let n = Math.floor(Math.random() * 20) + 1 + (monster.dexMod || 0) + (monster.level || 1) * 2;
            const playerAC = player.getTotalAC ? player.getTotalAC() : (COMBAT_CONFIG.PLAYER_DEFENSE.baseAC + (player.dexMod || 0));
            const isHit = (n >= playerAC) || (n >= 20);
            
            if (isHit) {
                const atkResult = TomeSpellEngine.executeAttack({
                    attack: currentAtk,
                    attacker: monster,
                    defender: player,
                    game
                });

                const finalDmg = atkResult.finalDamage;
                let attackEl = (currentAtk.effect === 'FIRE' || currentAtk.effect === 'ACID' || currentAtk.effect === 'ELEC' || currentAtk.effect === 'COLD') ? currentAtk.effect : 'PHYSICAL';
                if (game && game.effects) {
                    game.effects.push(new MeleeSlashEffect(player.x, player.y, attackEl));
                    game.effects.push(new FloatingTextEffect(player.x, player.y, `-${finalDmg}`, "#ef4444", false, _a * 0.08));
                }

                let methodKey = currentAtk.method || 'BASH';
                if (methodKey === 'HIT') methodKey = 'BASH';
                else if (methodKey === 'CLAW') methodKey = 'CLAW';
                else if (methodKey === 'BITE') methodKey = 'BITE';
                else if (methodKey === 'STING' || methodKey === 'PIERCE') methodKey = 'PIERCE';
                else if (methodKey === 'CRUSH' || methodKey === 'BASH') methodKey = 'CRUSH';

                const vfxType = (attackEl !== 'PHYSICAL') ? `${attackEl}_BURST` : methodKey;
                combatVFXEngine.triggerAttackFX(vfxType, monster, player, false, game?.renderer, _a, activeAttacks.length, finalDmg, methodKey);

                if (player.stats.hp <= 0) {
                    player.lastDamageSource = monster.displayName || monster.name;
                    if (typeof game.handlePlayerDeath === 'function') {
                        game.handlePlayerDeath();
                    }
                    return;
                }
            } else {
                if (game && game.addLogEntry) {
                    game.addLogEntry(`[Combat] ${monster.displayName || monster.name}의 ${currentAtk.method || '근접'} 공격을 가볍게 회피했습니다.`, `system`);
                }
            }
        }
    }

    /**
     * 몬스터의 특수 광폭 속성 브레스를 조율합니다.
     */
    static useMonsterBreath(game, monster, dx, dy, dist) {
        if (!monster.specialAction) return false;
        const config = monster.specialAction;

        const maxRange = config.maxRange || 4.5;
        if (dist > maxRange) return false;

        const hasLine = game.map.isTransparent(monster.x, monster.y, game.player.x, game.player.y);
        if (!hasLine) return false;

        const element = monster.breathElement || 'FIRE';
        const elemName = (ELEMENT_METADATA[element] || ELEMENT_METADATA.FIRE).name;

        let baseDamage = config.rollBaseDamage();
        let totalDmg = baseDamage + config.getScaling(monster);

        // 피의 갈망 버프
        if (monster.bloodLustTurns && monster.bloodLustTurns > 0) {
            totalDmg = Math.floor(totalDmg * 1.30);
        }

        // 1. Filter damage through player defense filters (protect prayer, resistances, mana shield)
        const defenseResult = CombatCalculator.filterPlayerIncomingDamage(
            game.player, 
            totalDmg, 
            0, // elemDmg (already integrated)
            element === "FIRE", // isFurious equivalent for resistance check
            element === "ACID"  // isChieftain equivalent for resistance check
        );



        const finalDmg = defenseResult.finalDmg;
        const isDead = game.player.takeDamage(finalDmg, game);

        const breathName = config.namePattern.replace('{elementName}', elemName);
        const breathConfig = Object.assign({}, config, { element, type: "BREATH", maxRange: 5.5, coneAngle: 0.95 });
        const breathEffect = SkillVisualEffectFactory.createSkillEffect(breathConfig, monster, game.player);
        if (breathEffect) game.effects.push(breathEffect);
        game.effects.push(new FloatingTextEffect(game.player.x, game.player.y, `-${finalDmg}`, "#ef4444", true));
        combatVFXEngine.triggerAttackFX(element ? `${element}_BURST` : VFX_TYPES.FIRE_BURST, monster, game.player, false, game?.renderer);

        const hasResist = CombatCalculator.getPlayerResistance(game.player, element);
        let resistMsg = hasResist ? ` <span style="color: #cbd5e1; font-weight: normal;">[${elemName} 저항 반감 50%]</span>` : "";
        game.addLogEntry(`[MonsterSkill] 🔥 ${monster.displayName}가 나를 향해 <span style="color: red; font-weight: bold;">${breathName}</span>을 분사했습니다! (피해: ${finalDmg})${resistMsg}`, `loot`);
        game.addLogEntry(`[Combat] ${monster.displayName}의 브레스 적중! 나에게 ${finalDmg}의 피해! (HP: ${game.player.stats.hp}/${game.player.stats.maxHp})`, `combat`);

        monster.breathCooldown = config.cooldown || 4;

        if (!isDead) {
            if (config.applyDebuffs) {
                config.applyDebuffs(game, monster, element, finalDmg);
            }
        } else {
            game.player.lastDamageSource = monster.displayName;
            if (typeof game.handlePlayerDeath === 'function') {
                game.handlePlayerDeath();
            }
        }

        return true;
    }

    /**
     * 플레이어의 메인 코어 및 보조 코어의 ACTIVE 스킬을 턴 종료 시 격발합니다.
     * CORE_SKILL_TREES의 스킬 정의(pt/type)와 ACTIVE_SKILL_CONFIGS의 실행 설정(trackerKey/rollDamage/etc)을 연동합니다.
     */
    static triggerActiveSkills(game) {
        if (!game || !game.player || game.player.stats.hp <= 0) return;

        // 원거리 무기 쿨다운 감소
        if (game.player.rangedCooldownTracker > 0) {
            game.player.rangedCooldownTracker--;
        }

        // 모든 장착 스킬 쿨다운 매 턴 감소 (QUICKCAST 스택 반영)
        const innateSkills = game.player.getInnateSkills ? game.player.getInnateSkills() : [];
        for (const skill of innateSkills) {
            game.player.decrementCooldown(skill.id);
        }

        // 실시간 의태 액티브 스킬 자동 격발 (Auto-Cast) 실행
        if (game.player.tryAutoCastInnateSkills) {
            game.player.tryAutoCastInnateSkills(game);
        }
    }
}
