import { useState, useMemo } from "react";
import type { CharacterData, CharacterSpell } from "@aidnd/shared/types";
import { getSpellAvailability } from "@aidnd/shared/utils";
import type { SpellAvailability } from "@aidnd/shared/utils";
import { FilterChipBar } from "../FilterChipBar";

interface SpellsTabProps {
  character: CharacterData;
  onSpellClick: (spell: CharacterSpell) => void;
}

const AVAILABILITY_STYLES: Record<SpellAvailability, { dot: string; text: string }> = {
  active: { dot: "bg-green-500", text: "text-gray-200" },
  "ritual-only": { dot: "bg-blue-500", text: "text-blue-300/80" },
  known: { dot: "bg-gray-600 ring-1 ring-gray-500", text: "text-gray-500" },
};

function SpellRow({
  spell,
  onClick,
}: {
  spell: CharacterSpell;
  onClick: () => void;
}) {
  const availability = getSpellAvailability(spell);
  const styles = AVAILABILITY_STYLES[availability];

  return (
    <div
      className={`text-xs flex items-center gap-1.5 cursor-pointer hover:text-purple-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-700/30 ${styles.text}`}
      onClick={onClick}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
      />
      <span className="truncate flex-1">{spell.name}</span>

      {/* Source badges */}
      {spell.alwaysPrepared && spell.spellSource === "class" && (
        <span className="text-[8px] text-purple-400/70 shrink-0">Always</span>
      )}
      {spell.spellSource === "race" && (
        <span className="text-[8px] text-emerald-400/70 shrink-0">Race</span>
      )}
      {spell.spellSource === "feat" && (
        <span className="text-[8px] text-amber-400/70 shrink-0">Feat</span>
      )}
      {spell.spellSource === "item" && (
        <span className="text-[8px] text-cyan-400/70 shrink-0">Item</span>
      )}

      {/* Concentration & Ritual badges */}
      {spell.concentration && (
        <span className="text-[9px] text-yellow-500 font-semibold shrink-0">
          C
        </span>
      )}
      {spell.ritual && (
        <span className="text-[9px] text-blue-400 font-semibold shrink-0">
          R
        </span>
      )}
    </div>
  );
}

export function SpellsTab({ character, onSpellClick }: SpellsTabProps) {
  const [filter, setFilter] = useState<string>("all");
  const s = character.static;
  const d = character.dynamic;

  // Sort: active first, then ritual-only, then known; within each group alphabetical
  const spellSort = (a: CharacterSpell, b: CharacterSpell) => {
    const order: Record<SpellAvailability, number> = {
      active: 0,
      "ritual-only": 1,
      known: 2,
    };
    const aOrder = order[getSpellAvailability(a)];
    const bOrder = order[getSpellAvailability(b)];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  };

  // Determine which spell levels exist
  const spellLevels = useMemo(() => {
    const levels = new Set(s.spells.map((sp) => sp.level));
    return Array.from(levels).sort((a, b) => a - b);
  }, [s.spells]);

  const chips = useMemo(() => {
    const result = [
      { id: "all", label: "ALL", count: s.spells.length },
    ];
    for (const lvl of spellLevels) {
      const count = s.spells.filter((sp) => sp.level === lvl).length;
      result.push({
        id: String(lvl),
        label: lvl === 0 ? "CANTRIP" : String(lvl),
        count,
      });
    }
    return result;
  }, [s.spells, spellLevels]);

  const filteredLevels =
    filter === "all" ? spellLevels : [Number(filter)];

  return (
    <div className="space-y-2">
      <FilterChipBar chips={chips} activeChipId={filter} onSelect={setFilter} />

      {s.spells.length === 0 && (
        <div className="text-xs text-gray-600 text-center py-4">
          No spells known
        </div>
      )}

      <div className="space-y-2">
        {filteredLevels.map((lvl) => {
          const spellsAtLevel = s.spells
            .filter((sp) => sp.level === lvl)
            .sort(spellSort);
          if (spellsAtLevel.length === 0) return null;

          const slotData = d.spellSlotsUsed.find((sl) => sl.level === lvl);

          return (
            <div key={lvl}>
              <div className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1.5 px-1.5">
                <span className="font-medium">
                  {lvl === 0 ? "Cantrips" : `Level ${lvl}`}
                </span>
                {slotData && slotData.total > 0 && (
                  <span className="text-purple-400/80">
                    {slotData.total - slotData.used}/{slotData.total} slots
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {spellsAtLevel.map((sp) => (
                  <SpellRow
                    key={sp.name}
                    spell={sp}
                    onClick={() => onSpellClick(sp)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
