/**
 * Supplementary D&D data lookup service using dnd-data package.
 * Used as a fallback when SRD 5.2/5.1 don't have the requested content.
 * Covers 5,849 spells, 11,463 monsters, 15,749 items, 134 classes, 383 species, 405 backgrounds.
 */

interface DndDataEntry {
  name: string;
  description: string;
  properties: Record<string, string | number | undefined>;
  publisher: string;
  book: string;
}

interface ActionTrait {
  Name: string;
  Desc: string;
}

type SourceFilter = "2024" | "official" | "all";

/** Book priority for deduplication — lower = preferred */
const BOOK_PRIORITY: Record<string, number> = {
  "Player's Handbook (2024)": 1,
  "Free Basic Rules (2024)": 2,
  "Dungeon Master's Guide (2024)": 3,
  "Player's Handbook": 10,
  "Monster Manual": 11,
  "Dungeon Master's Guide": 12,
  "Free Basic Rules (2014)": 13,
  "Xanathar's Guide to Everything": 20,
  "Tasha's Cauldron of Everything": 21,
  "Fizban's Treasury of Dragons": 22,
  "Mordenkainen's Tome of Foes": 23,
  "Volo's Guide to Monsters": 24,
  "Sword Coast Adventurer's Guide": 25,
  "Mordenkainen Presents: Monsters of the Multiverse": 26,
  "Strixhaven: A Curriculum of Chaos": 27,
  "Bigby Presents: Glory of the Giants": 28,
  "The Book of Many Things": 29,
};

function getBookPriority(book: string): number {
  return BOOK_PRIORITY[book] ?? (isOfficialBook(book) ? 50 : 100);
}

function isOfficialBook(book: string): boolean {
  const pub = book.toLowerCase();
  // WotC official supplements, adventure modules, and core books
  return (
    pub.includes("handbook") ||
    pub.includes("monster manual") ||
    pub.includes("dungeon master") ||
    pub.includes("basic rules") ||
    pub.includes("xanathar") ||
    pub.includes("tasha") ||
    pub.includes("fizban") ||
    pub.includes("mordenkainen") ||
    pub.includes("volo") ||
    pub.includes("sword coast") ||
    pub.includes("strixhaven") ||
    pub.includes("bigby") ||
    pub.includes("many things") ||
    pub.includes("eberron") ||
    pub.includes("ravenloft") ||
    pub.includes("theros") ||
    pub.includes("ravnica") ||
    pub.includes("spelljammer") ||
    pub.includes("dragonlance") ||
    pub.includes("planescape") ||
    pub.includes("critical role") === false && // explicit exclude
    book.startsWith("Wizards of the Coast") === false && // publisher field
    (pub.includes("curse of strahd") ||
      pub.includes("tomb of annihilation") ||
      pub.includes("waterdeep") ||
      pub.includes("baldur's gate") ||
      pub.includes("rime of the frostmaiden") ||
      pub.includes("wild beyond the witchlight") ||
      pub.includes("phandelver") ||
      pub.includes("out of the abyss") ||
      pub.includes("storm king") ||
      pub.includes("elemental evil") ||
      pub.includes("acquisitions incorporated") ||
      pub.includes("explorer's guide"))
  ) || book in BOOK_PRIORITY;
}

function is2024Book(book: string): boolean {
  return book.includes("(2024)") || book.includes("2024");
}

function matchesSourceFilter(book: string, filter: SourceFilter): boolean {
  switch (filter) {
    case "2024":
      return is2024Book(book);
    case "official":
      return isOfficialBook(book);
    case "all":
      return true;
  }
}

/** Normalize a name for matching */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[-_/\\]/g, " ")
    .replace(/\s+/g, " ");
}

export class DndDataLookup {
  private spells: DndDataEntry[] = [];
  private monsters: DndDataEntry[] = [];
  private items: DndDataEntry[] = [];
  private classes: DndDataEntry[] = [];
  private species: DndDataEntry[] = [];
  private backgrounds: DndDataEntry[] = [];

  /** Name → best entry (deduplicated by source priority) */
  private spellIndex = new Map<string, DndDataEntry[]>();
  private monsterIndex = new Map<string, DndDataEntry[]>();
  private itemIndex = new Map<string, DndDataEntry[]>();
  private classIndex = new Map<string, DndDataEntry[]>();
  private speciesIndex = new Map<string, DndDataEntry[]>();
  private backgroundIndex = new Map<string, DndDataEntry[]>();

  async initialize(): Promise<void> {
    const start = Date.now();

    // Dynamic import — dnd-data exports all datasets from the main module
    const dndDataMod = await import("dnd-data");
    const dndDataAll = (dndDataMod.default ?? dndDataMod) as Record<string, DndDataEntry[]>;

    this.spells = dndDataAll.spells ?? [];
    this.monsters = dndDataAll.monsters ?? [];
    this.items = dndDataAll.items ?? [];
    this.classes = dndDataAll.classes ?? [];
    this.species = dndDataAll.species ?? [];
    this.backgrounds = dndDataAll.backgrounds ?? [];

    // Build indexes
    this.spellIndex = this.buildIndex(this.spells);
    this.monsterIndex = this.buildIndex(this.monsters);
    this.itemIndex = this.buildIndex(this.items);
    this.classIndex = this.buildIndex(this.classes);
    this.speciesIndex = this.buildIndex(this.species);
    this.backgroundIndex = this.buildIndex(this.backgrounds);

    const elapsed = Date.now() - start;
    console.error(
      `[dnd-data] Loaded ${this.spells.length} spells, ${this.monsters.length} monsters, ` +
        `${this.items.length} items, ${this.classes.length} classes, ${this.species.length} species, ` +
        `${this.backgrounds.length} backgrounds in ${elapsed}ms`
    );
  }

  // ── Lookups ───────────────────────────────────────────────────────

  lookupSpell(name: string, source: SourceFilter = "official"): string | null {
    const entry = this.findBest(this.spellIndex, name, source);
    if (!entry) return null;
    return this.formatSpell(entry);
  }

  lookupMonster(name: string, source: SourceFilter = "official"): string | null {
    const entry = this.findBest(this.monsterIndex, name, source);
    if (!entry) return null;
    return this.formatMonster(entry);
  }

  lookupItem(name: string, source: SourceFilter = "official"): string | null {
    const entry = this.findBest(this.itemIndex, name, source);
    if (!entry) return null;
    return this.formatItem(entry);
  }

  lookupClass(name: string, source: SourceFilter = "official"): string | null {
    const entry = this.findBest(this.classIndex, name, source);
    if (!entry) return null;
    return this.formatClass(entry);
  }

  lookupSpecies(name: string, source: SourceFilter = "official"): string | null {
    const entry = this.findBest(this.speciesIndex, name, source);
    if (!entry) return null;
    return this.formatSpecies(entry);
  }

  lookupBackground(name: string, source: SourceFilter = "official"): string | null {
    const entry = this.findBest(this.backgroundIndex, name, source);
    if (!entry) return null;
    return this.formatBackground(entry);
  }

  // ── Index & Search ────────────────────────────────────────────────

  private buildIndex(entries: DndDataEntry[]): Map<string, DndDataEntry[]> {
    const index = new Map<string, DndDataEntry[]>();
    for (const entry of entries) {
      const key = normalize(entry.name);
      const existing = index.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        index.set(key, [entry]);
      }
    }
    // Sort each group by book priority
    for (const [, group] of index) {
      group.sort((a, b) => getBookPriority(a.book) - getBookPriority(b.book));
    }
    return index;
  }

  private findBest(
    index: Map<string, DndDataEntry[]>,
    name: string,
    source: SourceFilter
  ): DndDataEntry | null {
    const key = normalize(name);

    // 1. Exact match
    const exact = index.get(key);
    if (exact) {
      const filtered = exact.filter((e) => matchesSourceFilter(e.book, source));
      if (filtered.length > 0) return filtered[0]!;
      // If source filter excluded all, try "all" as fallback for exact matches
      if (source !== "all" && exact.length > 0) return exact[0]!;
    }

    // 2. Fuzzy: find entries whose normalized name contains the query or vice versa
    const STOP_WORDS = new Set(["of", "the", "a", "an", "and", "or", "in", "on", "to", "for", "with", "by"]);
    const queryWords = key.split(" ").filter((w) => w.length > 0);
    const queryContent = queryWords.filter((w) => !STOP_WORDS.has(w));
    if (queryContent.length === 0) return null;

    let bestMatch: { entry: DndDataEntry; score: number } | null = null;

    for (const [entryKey, entries] of index) {
      // Substring containment
      if (entryKey.includes(key) || key.includes(entryKey)) {
        const score = Math.min(key.length, entryKey.length) / Math.max(key.length, entryKey.length);
        const candidate = entries.find((e) => matchesSourceFilter(e.book, source)) ?? entries[0]!;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { entry: candidate, score };
        }
        continue;
      }

      // Word overlap
      const entryWords = entryKey.split(" ").filter((w) => w.length > 0);
      const entryContent = entryWords.filter((w) => !STOP_WORDS.has(w));
      if (entryContent.length === 0) continue;

      const matchingEntry = entryContent.filter((ew) =>
        queryContent.some((qw) => ew === qw || ew.startsWith(qw) || qw.startsWith(ew))
      );
      const matchingQuery = queryContent.filter((qw) =>
        entryContent.some((ew) => ew === qw || ew.startsWith(qw) || qw.startsWith(ew))
      );

      const entryOverlap = matchingEntry.length / entryContent.length;
      const queryOverlap = matchingQuery.length / queryContent.length;

      if (entryOverlap >= 1.0 && queryOverlap >= 0.5) {
        const score = entryOverlap + queryOverlap;
        if (!bestMatch || score > bestMatch.score) {
          const candidate = entries.find((e) => matchesSourceFilter(e.book, source)) ?? entries[0]!;
          bestMatch = { entry: candidate, score };
        }
      }
    }

    return bestMatch?.entry ?? null;
  }

  // ── Formatters ────────────────────────────────────────────────────

  private formatSpell(entry: DndDataEntry): string {
    const p = entry.properties;
    const lines: string[] = [];

    lines.push(`# ${entry.name}`);
    lines.push(`*Source: ${entry.book}*\n`);

    const level = p["Level"];
    const school = p["School"];
    if (level !== undefined && school) {
      lines.push(level === 0 || level === "0" ? `*${school} cantrip*` : `*Level ${level} ${school}*`);
    }

    const addField = (label: string, key: string) => {
      const val = p[key];
      if (val !== undefined && val !== "") lines.push(`**${label}:** ${val}`);
    };

    addField("Casting Time", "Casting Time");
    addField("Range", "Range");
    if (!p["Range"] && p["data-RangeAoe"]) {
      lines.push(`**Range:** ${p["data-RangeAoe"]}`);
    }
    addField("Components", "Components");
    addField("Duration", "Duration");

    if (p["Concentration"] === "TRUE" || p["Concentration"] === "Yes") {
      lines.push("**Concentration:** Yes");
    }
    if (p["Ritual"] === "TRUE" || p["Ritual"] === "Yes") {
      lines.push("**Ritual:** Yes");
    }

    lines.push("");
    lines.push(this.cleanDescription(entry.description));

    if (p["Classes"]) {
      lines.push(`\n**Classes:** ${p["Classes"]}`);
    }

    return lines.join("\n");
  }

  private formatMonster(entry: DndDataEntry): string {
    const p = entry.properties;
    const lines: string[] = [];

    lines.push(`# ${entry.name}`);
    lines.push(`*Source: ${entry.book}*\n`);

    // Type line
    const size = p["Size"] ?? "";
    const type = p["Type"] ?? "";
    const alignment = p["Alignment"] ?? "";
    if (size || type) {
      lines.push(`*${size} ${type}${alignment ? `, ${alignment}` : ""}*\n`);
    }

    const addField = (label: string, key: string) => {
      const val = p[key];
      if (val !== undefined && val !== "") lines.push(`**${label}:** ${val}`);
    };

    addField("Armor Class", "AC");
    addField("Hit Points", "HP");
    if (p["Hit Dice"]) lines.push(`**Hit Dice:** ${p["Hit Dice"]}`);
    addField("Speed", "Speed");

    // Ability scores
    const abilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    const hasAbilities = abilities.some((a) => p[a] !== undefined);
    if (hasAbilities) {
      lines.push("");
      lines.push("| STR | DEX | CON | INT | WIS | CHA |");
      lines.push("|-----|-----|-----|-----|-----|-----|");
      const scores = abilities.map((a) => {
        const score = Number(p[a]) || 10;
        const mod = Math.floor((score - 10) / 2);
        const sign = mod >= 0 ? "+" : "";
        return `${score} (${sign}${mod})`;
      });
      lines.push(`| ${scores.join(" | ")} |`);
      lines.push("");
    }

    addField("Saving Throws", "Saving Throws");
    addField("Skills", "Skills");
    addField("Damage Resistances", "Resistances");
    addField("Damage Immunities", "Immunities");
    addField("Damage Vulnerabilities", "Vulnerabilities");
    addField("Condition Immunities", "Condition Immunities");
    addField("Senses", "Senses");
    addField("Languages", "Languages");
    addField("Challenge", "Challenge Rating");
    addField("Proficiency Bonus", "PB");

    // Traits
    this.appendActions(lines, p["data-Traits"] as string | undefined, "Traits");
    this.appendActions(lines, p["data-Actions"] as string | undefined, "Actions");
    this.appendActions(lines, p["data-Bonus Actions"] as string | undefined, "Bonus Actions");
    this.appendActions(lines, p["data-Reactions"] as string | undefined, "Reactions");
    this.appendActions(lines, p["data-Legendary Actions"] as string | undefined, "Legendary Actions");

    return lines.join("\n");
  }

  private appendActions(
    lines: string[],
    jsonStr: string | undefined,
    heading: string
  ): void {
    if (!jsonStr) return;
    try {
      const actions: ActionTrait[] = JSON.parse(jsonStr);
      if (!Array.isArray(actions) || actions.length === 0) return;

      lines.push(`\n### ${heading}\n`);
      for (const action of actions) {
        lines.push(`***${action.Name}.*** ${action.Desc}\n`);
      }
    } catch {
      // If not valid JSON, just include the raw text
      lines.push(`\n### ${heading}\n`);
      lines.push(jsonStr);
    }
  }

  private formatItem(entry: DndDataEntry): string {
    const p = entry.properties;
    const lines: string[] = [];

    lines.push(`# ${entry.name}`);
    lines.push(`*Source: ${entry.book}*\n`);

    const addField = (label: string, key: string) => {
      const val = p[key];
      if (val !== undefined && val !== "") lines.push(`**${label}:** ${val}`);
    };

    addField("Type", "Item Type");
    addField("Rarity", "Item Rarity");
    addField("Attunement", "Requires Attunement");
    addField("Properties", "Properties");
    addField("Damage", "Damage");
    addField("Damage Type", "Damage Type");
    addField("Range", "Range");
    addField("AC", "AC");
    addField("Weight", "Weight");

    lines.push("");
    lines.push(this.cleanDescription(entry.description));

    return lines.join("\n");
  }

  private formatClass(entry: DndDataEntry): string {
    const p = entry.properties;
    const lines: string[] = [];

    lines.push(`# ${entry.name}`);
    lines.push(`*Source: ${entry.book}*\n`);

    const addField = (label: string, key: string) => {
      const val = p[key];
      if (val !== undefined && val !== "") lines.push(`**${label}:** ${val}`);
    };

    addField("Hit Die", "Hit Die");
    addField("Caster Progression", "Caster Progression");
    addField("Spellcasting Ability", "Spellcasting Ability");
    addField("Starting Gold", "Starting Gold");

    lines.push("");
    lines.push(this.cleanDescription(entry.description));

    return lines.join("\n");
  }

  private formatSpecies(entry: DndDataEntry): string {
    const p = entry.properties;
    const lines: string[] = [];

    lines.push(`# ${entry.name}`);
    lines.push(`*Source: ${entry.book}*\n`);

    const addField = (label: string, key: string) => {
      const val = p[key];
      if (val !== undefined && val !== "") lines.push(`**${label}:** ${val}`);
    };

    addField("Size", "Size");
    addField("Speed", "Speed");

    // Parse ability score increases if present
    const asiStr = p["data-Ability Score Increase"] as string | undefined;
    if (asiStr) {
      try {
        const asi = JSON.parse(asiStr);
        if (typeof asi === "object" && asi !== null) {
          const parts = Object.entries(asi)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k} +${v}`);
          if (parts.length > 0) {
            lines.push(`**Ability Score Increase:** ${parts.join(", ")}`);
          }
        }
      } catch {
        lines.push(`**Ability Score Increase:** ${asiStr}`);
      }
    }

    lines.push("");
    lines.push(this.cleanDescription(entry.description));

    return lines.join("\n");
  }

  private formatBackground(entry: DndDataEntry): string {
    const p = entry.properties;
    const lines: string[] = [];

    lines.push(`# ${entry.name}`);
    lines.push(`*Source: ${entry.book}*\n`);

    if (p["data-Starting Gold"]) {
      lines.push(`**Starting Gold:** ${p["data-Starting Gold"]} gp`);
    }

    lines.push("");
    lines.push(this.cleanDescription(entry.description));

    // Personality traits, ideals, bonds, flaws
    this.appendJsonList(lines, p["data-Personality Traits"] as string | undefined, "Personality Traits");
    this.appendJsonList(lines, p["data-Ideals"] as string | undefined, "Ideals");
    this.appendJsonList(lines, p["data-Bonds"] as string | undefined, "Bonds");
    this.appendJsonList(lines, p["data-Flaws"] as string | undefined, "Flaws");

    return lines.join("\n");
  }

  private appendJsonList(
    lines: string[],
    jsonStr: string | undefined,
    heading: string
  ): void {
    if (!jsonStr) return;
    try {
      const items: string[] = JSON.parse(jsonStr);
      if (!Array.isArray(items) || items.length === 0) return;
      lines.push(`\n### ${heading}\n`);
      for (let i = 0; i < items.length; i++) {
        lines.push(`${i + 1}. ${items[i]}`);
      }
    } catch {
      // ignore parse errors
    }
  }

  private cleanDescription(desc: string): string {
    return (
      desc
        // Fix common Roll20 formatting artifacts
        .replace(/\bRang e:/g, "Range:")
        .replace(/\bDamag e:/g, "Damage:")
        // Remove token image URLs
        .replace(/https?:\/\/[^\s)]+\.(png|jpg|jpeg|gif|webp)[^\s)]*/gi, "")
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }
}
