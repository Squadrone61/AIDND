import { useEffect, useMemo, useState } from "react";
import type { AbilityScores } from "@aidnd/shared/types";
import type { FeatData } from "@aidnd/shared/data";
import { getFeat } from "@aidnd/shared/data";
import type { StepProps, ASISelection } from "./types";
import { getSpellsByClass } from "@aidnd/shared/data";
import { getASILevels, getEligibleFeats, getFinalAbilities, getAbilityMod, getFeatAbilityChoices, ALL_SKILLS, formatSkillName } from "./utils";
import { ClassASIPicker } from "./ASIAbilityPicker";
import { Prose } from "../Prose";

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];

const ABILITY_ABBREV: Record<keyof AbilityScores, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};

export function StepFeats({ state, dispatch }: StepProps) {
  const asiLevels = useMemo(
    () => (state.className ? getASILevels(state.className, state.level) : []),
    [state.className, state.level]
  );

  const finalAbilities = useMemo(() => getFinalAbilities(state), [state]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-amber-200/90 tracking-wide" style={{ fontFamily: "var(--font-cinzel)" }}>
          Ability Score Improvements &amp; Feats
        </h2>
        <p className="text-xs text-gray-500">At certain class levels, you can increase your ability scores or take a feat.</p>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-gray-700/50 to-transparent mt-2" />
      </div>

      {asiLevels.map((level) => {
        const sel = state.asiSelections.find((s) => s.level === level);
        return (
          <ASICard
            key={level}
            level={level}
            selection={sel ?? null}
            allSelections={state.asiSelections}
            currentScores={finalAbilities}
            characterLevel={state.level}
            onChange={(selection) =>
              dispatch({ type: "SET_ASI_SELECTION", level, selection })
            }
          />
        );
      })}

      {/* Final Ability Score Preview */}
      <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-4">
        <div className="text-xs text-amber-200/70 font-medium mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
          Final Ability Scores (with all ASI/feat bonuses)
        </div>
        <div className="grid grid-cols-6 gap-3">
          {ABILITY_KEYS.map((ability) => {
            const score = finalAbilities[ability];
            const mod = getAbilityMod(score);
            return (
              <div
                key={ability}
                className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-2 text-center"
              >
                <div className="text-[10px] text-gray-500 uppercase">
                  {ABILITY_ABBREV[ability]}
                </div>
                <div className="text-lg font-bold text-gray-100">{score}</div>
                <div className="text-xs text-gray-400">
                  {mod >= 0 ? "+" : ""}{mod}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ASICard({
  level,
  selection,
  allSelections,
  currentScores,
  characterLevel,
  onChange,
}: {
  level: number;
  selection: ASISelection | null;
  allSelections: ASISelection[];
  currentScores: AbilityScores;
  characterLevel: number;
  onChange: (selection: ASISelection) => void;
}) {
  const type = selection?.type ?? "asi";

  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
            Level {level}
          </span>
          <span className="text-xs text-gray-400">
            Ability Score Improvement
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() =>
              onChange({ level, type: "asi", asiChoice: { mode: "two", abilities: {} } })
            }
            className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
              type === "asi"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                : "text-gray-500 border border-gray-700 hover:text-gray-300"
            }`}
          >
            Ability Score
          </button>
          <button
            onClick={() => onChange({ level, type: "feat" })}
            className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
              type === "feat"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                : "text-gray-500 border border-gray-700 hover:text-gray-300"
            }`}
          >
            Feat
          </button>
        </div>
      </div>

      {/* Content */}
      {type === "asi" ? (
        <ASIContent
          level={level}
          selection={selection}
          currentScores={currentScores}
          onChange={onChange}
        />
      ) : (
        <FeatContent
          level={level}
          selection={selection}
          allSelections={allSelections}
          characterLevel={characterLevel}
          currentScores={currentScores}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function ASIContent({
  level,
  selection,
  currentScores,
  onChange,
}: {
  level: number;
  selection: ASISelection | null;
  currentScores: AbilityScores;
  onChange: (selection: ASISelection) => void;
}) {
  const mode = selection?.asiChoice?.mode ?? "two";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() =>
            onChange({ level, type: "asi", asiChoice: { mode: "two", abilities: {} } })
          }
          className={`text-[10px] px-2 py-1 rounded ${
            mode === "two"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              : "text-gray-500 border border-gray-700"
          }`}
        >
          +2 to one
        </button>
        <button
          onClick={() =>
            onChange({ level, type: "asi", asiChoice: { mode: "one-one", abilities: {} } })
          }
          className={`text-[10px] px-2 py-1 rounded ${
            mode === "one-one"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              : "text-gray-500 border border-gray-700"
          }`}
        >
          +1 to two
        </button>
      </div>

      <ClassASIPicker
        mode={mode}
        assignments={selection?.asiChoice?.abilities ?? {}}
        onChange={(abilities) =>
          onChange({ level, type: "asi", asiChoice: { mode, abilities } })
        }
        currentScores={currentScores}
      />
    </div>
  );
}

function FeatContent({
  level,
  selection,
  allSelections,
  characterLevel,
  currentScores,
  onChange,
}: {
  level: number;
  selection: ASISelection | null;
  allSelections: ASISelection[];
  characterLevel: number;
  currentScores: AbilityScores;
  onChange: (selection: ASISelection) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "general" | "epic-boon">("all");

  // Feats already taken at other ASI levels (non-repeatable can't be picked again)
  const takenAtOtherLevels = useMemo(() => {
    const names = new Set<string>();
    for (const sel of allSelections) {
      if (sel.type === "feat" && sel.featName && sel.level !== level) {
        names.add(sel.featName.toLowerCase());
      }
    }
    return names;
  }, [allSelections, level]);

  const eligibleFeats = useMemo(
    () => getEligibleFeats(characterLevel),
    [characterLevel]
  );

  const filtered = useMemo(() => {
    let list = eligibleFeats;
    // Filter out non-repeatable feats already taken at other levels
    list = list.filter(
      (f) => f.repeatable || !takenAtOtherLevels.has(f.name.toLowerCase())
    );
    if (category !== "all") {
      list = list.filter((f) => f.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [eligibleFeats, category, search]);

  const selectedFeat = selection?.featName
    ? getFeat(selection.featName)
    : null;

  return (
    <div className="space-y-3">
      {/* Search + Filter */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search feats..."
          className="flex-1 bg-gray-900/60 border border-gray-700/60 rounded px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
        <div className="flex gap-1">
          {(["all", "general", "epic-boon"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-[10px] px-2 py-1 rounded whitespace-nowrap ${
                category === cat
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-gray-500 border border-gray-700"
              }`}
            >
              {cat === "all" ? "All" : cat === "general" ? "General" : "Epic Boon"}
            </button>
          ))}
        </div>
      </div>

      {/* Feat List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {filtered.map((feat) => (
          <FeatCard
            key={feat.name}
            feat={feat}
            isSelected={selection?.featName === feat.name}
            onSelect={() =>
              onChange({
                level,
                type: "feat",
                featName: feat.name,
                featAbilityChoice: selection?.featName === feat.name
                  ? selection?.featAbilityChoice
                  : undefined,
              })
            }
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-xs text-gray-600 py-4 text-center">
            No feats match your search.
          </div>
        )}
      </div>

      {/* Selected Feat Detail */}
      {selectedFeat && (
        <SelectedFeatDetail
          feat={selectedFeat}
          selection={selection!}
          level={level}
          currentScores={currentScores}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function FeatCard({
  feat,
  isSelected,
  onSelect,
}: {
  feat: FeatData;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const abilityChoices = getFeatAbilityChoices(feat);

  return (
    <button
      onClick={onSelect}
      className={`text-left p-2.5 rounded-lg border transition-colors ${
        isSelected
          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
          : "border-gray-700/50 bg-gray-900/60 text-gray-300 hover:border-gray-600"
      }`}
    >
      <div className="text-xs font-medium truncate">{feat.name}</div>
      {feat.prerequisite && (
        <div className="text-[10px] text-amber-500/80 mt-0.5 truncate">
          {feat.prerequisite}
        </div>
      )}
      <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
        {abilityChoices.length > 0 && (
          <span className="text-emerald-500">
            +1 {abilityChoices.map((a) => ABILITY_ABBREV[a]).join("/")}
            {" · "}
          </span>
        )}
        {feat.description.slice(0, 100)}...
      </div>
    </button>
  );
}

function SelectedFeatDetail({
  feat,
  selection,
  level,
  currentScores,
  onChange,
}: {
  feat: FeatData;
  selection: ASISelection;
  level: number;
  currentScores: AbilityScores;
  onChange: (selection: ASISelection) => void;
}) {
  const abilityChoices = getFeatAbilityChoices(feat);
  const needsAbilityChoice = abilityChoices.length > 1;

  return (
    <div className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-amber-300/90" style={{ fontFamily: "var(--font-cinzel)" }}>{feat.name}</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 capitalize">
          {feat.category.replace("-", " ")}
        </span>
      </div>

      {feat.prerequisite && (
        <div className="text-[10px] text-amber-500/80">
          Prerequisite: {feat.prerequisite}
        </div>
      )}

      <div className="line-clamp-6">
        <Prose className="text-xs text-gray-400">{feat.description}</Prose>
      </div>

      {/* Ability Score Choice */}
      {abilityChoices.length > 0 && (
        <div className="pt-1 border-t border-gray-800">
          <div className="text-[10px] text-gray-500 font-medium mb-1.5">
            {needsAbilityChoice
              ? "Choose +1 ability score:"
              : `+1 ${ABILITY_ABBREV[abilityChoices[0]]}`}
          </div>
          {needsAbilityChoice ? (
            <div className="flex gap-1.5 flex-wrap">
              {abilityChoices.map((key) => {
                const isChosen = selection.featAbilityChoice === key;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      onChange({
                        ...selection,
                        featAbilityChoice: isChosen ? undefined : key,
                      })
                    }
                    className={`text-[10px] px-2 py-1 rounded transition-colors ${
                      isChosen
                        ? "bg-amber-500/80 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {ABILITY_ABBREV[key]}
                    {currentScores[key] !== undefined && (
                      <span className="ml-1 text-gray-500">({currentScores[key]})</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            // Auto-select single ability
            <AutoSelectAbility
              ability={abilityChoices[0]}
              selection={selection}
              onChange={onChange}
            />
          )}
        </div>
      )}

      {/* Proficiency grants */}
      {feat.proficiencies && (
        <div className="text-[10px] text-gray-500">
          {feat.proficiencies.armor && (
            <span>Armor: {feat.proficiencies.armor.join(", ")} · </span>
          )}
          {feat.proficiencies.weapons && (
            <span>Weapons: {feat.proficiencies.weapons.join(", ")} · </span>
          )}
          {feat.proficiencies.tools && (
            <span>Tools: {feat.proficiencies.tools.join(", ")}</span>
          )}
        </div>
      )}

      {/* Speed bonus */}
      {feat.speed && (
        <div className="text-[10px] text-emerald-500">
          +{feat.speed} ft. speed
        </div>
      )}

      {/* Sub-choices for specific feats */}
      <FeatSubChoices feat={feat} selection={selection} level={level} onChange={onChange} />
    </div>
  );
}

// ─── Feat Sub-Choices ────────────────────────────────────

const MI_CLASSES = ["Cleric", "Druid", "Wizard"];

function FeatSubChoices({
  feat,
  selection,
  level,
  onChange,
}: {
  feat: FeatData;
  selection: ASISelection;
  level: number;
  onChange: (selection: ASISelection) => void;
}) {
  const lc = feat.name.toLowerCase();
  const subChoices = selection.featSubChoices ?? {};

  const updateSubChoices = (key: string, value: string[]) => {
    onChange({
      ...selection,
      featSubChoices: { ...subChoices, [key]: value },
    });
  };

  // Skilled: pick 3 skills
  if (lc === "skilled") {
    const selected = subChoices["skills"] ?? [];
    return (
      <div className="pt-1 border-t border-gray-800 space-y-1">
        <div className="text-[10px] text-gray-500 font-medium">
          Choose 3 skill proficiencies ({selected.length}/3)
        </div>
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {ALL_SKILLS.map((skill) => {
            const isSelected = selected.includes(skill);
            return (
              <button
                key={skill}
                onClick={() =>
                  updateSubChoices(
                    "skills",
                    isSelected
                      ? selected.filter((s) => s !== skill)
                      : selected.length < 3
                        ? [...selected, skill]
                        : selected
                  )
                }
                disabled={!isSelected && selected.length >= 3}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isSelected
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    : selected.length >= 3
                      ? "text-gray-700 border border-gray-800"
                      : "text-gray-400 border border-gray-700 hover:text-gray-200"
                }`}
              >
                {formatSkillName(skill)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Skill Expert: pick 1 skill proficiency
  if (lc === "skill expert") {
    const selected = subChoices["skills"] ?? [];
    return (
      <div className="pt-1 border-t border-gray-800 space-y-1">
        <div className="text-[10px] text-gray-500 font-medium">
          Choose 1 skill proficiency
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_SKILLS.map((skill) => {
            const isSelected = selected.includes(skill);
            return (
              <button
                key={skill}
                onClick={() =>
                  updateSubChoices("skills", isSelected ? [] : [skill])
                }
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isSelected
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    : "text-gray-400 border border-gray-700 hover:text-gray-200"
                }`}
              >
                {formatSkillName(skill)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Magic Initiate (general feat version): pick class + cantrips + spell
  if (lc.startsWith("magic initiate")) {
    const spellClass = subChoices["class"]?.[0] ?? "Cleric";
    const selectedCantrips = subChoices["cantrips"] ?? [];
    const selectedSpell = subChoices["spells"]?.[0] ?? "";

    const cantrips = getSpellsByClass(spellClass).filter((s) => s.level === 0);
    const level1Spells = getSpellsByClass(spellClass).filter((s) => s.level === 1);

    return (
      <div className="pt-1 border-t border-gray-800 space-y-2">
        <div className="text-[10px] text-gray-500 font-medium">Magic Initiate Choices</div>

        {/* Spell class */}
        <div className="flex gap-1">
          {MI_CLASSES.map((c) => (
            <button
              key={c}
              onClick={() =>
                onChange({
                  ...selection,
                  featSubChoices: { ...subChoices, class: [c], cantrips: [], spells: [] },
                })
              }
              className={`text-[10px] px-2 py-0.5 rounded ${
                spellClass === c
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-gray-500 border border-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 2 Cantrips */}
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Cantrips ({selectedCantrips.length}/2)</div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {cantrips.map((s) => {
              const isSel = selectedCantrips.includes(s.name);
              return (
                <button
                  key={s.name}
                  onClick={() =>
                    updateSubChoices(
                      "cantrips",
                      isSel
                        ? selectedCantrips.filter((n) => n !== s.name)
                        : selectedCantrips.length < 2
                          ? [...selectedCantrips, s.name]
                          : selectedCantrips
                    )
                  }
                  disabled={!isSel && selectedCantrips.length >= 2}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSel
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : selectedCantrips.length >= 2
                        ? "text-gray-700 border border-gray-800"
                        : "text-gray-400 border border-gray-700 hover:text-gray-200"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1 Level 1 Spell */}
        <div>
          <div className="text-[10px] text-gray-500 mb-1">
            Level 1 Spell {selectedSpell && `(${selectedSpell})`}
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {level1Spells.map((s) => {
              const isSel = selectedSpell === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() =>
                    updateSubChoices("spells", isSel ? [] : [s.name])
                  }
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSel
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "text-gray-400 border border-gray-700 hover:text-gray-200"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function AutoSelectAbility({
  ability,
  selection,
  onChange,
}: {
  ability: keyof AbilityScores;
  selection: ASISelection;
  onChange: (selection: ASISelection) => void;
}) {
  useEffect(() => {
    if (selection.featAbilityChoice !== ability) {
      onChange({ ...selection, featAbilityChoice: ability });
    }
  }, [ability, selection, onChange]);
  return null;
}
