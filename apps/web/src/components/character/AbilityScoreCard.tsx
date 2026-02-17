"use client";

import type { AbilityScores } from "@aidnd/shared/types";
import { getModifier, formatModifier } from "@aidnd/shared/utils";

interface AbilityScoreCardProps {
  label: string;
  score: number;
  abilityKey: keyof AbilityScores;
  onClick?: (abilityKey: keyof AbilityScores) => void;
  hasAdvantage?: boolean;
  hasDisadvantage?: boolean;
  advantageTooltip?: string;
}

export function AbilityScoreCard({
  label,
  score,
  abilityKey,
  onClick,
  hasAdvantage,
  hasDisadvantage,
  advantageTooltip,
}: AbilityScoreCardProps) {
  const mod = getModifier(score);
  const modStr = formatModifier(score);
  const isPositive = mod > 0;
  const isNegative = mod < 0;

  return (
    <div
      className={`bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-center relative ${
        onClick
          ? "cursor-pointer hover:border-purple-500/50 hover:bg-gray-900/70 transition-colors"
          : ""
      }`}
      onClick={() => onClick?.(abilityKey)}
    >
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${
          isPositive
            ? "text-green-400"
            : isNegative
            ? "text-red-400"
            : "text-gray-300"
        }`}
      >
        {modStr}
      </div>
      <div className="text-xs text-gray-500">{score}</div>
      {(hasAdvantage || hasDisadvantage) && (
        <span
          className="absolute top-1 right-1"
          title={advantageTooltip}
        >
          {hasAdvantage && (
            <span className="text-[9px] text-green-400 font-bold">▲</span>
          )}
          {hasDisadvantage && (
            <span className="text-[9px] text-red-400 font-bold">▼</span>
          )}
        </span>
      )}
    </div>
  );
}
