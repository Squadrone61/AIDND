import type { AbilityScores } from "@aidnd/shared/types";
import type { BuilderState, BuilderAction } from "./types";
import { DEFAULT_ABILITIES, POINT_BUY_DEFAULT, STANDARD_ARRAY_DEFAULT, getASILevels } from "./utils";

export function createInitialState(editingId?: string | null): BuilderState {
  return {
    currentStep: "species",
    editingId: editingId ?? null,
    species: null,
    nameFromSpeciesStep: "",
    speciesChoices: {},
    background: null,
    className: null,
    level: 1,
    subclass: null,
    featureChoices: {},
    weaponMasteries: [],
    abilityMethod: "standard-array",
    baseAbilities: { ...STANDARD_ARRAY_DEFAULT },
    asiMode: "two-one",
    asiAssignments: {},
    asiSelections: [],
    originFeatOverrides: {},
    skillProficiencies: [],
    skillExpertise: [],
    selectedCantrips: [],
    selectedSpells: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    name: "",
    alignment: "",
    backstory: "",
    appearance: {},
    traits: {},
  };
}

export function builderReducer(
  state: BuilderState,
  action: BuilderAction
): BuilderState {
  switch (action.type) {
    // ─── Navigation ───────────────────────────
    case "SET_STEP":
      return { ...state, currentStep: action.step };

    case "HYDRATE":
      return { ...state, ...action.state };

    // ─── Species ──────────────────────────────
    case "SET_SPECIES":
      return {
        ...state,
        species: action.species,
        speciesChoices: {},
      };

    case "SET_NAME_EARLY":
      return { ...state, nameFromSpeciesStep: action.name };

    case "SET_SPECIES_CHOICE":
      return {
        ...state,
        speciesChoices: {
          ...state.speciesChoices,
          [action.traitName]: {
            ...state.speciesChoices[action.traitName],
            selected: action.selected,
          },
        },
      };

    case "SET_SPECIES_SECONDARY_CHOICE":
      return {
        ...state,
        speciesChoices: {
          ...state.speciesChoices,
          [action.traitName]: {
            ...state.speciesChoices[action.traitName],
            selected: state.speciesChoices[action.traitName]?.selected ?? "",
            secondarySelected: action.selected,
          },
        },
      };

    // ─── Background ───────────────────────────
    case "SET_BACKGROUND":
      return {
        ...state,
        background: action.background,
        skillProficiencies: [],
        originFeatOverrides: {},
      };

    // ─── Class ────────────────────────────────
    case "SET_CLASS":
      return {
        ...state,
        className: action.className,
        subclass: null,
        skillProficiencies: [],
        skillExpertise: [],
        selectedCantrips: [],
        selectedSpells: [],
        equipment: [],
        featureChoices: {},
        weaponMasteries: [],
        asiSelections: [],
      };

    case "SET_LEVEL": {
      const newState: BuilderState = {
        ...state,
        level: action.level,
      };
      if (action.level < 3) {
        newState.subclass = null;
      }
      newState.selectedCantrips = [];
      newState.selectedSpells = [];
      // Trim ASI selections to valid levels for new level
      if (state.className) {
        const validLevels = new Set(getASILevels(state.className, action.level));
        newState.asiSelections = state.asiSelections.filter(s => validLevels.has(s.level));
      }
      return newState;
    }

    case "SET_SUBCLASS":
      return { ...state, subclass: action.subclass };

    case "SET_FEATURE_CHOICE":
      return {
        ...state,
        featureChoices: {
          ...state.featureChoices,
          [action.featureName]: action.selected,
        },
      };

    case "SET_WEAPON_MASTERIES":
      return { ...state, weaponMasteries: action.weapons };

    // ─── Abilities ────────────────────────────
    case "SET_ABILITY_METHOD": {
      const defaults: Record<string, AbilityScores> = {
        "standard-array": { ...STANDARD_ARRAY_DEFAULT },
        "point-buy": { ...POINT_BUY_DEFAULT },
        manual: { ...DEFAULT_ABILITIES },
      };
      return {
        ...state,
        abilityMethod: action.method,
        baseAbilities: defaults[action.method],
        asiAssignments: {},
      };
    }

    case "SET_BASE_ABILITIES":
      return { ...state, baseAbilities: action.abilities };

    case "SET_ABILITY":
      return {
        ...state,
        baseAbilities: {
          ...state.baseAbilities,
          [action.ability]: action.value,
        },
      };

    case "SET_ASI_MODE":
      return { ...state, asiMode: action.mode, asiAssignments: {} };

    case "SET_ASI_ASSIGNMENT":
      return {
        ...state,
        asiAssignments: {
          ...state.asiAssignments,
          [action.ability]: action.value,
        },
      };

    case "CLEAR_ASI":
      return { ...state, asiAssignments: {} };

    // ─── Feats / ASI Selections ────────────────
    case "SET_ASI_SELECTION": {
      const existing = state.asiSelections.filter(s => s.level !== action.level);
      return {
        ...state,
        asiSelections: [...existing, action.selection].sort((a, b) => a.level - b.level),
      };
    }

    case "CLEAR_ASI_SELECTIONS":
      return { ...state, asiSelections: [] };

    case "SET_ORIGIN_FEAT_OVERRIDES":
      return {
        ...state,
        originFeatOverrides: { ...state.originFeatOverrides, ...action.overrides },
      };

    // ─── Skills ───────────────────────────────
    case "TOGGLE_SKILL": {
      const has = state.skillProficiencies.includes(action.skill);
      return {
        ...state,
        skillProficiencies: has
          ? state.skillProficiencies.filter((s) => s !== action.skill)
          : [...state.skillProficiencies, action.skill],
        skillExpertise: has
          ? state.skillExpertise.filter((s) => s !== action.skill)
          : state.skillExpertise,
      };
    }

    case "TOGGLE_EXPERTISE": {
      const has = state.skillExpertise.includes(action.skill);
      return {
        ...state,
        skillExpertise: has
          ? state.skillExpertise.filter((s) => s !== action.skill)
          : [...state.skillExpertise, action.skill],
      };
    }

    case "RESET_SKILLS":
      return { ...state, skillProficiencies: [], skillExpertise: [] };

    // ─── Spells ───────────────────────────────
    case "TOGGLE_CANTRIP": {
      const has = state.selectedCantrips.includes(action.spell);
      return {
        ...state,
        selectedCantrips: has
          ? state.selectedCantrips.filter((s) => s !== action.spell)
          : [...state.selectedCantrips, action.spell],
      };
    }

    case "TOGGLE_SPELL": {
      const has = state.selectedSpells.includes(action.spell);
      return {
        ...state,
        selectedSpells: has
          ? state.selectedSpells.filter((s) => s !== action.spell)
          : [...state.selectedSpells, action.spell],
      };
    }

    case "RESET_SPELLS":
      return { ...state, selectedCantrips: [], selectedSpells: [] };

    // ─── Equipment ────────────────────────────
    case "ADD_EQUIPMENT": {
      const existing = state.equipment.find(
        (e) => e.name === action.entry.name && e.source === action.entry.source
      );
      if (existing) {
        return {
          ...state,
          equipment: state.equipment.map((e) =>
            e.name === action.entry.name && e.source === action.entry.source
              ? { ...e, quantity: e.quantity + action.entry.quantity }
              : e
          ),
        };
      }
      return { ...state, equipment: [...state.equipment, action.entry] };
    }

    case "REMOVE_EQUIPMENT":
      return {
        ...state,
        equipment: state.equipment.filter((e) => e.name !== action.name),
      };

    case "SET_EQUIPMENT_QUANTITY":
      return {
        ...state,
        equipment: state.equipment.map((e) =>
          e.name === action.name ? { ...e, quantity: action.quantity } : e
        ),
      };

    case "TOGGLE_EQUIPPED":
      return {
        ...state,
        equipment: state.equipment.map((e) =>
          e.name === action.name ? { ...e, equipped: !e.equipped } : e
        ),
      };

    case "SET_CURRENCY":
      return { ...state, currency: action.currency };

    // ─── Details ──────────────────────────────
    case "SET_NAME":
      return { ...state, name: action.name };

    case "SET_ALIGNMENT":
      return { ...state, alignment: action.alignment };

    case "SET_BACKSTORY":
      return { ...state, backstory: action.backstory };

    case "SET_APPEARANCE":
      return { ...state, appearance: { ...state.appearance, ...action.appearance } };

    case "SET_TRAITS":
      return { ...state, traits: { ...state.traits, ...action.traits } };

    default:
      return state;
  }
}
