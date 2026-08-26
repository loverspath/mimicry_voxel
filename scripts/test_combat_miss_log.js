import assert from 'assert';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';

console.log("================================================================================");
console.log("🎯 [TEST: CombatSystem Player Miss Log Verification] 🎯");
console.log("================================================================================");

const logs = [];
const mockGame = {
    addLogEntry: (msg, type) => {
        logs.push({ msg, type });
    },
    effects: [],
    updateUI: () => {}
};

const player = new Player(10, 10);
const monster = new Monster(10, 11, 'OGRE', 5);

// Force calculateHitChance to return a miss with realistic values
const originalCalculateHitChance = CombatCalculator.calculateHitChance;
CombatCalculator.calculateHitChance = (p, m, activeTags, roll) => {
    return {
        isHit: false,
        hitChance: 0.6543,
        bHit: 55,
        targetAC: 20,
        log: null,
        archetype: null
    };
};

try {
    CombatSystem.attackMonster(mockGame, player, monster);

    console.log("Captured logs:", logs);

    // Verify miss log was generated
    const missLog = logs.find(l => l.msg.includes("공격이 빗나갔습니다"));
    assert(missLog !== undefined, "빗나감 로그가 생성되어야 합니다.");

    // Check for undefined
    assert(!missLog.msg.includes("undefined"), `로그에 undefined가 포함되어서는 안 됩니다. (실제: ${missLog.msg})`);

    // Check ToME 2.3.5 BTH and Hit Chance format
    assert(missLog.msg.includes("명중률: 65.4%"), `명중률 백분율(65.4%)이 포맷팅되어야 합니다. (실제: ${missLog.msg})`);
    assert(missLog.msg.includes("BTH: 55"), `BTH 수치(55)가 포함되어야 합니다. (실제: ${missLog.msg})`);
    assert(missLog.msg.includes("AC: 20"), `AC 수치(20)가 포함되어야 합니다. (실제: ${missLog.msg})`);
    assert(missLog.msg.includes(monster.displayName || monster.name), `몬스터 이름이 포함되어야 합니다. (실제: ${missLog.msg})`);

    console.log("  ✅ PASS: Miss log correctly formatted:", missLog.msg);
    console.log("\n🎉 ALL TESTS PASSED!");
} finally {
    CombatCalculator.calculateHitChance = originalCalculateHitChance;
}
