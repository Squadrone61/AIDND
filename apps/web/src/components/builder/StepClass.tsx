import { useMemo, useState } from "react";
import { classesArray, getClass, equipmentDb } from "@aidnd/shared/data";
import type { ClassData } from "@aidnd/shared/data";
import type { StepProps } from "./types";
import { Prose } from "../Prose";
import {
  deduplicateSubclasses,
  formatSkillName,
  getFeatureChoicesForClass,
  getFeatureChoiceCount,
  getWeaponMasteryConfig,
} from "./utils";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function StepClass({ state, dispatch }: StepProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return classesArray;
    const q = search.toLowerCase();
    return classesArray.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const selected = state.className ? getClass(state.className) : null;

  // Feature choices available at current level
  const featureChoiceDefs = useMemo(() => {
    if (!state.className) return [];
    return getFeatureChoicesForClass(state.className, state.level);
  }, [state.className, state.level]);

  // Weapon mastery config
  const masteryConfig = useMemo(() => {
    if (!state.className) return null;
    return getWeaponMasteryConfig(state.className, state.level);
  }, [state.className, state.level]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-amber-200/90 tracking-wide" style={{ fontFamily: "var(--font-cinzel)" }}>
          Choose Your Class
        </h2>
        <p className="text-xs text-gray-500">
          Your class determines your hit dice, proficiencies, features, and spellcasting ability.
        </p>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-gray-700/50 to-transparent mt-2" />
      </div>

      <div className="flex gap-6">
        {/* Left: Grid + Level */}
        <div className="flex-1 min-w-0 space-y-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes..."
            className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((cls) => (
              <button
                key={cls.name}
                onClick={() =>
                  dispatch({ type: "SET_CLASS", className: cls.name })
                }
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 ${
                  state.className === cls.name
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                    : "border-gray-700/50 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800"
                }`}
              >
                <div className="font-medium">{cls.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  d{cls.hitDice} &middot;{" "}
                  {cls.casterType
                    ? `${cls.casterType} caster`
                    : "non-caster"}
                </div>
              </button>
            ))}
          </div>

          {/* Level Picker */}
          {state.className && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400">Level</label>
              <select
                value={state.level}
                onChange={(e) =>
                  dispatch({ type: "SET_LEVEL", level: Number(e.target.value) })
                }
                className="bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

              {/* Subclass Picker */}
              {state.level >= 3 && selected && selected.subclasses.length > 0 && (
                <>
                  <label className="text-xs text-gray-400 ml-4">Subclass</label>
                  <select
                    value={state.subclass ?? ""}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_SUBCLASS",
                        subclass: e.target.value || null,
                      })
                    }
                    className="bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
                  >
                    <option value="">None</option>
                    {deduplicateSubclasses(selected.subclasses).map((sc) => (
                      <option key={sc.name} value={sc.name}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* Feature Choices */}
          {featureChoiceDefs.length > 0 && (
            <div className="space-y-3">
              {featureChoiceDefs.map((def) => {
                const maxCount = getFeatureChoiceCount(def, state.level);
                const selected = state.featureChoices[def.featureName] ?? [];
                return (
                  <FeatureChoicePicker
                    key={`${def.className}-${def.featureName}`}
                    featureName={def.featureName}
                    options={def.options}
                    maxCount={maxCount}
                    selected={selected}
                    onSelect={(val) =>
                      dispatch({ type: "SET_FEATURE_CHOICE", featureName: def.featureName, selected: val })
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Weapon Mastery */}
          {masteryConfig && (
            <WeaponMasteryPicker
              config={masteryConfig}
              selected={state.weaponMasteries}
              onSelect={(weapons) => dispatch({ type: "SET_WEAPON_MASTERIES", weapons })}
            />
          )}
        </div>

        {/* Right: Detail Panel */}
        {selected && (
          <ClassDetail
            cls={selected}
            level={state.level}
          />
        )}
      </div>

      {/* Features Reference — full-width collapsible below the main layout */}
      {selected && (
        <ClassFeaturesSection cls={selected} level={state.level} subclassName={state.subclass} />
      )}
    </div>
  );
}

// ─── Feature Choice Picker ───────────────────────────────

function FeatureChoicePicker({
  featureName,
  options,
  maxCount,
  selected,
  onSelect,
}: {
  featureName: string;
  options: { name: string; description: string }[];
  maxCount: number;
  selected: string[];
  onSelect: (val: string[]) => void;
}) {
  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onSelect(selected.filter((s) => s !== name));
    } else {
      if (selected.length >= maxCount) return;
      onSelect([...selected, name]);
    }
  };

  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-200">{featureName}</div>
        <div className="text-[10px] text-gray-500">
          {selected.length}/{maxCount}
        </div>
      </div>
      <div className="space-y-1">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.name);
          const atMax = selected.length >= maxCount && !isSelected;
          return (
            <button
              key={opt.name}
              onClick={() => toggle(opt.name)}
              disabled={atMax}
              className={`w-full text-left px-2.5 py-1.5 rounded border text-[10px] transition-colors ${
                isSelected
                  ? "border-amber-500/30 bg-amber-500/15"
                  : atMax
                    ? "border-gray-700/60 bg-gray-900 opacity-30"
                    : "border-gray-700/60 bg-gray-900 hover:border-gray-600"
              }`}
            >
              <div className={isSelected ? "text-amber-300 font-medium" : "text-gray-200"}>
                {opt.name}
              </div>
              <Prose className="text-gray-500 mt-0.5 text-xs">{opt.description}</Prose>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weapon Mastery Picker ───────────────────────────────

function WeaponMasteryPicker({
  config,
  selected,
  onSelect,
}: {
  config: { count: number; restriction?: "melee" };
  selected: string[];
  onSelect: (val: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const eligibleWeapons = useMemo(() => {
    let weapons = equipmentDb.weapons.filter((w) => !!w.mastery);
    if (config.restriction === "melee") {
      weapons = weapons.filter((w) => w.type === "melee");
    }
    if (search) {
      const q = search.toLowerCase();
      weapons = weapons.filter((w) => w.name.toLowerCase().includes(q));
    }
    return weapons;
  }, [config.restriction, search]);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onSelect(selected.filter((s) => s !== name));
    } else {
      if (selected.length >= config.count) return;
      onSelect([...selected, name]);
    }
  };

  // Parse mastery name from "Name|Source" format
  const parseMastery = (mastery: string) => mastery.split("|")[0];

  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-200">Weapon Mastery</div>
        <div className="text-[10px] text-gray-500">
          {selected.length}/{config.count}
        </div>
      </div>
      <p className="text-[10px] text-gray-500">
        Choose {config.count} weapon{config.count > 1 ? "s" : ""} to master
        {config.restriction === "melee" ? " (melee only)" : ""}.
      </p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search weapons..."
        className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-[10px] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
      />
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {eligibleWeapons.map((w) => {
          const isSelected = selected.includes(w.name);
          const atMax = selected.length >= config.count && !isSelected;
          return (
            <button
              key={w.name}
              onClick={() => toggle(w.name)}
              disabled={atMax}
              className={`w-full text-left flex items-center justify-between px-2 py-1 rounded text-[10px] transition-colors ${
                isSelected
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : atMax
                    ? "text-gray-600 opacity-40 border border-transparent"
                    : "text-gray-300 hover:bg-gray-700/50 border border-transparent"
              }`}
            >
              <span>{w.name}</span>
              {w.mastery && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                  isSelected
                    ? "bg-purple-900/30 text-purple-400"
                    : "bg-gray-700 text-gray-500"
                }`}>
                  {parseMastery(w.mastery)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Class Detail Panel ──────────────────────────────────

function ClassDetail({
  cls,
  level,
}: {
  cls: ClassData;
  level: number;
}) {
  return (
    <div className="w-72 shrink-0 bg-gray-800/60 border border-gray-700/40 rounded-lg p-4 space-y-3 self-start">
      <h3 className="text-sm font-bold text-amber-300/90" style={{ fontFamily: "var(--font-cinzel)" }}>{cls.name}</h3>

      {/* Core stats */}
      <div className="flex flex-wrap gap-1.5">
        <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
          <div className="text-[9px] text-gray-500 uppercase">Hit Dice</div>
          <div className="text-xs text-gray-200 font-medium">d{cls.hitDice}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
          <div className="text-[9px] text-gray-500 uppercase">Primary</div>
          <div className="text-xs text-gray-200 font-medium">{cls.primaryAbility}</div>
        </div>
        {cls.spellcastingAbility && (
          <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
            <div className="text-[9px] text-gray-500 uppercase">Casting</div>
            <div className="text-xs text-gray-200 font-medium capitalize">
              {cls.spellcastingAbility}
            </div>
          </div>
        )}
      </div>

      {/* Saving Throws */}
      <div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
          Saving Throws
        </div>
        <div className="text-xs text-gray-300">
          {cls.savingThrows.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
        </div>
      </div>

      {/* Armor Proficiencies */}
      {cls.armorProficiencies.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Armor
          </div>
          <div className="text-xs text-gray-300">
            {cls.armorProficiencies.join(", ")}
          </div>
        </div>
      )}

      {/* Weapon Proficiencies */}
      {cls.weaponProficiencies.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Weapons
          </div>
          <div className="text-xs text-gray-300">
            {cls.weaponProficiencies.join(", ")}
          </div>
        </div>
      )}

      {/* Skill Choices */}
      <div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
          Skill Choices ({cls.skillChoices.count})
        </div>
        <div className="flex flex-wrap gap-1">
          {cls.skillChoices.from.map((s) => (
            <span
              key={s}
              className="text-[10px] bg-purple-900/20 text-purple-400 border border-purple-800/30 rounded px-1.5 py-0.5"
            >
              {formatSkillName(s)}
            </span>
          ))}
        </div>
      </div>

      {/* Spell Slot Table */}
      {cls.spellSlotTable && cls.spellSlotTable.length > 0 && (
        <SpellSlotTable slots={cls.spellSlotTable} currentLevel={level} />
      )}

      <div className="text-[10px] text-gray-600">{cls.source}</div>
    </div>
  );
}

// ─── Class Features Section (full-width, collapsible) ────

function ClassFeaturesSection({
  cls,
  level,
  subclassName,
}: {
  cls: ClassData;
  level: number;
  subclassName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const classFeatures = cls.features.filter((f) => f.level <= level);

  const subclassData = useMemo(() => {
    if (!subclassName) return null;
    return cls.subclasses.find((sc) => sc.name === subclassName) ?? null;
  }, [cls, subclassName]);

  const subclassFeatures = subclassData?.features.filter((f) => f.level <= level) ?? [];
  const totalCount = classFeatures.length + subclassFeatures.length;

  if (totalCount === 0) return null;

  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-200">
            Class Features
          </span>
          <span className="text-[10px] text-gray-500">
            Level 1–{level} &middot; {totalCount} feature{totalCount !== 1 ? "s" : ""}
          </span>
        </div>
        {!open && (
          <div className="flex gap-1 flex-wrap justify-end max-w-[60%]">
            {classFeatures.slice(0, 6).map((f) => (
              <span key={`${f.name}-${f.level}`} className="text-[9px] bg-gray-900 text-gray-400 rounded px-1.5 py-0.5">
                {f.name}
              </span>
            ))}
            {totalCount > 6 && (
              <span className="text-[9px] text-gray-600">+{totalCount - 6}</span>
            )}
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {/* Class Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
            {classFeatures.map((f) => {
              const key = `${f.name}-${f.level}`;
              const isExpanded = expandedFeature === key;
              return (
                <div key={key}>
                  <button
                    onClick={() => setExpandedFeature(isExpanded ? null : key)}
                    className="w-full text-left text-[10px] flex items-center gap-1 py-0.5 hover:text-gray-200"
                  >
                    <svg
                      className={`w-2.5 h-2.5 text-gray-600 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-gray-300">{f.name}</span>
                    <span className="text-gray-600 ml-auto">Lv.{f.level}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-3.5 mb-1 line-clamp-8">
                      <Prose className="text-xs text-gray-500">{f.description}</Prose>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Subclass Features */}
          {subclassFeatures.length > 0 && subclassData && (
            <div>
              <div className="text-[10px] text-amber-400/80 font-medium uppercase tracking-wider mb-1 border-t border-gray-700 pt-2">
                {subclassData.name}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                {subclassFeatures.map((f, i) => {
                  const key = `sc-${f.name}-${f.level}-${i}`;
                  const isExpanded = expandedFeature === key;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => setExpandedFeature(isExpanded ? null : key)}
                        className="w-full text-left text-[10px] flex items-center gap-1 py-0.5 hover:text-gray-200"
                      >
                        <svg
                          className={`w-2.5 h-2.5 text-gray-600 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-amber-400/80">{f.name}</span>
                        <span className="text-gray-600 ml-auto">Lv.{f.level}</span>
                      </button>
                      {isExpanded && (
                        <div className="ml-3.5 mb-1 line-clamp-8">
                          <Prose className="text-xs text-gray-500">{f.description}</Prose>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Spell Slot Table ────────────────────────────────────

function SpellSlotTable({
  slots,
  currentLevel,
}: {
  slots: number[][];
  currentLevel: number;
}) {
  // Show a compact table: current level row + columns for spell levels 1-9
  const row = slots[Math.min(currentLevel, 20) - 1];
  if (!row || row.every((v) => v === 0)) return null;

  const maxCol = row.reduce((max, v, i) => (v > 0 ? i : max), -1);
  if (maxCol < 0) return null;

  return (
    <div>
      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
        Spell Slots (Level {currentLevel})
      </div>
      <div className="flex gap-1">
        {row.slice(0, maxCol + 1).map((count, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center"
          >
            <div className="text-[8px] text-gray-600">{ordinal(i + 1)}</div>
            <div className="text-[10px] text-gray-300 font-medium">{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
