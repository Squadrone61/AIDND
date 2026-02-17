"use client";

import type { CharacterFeature } from "@aidnd/shared/types";
import { CharacterPopupOverlay } from "./CharacterPopupOverlay";

const SOURCE_COLORS: Record<
  CharacterFeature["source"],
  { bg: string; text: string }
> = {
  class: { bg: "bg-purple-900/40", text: "text-purple-300" },
  race: { bg: "bg-blue-900/40", text: "text-blue-300" },
  feat: { bg: "bg-amber-900/40", text: "text-amber-300" },
  background: { bg: "bg-emerald-900/40", text: "text-emerald-300" },
};

const SOURCE_LABELS: Record<CharacterFeature["source"], string> = {
  class: "Class",
  race: "Race",
  feat: "Feat",
  background: "Background",
};

interface FeatureDetailPopupProps {
  feature: CharacterFeature;
  onClose: () => void;
}

export function FeatureDetailPopup({
  feature,
  onClose,
}: FeatureDetailPopupProps) {
  const colors = SOURCE_COLORS[feature.source];
  const sourceTag = feature.sourceLabel
    ? `${SOURCE_LABELS[feature.source]}: ${feature.sourceLabel}`
    : SOURCE_LABELS[feature.source];

  return (
    <CharacterPopupOverlay title={feature.name} onClose={onClose}>
      <div className="space-y-2">
        {/* Source badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border border-current/20`}
          >
            {sourceTag}
          </span>
          {feature.requiredLevel != null && (
            <span className="text-[10px] text-gray-500">
              Level {feature.requiredLevel}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
          {feature.description || "No description available."}
        </div>
      </div>
    </CharacterPopupOverlay>
  );
}
