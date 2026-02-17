"use client";

import { getModifier, formatModifier } from "@aidnd/shared/utils";

interface AbilityScoreCardProps {
  label: string;
  score: number;
}

export function AbilityScoreCard({ label, score }: AbilityScoreCardProps) {
  const mod = getModifier(score);
  const modStr = formatModifier(score);
  const isPositive = mod > 0;
  const isNegative = mod < 0;

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-center">
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
    </div>
  );
}
