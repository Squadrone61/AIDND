import { useMemo, useState } from "react";
import { backgroundsArray, getBackground, getFeat, getSpellsByClass } from "@aidnd/shared/data";
import type { BackgroundData } from "@aidnd/shared/data";
import type { StepProps } from "./types";
import { parseBackgroundFeat, parseBackgroundAbilityScores, formatSkillName, ALL_SKILLS } from "./utils";
import { Prose } from "../Prose";

export function StepBackground({ state, dispatch }: StepProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return backgroundsArray;
    const q = search.toLowerCase();
    return backgroundsArray.filter((b) => b.name.toLowerCase().includes(q));
  }, [search]);

  const selected = state.background ? getBackground(state.background) : null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2
          className="text-xl font-semibold text-amber-200/90 tracking-wide"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Choose Your Background
        </h2>
        <p className="text-xs text-gray-500">
          Your background provides skill proficiencies, a tool proficiency, an origin feat, and ability score increases.
        </p>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-gray-700/50 to-transparent mt-2" />
      </div>

      <div className="flex gap-6">
        {/* Left: Grid */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search backgrounds..."
            className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30 transition-colors mb-3"
          />
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filtered.map((bg) => (
                <button
                  key={bg.name}
                  onClick={() =>
                    dispatch({ type: "SET_BACKGROUND", background: bg.name })
                  }
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 ${
                    state.background === bg.name
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                      : "border-gray-700/50 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800"
                  }`}
                >
                  <div className="font-medium truncate">{bg.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {bg.skillProficiencies.map(formatSkillName).join(", ")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selected && <BackgroundDetail bg={selected} state={state} dispatch={dispatch} />}
      </div>
    </div>
  );
}

function BackgroundDetail({ bg, state, dispatch }: { bg: BackgroundData } & StepProps) {
  const featName = bg.feat ? parseBackgroundFeat(bg.feat) : null;
  const featData = featName ? getFeat(featName) : null;

  // Use explicit abilityScores if available, otherwise parse from description
  const abilityScores =
    bg.abilityScores && bg.abilityScores.length > 0
      ? bg.abilityScores
      : parseBackgroundAbilityScores(bg.description);

  return (
    <div className="w-72 shrink-0 bg-gray-800/60 border border-gray-700/40 rounded-lg p-4 space-y-3 self-start">
      <h3
        className="text-sm font-semibold text-amber-300/90"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        {bg.name}
      </h3>

      {/* Skill Proficiencies */}
      <div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
          Skill Proficiencies
        </div>
        <div className="flex flex-wrap gap-1">
          {bg.skillProficiencies.map((s) => (
            <span
              key={s}
              className="text-[10px] bg-purple-900/20 text-purple-400 border border-purple-800/30 rounded-md px-1.5 py-0.5"
            >
              {formatSkillName(s)}
            </span>
          ))}
        </div>
      </div>

      {/* Tool Proficiency */}
      {bg.toolProficiency && (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Tool Proficiency
          </div>
          <span className="text-[10px] bg-gray-900/60 text-gray-300 border border-gray-700/50 rounded-md px-1.5 py-0.5">
            {bg.toolProficiency}
          </span>
        </div>
      )}

      {/* Ability Scores */}
      {abilityScores.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Ability Score Increases
          </div>
          <div className="flex flex-wrap gap-1">
            {abilityScores.map((a) => (
              <span
                key={a}
                className="text-[10px] bg-blue-900/20 text-blue-400 border border-blue-800/30 rounded-md px-1.5 py-0.5 capitalize"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Feat */}
      {featName ? (
        <div>
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">
            Origin Feat
          </div>
          <div className="border-l-2 border-amber-500/30 pl-2.5">
            <div className="text-xs font-medium text-gray-200">{featName}</div>
            {featData && (
              <div className="line-clamp-4 mt-0.5">
                <Prose className="text-xs text-gray-400">{featData.description}</Prose>
              </div>
            )}
          </div>
          {/* Origin feat choices */}
          {featName.toLowerCase().startsWith("magic initiate") && (
            <MagicInitiateChoices
              featName={featName}
              state={state}
              dispatch={dispatch}
            />
          )}
          {featName.toLowerCase() === "skilled" && (
            <SkilledChoices state={state} dispatch={dispatch} />
          )}
        </div>
      ) : bg.feat === undefined || bg.feat === "" ? null : null}

      {/* Source */}
      <div className="text-[10px] text-gray-600">{bg.source}</div>
    </div>
  );
}

// ─── Magic Initiate Origin Feat Choices ──────────────────

const MI_CLASSES = ["Cleric", "Druid", "Wizard"];

function MagicInitiateChoices({
  featName,
  state,
  dispatch,
}: {
  featName: string;
} & StepProps) {
  const matchedClass = MI_CLASSES.find((c) =>
    featName.toLowerCase().includes(c.toLowerCase())
  );
  const overrides = state.originFeatOverrides;
  const spellClass = matchedClass ?? overrides.spellClass ?? "Druid";

  const cantrips = useMemo(
    () => getSpellsByClass(spellClass).filter((s) => s.level === 0),
    [spellClass]
  );
  const level1Spells = useMemo(
    () => getSpellsByClass(spellClass).filter((s) => s.level === 1),
    [spellClass]
  );

  const selectedCantrips = overrides.cantrips ?? [];
  const selectedSpell = overrides.spell ?? "";

  return (
    <div className="mt-2 space-y-2 border-t border-gray-700/50 pt-2">
      <div className="text-[10px] text-gray-500 font-medium">Magic Initiate Choices</div>

      {!matchedClass && (
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Spell List</div>
          <div className="flex gap-1">
            {MI_CLASSES.map((c) => (
              <button
                key={c}
                onClick={() =>
                  dispatch({
                    type: "SET_ORIGIN_FEAT_OVERRIDES",
                    overrides: { spellClass: c, cantrips: [], spell: "" },
                  })
                }
                className={`text-[10px] px-2.5 py-1 rounded-md transition-all duration-150 ${
                  spellClass === c
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    : "text-gray-500 border border-gray-700/60"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] text-gray-500 mb-1">Spellcasting Ability</div>
        <div className="flex gap-1">
          {["Intelligence", "Wisdom", "Charisma"].map((a) => (
            <button
              key={a}
              onClick={() =>
                dispatch({
                  type: "SET_ORIGIN_FEAT_OVERRIDES",
                  overrides: { abilityChoice: a },
                })
              }
              className={`text-[10px] px-2.5 py-1 rounded-md transition-all duration-150 ${
                (overrides.abilityChoice ?? "").toLowerCase() === a.toLowerCase()
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-gray-500 border border-gray-700/60"
              }`}
            >
              {a.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">
          Cantrips ({selectedCantrips.length}/2)
        </div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {cantrips.map((s) => {
            const isSelected = selectedCantrips.includes(s.name);
            return (
              <button
                key={s.name}
                onClick={() => {
                  const next = isSelected
                    ? selectedCantrips.filter((n) => n !== s.name)
                    : selectedCantrips.length < 2
                      ? [...selectedCantrips, s.name]
                      : selectedCantrips;
                  dispatch({
                    type: "SET_ORIGIN_FEAT_OVERRIDES",
                    overrides: { cantrips: next },
                  });
                }}
                disabled={!isSelected && selectedCantrips.length >= 2}
                className={`text-[10px] px-1.5 py-0.5 rounded-md transition-colors ${
                  isSelected
                    ? "bg-purple-600/15 text-purple-400 border border-purple-500/30"
                    : selectedCantrips.length >= 2
                      ? "text-gray-700 border border-gray-800"
                      : "text-gray-400 border border-gray-700/60 hover:text-gray-200"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-1">
          Level 1 Spell {selectedSpell ? `(${selectedSpell})` : "(pick one)"}
        </div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {level1Spells.map((s) => {
            const isSelected = selectedSpell === s.name;
            return (
              <button
                key={s.name}
                onClick={() =>
                  dispatch({
                    type: "SET_ORIGIN_FEAT_OVERRIDES",
                    overrides: { spell: isSelected ? "" : s.name },
                  })
                }
                className={`text-[10px] px-1.5 py-0.5 rounded-md transition-colors ${
                  isSelected
                    ? "bg-purple-600/15 text-purple-400 border border-purple-500/30"
                    : "text-gray-400 border border-gray-700/60 hover:text-gray-200"
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

// ─── Skilled Origin Feat Choices ─────────────────────────

function SkilledChoices({ state, dispatch }: StepProps) {
  const overrides = state.originFeatOverrides;
  const selectedSkills = overrides.skillChoices ?? [];

  return (
    <div className="mt-2 space-y-2 border-t border-gray-700/50 pt-2">
      <div className="text-[10px] text-gray-500 font-medium">
        Skilled: Choose 3 skill proficiencies ({selectedSkills.length}/3)
      </div>
      <div className="flex flex-wrap gap-1">
        {ALL_SKILLS.map((skill) => {
          const isSelected = selectedSkills.includes(skill);
          return (
            <button
              key={skill}
              onClick={() => {
                const next = isSelected
                  ? selectedSkills.filter((s) => s !== skill)
                  : selectedSkills.length < 3
                    ? [...selectedSkills, skill]
                    : selectedSkills;
                dispatch({
                  type: "SET_ORIGIN_FEAT_OVERRIDES",
                  overrides: { skillChoices: next },
                });
              }}
              disabled={!isSelected && selectedSkills.length >= 3}
              className={`text-[10px] px-1.5 py-0.5 rounded-md transition-colors ${
                isSelected
                  ? "bg-purple-600/15 text-purple-400 border border-purple-500/30"
                  : selectedSkills.length >= 3
                    ? "text-gray-700 border border-gray-800"
                    : "text-gray-400 border border-gray-700/60 hover:text-gray-200"
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
