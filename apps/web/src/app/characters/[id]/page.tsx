"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CharacterSheet } from "@/components/character/CharacterSheet";
import { CharacterImport } from "@/components/character/CharacterImport";
import { useCharacterImport } from "@/hooks/useCharacterImport";
import { useCharacterExport } from "@/hooks/useCharacterExport";
import { useCharacterLibrary } from "@/hooks/useCharacterLibrary";
import { formatClassString, getTotalLevel } from "@aidnd/shared/utils";
import { HPBar } from "@/components/character/HPBar";

export default function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getCharacter, updateCharacter, deleteCharacter } =
    useCharacterLibrary();

  const saved = getCharacter(id);
  const [showImport, setShowImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    importState,
    character: importedCharacter,
    warnings,
    error,
    fallbackHint,
    importFromUrl,
    importFromJson,
    importFromAideDD,
    clearCharacter,
    resetForReimport,
    setFreshImport,
  } = useCharacterImport({
    existingCharacter: saved?.character ?? null,
  });

  const { exportState, exportToAideDD } = useCharacterExport();

  // When import succeeds, update library entry and close panel
  useEffect(() => {
    if (importState === "success" && importedCharacter && saved) {
      updateCharacter(saved.id, importedCharacter);
      setShowImport(false);
    }
  }, [importState, importedCharacter, saved, updateCharacter]);

  if (!saved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="text-gray-400 text-lg">Character not found</div>
          <Link
            href="/characters"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Back to Characters
          </Link>
        </div>
      </div>
    );
  }

  const char = saved.character;
  const s = char.static;
  const level = getTotalLevel(s.classes);

  const handleDelete = () => {
    deleteCharacter(saved.id);
    router.push("/characters");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-purple-400 truncate">
                  {s.name}
                </h1>
                {saved.campaignSlug && (
                  <span className="text-[10px] bg-purple-900/30 text-purple-400 border border-purple-800/50 rounded px-1.5 py-0.5 shrink-0">
                    {saved.campaignSlug}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-400">
                {s.race} &middot; {formatClassString(s.classes)} &middot; Level{" "}
                {level}
              </div>
              <div className="mt-2 w-48">
                <HPBar
                  current={char.dynamic.currentHP}
                  max={s.maxHP}
                  temp={char.dynamic.tempHP}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  if (showImport) {
                    setShowImport(false);
                  } else {
                    setFreshImport(false);
                    resetForReimport();
                    setShowImport(true);
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  showImport
                    ? "bg-purple-600/20 text-purple-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                Update
              </button>
              <button
                onClick={() => {
                  setFreshImport(true);
                  resetForReimport();
                  setShowImport(true);
                }}
                className="text-xs px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Re-import
              </button>
              <button
                onClick={() => exportToAideDD(char)}
                disabled={exportState === "exporting"}
                className="text-xs px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-emerald-600 transition-colors"
              >
                {exportState === "exporting"
                  ? "..."
                  : exportState === "success"
                    ? "Done"
                    : "Export"}
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs px-3 py-1.5 rounded bg-gray-700 text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="mt-3 flex items-center gap-4">
            <Link
              href="/characters"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              &larr; All Characters
            </Link>
          </div>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="bg-gray-900/80 border-b border-gray-700 px-6 py-4 shrink-0">
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">
                Re-import Character
              </div>
              <button
                onClick={() => {
                  setShowImport(false);
                  setFreshImport(false);
                }}
                className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              Leveled up or made changes? Re-import to update stats. HP,
              conditions, spell slot usage, inventory, and currency will be
              preserved.
            </p>
            <CharacterImport
              importState={importState}
              character={importedCharacter}
              error={error}
              fallbackHint={fallbackHint}
              warnings={warnings}
              onImportUrl={importFromUrl}
              onImportJson={importFromJson}
              onImportAideDD={importFromAideDD}
              onClear={clearCharacter}
            />
          </div>
        </div>
      )}

      {/* Character sheet */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <CharacterSheet character={char} />
        </div>
      </div>
    </div>
  );
}
