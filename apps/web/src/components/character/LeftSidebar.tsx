"use client";

import { useState } from "react";
import type { CharacterData } from "@aidnd/shared/types";
import { formatClassString, getTotalLevel } from "@aidnd/shared/utils";
import { CharacterSheet } from "./CharacterSheet";
import { HPBar } from "./HPBar";
import { useCharacterLibrary } from "@/hooks/useCharacterLibrary";
import Link from "next/link";

interface LeftSidebarProps {
  character: CharacterData | null;
  onCharacterImported: (character: CharacterData) => void;
}

export function LeftSidebar({ character, onCharacterImported }: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { characters, touchCharacter } = useCharacterLibrary();

  if (collapsed) {
    return (
      <div className="w-10 bg-gray-800 border-r border-gray-700 flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          title="Show character sheet"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 relative">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          {character ? (
            <h2
              className="text-sm font-bold text-purple-400 truncate mr-2"
              title={character.static.name}
            >
              {character.static.name}
            </h2>
          ) : (
            <h2 className="text-sm font-medium text-gray-300">Character</h2>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setCollapsed(true)}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1"
              title="Collapse"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>
        </div>
        {character && (
          <div className="text-[11px] text-gray-400 truncate">
            {character.static.race} &middot;{" "}
            {formatClassString(character.static.classes)} &middot; Lvl{" "}
            {getTotalLevel(character.static.classes)}
          </div>
        )}
        {character && (
          <HPBar
            current={character.dynamic.currentHP}
            max={character.static.maxHP}
            temp={character.dynamic.tempHP}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {character ? (
          <div className="flex flex-col flex-1 min-h-0">
            <CharacterSheet character={character} />
            {/* Link to library */}
            <div className="p-2 border-t border-gray-700 shrink-0">
              <Link
                href="/characters"
                target="_blank"
                className="text-[10px] text-gray-500 hover:text-purple-400 transition-colors"
              >
                View in library &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <CharacterPicker
            characters={characters}
            onSelect={(saved) => {
              touchCharacter(saved.id);
              onCharacterImported(saved.character);
            }}
          />
        )}
      </div>
    </div>
  );
}

function CharacterPicker({
  characters,
  onSelect,
}: {
  characters: import("@/types/saved-character").SavedCharacter[];
  onSelect: (saved: import("@/types/saved-character").SavedCharacter) => void;
}) {
  if (characters.length === 0) {
    return (
      <div className="p-4 text-center space-y-3">
        <div className="text-gray-500 text-sm">No characters</div>
        <p className="text-gray-600 text-xs">
          Import a character to get started.
        </p>
        <Link
          href="/characters/create"
          target="_blank"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          Import Character
        </Link>
        <div>
          <Link
            href="/characters"
            target="_blank"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Manage Characters &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto">
      <div className="text-xs text-gray-400 font-medium mb-1">
        Select a character
      </div>
      {characters.map((saved) => {
        const s = saved.character.static;
        return (
          <button
            key={saved.id}
            onClick={() => onSelect(saved)}
            className="w-full text-left bg-gray-900/50 hover:bg-gray-700/50 border border-gray-700 hover:border-gray-600 rounded-lg p-2.5 transition-colors"
          >
            <div className="text-sm font-medium text-purple-400 truncate">
              {s.name}
            </div>
            <div className="text-[11px] text-gray-400 truncate">
              {s.race} &middot; {formatClassString(s.classes)} &middot; Lvl{" "}
              {getTotalLevel(s.classes)}
            </div>
          </button>
        );
      })}
      <div className="pt-1">
        <Link
          href="/characters"
          target="_blank"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Manage Characters &rarr;
        </Link>
      </div>
    </div>
  );
}
