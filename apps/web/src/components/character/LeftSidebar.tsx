"use client";

import { useState, useEffect } from "react";
import type { CharacterData } from "@aidnd/shared/types";
import { CharacterSheet } from "./CharacterSheet";
import { CharacterImport } from "./CharacterImport";
import { useCharacterImport } from "@/hooks/useCharacterImport";

interface LeftSidebarProps {
  character: CharacterData | null;
  onCharacterImported: (character: CharacterData) => void;
}

export function LeftSidebar({ character, onCharacterImported }: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const {
    importState,
    character: importedCharacter,
    warnings,
    error: importError,
    fallbackHint,
    importFromUrl,
    importFromJson,
    clearCharacter,
  } = useCharacterImport();

  // When import succeeds, bubble up to GameContent
  useEffect(() => {
    if (importedCharacter && importState === "success") {
      onCharacterImported(importedCharacter);
    }
  }, [importedCharacter, importState, onCharacterImported]);

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
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-sm font-medium text-gray-300">Character</h2>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {character ? (
          <CharacterSheet character={character} />
        ) : (
          <div className="space-y-4">
            <div className="text-center pt-4 pb-2">
              <div className="text-gray-400 text-sm font-medium mb-1">
                Import Character
              </div>
              <p className="text-gray-600 text-xs">
                Import from D&D Beyond to see your character sheet and share
                stats with the party.
              </p>
            </div>
            <CharacterImport
              importState={importState}
              character={importedCharacter}
              error={importError}
              fallbackHint={fallbackHint}
              warnings={warnings}
              onImportUrl={importFromUrl}
              onImportJson={importFromJson}
              onClear={clearCharacter}
            />
          </div>
        )}
      </div>
    </div>
  );
}
