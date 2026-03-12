import { useMemo, useState, useEffect } from "react";
import { getSpellsByClass, getSpell } from "@aidnd/shared/data";
import type { SpellData } from "@aidnd/shared/data";
import type { StepProps } from "./types";
import { Prose } from "../Prose";
import {
  getCantripsKnown,
  getSpellsKnownOrPrepared,
  getMaxSpellLevel,
  getAbilityMod,
  getFinalAbilities,
  isCasterClass,
  getAlwaysPreparedSpells,
  RITUAL_CASTER_CLASSES,
} from "./utils";
import { getClass } from "@aidnd/shared/data";

export function StepSpells({ state, dispatch }: StepProps) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [ritualOnly, setRitualOnly] = useState(false);
  const [cantripsExpanded, setCantripsExpanded] = useState(true);

  const className = state.className ?? "";
  const cls = getClass(className);
  const finalAbilities = useMemo(() => getFinalAbilities(state), [state]);

  const castingAbility = cls?.spellcastingAbility?.toLowerCase() as
    | keyof typeof finalAbilities
    | undefined;
  const abilityMod = castingAbility
    ? getAbilityMod(finalAbilities[castingAbility])
    : 0;

  const maxCantrips = getCantripsKnown(className, state.level);
  const maxSpellLevel = getMaxSpellLevel(className, state.level);
  const spellInfo = getSpellsKnownOrPrepared(
    className,
    state.level,
    abilityMod
  );

  // Always-prepared spells from subclass
  const alwaysPrepared = useMemo(
    () => getAlwaysPreparedSpells(state.subclass, state.level),
    [state.subclass, state.level]
  );
  const alwaysPreparedSet = useMemo(
    () => new Set(alwaysPrepared.map((s) => s.toLowerCase())),
    [alwaysPrepared]
  );

  // Auto-collapse cantrips when selection is complete
  useEffect(() => {
    if (state.selectedCantrips.length >= maxCantrips && maxCantrips > 0) {
      setCantripsExpanded(false);
    }
  }, [state.selectedCantrips.length, maxCantrips]);

  // Ritual caster check
  const isRitualCaster = RITUAL_CASTER_CLASSES.has(className.toLowerCase());
  const isWizard = className.toLowerCase() === "wizard";

  // Get class spell list
  const classSpells = useMemo(() => {
    if (!className) return [];
    return getSpellsByClass(className);
  }, [className]);

  // Filter spells
  const cantrips = useMemo(
    () => classSpells.filter((s) => s.level === 0),
    [classSpells]
  );

  const leveled = useMemo(() => {
    return classSpells.filter(
      (s) => s.level > 0 && s.level <= maxSpellLevel
    );
  }, [classSpells, maxSpellLevel]);

  const filteredCantrips = useMemo(() => {
    let list = cantrips;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.school.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cantrips, search]);

  const filteredLeveled = useMemo(() => {
    let list = leveled;
    if (levelFilter !== null) {
      list = list.filter((s) => s.level === levelFilter);
    }
    if (ritualOnly) {
      list = list.filter((s) => s.ritual);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.school.toLowerCase().includes(q)
      );
    }
    return list;
  }, [leveled, levelFilter, ritualOnly, search]);

  if (!isCasterClass(className)) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-lg mb-2">No Spellcasting</div>
        <p className="text-xs">
          {className || "This class"} does not have spellcasting. You can skip
          this step.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-200 mb-1">Spells</h2>
        <p className="text-xs text-gray-500">
          Select your cantrips and {spellInfo.type === "known" ? "known" : "prepared"} spells.
          {castingAbility && (
            <span className="ml-1 text-purple-400">
              Casting: {castingAbility.charAt(0).toUpperCase() + castingAbility.slice(1)} (
              {abilityMod >= 0 ? "+" : ""}
              {abilityMod})
            </span>
          )}
        </p>
        {isRitualCaster && (
          <p className="text-[10px] text-gray-600 mt-0.5">
            {isWizard
              ? "As a Wizard, you can ritual cast any spell in your spellbook with the Ritual tag without preparing it."
              : "You can ritual cast prepared spells with the Ritual tag without expending a spell slot."}
          </p>
        )}
      </div>

      <div className="flex gap-6">
        {/* Left: Spell Browser */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spells..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />

          {/* Cantrips (collapsible) */}
          <div>
            <button
              onClick={() => setCantripsExpanded(!cantripsExpanded)}
              className="flex items-center justify-between w-full mb-2"
            >
              <div className="flex items-center gap-1.5">
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${cantripsExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-medium text-gray-300">Cantrips</span>
                <span className="text-[10px] text-gray-500">
                  {state.selectedCantrips.length}/{maxCantrips}
                </span>
              </div>
              {!cantripsExpanded && state.selectedCantrips.length > 0 && (
                <span className="text-[10px] text-purple-400/70 truncate max-w-[60%] text-right">
                  {state.selectedCantrips.join(", ")}
                </span>
              )}
            </button>
            {cantripsExpanded && (
              <div className="space-y-1">
                {filteredCantrips.map((spell) => (
                  <SpellRow
                    key={spell.name}
                    spell={spell}
                    selected={state.selectedCantrips.includes(spell.name)}
                    disabled={
                      !state.selectedCantrips.includes(spell.name) &&
                      state.selectedCantrips.length >= maxCantrips
                    }
                    locked={false}
                    expanded={expandedSpell === spell.name}
                    isRitualCaster={isRitualCaster}
                    onToggle={() =>
                      dispatch({ type: "TOGGLE_CANTRIP", spell: spell.name })
                    }
                    onExpand={() =>
                      setExpandedSpell(
                        expandedSpell === spell.name ? null : spell.name
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Level Filter */}
          {maxSpellLevel > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-300">
                    Spells
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setLevelFilter(null)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        levelFilter === null
                          ? "bg-purple-600/20 text-purple-400"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      All
                    </button>
                    {Array.from({ length: maxSpellLevel }, (_, i) => i + 1).map(
                      (l) => (
                        <button
                          key={l}
                          onClick={() => setLevelFilter(l)}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            levelFilter === l
                              ? "bg-purple-600/20 text-purple-400"
                              : "text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {l}
                        </button>
                      )
                    )}
                    {isRitualCaster && (
                      <button
                        onClick={() => setRitualOnly(!ritualOnly)}
                        className={`text-[10px] px-1.5 py-0.5 rounded ml-1 ${
                          ritualOnly
                            ? "bg-cyan-600/20 text-cyan-400"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        Ritual
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-gray-500">
                  {state.selectedSpells.length}/{spellInfo.count}{" "}
                  {spellInfo.type}
                </div>
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredLeveled.map((spell) => {
                  const isAlwaysPrepared = alwaysPreparedSet.has(spell.name.toLowerCase());
                  return (
                    <SpellRow
                      key={spell.name}
                      spell={spell}
                      selected={state.selectedSpells.includes(spell.name) || isAlwaysPrepared}
                      disabled={
                        isAlwaysPrepared ||
                        (!state.selectedSpells.includes(spell.name) &&
                          state.selectedSpells.length >= spellInfo.count)
                      }
                      locked={isAlwaysPrepared}
                      expanded={expandedSpell === spell.name}
                      isRitualCaster={isRitualCaster}
                      onToggle={() => {
                        if (!isAlwaysPrepared) {
                          dispatch({ type: "TOGGLE_SPELL", spell: spell.name });
                        }
                      }}
                      onExpand={() =>
                        setExpandedSpell(
                          expandedSpell === spell.name ? null : spell.name
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Selected Spells sidebar */}
        <SelectedSpellsSidebar
          state={state}
          alwaysPrepared={alwaysPrepared}
        />
      </div>
    </div>
  );
}

function SpellRow({
  spell,
  selected,
  disabled,
  locked,
  expanded,
  isRitualCaster,
  onToggle,
  onExpand,
}: {
  spell: SpellData;
  selected: boolean;
  disabled: boolean;
  locked: boolean;
  expanded: boolean;
  isRitualCaster: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <div
      className={`border rounded-lg transition-colors ${
        locked
          ? "border-amber-500/20 bg-amber-600/5"
          : selected
            ? "border-purple-500/30 bg-purple-600/5"
            : "border-gray-700 bg-gray-800"
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {locked ? (
          <div className="w-4 h-4 rounded border border-amber-600 bg-amber-600/30 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
              selected
                ? "border-purple-500 bg-purple-600"
                : disabled
                  ? "border-gray-700 bg-gray-900 opacity-30"
                  : "border-gray-600 bg-gray-900 hover:border-gray-500"
            }`}
          >
            {selected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-200">{spell.name}</span>
          <span className="text-[10px] text-gray-500 ml-2">
            {spell.school}
            {spell.concentration && " C"}
          </span>
          {/* Ritual badge */}
          {spell.ritual && (
            <span className={`text-[9px] ml-1.5 px-1 py-px rounded ${
              isRitualCaster
                ? "bg-cyan-900/30 text-cyan-400 border border-cyan-800/30"
                : "text-gray-600"
            }`}>
              R
            </span>
          )}
          {/* Always prepared badge */}
          {locked && (
            <span className="text-[9px] ml-1.5 text-amber-500">always</span>
          )}
        </div>

        <span className="text-[10px] text-gray-600 shrink-0">
          {spell.level === 0 ? "Cantrip" : `Lv.${spell.level}`}
        </span>

        <button
          onClick={onExpand}
          className="text-gray-600 hover:text-gray-400 shrink-0"
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2 border-t border-gray-700/50 pt-1.5 space-y-1">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
            <span>{spell.castingTime}</span>
            <span>{spell.range}</span>
            <span>{spell.duration}</span>
            <span>{spell.components}</span>
          </div>
          <div className="line-clamp-6">
            <Prose className="text-xs text-gray-400">{spell.description}</Prose>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedSpellsSidebar({
  state,
  alwaysPrepared,
}: {
  state: StepProps["state"];
  alwaysPrepared: string[];
}) {
  const hasSpells =
    alwaysPrepared.length > 0 ||
    state.selectedCantrips.length > 0 ||
    state.selectedSpells.length > 0;

  if (!hasSpells) {
    return (
      <div className="w-56 shrink-0 bg-gray-800 border border-gray-700 rounded-lg p-4 self-start">
        <div className="text-xs text-gray-500 text-center">
          No spells selected
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3 self-start max-h-[600px] overflow-y-auto">
      <div className="text-xs font-medium text-gray-300">Selected Spells</div>

      {/* Always-Prepared Spells */}
      {alwaysPrepared.length > 0 && (
        <div>
          <div className="text-[10px] text-amber-500/80 uppercase tracking-wider mb-1">
            Always Prepared
          </div>
          {alwaysPrepared.map((name) => {
            const spell = getSpell(name);
            return (
              <div key={name} className="text-[10px] text-amber-300/70 py-0.5">
                {name}
                {spell && (
                  <span className="text-gray-600 ml-1">Lv.{spell.level}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.selectedCantrips.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Cantrips
          </div>
          {state.selectedCantrips.map((name) => {
            const spell = getSpell(name);
            return (
              <div key={name} className="text-[10px] text-gray-300 py-0.5">
                {name}
                {spell && (
                  <span className="text-gray-600 ml-1">{spell.school}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.selectedSpells.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Spells
          </div>
          {state.selectedSpells.map((name) => {
            const spell = getSpell(name);
            return (
              <div key={name} className="text-[10px] text-gray-300 py-0.5">
                {name}
                {spell && (
                  <span className="text-gray-600 ml-1">
                    Lv.{spell.level} {spell.school}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
