"use client";

import type { CharacterSpell } from "@aidnd/shared/types";
import { CharacterPopupOverlay } from "./CharacterPopupOverlay";

interface SpellDetailPopupProps {
  spell: CharacterSpell;
  onClose: () => void;
}

export function SpellDetailPopup({ spell, onClose }: SpellDetailPopupProps) {
  const levelStr =
    spell.level === 0
      ? "Cantrip"
      : `Level ${spell.level}${spell.school ? ` ${spell.school}` : ""}`;

  return (
    <CharacterPopupOverlay title={spell.name} onClose={onClose}>
      <div className="space-y-3">
        {/* Level & School */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full border border-purple-700/50">
            {levelStr}
          </span>
          {spell.school && spell.level === 0 && (
            <span className="text-xs text-gray-400">{spell.school}</span>
          )}
          {spell.ritual && (
            <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-700/50">
              Ritual
            </span>
          )}
          {spell.concentration && (
            <span className="text-xs bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-700/50">
              Concentration
            </span>
          )}
        </div>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 gap-2">
          {spell.castingTime && (
            <div className="bg-gray-900/50 border border-gray-700 rounded px-2.5 py-1.5">
              <div className="text-[10px] text-gray-500 uppercase">
                Casting Time
              </div>
              <div className="text-xs text-gray-300">{spell.castingTime}</div>
            </div>
          )}
          {spell.range && (
            <div className="bg-gray-900/50 border border-gray-700 rounded px-2.5 py-1.5">
              <div className="text-[10px] text-gray-500 uppercase">Range</div>
              <div className="text-xs text-gray-300">{spell.range}</div>
            </div>
          )}
          {spell.components && (
            <div className="bg-gray-900/50 border border-gray-700 rounded px-2.5 py-1.5">
              <div className="text-[10px] text-gray-500 uppercase">
                Components
              </div>
              <div className="text-xs text-gray-300">{spell.components}</div>
            </div>
          )}
          {spell.duration && (
            <div className="bg-gray-900/50 border border-gray-700 rounded px-2.5 py-1.5">
              <div className="text-[10px] text-gray-500 uppercase">
                Duration
              </div>
              <div className="text-xs text-gray-300">{spell.duration}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {spell.description && (
          <div>
            <div className="text-xs text-gray-400 font-medium mb-1">
              Description
            </div>
            <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
              {spell.description}
            </div>
          </div>
        )}
      </div>
    </CharacterPopupOverlay>
  );
}
