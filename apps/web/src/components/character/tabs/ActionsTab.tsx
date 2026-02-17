import { useState, useMemo } from "react";
import type {
  CharacterData,
  CharacterSpell,
  InventoryItem,
} from "@aidnd/shared/types";
import { getSpellAvailability } from "@aidnd/shared/utils";
import { FilterChipBar } from "../FilterChipBar";

type ActionCategory =
  | "all"
  | "attack"
  | "action"
  | "bonus"
  | "reaction"
  | "other";

interface ActionEntry {
  name: string;
  category: ActionCategory;
  sourceType: "weapon" | "spell";
  detail: string; // compact inline detail
  spell?: CharacterSpell;
  item?: InventoryItem;
}

interface ActionsTabProps {
  character: CharacterData;
  onSpellClick: (spell: CharacterSpell) => void;
  onItemClick: (item: InventoryItem) => void;
}

// Standard D&D combat actions — always shown as a reference
const STANDARD_ACTIONS = [
  { name: "Attack", detail: "Melee or ranged attack" },
  { name: "Cast a Spell", detail: "Use an action spell" },
  { name: "Dash", detail: "Double movement speed" },
  { name: "Disengage", detail: "No opportunity attacks" },
  { name: "Dodge", detail: "Attacks have disadvantage" },
  { name: "Help", detail: "Give ally advantage" },
  { name: "Hide", detail: "Stealth check" },
  { name: "Ready", detail: "Prepare a reaction" },
  { name: "Search", detail: "Perception/Investigation" },
  { name: "Use an Object", detail: "Interact with object" },
];

const SOURCE_BADGE_STYLES: Record<string, string> = {
  weapon: "bg-red-900/40 text-red-400",
  spell: "bg-purple-900/40 text-purple-400",
};

function categorizeSpellAction(castingTime?: string): ActionCategory {
  if (!castingTime) return "other";
  const ct = castingTime.toLowerCase();
  if (ct.includes("bonus action")) return "bonus";
  if (ct.includes("reaction")) return "reaction";
  if (ct.includes("1 action") || ct === "action") return "action";
  return "other";
}

export function ActionsTab({
  character,
  onSpellClick,
  onItemClick,
}: ActionsTabProps) {
  const [filter, setFilter] = useState<string>("all");
  const s = character.static;
  const d = character.dynamic;

  const actions = useMemo(() => {
    const entries: ActionEntry[] = [];

    // ── Weapon attacks from equipped items with damage ──
    for (const item of d.inventory) {
      if (item.equipped && item.damage) {
        const parts: string[] = [];
        if (item.range) parts.push(item.range);
        if (item.attackBonus != null) {
          parts.push(`${item.attackBonus >= 0 ? "+" : ""}${item.attackBonus}`);
        }
        parts.push(
          [item.damage, item.damageType].filter(Boolean).join(" ")
        );
        entries.push({
          name: item.name,
          category: "attack",
          sourceType: "weapon",
          detail: parts.join(" · "),
          item,
        });
      }
    }

    // ── Attack cantrips (level 0 spells that are active) ──
    for (const spell of s.spells) {
      if (spell.level !== 0) continue;
      if (getSpellAvailability(spell) !== "active") continue;
      const desc = (spell.description || "").toLowerCase();
      const isAttackCantrip =
        desc.includes("spell attack") ||
        desc.includes("damage") ||
        desc.includes("saving throw");
      if (isAttackCantrip) {
        const parts: string[] = [];
        if (spell.range) parts.push(spell.range);
        parts.push("Cantrip");
        entries.push({
          name: spell.name,
          category: "attack",
          sourceType: "spell",
          detail: parts.join(" · "),
          spell,
        });
      }
    }

    // ── Available leveled spells categorized by casting time ──
    for (const spell of s.spells) {
      if (spell.level === 0) continue;
      if (getSpellAvailability(spell) !== "active") continue;
      const cat = categorizeSpellAction(spell.castingTime);
      const parts: string[] = [];
      if (spell.range && spell.range !== "Self") parts.push(spell.range);
      parts.push(`Lvl ${spell.level}`);
      entries.push({
        name: spell.name,
        category: cat,
        sourceType: "spell",
        detail: parts.join(" · "),
        spell,
      });
    }

    // ── Non-attack cantrips (utility cantrips like Light, Mending) ──
    for (const spell of s.spells) {
      if (spell.level !== 0) continue;
      if (getSpellAvailability(spell) !== "active") continue;
      const desc = (spell.description || "").toLowerCase();
      const isAttackCantrip =
        desc.includes("spell attack") ||
        desc.includes("damage") ||
        desc.includes("saving throw");
      if (!isAttackCantrip) {
        const cat = categorizeSpellAction(spell.castingTime);
        entries.push({
          name: spell.name,
          category: cat,
          sourceType: "spell",
          detail: "Cantrip",
          spell,
        });
      }
    }

    return entries;
  }, [s.spells, d.inventory]);

  const counts = useMemo(() => {
    const result: Record<ActionCategory, number> = {
      all: actions.length,
      attack: 0,
      action: 0,
      bonus: 0,
      reaction: 0,
      other: 0,
    };
    for (const a of actions) {
      result[a.category]++;
    }
    return result;
  }, [actions]);

  const filtered =
    filter === "all"
      ? actions
      : actions.filter((a) => a.category === filter);

  const chips = [
    { id: "all", label: "ALL", count: counts.all },
    ...(counts.attack > 0
      ? [{ id: "attack", label: "ATTACK", count: counts.attack }]
      : []),
    ...(counts.action > 0
      ? [{ id: "action", label: "ACTION", count: counts.action }]
      : []),
    ...(counts.bonus > 0
      ? [{ id: "bonus", label: "BONUS", count: counts.bonus }]
      : []),
    ...(counts.reaction > 0
      ? [{ id: "reaction", label: "REACTION", count: counts.reaction }]
      : []),
    ...(counts.other > 0
      ? [{ id: "other", label: "OTHER", count: counts.other }]
      : []),
  ];

  return (
    <div className="space-y-2">
      <FilterChipBar
        chips={chips}
        activeChipId={filter}
        onSelect={setFilter}
      />

      {filtered.length === 0 && (
        <div className="text-xs text-gray-600 text-center py-4">
          No actions available
        </div>
      )}

      {/* Action entries */}
      <div className="space-y-0.5">
        {filtered.map((action, i) => (
          <div
            key={`${action.name}-${i}`}
            className="flex items-center gap-1.5 text-xs px-1.5 py-1 rounded cursor-pointer hover:bg-gray-700/30 transition-colors group"
            onClick={() => {
              if (action.spell) onSpellClick(action.spell);
              else if (action.item) onItemClick(action.item);
            }}
          >
            {/* Source type badge */}
            <span
              className={`shrink-0 text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${
                SOURCE_BADGE_STYLES[action.sourceType]
              }`}
            >
              {action.sourceType === "weapon" ? "WPN" : "SPL"}
            </span>

            {/* Name */}
            <span className="text-gray-200 group-hover:text-purple-300 transition-colors truncate flex-1">
              {action.name}
            </span>

            {/* Inline detail */}
            <span className="text-gray-500 shrink-0 text-[10px]">
              {action.detail}
            </span>
          </div>
        ))}
      </div>

      {/* Standard combat actions (reference) */}
      {(filter === "all" || filter === "action") && (
        <div className="border-t border-gray-700/50 pt-2 mt-2">
          <div className="text-[10px] text-gray-500 font-medium mb-0.5 px-1.5">
            Standard Actions
          </div>
          <div className="space-y-0.5">
            {STANDARD_ACTIONS.map((sa) => (
              <div
                key={sa.name}
                className="flex items-center gap-1.5 text-xs px-1.5 py-0.5 text-gray-600"
              >
                <span className="truncate flex-1">{sa.name}</span>
                <span className="text-[10px] shrink-0">{sa.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
