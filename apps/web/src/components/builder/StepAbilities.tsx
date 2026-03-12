import { useMemo } from "react";
import type { AbilityScores } from "@aidnd/shared/types";
import { getBackground } from "@aidnd/shared/data";
import type { StepProps, AbilityMethod, ASIMode } from "./types";
import {
  STANDARD_ARRAY,
  POINT_BUY_POOL,
  getPointBuyCost,
  getAbilityMod,
  getFinalAbilities,
  parseBackgroundAbilityScores,
} from "./utils";
import { ASIAbilityPicker } from "./ASIAbilityPicker";

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

const ABILITY_SHORT: Record<keyof AbilityScores, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

const METHODS: { value: AbilityMethod; label: string }[] = [
  { value: "standard-array", label: "Standard Array" },
  { value: "point-buy", label: "Point Buy" },
  { value: "manual", label: "Manual" },
];

export function StepAbilities({ state, dispatch }: StepProps) {
  const pointsUsed = useMemo(
    () =>
      state.abilityMethod === "point-buy"
        ? getPointBuyCost(state.baseAbilities)
        : 0,
    [state.abilityMethod, state.baseAbilities]
  );

  const finalAbilities = useMemo(() => getFinalAbilities(state), [state]);

  const allowedAbilities = useMemo(() => {
    const bgData = state.background ? getBackground(state.background) : null;
    if (!bgData) return undefined;
    const abilities = bgData.abilityScores?.length
      ? bgData.abilityScores
      : parseBackgroundAbilityScores(bgData.description);
    return abilities.length > 0
      ? (abilities as (keyof AbilityScores)[])
      : undefined;
  }, [state.background]);

  // For standard array: track which values have been assigned
  const usedValues = useMemo(() => {
    if (state.abilityMethod !== "standard-array") return new Set<number>();
    return new Set(Object.values(state.baseAbilities).filter((v) => v > 0 && STANDARD_ARRAY.includes(v)));
  }, [state.abilityMethod, state.baseAbilities]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-amber-200/90 tracking-wide" style={{ fontFamily: "var(--font-cinzel)" }}>
          Ability Scores
        </h2>
        <p className="text-xs text-gray-500">Set your base ability scores, then apply your background ability score increases.</p>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-gray-700/50 to-transparent mt-2" />
      </div>

      {/* Method Tabs */}
      <div className="flex border-b border-gray-700">
        {METHODS.map((m) => (
          <button
            key={m.value}
            onClick={() =>
              dispatch({ type: "SET_ABILITY_METHOD", method: m.value })
            }
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              state.abilityMethod === m.value
                ? "text-amber-300 border-b-2 border-amber-400/70"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Point Buy info */}
      {state.abilityMethod === "point-buy" && (
        <div className="text-xs text-gray-400">
          Points: <span className={pointsUsed > POINT_BUY_POOL ? "text-red-400" : "text-amber-300"}>
            {pointsUsed}
          </span>{" "}
          / {POINT_BUY_POOL} used
        </div>
      )}

      {/* Ability Score Row */}
      <div className="grid grid-cols-6 gap-3">
        {ABILITY_KEYS.map((ability) => (
          <div
            key={ability}
            className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3 text-center"
          >
            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-2">
              {ABILITY_SHORT[ability]}
            </div>
            {state.abilityMethod === "standard-array" ? (
              <select
                value={state.baseAbilities[ability]}
                onChange={(e) =>
                  dispatch({
                    type: "SET_ABILITY",
                    ability,
                    value: Number(e.target.value),
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded px-1 py-1.5 text-center text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              >
                <option value={0}>--</option>
                {STANDARD_ARRAY.map((v) => (
                  <option
                    key={v}
                    value={v}
                    disabled={
                      usedValues.has(v) && state.baseAbilities[ability] !== v
                        ? countInArray(Object.values(state.baseAbilities), v) >= countInArray(STANDARD_ARRAY, v)
                        : false
                    }
                  >
                    {v}
                  </option>
                ))}
              </select>
            ) : state.abilityMethod === "point-buy" ? (
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() =>
                    dispatch({
                      type: "SET_ABILITY",
                      ability,
                      value: Math.max(8, state.baseAbilities[ability] - 1),
                    })
                  }
                  disabled={state.baseAbilities[ability] <= 8}
                  className="w-6 h-6 rounded bg-gray-900 text-gray-400 hover:bg-gray-700 disabled:opacity-30 text-xs"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm text-gray-100 font-medium">
                  {state.baseAbilities[ability]}
                </span>
                <button
                  onClick={() =>
                    dispatch({
                      type: "SET_ABILITY",
                      ability,
                      value: Math.min(15, state.baseAbilities[ability] + 1),
                    })
                  }
                  disabled={state.baseAbilities[ability] >= 15}
                  className="w-6 h-6 rounded bg-gray-900 text-gray-400 hover:bg-gray-700 disabled:opacity-30 text-xs"
                >
                  +
                </button>
              </div>
            ) : (
              <input
                type="number"
                min={1}
                max={20}
                value={state.baseAbilities[ability] || ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_ABILITY",
                    ability,
                    value: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded px-1 py-1.5 text-center text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            )}
            <div className="text-[10px] text-gray-600 mt-1">
              {state.baseAbilities[ability] > 0
                ? `Mod: ${getAbilityMod(state.baseAbilities[ability]) >= 0 ? "+" : ""}${getAbilityMod(state.baseAbilities[ability])}`
                : "\u00A0"}
            </div>
          </div>
        ))}
      </div>

      {/* Background ASI */}
      <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-200">
              Background Ability Score Increases
            </div>
            <div className="text-[10px] text-gray-500">
              PHB 2024: Choose +2/+1 to two different abilities, or +1/+1/+1 to
              three.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: "SET_ASI_MODE", mode: "two-one" })}
              className={`text-[10px] px-2 py-1 rounded ${
                state.asiMode === "two-one"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-gray-500 border border-gray-700"
              }`}
            >
              +2/+1
            </button>
            <button
              onClick={() =>
                dispatch({ type: "SET_ASI_MODE", mode: "three-ones" })
              }
              className={`text-[10px] px-2 py-1 rounded ${
                state.asiMode === "three-ones"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-gray-500 border border-gray-700"
              }`}
            >
              +1/+1/+1
            </button>
            {Object.keys(state.asiAssignments).length > 0 && (
              <button
                onClick={() => dispatch({ type: "CLEAR_ASI" })}
                className="text-[10px] text-gray-500 hover:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <ASIAbilityPickerWrapper
          mode={state.asiMode}
          assignments={state.asiAssignments}
          onChange={(a) => dispatch({ type: "HYDRATE", state: { asiAssignments: a } })}
          allowedAbilities={allowedAbilities}
        />
      </div>

      {/* Final Scores */}
      <div>
        <div className="text-xs text-amber-200/70 font-medium mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
          Final Ability Scores
        </div>
        <div className="grid grid-cols-6 gap-3">
          {ABILITY_KEYS.map((ability) => {
            const base = state.baseAbilities[ability];
            const asi = state.asiAssignments[ability] ?? 0;
            const final_ = finalAbilities[ability];
            const mod = getAbilityMod(final_);
            return (
              <div
                key={ability}
                className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-2 text-center"
              >
                <div className="text-[10px] text-gray-500 uppercase">
                  {ABILITY_SHORT[ability]}
                </div>
                <div className="text-lg font-bold text-gray-100">{final_ > 0 ? final_ : "—"}</div>
                {asi > 0 && base > 0 && (
                  <div className="text-[10px] text-amber-400">
                    {base}+{asi}
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  {final_ > 0 ? `${mod >= 0 ? "+" : ""}${mod}` : "\u00A0"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ASIAbilityPickerWrapper({
  mode,
  assignments,
  onChange,
  allowedAbilities,
}: {
  mode: ASIMode;
  assignments: Partial<Record<keyof AbilityScores, number>>;
  onChange: (a: Partial<Record<keyof AbilityScores, number>>) => void;
  allowedAbilities?: (keyof AbilityScores)[];
}) {
  return (
    <ASIAbilityPicker
      mode={mode === "two-one" ? "two-one" : "three-ones"}
      assignments={assignments}
      onChange={onChange}
      allowedAbilities={allowedAbilities}
    />
  );
}

function countInArray(arr: number[], val: number): number {
  return arr.filter((v) => v === val).length;
}
