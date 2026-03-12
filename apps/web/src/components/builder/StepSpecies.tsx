import { useMemo, useState } from "react";
import { getSpecies, featsArray } from "@aidnd/shared/data";
import { Prose } from "../Prose";
import type { SpeciesData, FeatData } from "@aidnd/shared/data";
import type { StepProps, TraitChoiceDefinition } from "./types";
import {
  getFilteredSpecies,
  getSpeciesTraitChoices,
  formatSkillName,
  ALL_SKILLS,
} from "./utils";

export function StepSpecies({ state, dispatch }: StepProps) {
  const allSpecies = useMemo(() => getFilteredSpecies(), []);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return allSpecies;
    const q = search.toLowerCase();
    return allSpecies.filter((s) => s.name.toLowerCase().includes(q));
  }, [allSpecies, search]);

  const selected = state.species ? getSpecies(state.species) : null;
  const traitChoices = state.species
    ? getSpeciesTraitChoices(state.species)
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-200 mb-1">Choose Your Species</h2>
        <p className="text-xs text-gray-500">
          Your species determines traits, speed, and special abilities.
        </p>
      </div>

      {/* Character name (optional early entry) */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Character Name (optional)</label>
        <input
          type="text"
          value={state.nameFromSpeciesStep}
          onChange={(e) => dispatch({ type: "SET_NAME_EARLY", name: e.target.value })}
          placeholder="Enter a name..."
          className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      <div className="flex gap-6">
        {/* Left: Grid */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search species..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3"
          />
          <div className="max-h-[420px] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filtered.map((sp) => (
                <button
                  key={sp.name}
                  onClick={() => dispatch({ type: "SET_SPECIES", species: sp.name })}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    state.species === sp.name
                      ? "border-purple-500 bg-purple-600/10 text-purple-300"
                      : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-750"
                  }`}
                >
                  <div className="font-medium truncate">{sp.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {sp.size.join("/")} &middot; {sp.speed} ft.
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selected && (
          <div className="w-80 shrink-0">
            <SpeciesDetail species={selected} />
          </div>
        )}
      </div>

      {/* Trait Choices — prominent section below the grid */}
      {selected && traitChoices.length > 0 && (
        <div className="bg-gray-800 border-l-4 border-purple-500 border-y border-r border-gray-700 rounded-lg p-4 space-y-3">
          <div className="text-xs font-medium text-purple-300">
            Trait Choices for {selected.name}
          </div>
          {traitChoices.map((def) => (
            <TraitChoicePicker
              key={def.traitName}
              definition={def}
              value={state.speciesChoices[def.traitName]}
              dispatch={dispatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Trait Choice Picker ─────────────────────────────────

function TraitChoicePicker({
  definition,
  value,
  dispatch,
}: {
  definition: TraitChoiceDefinition;
  value?: { selected: string | string[]; secondarySelected?: string };
  dispatch: StepProps["dispatch"];
}) {
  const { traitName, choiceType } = definition;

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-gray-200">{traitName}</div>

      {choiceType === "skill" && (
        <SkillPicker
          traitName={traitName}
          options={definition.options ?? ALL_SKILLS}
          count={1}
          value={value?.selected ? [typeof value.selected === "string" ? value.selected : value.selected[0]] : []}
          dispatch={dispatch}
        />
      )}

      {choiceType === "skills" && (
        <SkillPicker
          traitName={traitName}
          options={definition.options ?? ALL_SKILLS}
          count={definition.count ?? 2}
          value={Array.isArray(value?.selected) ? value.selected : []}
          dispatch={dispatch}
        />
      )}

      {choiceType === "feat" && (
        <FeatPicker
          traitName={traitName}
          category={definition.featCategory!}
          value={typeof value?.selected === "string" ? value.selected : ""}
          dispatch={dispatch}
        />
      )}

      {(choiceType === "lineage" || choiceType === "ancestry") && (
        <LineagePicker
          traitName={traitName}
          options={definition.lineageOptions ?? []}
          value={typeof value?.selected === "string" ? value.selected : ""}
          dispatch={dispatch}
        />
      )}

      {definition.secondaryChoice && (
        <div className="mt-1.5">
          <div className="text-[10px] text-gray-500 mb-1">Spellcasting Ability</div>
          <div className="flex gap-1.5">
            {definition.secondaryChoice.options.map((opt) => (
              <button
                key={opt}
                onClick={() =>
                  dispatch({
                    type: "SET_SPECIES_SECONDARY_CHOICE",
                    traitName,
                    selected: opt,
                  })
                }
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  value?.secondarySelected === opt
                    ? "border-purple-500 bg-purple-600/10 text-purple-300"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                }`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skill Picker ────────────────────────────────────────

function SkillPicker({
  traitName,
  options,
  count,
  value,
  dispatch,
}: {
  traitName: string;
  options: string[];
  count: number;
  value: string[];
  dispatch: StepProps["dispatch"];
}) {
  const toggle = (skill: string) => {
    const has = value.includes(skill);
    let newVal: string | string[];
    if (has) {
      newVal = count === 1 ? "" : value.filter((s) => s !== skill);
    } else {
      if (value.length >= count) return;
      newVal = count === 1 ? skill : [...value, skill];
    }
    dispatch({ type: "SET_SPECIES_CHOICE", traitName, selected: newVal });
  };

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((skill) => {
        const isSelected = value.includes(skill);
        const atMax = value.length >= count && !isSelected;
        return (
          <button
            key={skill}
            onClick={() => toggle(skill)}
            disabled={atMax}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              isSelected
                ? "border-emerald-500 bg-emerald-600/10 text-emerald-300"
                : atMax
                  ? "border-gray-700 bg-gray-900 text-gray-600 opacity-40"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
            }`}
          >
            {formatSkillName(skill)}
          </button>
        );
      })}
      <div className="text-[10px] text-gray-600 self-center ml-1">
        {value.length}/{count}
      </div>
    </div>
  );
}

// ─── Feat Picker ─────────────────────────────────────────

/** Extract bold sub-benefit names from feat description like "**Initiative Proficiency.**" */
function parseFeatBenefits(description: string): string[] {
  const matches = description.match(/\*\*([^*]+?)\.?\*\*/g);
  if (!matches) return [];
  return matches
    .map((m) => m.replace(/\*\*/g, "").replace(/\.$/, ""))
    .filter((b) => !b.toLowerCase().startsWith("you gain"));
}

function FeatPicker({
  traitName,
  category,
  value,
  dispatch,
}: {
  traitName: string;
  category: string;
  value: string;
  dispatch: StepProps["dispatch"];
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const originFeats = useMemo(
    () => featsArray.filter((f: FeatData) => f.category === category),
    [category]
  );

  const filtered = useMemo(() => {
    if (!search) return originFeats;
    const q = search.toLowerCase();
    return originFeats.filter((f) => f.name.toLowerCase().includes(q));
  }, [originFeats, search]);

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search feats..."
        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.map((feat) => {
          const isSelected = value === feat.name;
          const isExpanded = expanded === feat.name;
          const benefits = parseFeatBenefits(feat.description);
          return (
            <div
              key={feat.name}
              className={`rounded-lg border transition-colors ${
                isSelected
                  ? "border-purple-500/30 bg-purple-600/10"
                  : "border-gray-700 bg-gray-900 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <button
                  onClick={() =>
                    dispatch({ type: "SET_SPECIES_CHOICE", traitName, selected: feat.name })
                  }
                  className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                    isSelected
                      ? "border-purple-500 bg-purple-600"
                      : "border-gray-600 bg-gray-900 hover:border-gray-500"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() =>
                    dispatch({ type: "SET_SPECIES_CHOICE", traitName, selected: feat.name })
                  }
                  className="flex-1 min-w-0 text-left"
                >
                  <span className={`text-xs font-medium ${isSelected ? "text-purple-300" : "text-gray-200"}`}>
                    {feat.name}
                  </span>
                  {benefits.length > 0 && (
                    <span className="text-[10px] text-gray-500 ml-1.5">
                      {benefits.join(", ")}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setExpanded(isExpanded ? null : feat.name)}
                  className="text-gray-600 hover:text-gray-400 shrink-0"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {isExpanded && (
                <div className="px-2.5 pb-2 border-t border-gray-700/50 pt-1.5">
                  <Prose className="text-xs text-gray-400">{feat.description}</Prose>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lineage/Ancestry Picker ─────────────────────────────

function LineagePicker({
  traitName,
  options,
  value,
  dispatch,
}: {
  traitName: string;
  options: { name: string; description: string }[];
  value: string;
  dispatch: StepProps["dispatch"];
}) {
  return (
    <div className="space-y-1">
      {options.map((opt) => (
        <button
          key={opt.name}
          onClick={() =>
            dispatch({ type: "SET_SPECIES_CHOICE", traitName, selected: opt.name })
          }
          className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${
            value === opt.name
              ? "border-purple-500/30 bg-purple-600/10"
              : "border-gray-700 bg-gray-900 hover:border-gray-600"
          }`}
        >
          <div className={`font-medium ${value === opt.name ? "text-purple-300" : "text-gray-200"}`}>
            {opt.name}
          </div>
          <Prose className="text-gray-500 mt-0.5 text-xs">{opt.description}</Prose>
        </button>
      ))}
    </div>
  );
}

// ─── Species Detail Panel ────────────────────────────────

function SpeciesDetail({ species }: { species: SpeciesData }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold text-purple-400">{species.name}</h3>

      {/* Stat badges */}
      <div className="flex flex-wrap gap-1.5">
        <StatBadge label="Size" value={species.size.join("/")} />
        <StatBadge label="Speed" value={`${species.speed} ft.`} />
        {species.darkvision && (
          <StatBadge label="Darkvision" value={`${species.darkvision} ft.`} />
        )}
      </div>

      {/* Traits */}
      {species.traits.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            Traits
          </div>
          {species.traits.map((t) => (
            <div
              key={t.name}
              className="border-l-2 border-purple-500/40 pl-2.5"
            >
              <div className="text-xs font-medium text-gray-200">{t.name}</div>
              <Prose className="text-xs text-gray-400 mt-0.5 line-clamp-4">{t.description}</Prose>
            </div>
          ))}
        </div>
      )}

      {/* Resistances */}
      {species.resistances && species.resistances.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Resistances
          </div>
          <div className="flex flex-wrap gap-1">
            {species.resistances.map((r) => (
              <span
                key={r}
                className="text-[10px] bg-red-900/20 text-red-400 border border-red-800/30 rounded px-1.5 py-0.5"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Languages */}
      {species.languages && species.languages.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Languages
          </div>
          <div className="flex flex-wrap gap-1">
            {species.languages.map((l) => (
              <span
                key={l}
                className="text-[10px] bg-blue-900/20 text-blue-400 border border-blue-800/30 rounded px-1.5 py-0.5"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div className="text-[10px] text-gray-600">{species.source}</div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
      <div className="text-[9px] text-gray-500 uppercase">{label}</div>
      <div className="text-xs text-gray-200 font-medium">{value}</div>
    </div>
  );
}
