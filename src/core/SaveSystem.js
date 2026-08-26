/**
 * @module SaveSystem
 * @category core
 * @description 로컬스토리지 기반 다중 슬롯 게임 상태(맵, 플레이어, 인벤토리, 몬스터, 유니크 몬스터 생태계) 직렬화 및 역직렬화 세이브/로드 엔진
 * @purity State Store
 * @dependencies Map.js, Player.js, Item.js, Monster.js, MonsterRegistry.js, UniqueMonsterManager.js
 * @exports SAVE_SLOTS, SaveSystem
 */

import { Map } from '../map/Map.js';
import { Player } from '../entities/Player.js';
import { Item } from '../entities/Item.js';
import { Monster } from '../entities/Monster.js';
import { getSpeciesConfig, LEGACY_TOME_ALIASES_MAP } from '../entities/MonsterRegistry.js';
import { uniqueMonsterManager } from '../systems/UniqueMonsterManager.js';
import { MonsterSpellFactory } from '../systems/MonsterSpellFactory.js';

/** 중앙화된 세이브 슬롯 목록 — 슬롯 수가 바뀌면 여기만 수정 */
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8'];

export class SaveSystem {
    static serialize(game) {
        const serializeItem = (item) => {
            if (!item) return null;
            return {
                x: item.x,
                y: item.y,
                type: item.type,
                char: item.char,
                color: item._baseColor || item.color,
                name: item._baseName || item.name,
                lightBonus: item.lightBonus,
                slotType: item.slotType,
                statBonuses: item.statBonuses,
                dice: item.dice,
                coreType: item.coreType,
                prefixes: item.prefixes,
                suffixes: item.suffixes,
                fusionLevel: item.fusionLevel,
                upgradeLevel: item.upgradeLevel || 0,
                count: item.count || 1,
                specialTags: item.specialTags || [],
                weight: item.weight !== undefined ? item.weight : 0,
                potionEffect: item.potionEffect || null,
                scrollEffect: item.scrollEffect || null,
                baseAC: item.baseAC !== undefined ? item.baseAC : 0,
                toHit: item.toHit !== undefined ? item.toHit : 0,
                toDamage: item.toDamage !== undefined ? item.toDamage : 0,
                toDmg: item.toDmg !== undefined ? item.toDmg : 0,
                range: item.range !== undefined ? item.range : 0,
                multiplier: item.multiplier !== undefined ? item.multiplier : 0,
                weaponCategory: item.weaponCategory || null,
                flavorText: item.flavorText || '',
                tval: item.tval,
                sval: item.sval,
                charges: item.charges,
                timeout: item.timeout || 0
            };
        };

        const serializeMonster = (m) => {
            return {
                x: m.x,
                y: m.y,
                type: m.type,
                level: m.level,
                prefixes: m.prefixes,
                suffixes: m.suffixes,
                hp: m.stats.hp,
                energy: m.energy,
                batFleeTurns: m.batFleeTurns,
                breathCooldown: m.breathCooldown,
                giantBloodCooldown: m.giantBloodCooldown || 0,
                debuffs: m.debuffs,
                statuses: m.statuses || {}
            };
        };

        const playerInv = game.player.inventory;
        const equipmentIndexes = {
            weapon: playerInv.indexOf(game.player.equipment.weapon),
            shield: playerInv.indexOf(game.player.equipment.shield),
            bow: playerInv.indexOf(game.player.equipment.bow),
            quiver: playerInv.indexOf(game.player.equipment.quiver),
            armor: playerInv.indexOf(game.player.equipment.armor),
            helmet: playerInv.indexOf(game.player.equipment.helmet),
            gloves: playerInv.indexOf(game.player.equipment.gloves),
            boots: playerInv.indexOf(game.player.equipment.boots),
            cloak: playerInv.indexOf(game.player.equipment.cloak),
            subCore1: playerInv.indexOf(game.player.equipment.subCore1),
            subCore2: playerInv.indexOf(game.player.equipment.subCore2),
            ring1: playerInv.indexOf(game.player.equipment.ring1),
            ring2: playerInv.indexOf(game.player.equipment.ring2),
            amulet: playerInv.indexOf(game.player.equipment.amulet),
            equippedLamp: playerInv.indexOf(game.player.equippedLamp)
        };

        return JSON.stringify({
            floor: game.floor,
            floorDanger: game.floorDanger,
            uniqueMonsters: (game.uniqueMonsterManager || uniqueMonsterManager).serialize(),
            player: {
                x: game.player.x,
                y: game.player.y,
                level: game.player.level,
                xp: game.player.xp,
                xpNeeded: game.player.xpNeeded,
                baseStats: game.player.baseStats,
                legacyStats: game.player.legacyStats,
                attackCount: game.player.attackCount,
                debuffs: game.player.debuffs,
                statuses: game.player.statuses || {},
                autoFireEnabled: game.player.autoFireEnabled !== undefined ? game.player.autoFireEnabled : true,
                stats: { hp: game.player.stats.hp, maxHp: game.player.stats.maxHp },
                mimicCore: game.player.mimicCore,
                animationTime: game.player.animationTime,
                energy: game.player.energy,
                playerBreathCooldown: game.playerBreathCooldown,
                hatchlingBreathCooldown: game.hatchlingBreathCooldown || 0,
                dragonBreathCooldown: game.dragonBreathCooldown || 0,
                skillTrackers: game.player.skillTrackers || {},
                inventory: playerInv.map(serializeItem),
                equipmentIndexes: equipmentIndexes,
                mutations: game.player.body ? game.player.body.mutations : [],
                loreRegistry: game.player.body ? game.player.body.loreRegistry : {},
                weaponMastery: game.player.body ? game.player.body.weaponMastery : {}
            },
            items: game.items.map(serializeItem),
            monsters: game.monsters.map(serializeMonster),
            map: {
                width: game.map.width,
                height: game.map.height,
                floor: game.map.floor,
                startingPosition: game.map.startingPosition,
                rooms: (game.map.rooms || []).map(r => ({
                    x1: r.x1,
                    y1: r.y1,
                    x2: r.x2,
                    y2: r.y2,
                    w: r.w !== undefined ? r.w : (r.x2 - r.x1),
                    h: r.h !== undefined ? r.h : (r.y2 - r.y1),
                    type: r.type,
                    center: r.center,
                    theme: r.theme,
                    vaultType: r.vaultType,
                    pitSpecies: r.pitSpecies,
                    pitTiles: r.pitTiles,
                    treasureTiles: r.treasureTiles,
                    trapTiles: r.trapTiles,
                    doorTiles: r.doorTiles,
                    innerWalls: r.innerWalls
                })),
                tiles: (game.map.tiles || []).map(row => row.map(t => ({
                    x: t.x,
                    y: t.y,
                    isWalkable: t.isWalkable,
                    char: t.char,
                    color: t.color,
                    isExplored: t.isExplored,
                    isStaircase: t.isStaircase || false,
                    isUpStaircase: t.isUpStaircase || false
                })))
            }
        });
    }

    static deserialize(game, jsonStringOrData) {
        const data = typeof jsonStringOrData === 'string' ? JSON.parse(jsonStringOrData) : jsonStringOrData;
        
        // 1. Map Restore
        game.floor = data.floor;
        game.floorDanger = data.floorDanger;
        game.mapWidth = data.map.width;
        game.mapHeight = data.map.height;
        
        game.map = new Map(data.map.width, data.map.height, data.map.floor);
        game.map.startingPosition = data.map.startingPosition;
        
        // Restore rooms as structured RectRoom instances
        game.map.rooms = (data.map.rooms || []).map(r => {
            const room = {
                x1: r.x1,
                y1: r.y1,
                x2: r.x2,
                y2: r.y2,
                w: r.w !== undefined ? r.w : (r.x2 - r.x1),
                h: r.h !== undefined ? r.h : (r.y2 - r.y1),
                type: r.type || 'NORMAL',
                theme: r.theme,
                vaultType: r.vaultType,
                pitSpecies: r.pitSpecies,
                pitTiles: r.pitTiles || [],
                treasureTiles: r.treasureTiles || [],
                trapTiles: r.trapTiles || [],
                doorTiles: r.doorTiles || [],
                innerWalls: r.innerWalls || [],
                get center() {
                    return {
                        x: Math.floor((this.x1 + this.x2) / 2),
                        y: Math.floor((this.y1 + this.y2) / 2)
                    };
                }
            };
            return room;
        });
        game.map.tiles = data.map.tiles;
        
        // 2. Player Restore
        const pData = data.player;
        const initialCore = pData.mimicCore?.coreType || pData.mimicCore?.name || 'MON_NOVICE_WARRIOR';
        game.player = new Player(pData.x, pData.y, initialCore);
        game.player.level = pData.level || 1;
        game.player.xp = pData.xp || 0;
        game.player.xpNeeded = pData.xpNeeded || 50;
        if (pData.autoFireEnabled !== undefined) {
            game.player.autoFireEnabled = pData.autoFireEnabled;
        }
        
        // Restore stats and ensure MimicBody stays in sync
        game.player.baseStats = pData.baseStats || { str: 8, dex: 8, con: 8, int: 8, cha: 6 };
        if (game.player.body) {
            game.player.body.baseStats = game.player.baseStats;
        }
        game.player.legacyStats = pData.legacyStats || { str: 0, dex: 0, con: 0, int: 0, cha: 0 };
        if (game.player.body) {
            game.player.body.legacyStats = game.player.legacyStats;
        }

        game.player.attackCount = pData.attackCount || 0;
        
        // Safely restore statuses & preserve debuffs Proxy
        game.player.statuses = {};
        if (pData.statuses && Object.keys(pData.statuses).length > 0) {
            for (const [key, st] of Object.entries(pData.statuses)) {
                if (st && st.duration > 0) {
                    game.player.statuses[key] = {
                        key: st.key || key,
                        name: st.name || key,
                        duration: st.duration,
                        power: st.power || 1,
                        source: st.source || null,
                        color: st.color || '#34d399',
                        icon: st.icon || '✨',
                        modifiers: st.modifiers || {}
                    };
                }
            }
        } else if (pData.debuffs) {
            for (const [k, v] of Object.entries(pData.debuffs)) {
                if (v) {
                    game.player.debuffs[k] = v;
                }
            }
        }

        game.player.stats = pData.stats || { hp: 10, maxHp: 10 };
        
        if (pData.mimicCore) {
            game.player.mimicCore = pData.mimicCore;
            // 1. Resolve canonical coreType if missing or stored as legacy alias
            const rawKey = game.player.mimicCore.coreType || game.player.mimicCore.name || 'MON_NOVICE_WARRIOR';
            const config = getSpeciesConfig(rawKey);
            if (config) {
                game.player.mimicCore.coreType = config.coreType || rawKey;
                game.player.mimicCore.name = config.name;
                game.player.mimicCore.char = config.char;
                game.player.mimicCore.baseColor = config.baseColor;
                game.player.mimicCore.flashColor = config.flashColor;
            }
            const isStartingHuman = (
                game.player.mimicCore.coreType === 'MON_NOVICE_WARRIOR' ||
                game.player.mimicCore.coreType === 'HUMAN' ||
                game.player.mimicCore.name === 'Novice warrior' ||
                game.player.mimicCore.name === '인간 여행자'
            );
            game.player.char = isStartingHuman ? '@' : (game.player.mimicCore.char || '@');
            game.player.color = isStartingHuman ? '#34d399' : (game.player.mimicCore.baseColor || '#34d399');
        }

        game.player.animationTime = pData.animationTime || 0;
        game.player.energy = pData.energy || 0;
        game.playerBreathCooldown = pData.playerBreathCooldown || 0;
        game.hatchlingBreathCooldown = pData.hatchlingBreathCooldown || 0;
        game.dragonBreathCooldown = pData.dragonBreathCooldown || 0;
        game.player.skillTrackers = pData.skillTrackers || {};
        
        // Restore MimicBody attributes & Auto-migrate fragmented lore XP to maximum level
        if (game.player.body) {
            if (pData.mutations) game.player.body.mutations = pData.mutations;
            if (pData.loreRegistry) {
                game.player.body.loreRegistry = pData.loreRegistry;
                // Auto-migrate and synchronize all lore keys across aliases (e.g. 'TITAN', 'Lesser titan', 'MON_LESSER_TITAN', '레서 타이탄')
                // to the highest accumulated XP (e.g. 3,408 XP -> Lv.50)
                for (const key of Object.keys(game.player.body.loreRegistry)) {
                    game.player.body.gainLoreXp(key, 0);
                }
                if (LEGACY_TOME_ALIASES_MAP) {
                    for (const [alias, targetKey] of Object.entries(LEGACY_TOME_ALIASES_MAP)) {
                        if (game.player.body.loreRegistry[alias] !== undefined || game.player.body.loreRegistry[targetKey] !== undefined) {
                            game.player.body.gainLoreXp(alias, 0);
                            game.player.body.gainLoreXp(targetKey, 0);
                        }
                    }
                }
            }
            if (pData.weaponMastery) game.player.body.weaponMastery = pData.weaponMastery;
        }

        // Rebind activeSkills based on current restored mimicCore
        const currentCoreKey = game.player.mimicCore?.coreType || game.player.mimicCore?.name || 'MON_NOVICE_WARRIOR';
        game.player.activeSkills = MonsterSpellFactory.createInnateSkills(currentCoreKey);
        
        // Item deserializer helper
        const deserializeItem = (iData) => {
            if (!iData) return null;
            let itemName = iData.name;
            let itemColor = iData.color;
            let itemChar = iData.char;
            if (iData.type === 'CORE' && iData.coreType) {
                const config = getSpeciesConfig(iData.coreType);
                if (config) {
                    itemName = `${config.name} 코어`;
                    itemColor = config.baseColor;
                    itemChar = config.char;
                }
            }
            const item = new Item(
                iData.x, iData.y, iData.type, itemChar, itemColor, itemName,
                iData.lightBonus, iData.slotType, iData.statBonuses, iData.dice,
                iData.coreType, iData.prefixes || [], iData.suffixes || [], iData.specialTags || [],
                iData.flavorText || ""
            );
            item.fusionLevel = iData.fusionLevel || 0;
            item.upgradeLevel = iData.upgradeLevel || 0;
            item.count = iData.count || 1;
            // 동적 계산 대상(코어, 탄약, 소모품, 장비)의 _weight 오염 방지 (TomeEquipmentEngine dynamic getter 위임 유지)
            if (iData.potionEffect !== undefined) item.potionEffect = iData.potionEffect;
            if (iData.scrollEffect !== undefined) item.scrollEffect = iData.scrollEffect;
            if (iData.baseAC !== undefined) item.baseAC = iData.baseAC;
            if (iData.toHit !== undefined) item.toHit = iData.toHit;
            if (iData.toDamage !== undefined) item.toDamage = iData.toDamage;
            if (iData.toDmg !== undefined) item.toDmg = iData.toDmg;
            if (iData.range !== undefined) item.range = iData.range;
            if (iData.multiplier !== undefined) item.multiplier = iData.multiplier;
            if (iData.weaponCategory !== undefined) item.weaponCategory = iData.weaponCategory;
            if (iData.tval !== undefined) item.tval = iData.tval;
            if (iData.sval !== undefined) item.sval = iData.sval;
            if (iData.charges !== undefined) item.charges = iData.charges;
            if (iData.timeout !== undefined) item.timeout = iData.timeout;
            return item;
        };

        // Inventory
        game.player.inventory = (pData.inventory || []).map(deserializeItem);
        
        // Equipment references mapping
        const eqIdx = pData.equipmentIndexes || {};
        game.player.equipment = { 
            weapon: null, 
            shield: null,
            bow: null,
            quiver: null,
            armor: null, 
            helmet: null, 
            gloves: null,
            boots: null,
            cloak: null,
            subCore1: null, 
            subCore2: null,
            ring1: null,
            ring2: null,
            amulet: null
        };
        game.player.equippedLamp = null;
        
        if (eqIdx.weapon !== -1 && eqIdx.weapon !== undefined) game.player.equipment.weapon = game.player.inventory[eqIdx.weapon];
        if (eqIdx.shield !== -1 && eqIdx.shield !== undefined) game.player.equipment.shield = game.player.inventory[eqIdx.shield];
        if (eqIdx.bow !== -1 && eqIdx.bow !== undefined) game.player.equipment.bow = game.player.inventory[eqIdx.bow];
        if (eqIdx.quiver !== -1 && eqIdx.quiver !== undefined) game.player.equipment.quiver = game.player.inventory[eqIdx.quiver];
        if (eqIdx.armor !== -1 && eqIdx.armor !== undefined) game.player.equipment.armor = game.player.inventory[eqIdx.armor];
        if (eqIdx.helmet !== -1 && eqIdx.helmet !== undefined) game.player.equipment.helmet = game.player.inventory[eqIdx.helmet];
        if (eqIdx.gloves !== -1 && eqIdx.gloves !== undefined) game.player.equipment.gloves = game.player.inventory[eqIdx.gloves];
        if (eqIdx.boots !== -1 && eqIdx.boots !== undefined) game.player.equipment.boots = game.player.inventory[eqIdx.boots];
        if (eqIdx.cloak !== -1 && eqIdx.cloak !== undefined) game.player.equipment.cloak = game.player.inventory[eqIdx.cloak];
        if (eqIdx.subCore1 !== -1 && eqIdx.subCore1 !== undefined) game.player.equipment.subCore1 = game.player.inventory[eqIdx.subCore1];
        if (eqIdx.subCore2 !== -1 && eqIdx.subCore2 !== undefined) game.player.equipment.subCore2 = game.player.inventory[eqIdx.subCore2];
        if (eqIdx.ring1 !== -1 && eqIdx.ring1 !== undefined) game.player.equipment.ring1 = game.player.inventory[eqIdx.ring1];
        if (eqIdx.ring2 !== -1 && eqIdx.ring2 !== undefined) game.player.equipment.ring2 = game.player.inventory[eqIdx.ring2];
        if (eqIdx.amulet !== -1 && eqIdx.amulet !== undefined) game.player.equipment.amulet = game.player.inventory[eqIdx.amulet];
        if (eqIdx.equippedLamp !== -1 && eqIdx.equippedLamp !== undefined) game.player.equippedLamp = game.player.inventory[eqIdx.equippedLamp];

        game.player.markDirty('SaveSystem.deserialize');

        // 3. Ground Items Restore
        game.items = (data.items || []).map(deserializeItem);

        // 4. Monsters Restore
        game.monsters = (data.monsters || []).map(mData => {
            const m = new Monster(mData.x, mData.y, mData.type, mData.level, mData.prefixes || [], mData.suffixes || []);
            m.stats.hp = mData.hp;
            m.energy = mData.energy || 0;
            m.batFleeTurns = mData.batFleeTurns || 0;
            m.breathCooldown = mData.breathCooldown || 0;
            m.giantBloodCooldown = mData.giantBloodCooldown || 0;
            m.statuses = {};
            if (mData.statuses && Object.keys(mData.statuses).length > 0) {
                for (const [key, st] of Object.entries(mData.statuses)) {
                    if (st && st.duration > 0) {
                        m.statuses[key] = {
                            key: st.key || key,
                            name: st.name || key,
                            duration: st.duration,
                            power: st.power || 1,
                            source: st.source || null,
                            color: st.color || '#fbbf24',
                            icon: st.icon || '⚡',
                            modifiers: st.modifiers || {}
                        };
                    }
                }
            } else if (mData.debuffs) {
                for (const [k, v] of Object.entries(mData.debuffs)) {
                    if (v) {
                        m.debuffs[k] = v;
                    }
                }
            }
            return m;
        });

        // 5. Unique Monster Manager State Restore
        if (data.uniqueMonsters) {
            (game.uniqueMonsterManager || uniqueMonsterManager).deserialize(data.uniqueMonsters);
        }

        // 6. Reset death / game over flags
        game.isGameOver = false;
        game._isHandlingDeath = false;

        // 7. UI and Render Update
        if (typeof game.updateUI === 'function') game.updateUI();
        if (typeof game.render === 'function') game.render();
    }

    static getSlotInfo(slot) {
        try {
            if (typeof localStorage === 'undefined') return null;
            const saved = localStorage.getItem('mimicry_save_game_' + slot);
            if (!saved) return null;
            const data = JSON.parse(saved);
            if (!data || !data.player) return null;
            
            // Extract player details
            const mimicCore = data.player.mimicCore;
            let species = '인간 여행자';
            if (mimicCore) {
                const coreType = mimicCore.coreType || mimicCore.name || '';
                const config = getSpeciesConfig(coreType);
                if (config) {
                    species = config.displayName || config.name;
                } else if (coreType === 'SLIME') species = '초록 슬라임';
                else if (coreType === 'BAT') species = '과일박쥐';
                else if (coreType === 'GOBLIN') species = '고블린 전사';
                else if (coreType === 'ORC') species = '오크 돌격병';
                else if (coreType === 'OGRE') species = '오우거';
                else if (coreType === 'HATCHLING') species = '드래곤 해츨링';
                else if (coreType === 'DRAGON') species = '성체 드래곤';
                else if (coreType === 'IMP') species = '임프';
                else species = mimicCore.displayName || mimicCore.name || '인간 여행자';
            }
            
            return {
                exists: true,
                species: species,
                level: data.player.level || 1,
                floor: data.floor || 1
            };
        } catch (e) {
            console.error("Failed to parse slot info:", e);
            return null;
        }
    }

    static saveGame(game, isSilent = false, slot = null) {
        try {
            if (typeof localStorage === 'undefined') return;
            const activeSlot = slot || game.currentSlot || 'slot1';
            const serialized = SaveSystem.serialize(game);
            localStorage.setItem('mimicry_save_game_' + activeSlot, serialized);
            localStorage.setItem('mimicry_save_game', serialized);
            if (!isSilent) {
                game.addLogEntry(`💾 게임 진행 상황이 로컬 저장소 [${activeSlot.toUpperCase()}]에 저장되었습니다.`, `system`);
            }
        } catch (e) {
            console.error("Save failed:", e);
            if (!isSilent) {
                game.addLogEntry(`⚠️ 저장 실패: 브라우저 용량이나 설정을 확인하세요.`, `combat`);
            }
        }
    }

    static loadGame(game, isSilent = false, slot = null) {
        try {
            if (typeof localStorage === 'undefined') return false;
            const activeSlot = slot || game.currentSlot || 'slot1';
            const saved = localStorage.getItem('mimicry_save_game_' + activeSlot);
            if (!saved) {
                if (!isSilent) {
                    game.addLogEntry(`⚠️ 불러올 세이브 파일이 없습니다! [${activeSlot.toUpperCase()}]`, `combat`);
                }
                return false;
            }
            SaveSystem.deserialize(game, saved);
            if (!isSilent) {
                game.addLogEntry(`⏳ 이전 플레이 상태를 불러왔습니다. [${activeSlot.toUpperCase()}] 모험을 재개합니다!`, `loot`);
            }
            return true;
        } catch (e) {
            console.error("Load failed:", e);
            if (!isSilent) {
                game.addLogEntry(`⚠️ 불러오기 실패: 세이브 파일이 손상되었습니다.`, `combat`);
            }
            return false;
        }
    }
}

