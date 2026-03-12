import { useMemo } from "react";
import { buildCharacter } from "@aidnd/shared/builders";
import { CharacterSheet } from "@/components/character/CharacterSheet";
import type { StepProps } from "./types";
import { assembleIdentifiers, isStepValid } from "./utils";
import { BUILDER_STEPS } from "./types";

interface StepReviewProps extends StepProps {
  onSave: () => void;
}

export function StepReview({ state }: StepReviewProps) {
  const result = useMemo(() => {
    if (!state.className) return null;
    try {
      const ids = assembleIdentifiers(state);
      return buildCharacter(ids);
    } catch (e) {
      return { error: String(e) };
    }
  }, [state]);

  // Validation warnings
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    for (const step of BUILDER_STEPS) {
      if (!isStepValid(state, step)) {
        issues.push(`Step "${step}" is not complete`);
      }
    }
    return issues;
  }, [state]);

  if (!result || "error" in result) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 text-sm mb-2">
          Could not build character
        </div>
        <p className="text-xs text-gray-500">
          {"error" in (result ?? {})
            ? (result as { error: string }).error
            : "Please complete all required steps."}
        </p>
      </div>
    );
  }

  const { character, warnings } = result;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-200 mb-1">
          Review Your Character
        </h2>
        <p className="text-xs text-gray-500">
          Review your character below. Click "Save Character" when you're ready.
        </p>
      </div>

      {/* Warnings */}
      {(warnings.length > 0 || validationIssues.length > 0) && (
        <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3">
          {validationIssues.map((issue: string, i: number) => (
            <div key={`v${i}`} className="text-[10px] text-yellow-500">
              {issue}
            </div>
          ))}
          {warnings.map((w: string, i: number) => (
            <div key={`w${i}`} className="text-[10px] text-yellow-500">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Character Sheet */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <CharacterSheet character={character} />
      </div>
    </div>
  );
}
