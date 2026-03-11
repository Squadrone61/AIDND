// D&D 2024 Database Types — Single Source of Truth

// ─── Classes ──────────────────────────────────────────────

export interface ClassData {
  name: string;
  hitDice: number;
  primaryAbility: string;
  savingThrows: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillChoices: {
    count: number;
    from: string[];
  };
  spellcastingAbility?: string;
  casterType?: "full" | "half" | "third" | "pact";
  spellSlotTable?: number[][];
  pactSlotTable?: { level: number; slots: number; slotLevel: number }[];
  features: ClassFeatureData[];
  subclasses: SubclassData[];
  resources: ClassResourceTemplate[];
  multiclassPrerequisites?: string;
  multiclassProficiencies?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    skills?: { count: number; from: string[] };
  };
  source: string;
}

export interface ClassFeatureData {
  name: string;
  level: number;
  description: string;
  activationType?: string;
  scaling?: Record<number, string>;
}

export interface SubclassData {
  name: string;
  features: ClassFeatureData[];
  spellcastingAbility?: string;
  casterType?: "third";
  source: string;
}

export interface ClassResourceTemplate {
  name: string;
  levelAvailable: number;
  resetType: "short" | "long";
  uses: number | { abilityMod: string; minimum?: number };
  usesTable?: Record<number, number>;
}

// ─── Feats ────────────────────────────────────────────────

export interface FeatData {
  name: string;
  category: "origin" | "general" | "fighting-style" | "epic-boon";
  prerequisite?: string;
  repeatable: boolean;
  description: string;
  activationType?: string;
  abilityScoreIncrease?: string[];
  advantages?: { type: "advantage" | "disadvantage"; subType: string; restriction?: string }[];
  proficiencies?: { armor?: string[]; weapons?: string[]; tools?: string[] };
  resistances?: string[];
  speed?: number;
  senses?: Record<string, number>;
  source: string;
}

// ─── Spells ───────────────────────────────────────────────

export interface SpellData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels?: string;
  classes: string[];
  damage?: { dice: string; type: string };
  source: string;
}

// ─── Species ──────────────────────────────────────────────

export interface SpeciesData {
  name: string;
  size: string[];
  speed: number;
  darkvision?: number;
  traits: SpeciesTraitData[];
  resistances?: string[];
  advantages?: { type: "advantage" | "disadvantage"; subType: string; restriction?: string }[];
  languages?: string[];
  source: string;
}

export interface SpeciesTraitData {
  name: string;
  description: string;
  activationType?: string;
}

// ─── Backgrounds ──────────────────────────────────────────

export interface BackgroundData {
  name: string;
  description: string;
  skillProficiencies: string[];
  toolProficiency?: string;
  feat: string;
  abilityScores: string[];
  equipment: string[];
  source: string;
}

// ─── Conditions ───────────────────────────────────────────

export interface ConditionData {
  name: string;
  description: string;
  effects?: {
    disadvantageOn?: string[];
    cantDo?: string[];
    autoFail?: string[];
    speed?: number;
  };
  source: string;
}

// ─── Equipment ────────────────────────────────────────────

export interface WeaponData {
  name: string;
  category: "simple" | "martial";
  type: "melee" | "ranged";
  damage: string;
  damageType: string;
  weight: number;
  cost: string;
  properties: string[];
  mastery?: string;
  range?: string;
}

export interface ArmorData {
  name: string;
  category: "light" | "medium" | "heavy" | "shield";
  ac: number;
  dexCap?: number;
  stealthDisadvantage: boolean;
  weight: number;
  cost: string;
  strengthReq?: number;
}

export interface GearData {
  name: string;
  cost: string;
  weight: number;
  description?: string;
}

export interface ToolData {
  name: string;
  cost: string;
  weight: number;
  description?: string;
}

export interface EquipmentDatabase {
  weapons: WeaponData[];
  armor: ArmorData[];
  gear: GearData[];
  tools: ToolData[];
}

// ─── Magic Items ──────────────────────────────────────────

export interface MagicItemData {
  name: string;
  type: string;
  rarity: string;
  attunement: boolean;
  attunementReq?: string;
  description: string;
  acBonus?: number;
  attackBonus?: number;
  damageBonus?: number;
  source: string;
}

// ─── Monsters ─────────────────────────────────────────────

export interface MonsterData {
  name: string;
  size: string;
  type: string;
  alignment?: string;
  ac: number;
  acType?: string;
  hp: number;
  hitDice: string;
  speed: Record<string, number>;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  savingThrows?: Record<string, number>;
  skills?: Record<string, number>;
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  conditionImmunities?: string[];
  senses: string[];
  languages: string[];
  cr: string;
  xp: number;
  traits?: { name: string; description: string }[];
  actions: { name: string; description: string }[];
  bonusActions?: { name: string; description: string }[];
  reactions?: { name: string; description: string }[];
  legendaryActions?: { name: string; description: string }[];
  lairActions?: { name: string; description: string }[];
  source: string;
}
