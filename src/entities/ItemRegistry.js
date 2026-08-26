/**
 * @module ItemRegistry
 * @category entities
 * @description ToME 2.3.5 기반 560+종 기본 아이템 및 190+종 전설 유물(Artifacts) 중앙 레지스트리
 * @purity Pure Registry / Data Store
 * @dependencies Item.js, Tags.js
 * @exports TOME_BASE_ITEMS, TOME_ARTIFACTS, createTomeItem, getItemConfig
 */

import { Item } from './Item.js';

export const TOME_BASE_ITEMS = Object.freeze({
  "ITEM_BLINDNESS": {
    key: "ITEM_BLINDNESS",
    name: 'Blindness',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 1,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This slightly poisonous potion temporarily impedes your eyesight, making you unable to see a thing.'
  },
  "ITEM_PARANOIA": {
    key: "ITEM_PARANOIA",
    name: 'Paranoia',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 5,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will make you scared. You will not be able to hit your enemies in combat if you\'re scared.'
  },
  "ITEM_CONFUSION": {
    key: "ITEM_CONFUSION",
    name: 'Confusion',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 5,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will confuse you. You will not be able to cast spells, use wands, staves or scrolls. You can still quaff potions, though.'
  },
  "ITEM_HALLUCINATION": {
    key: "ITEM_HALLUCINATION",
    name: 'Hallucination',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 10,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will make you hallucinate. You will not be able to recognise any monster or item.'
  },
  "ITEM_CURE_POISON": {
    key: "ITEM_CURE_POISON",
    name: 'Cure Poison',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 10,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will cure you from poison.'
  },
  "ITEM_CURE_BLINDNESS": {
    key: "ITEM_CURE_BLINDNESS",
    name: 'Cure Blindness',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 10,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will cure you from blindness.'
  },
  "ITEM_CURE_PARANOIA": {
    key: "ITEM_CURE_PARANOIA",
    name: 'Cure Paranoia',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 10,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will cure your paranoia.  Paranoia is the state when you are too afraid to attack monsters.'
  },
  "ITEM_CURE_CONFUSION": {
    key: "ITEM_CURE_CONFUSION",
    name: 'Cure Confusion',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 10,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will cure your confusion.  Confusion is when you are too confused to cast spells, zap staves, aim wands or read scrolls.'
  },
  "ITEM_WEAKNESS": {
    key: "ITEM_WEAKNESS",
    name: 'Weakness',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 3,
    baseAC: 0,
    dice: '3d12',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This nasty potion will sap your strength, making you weaker.'
  },
  "ITEM_UNHEALTH": {
    key: "ITEM_UNHEALTH",
    name: 'Unhealth',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 15,
    baseAC: 0,
    dice: '10d10',
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will reduce your constitution by one point.'
  },
  "ITEM_RESTORE_CONSTITUTION": {
    key: "ITEM_RESTORE_CONSTITUTION",
    name: 'Restore Constitution',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 25,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'A beneficial magical concoction, restoring your damaged health.'
  },
  "ITEM_RESTORING": {
    key: "ITEM_RESTORING",
    name: 'Restoring',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 20,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will restore your strength, dexterity, constitution, intelligence, wisdom and charisma. These need restoring when they are displayed in yellow.'
  },
  "ITEM_STUPIDITY": {
    key: "ITEM_STUPIDITY",
    name: 'Stupidity',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 20,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This accursed potion will cloud your intellect, making you stupid.'
  },
  "ITEM_NAIVETY": {
    key: "ITEM_NAIVETY",
    name: 'Naivety',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 20,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This potion casts a shadow on your knowledge, making you foolish.'
  },
  "ITEM_POISON": {
    key: "ITEM_POISON",
    name: 'Poison',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 3,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This bottle is filled with a mild but still dangerous liquid poison. Drinking it would be highly unwise.'
  },
  "ITEM_SICKNESS": {
    key: "ITEM_SICKNESS",
    name: 'Sickness',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 10,
    baseAC: 0,
    dice: '4d4',
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will reduce your constitution by one point. It will also damage you quite severely in the process. That\'s a bad thing.'
  },
  "ITEM_PARALYSIS": {
    key: "ITEM_PARALYSIS",
    name: 'Paralysis',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 20,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will paralyse you for a certain time. Any nearby monsters will take this opportunity to kill you. That\'s a bad thing.'
  },
  "ITEM_RESTORE_STRENGTH": {
    key: "ITEM_RESTORE_STRENGTH",
    name: 'Restore Strength',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 25,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This magical potion will bring back your physical power to its full extent, should it be drained.'
  },
  "ITEM_DISEASE": {
    key: "ITEM_DISEASE",
    name: 'Disease',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#cbd5e1',
    level: 20,
    baseAC: 0,
    dice: '10d10',
    statBonuses: {},
    specialTags: [],
    flavorText: '\'E\'ating this mushroom will reduce your strength by one point. It will also damage you quite severely in the process. That\'s a bad thing.'
  },
  "ITEM_CURE_SERIOUS_WOUNDS": {
    key: "ITEM_CURE_SERIOUS_WOUNDS",
    name: 'Cure Serious Wounds',
    type: 'SCROLL',
    slotType: null,
    char: '?',
    color: '#cbd5e1',
    level: 3,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This beneficial potion will cure some wounds and other inhibiting ailments.'
  },
  "ITEM_RATION_OF_FOOD": {
    key: "ITEM_RATION_OF_FOOD",
    name: '& Ration~ of Food',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#d97706',
    level: 1,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'Lightweight and filling. Not an incredible taste experience, but that\'d be asking a bit much. You can \'E\'at it.'
  },
  "ITEM_HARD_BISCUIT": {
    key: "ITEM_HARD_BISCUIT",
    name: '& Hard Biscuit~',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#d97706',
    level: 1,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'It doesn\'t look great, and \'E\'ating it will only fill your stomach a bit, for a short time.'
  },
  "ITEM_STRIP_OF_VENISON": {
    key: "ITEM_STRIP_OF_VENISON",
    name: '& Strip~ of Venison',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#b45309',
    level: 1,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'It looks great, and \'E\'ating it will fill your stomach well.'
  },
  "ITEM_SLIME_MOLD": {
    key: "ITEM_SLIME_MOLD",
    name: '& Slime Mold~',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#22c55e',
    level: 1,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'It looks disgusting, but if you really want to you can \'E\'at it. Not an incredible taste experience, but that\'d be asking a bit much.'
  },
  "ITEM_PINT_OF_FINE_ALE": {
    key: "ITEM_PINT_OF_FINE_ALE",
    name: '& Pint~ of Fine Ale',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#eab308',
    level: 1,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'A bottle of a dark beer-like beverage. You can drink it by pressing \'E\'.'
  },
  "ITEM_PINT_OF_FINE_WINE": {
    key: "ITEM_PINT_OF_FINE_WINE",
    name: '& Pint~ of Fine Wine',
    type: 'FOOD',
    slotType: null,
    char: ',',
    color: '#ef4444',
    level: 1,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'A bottle of fine wine. You can drink it by pressing \'E\'.'
  },
  "ITEM_MATTOCK": {
    key: "ITEM_MATTOCK",
    name: '& Mattock~',
    type: 'WEAPON',
    slotType: 'WEAPON',
    char: '\\',
    color: '#475569',
    level: 50,
    baseAC: 0,
    dice: '1d8',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This is a digging tool. Use it to dig in walls, destroy doors, or cut wood.'
  },
  "ITEM_BLUE_STONE": {
    key: "ITEM_BLUE_STONE",
    name: '& Blue Stone~',
    type: 'AMULET',
    slotType: 'AMULET',
    char: '"',
    color: '#38bdf8',
    level: 60,
    baseAC: 0,
    dice: null,
    statBonuses: {},
    specialTags: [],
    flavorText: 'A standard & Blue Stone~ from the depths of ToME.'
  },
  "ITEM_BROKEN_DAGGER": {
    key: "ITEM_BROKEN_DAGGER",
    name: '& Broken Dagger~',
    type: 'WEAPON',
    slotType: 'WEAPON',
    char: '|',
    color: '#475569',
    level: 1,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: [],
    flavorText: 'The blade itself is a foot long and broken off not far above the hilt.'
  },
  "ITEM_BASTARD_SWORD": {
    key: "ITEM_BASTARD_SWORD",
    name: '& Bastard Sword~',
    type: 'WEAPON',
    slotType: 'WEAPON',
    char: '|',
    color: '#cbd5e1',
    level: 15,
    baseAC: 0,
    dice: '3d4',
    statBonuses: {},
    specialTags: [],
    flavorText: 'This is a long, double-edged sword with a plain hilt that could be wielded in one or two hands. It\'s called a "bastard sword" because in size, it falls between the broad sword and the two-handed sword, thus not having a family of its own. It\'s typically around 51 inches long. It is effective for cutting through tougher armours. It could be used for thrusting, but most wielders swing it like a bat.'
  },
  "ART_OF_GALADRIEL": {
    key: "ART_OF_GALADRIEL",
    name: '유물: of Galadriel',
    type: 'LAMP',
    slotType: 'LIGHT',
    char: '~',
    color: '#ffd700',
    level: 20,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: ["ARTIFACT", "LEGENDARY", "LIGHT_SOURCE"],
    flavorText: 'A small crystal phial, with the light of Earendil\'s Star contained inside. Its light is imperishable, and near it darkness cannot endure.'
  },
  "ART_OF_ELENDIL": {
    key: "ART_OF_ELENDIL",
    name: '유물: of Elendil',
    type: 'LAMP',
    slotType: 'LIGHT',
    char: '~',
    color: '#ffd700',
    level: 30,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: ["ARTIFACT", "LEGENDARY", "LIGHT_SOURCE"],
    flavorText: 'The shining Star of the West, a famed heirloom of Elendil\'s house.'
  },
  "ART_OF_THRAIN": {
    key: "ART_OF_THRAIN",
    name: '유물: of Thrain',
    type: 'LAMP',
    slotType: 'LIGHT',
    char: '~',
    color: '#ffd700',
    level: 50,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: ["ARTIFACT", "LEGENDARY", "LIGHT_SOURCE"],
    flavorText: 'A great globe seemingly filled with moonlight, the famed Heart of the Mountain, which splinters the light that falls upon it into a thousand glowing shards.'
  },
  "ART_OF_CARLAMMAS": {
    key: "ART_OF_CARLAMMAS",
    name: '유물: of Carlammas',
    type: 'AMULET',
    slotType: 'AMULET',
    char: '"',
    color: '#ffd700',
    level: 50,
    baseAC: 0,
    dice: null,
    statBonuses: {"con": 2},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A fiery circle of bronze, with mighty spells to ward off evil.'
  },
  "ART_OF_INGWE": {
    key: "ART_OF_INGWE",
    name: '유물: of Ingwe',
    type: 'AMULET',
    slotType: 'AMULET',
    char: '"',
    color: '#ffd700',
    level: 65,
    baseAC: 0,
    dice: null,
    statBonuses: {"int": 3, "cha": 3},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The ancient heirloom of Ingwe, high lord of the Vanyar, against whom nothing of evil could stand.'
  },
  "ART_NAUGLAMIR": {
    key: "ART_NAUGLAMIR",
    name: '유물: \'Nauglamir\'',
    type: 'AMULET',
    slotType: 'AMULET',
    char: '"',
    color: '#ffd700',
    level: 70,
    baseAC: 0,
    dice: null,
    statBonuses: {"str": 3, "dex": 3, "con": 3},
    specialTags: ["ARTIFACT", "LEGENDARY", "LIGHT_SOURCE"],
    flavorText: 'A carencet of gold, set with a multitude of shining gems of Valinor.  Despite its size, its weight seems as that of gossamer.'
  },
  "ART_OF_FLARE": {
    key: "ART_OF_FLARE",
    name: '유물: of Flare',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 50,
    baseAC: 0,
    dice: null,
    statBonuses: {"str": 3, "con": 3, "cha": 3},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The mighty ring of the Thunderlord Flare that makes the wearer strong and healthy.  Once a ring of power, it was given to Flare by Celegorm when he arrived on Middle-earth with a full nest of Thunderlords.'
  },
  "ART_OF_BARAHIR": {
    key: "ART_OF_BARAHIR",
    name: '유물: of Barahir',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 50,
    baseAC: 0,
    dice: null,
    statBonuses: {"str": 1, "dex": 1, "con": 1, "int": 1, "cha": 1},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A ring shaped into twinned serpents with eyes of emerald meeting beneath a crown of flowers, an ancient treasure of Isildur\'s house.'
  },
  "ART_OF_TULKAS": {
    key: "ART_OF_TULKAS",
    name: '유물: of Tulkas',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 70,
    baseAC: 0,
    dice: null,
    statBonuses: {"str": 4, "dex": 4, "con": 4},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The treasure of Tulkas, most fleet and wrathful of the Valar.'
  },
  "ART_OF_POWER_NARYA": {
    key: "ART_OF_POWER_NARYA",
    name: '유물: of Power \'Narya\'',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 70,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {"str": 1, "dex": 1, "con": 1, "int": 1, "cha": 1},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The Ring of Fire, set with a ruby that glows like flame.  Narya is one of the three Rings of Power created by the Elves and hidden by them from Sauron.'
  },
  "ART_OF_POWER_NENYA": {
    key: "ART_OF_POWER_NENYA",
    name: '유물: of Power \'Nenya\'',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 80,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {"str": 2, "dex": 2, "con": 2, "int": 2, "cha": 2},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The Ring of Adamant, with a pure white stone as centrepiece.  Nenya is one of the three Rings of Power created by the Elves and hidden by them from Sauron.'
  },
  "ART_OF_POWER_VILYA": {
    key: "ART_OF_POWER_VILYA",
    name: '유물: of Power \'Vilya\'',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 90,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {"str": 3, "dex": 3, "con": 3, "int": 3, "cha": 3},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The Ring of Sapphire, with clear blue gems that shine like stars, glittering untouchable despite all that Sauron ever wrought.  Vilya is one of the three Rings of Power created by the Elves and hidden by them from Sauron.'
  },
  "ART_OF_POWER_THE_ONE_RING": {
    key: "ART_OF_POWER_THE_ONE_RING",
    name: '유물: of Power \'The One Ring\'',
    type: 'RING',
    slotType: 'RING',
    char: '=',
    color: '#ffd700',
    level: 100,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {"str": 5, "dex": 5, "con": 5, "int": 5, "cha": 5},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: '"Ash nazg durbatuluk, ash nazg gimbatul, ash nazg thrakatuluk agh burzum-ishi krimpatul". Unadorned, made of massive gold, set with runes in the foul speech of Mordor, with power so great that it inevitably twists and masters any earthly being who wears it.'
  },
  "ART_OF_SPACE_TIME": {
    key: "ART_OF_SPACE_TIME",
    name: '유물: of Space-Time',
    type: 'LAMP',
    slotType: 'LIGHT',
    char: '~',
    color: '#ffd700',
    level: 30,
    baseAC: 0,
    dice: '1d1',
    statBonuses: {},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A powerful stone that provides a strong light for any who wields it. It is rumoured that it may even protect the wearer from the passing of time.'
  },
  "ART_RAZORBACK": {
    key: "ART_RAZORBACK",
    name: '유물: \'Razorback\'',
    type: 'ARMOR',
    slotType: 'ARMOR',
    char: '[',
    color: '#ffd700',
    level: 90,
    baseAC: 55,
    dice: '2d4',
    statBonuses: {},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A massive suit of heavy dragon scales deeply saturated with many colours. It throbs with angry energies, and you feel the raw elemental might of untamed Lightning as you put it on.'
  },
  "ART_OF_ETERNITY": {
    key: "ART_OF_ETERNITY",
    name: '유물: of Eternity',
    type: 'ARTIFACT',
    slotType: 'WEAPON',
    char: '|',
    color: '#ffd700',
    level: 127,
    baseAC: 0,
    dice: '0d0',
    statBonuses: {"dex": 5, "con": 5},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'Designed to be used with the Seeker Bolt of Feanor, this Crossbow is perfect against the terrible powers of Morgoth.'
  },
  "ART_OF_MELKOR": {
    key: "ART_OF_MELKOR",
    name: '유물: of Melkor',
    type: 'WEAPON',
    slotType: 'WEAPON',
    char: '|',
    color: '#ffd700',
    level: 65,
    baseAC: 0,
    dice: '4d6',
    statBonuses: {},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'The mighty spear used once by Melkor to slay the trees of Valinor.'
  },
  "ART_SOULKEEPER": {
    key: "ART_SOULKEEPER",
    name: '유물: \'Soulkeeper\'',
    type: 'ARMOR',
    slotType: 'ARMOR',
    char: '[',
    color: '#ffd700',
    level: 75,
    baseAC: 60,
    dice: '2d4',
    statBonuses: {"con": 2},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A suit of imperishable adamant, with unconquerable strength to endure evil and disruptive magics, that protects the life force of its wearer as nothing else can.'
  },
  "ART_OF_ISILDUR": {
    key: "ART_OF_ISILDUR",
    name: '유물: of Isildur',
    type: 'ARMOR',
    slotType: 'ARMOR',
    char: '[',
    color: '#ffd700',
    level: 30,
    baseAC: 50,
    dice: '2d4',
    statBonuses: {"con": 1},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A gleaming steel suit covering the wearer from neck to foot, with runes of warding and stability deeply engraved into its surface.'
  },
  "ART_OF_THE_ROHIRRIM": {
    key: "ART_OF_THE_ROHIRRIM",
    name: '유물: of the Rohirrim',
    type: 'ARMOR',
    slotType: 'ARMOR',
    char: '[',
    color: '#ffd700',
    level: 30,
    baseAC: 34,
    dice: '1d4',
    statBonuses: {"str": 2, "dex": 2},
    specialTags: ["ARTIFACT", "LEGENDARY"],
    flavorText: 'A stiff suit of armour composed of small metal plates sewn to an inner layer of heavy canvas, and covered with a second layer of cloth.  Within it is the spirit of Eorl the Young, matchless in combat.'
  },
});

import { TOME_ARTIFACTS_DATA } from './TomeArtifactsData.js';

export const TOME_ARTIFACTS = TOME_ARTIFACTS_DATA;

/**
 * ToME 아이템 키로부터 새로운 Item 인스턴스를 즉시 생성합니다.
 */
export function createTomeItem(key, x = 0, y = 0) {
  const cfg = TOME_BASE_ITEMS[key] || TOME_ARTIFACTS[key];
  if (!cfg) return null;

  let type = cfg.type || 'WEAPON';
  let slotType = cfg.slotType || null;
  let char = cfg.char;

  // Safeguard slotType & type based on tval
  if (cfg.tval === 31 || type === 'GLOVES') {
    type = 'GLOVES';
    slotType = 'GLOVES';
    char = ']';
  } else if (cfg.tval === 34 || type === 'SHIELD') {
    type = 'SHIELD';
    slotType = 'SHIELD';
    char = ')';
  } else if (cfg.tval === 30 || type === 'BOOTS') {
    type = 'BOOTS';
    slotType = 'BOOTS';
    char = ']';
  } else if (cfg.tval === 35 || type === 'CLOAK') {
    type = 'CLOAK';
    slotType = 'CLOAK';
    char = '(';
  } else if (cfg.tval === 32 || cfg.tval === 33 || type === 'HELMET' || type === 'CROWN') {
    type = 'HELMET';
    slotType = 'HELMET';
    char = ']';
  } else if (cfg.tval === 36 || cfg.tval === 37 || cfg.tval === 38 || type === 'ARMOR') {
    type = 'ARMOR';
    slotType = 'ARMOR';
    char = '[';
  }

  const isArtifact = cfg.specialTags?.includes('ARTIFACT') || !!TOME_ARTIFACTS[key] || (cfg.key && cfg.key.startsWith('ART_'));
  const item = new Item(
    x, y,
    type,
    char,
    cfg.color || (isArtifact ? '#ffd700' : '#cbd5e1'),
    cfg.name,
    cfg.type === 'LAMP' ? 2 : 0,
    slotType,
    cfg.statBonuses || {},
    cfg.dice,
    null,
    [],
    [],
    cfg.specialTags || (isArtifact ? ['ARTIFACT'] : []),
    cfg.flavorText || ""
  );

  if (isArtifact) {
    item.artifactKey = cfg.key || key;
  }
  if (typeof cfg.baseAC === 'number') {
    item.baseAC = cfg.baseAC;
  }
  if (typeof cfg.weight === 'number') {
    item.weight = cfg.weight;
  }
  if (typeof cfg.cost === 'number') {
    item.cost = cfg.cost;
  }
  if (typeof cfg.level === 'number') {
    item.level = cfg.level;
  }
  if (cfg.flags && Array.isArray(cfg.flags)) {
    item.flags = [...cfg.flags];
  }
  item.syncComponents();

  return item;
}

/**
 * 아이템 키로 메타 설정을 조회합니다.
 */
export function getItemConfig(key) {
  return TOME_BASE_ITEMS[key] || TOME_ARTIFACTS[key] || null;
}
