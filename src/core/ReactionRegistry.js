/**
 * @module ReactionRegistry
 * @description 원소 간의 결합 반응 및 상태이상 디버프 전파 처리를 전담하는 격리형 레지스트리 모듈.
 *              모든 원소 반응 공식, 추가 데미지 다이스 및 상태이상 턴 수 계산 등을 전투 본체와 디커플링합니다.
 */

export const ELEMENTAL_REACTIONS = {
    "FIRE_COLD": {
        name: "용해 (Melt)",
        color: "#f43f5e",
        effect: (game, monster, player) => {
            monster.debuffs.magicVulnerability = Math.max(monster.debuffs.magicVulnerability || 0, 3);
            const extraDmg = Math.floor(Math.random() * 8) + 4; // 1d8 + 4
            game.addLogEntry(`[Reaction] 🔥❄️ 용해(Melt) 반응! 온도 결합 파괴로 물리 경감을 관통하고 추가 원소 피해 +${extraDmg} 부여!`, `combat`);
            return { extraDmg, consume: ["FIRE", "COLD"] };
        }
    },
    "FIRE_ACID": {
        name: "연소 폭발 (Combustion)",
        color: "#fb923c",
        effect: (game, monster, player) => {
            const extraDmg = Math.floor(Math.random() * 6) + 3; // 1d6 + 3
            const targets = game.monsters.filter(m => {
                const dist = Math.sqrt(Math.pow(m.x - monster.x, 2) + Math.pow(m.y - monster.y, 2));
                return dist > 0 && dist <= 1.5;
            });
            targets.forEach(t => {
                t.takeDamage(extraDmg);
                game.addLogEntry(`[Reaction] 💥 연소 폭발 화염 스플래시! ${t.displayName}에게 +${extraDmg} 광역 피해!`, `combat`);
            });
            game.addLogEntry(`[Reaction] 🔥🧪 연소 폭발(Combustion) 반응! 산성 가스가 인화하여 +${extraDmg} 폭발 피해!`, `combat`);
            return { extraDmg, consume: ["FIRE", "ACID"] };
        }
    },
    "FIRE_LIGHTNING": {
        name: "과부하 (Overload)",
        color: "#fbbf24",
        effect: (game, monster, player) => {
            monster.debuffs.paralyzed = true;
            const extraDmg = Math.floor(Math.random() * 8) + 2;
            const dx = Math.sign(monster.x - player.x);
            const dy = Math.sign(monster.y - player.y);
            const nextX = monster.x + dx;
            const nextY = monster.y + dy;
            if (game.map.isWalkable(nextX, nextY) && !game.isMonsterAt(nextX, nextY)) {
                monster.x = nextX;
                monster.y = nextY;
                game.addLogEntry(`[Reaction] ⚡ 과부하 폭발력으로 인해 ${monster.displayName}가 뒤로 1칸 밀려납니다!`, `combat`);
            }
            game.addLogEntry(`[Reaction] 🔥⚡ 과부하(Overload) 반응! 열기와 고전압 충돌로 +${extraDmg} 피해 및 1턴 마비!`, `combat`);
            return { extraDmg, consume: ["FIRE", "LIGHTNING"] };
        }
    },
    "COLD_LIGHTNING": {
        name: "초전도 (Superconduct)",
        color: "#60a5fa",
        effect: (game, monster, player) => {
            monster.isSuperconducted = (monster.isSuperconducted || 0) + 4;
            const extraDmg = Math.floor(Math.random() * 6) + 2;
            game.addLogEntry(`[Reaction] ❄️⚡ 초전도(Superconduct) 반응! 모든 속성 저항 및 물리 경감이 4턴간 상실되며 +${extraDmg} 마법 피해!`, `combat`);
            return { extraDmg, consume: ["COLD", "LIGHTNING"] };
        }
    },
    "COLD_ACID": {
        name: "결빙 독소 (Frostbite)",
        color: "#34d399",
        effect: (game, monster, player) => {
            monster.debuffs.frost = Math.max(monster.debuffs.frost || 0, 4);
            monster.debuffs.poison = Math.max(monster.debuffs.poison || 0, 4);
            const extraDmg = Math.floor(Math.random() * 6) + 4;
            game.addLogEntry(`[Reaction] ❄️🧪 결빙 독소(Frostbite) 반응! 얼어붙은 독가시가 몸을 파고들어 +${extraDmg} 피해 및 빙결/중독 동시 극대화!`, `combat`);
            return { extraDmg, consume: ["COLD", "ACID"] };
        }
    },
    "ACID_LIGHTNING": {
        name: "전해 반응 (Electrolysis)",
        color: "#10b981",
        effect: (game, monster, player) => {
            monster.debuffs.paralyzed = true;
            monster.debuffs.poison = Math.max(monster.debuffs.poison || 0, 3);
            const extraDmg = Math.floor(Math.random() * 6) + 3;
            game.addLogEntry(`[Reaction] 🧪⚡ 전해(Electrolysis) 반응! 전도성 산성액이 전류를 증폭해 +${extraDmg} 피해 및 감전/마비!`, `combat`);
            return { extraDmg, consume: ["ACID", "LIGHTNING"] };
        }
    },
    "FIRE_MANA": {
        name: "마력 공명 (Resonance)",
        color: "#c084fc",
        effect: (game, monster, player) => {
            const extraDmg = Math.floor(Math.random() * 10) + 5;
            monster.debuffs.magicVulnerability = Math.max(monster.debuffs.magicVulnerability || 0, 4);
            game.addLogEntry(`[Reaction] 🔥🔮 마력 공명(Resonance) 반응! 순수 화염 마나가 폭발하며 +${extraDmg} 증폭 피해 및 마법 파쇄!`, `combat`);
            return { extraDmg, consume: ["FIRE", "MANA"] };
        }
    },
    "COLD_MANA": {
        name: "마력 공명 (Resonance)",
        color: "#c084fc",
        effect: (game, monster, player) => {
            const extraDmg = Math.floor(Math.random() * 10) + 5;
            monster.debuffs.magicVulnerability = Math.max(monster.debuffs.magicVulnerability || 0, 4);
            game.addLogEntry(`[Reaction] ❄️🔮 마력 공명(Resonance) 반응! 순수 냉기 마나가 폭발하며 +${extraDmg} 증폭 피해 및 마법 파쇄!`, `combat`);
            return { extraDmg, consume: ["COLD", "MANA"] };
        }
    },
    "LIGHTNING_MANA": {
        name: "마력 공명 (Resonance)",
        color: "#c084fc",
        effect: (game, monster, player) => {
            const extraDmg = Math.floor(Math.random() * 10) + 5;
            monster.debuffs.magicVulnerability = Math.max(monster.debuffs.magicVulnerability || 0, 4);
            game.addLogEntry(`[Reaction] ⚡🔮 마력 공명(Resonance) 반응! 순수 전기 마나가 폭발하며 +${extraDmg} 증폭 피해 및 마법 파쇄!`, `combat`);
            return { extraDmg, consume: ["LIGHTNING", "MANA"] };
        }
    },
    "ACID_MANA": {
        name: "마력 공명 (Resonance)",
        color: "#c084fc",
        effect: (game, monster, player) => {
            const extraDmg = Math.floor(Math.random() * 10) + 5;
            monster.debuffs.magicVulnerability = Math.max(monster.debuffs.magicVulnerability || 0, 4);
            game.addLogEntry(`[Reaction] 🧪🔮 마력 공명(Resonance) 반응! 순수 산성 마나가 폭발하며 +${extraDmg} 증폭 피해 및 마법 파쇄!`, `combat`);
            return { extraDmg, consume: ["ACID", "MANA"] };
        }
    }
};

/**
 * 몬스터에게 원소 관련 기본 디버프를 안전하게 부여합니다.
 * @param {Object} game - Game 인스턴스
 * @param {Object} monster - 대상 Monster 인스턴스
 * @param {string} element - 적용할 원소 (COLD, ACID, LIGHTNING, MANA)
 * @param {boolean} isAdult - 성체 판정 여부 (성체의 경우 지속 턴 및 감전 확률이 대폭 증가)
 */
export function applyMonsterDebuff(game, monster, element, isAdult) {
    if (!monster.debuffs) {
        monster.debuffs = { poison: 0, frost: 0, paralyzed: false, magicVulnerability: 0 };
    }
    if (element === "COLD") {
        monster.debuffs.frost = isAdult ? 5 : 3;
        game.addLogEntry(`[Debuff] ❄️ ${monster.displayName}가 냉기 브레스로 ${monster.debuffs.frost}턴간 속도 30% 감소합니다!`, `combat`);
    } else if (element === "ACID") {
        monster.debuffs.poison = isAdult ? 7 : 5;
        game.addLogEntry(`[Debuff] 🧪 ${monster.displayName}가 산성 브레스로 ${monster.debuffs.poison}턴간 중독 피해를 입습니다!`, `combat`);
    } else if (element === "LIGHTNING" && Math.random() < (isAdult ? 0.5 : 0.2)) {
        monster.debuffs.paralyzed = true;
        game.addLogEntry(`[Debuff] ⚡ ${monster.displayName}가 뇌격 브레스로 다음 턴 마비되었습니다!`, `combat`);
    } else if (element === "MANA") {
        monster.debuffs.magicVulnerability = isAdult ? 5 : 3;
        game.addLogEntry(`[Debuff] 🔮 ${monster.displayName}가 마나 브레스로 ${monster.debuffs.magicVulnerability}턴간 마법 취약 상태가 되었습니다!`, `combat`);
    }
}
