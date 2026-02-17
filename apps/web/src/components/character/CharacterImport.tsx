"use client";

import { useState } from "react";
import type { CharacterData } from "@aidnd/shared/types";
import { formatClassString, getTotalLevel } from "@aidnd/shared/utils";

interface CharacterImportProps {
  importState: "idle" | "importing" | "success" | "error";
  character: CharacterData | null;
  error: string;
  fallbackHint: string;
  warnings: string[];
  onImportUrl: (url: string) => Promise<void>;
  onImportJson: (json: string) => Promise<void>;
  onClear: () => void;
}

export function CharacterImport({
  importState,
  character,
  error,
  fallbackHint,
  warnings,
  onImportUrl,
  onImportJson,
  onClear,
}: CharacterImportProps) {
  const [url, setUrl] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [showJsonMode, setShowJsonMode] = useState(false);

  // Auto-expand JSON mode when URL import fails with 403
  const showJson = showJsonMode || !!fallbackHint;

  if (importState === "success" && character) {
    const s = character.static;
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-purple-400">
              {s.name}
            </div>
            <div className="text-xs text-gray-400">
              {s.race} {formatClassString(s.classes)} (Lvl{" "}
              {getTotalLevel(s.classes)})
            </div>
          </div>
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        </div>
        {warnings.length > 0 && (
          <div className="mt-2 text-[10px] text-yellow-500/80">
            {warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* URL Import */}
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="D&D Beyond URL..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5
                     text-sm text-gray-100 placeholder-gray-500 focus:outline-none
                     focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button
          onClick={() => onImportUrl(url)}
          disabled={!url.trim() || importState === "importing"}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700
                     text-white px-3 py-1.5 rounded-lg text-sm font-medium
                     transition-colors whitespace-nowrap"
        >
          {importState === "importing" ? "..." : "Import"}
        </button>
      </div>

      {/* Toggle JSON mode */}
      {!showJson && (
        <button
          onClick={() => setShowJsonMode(true)}
          className="text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
        >
          Or paste character JSON...
        </button>
      )}

      {/* JSON Paste */}
      {showJson && (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste D&D Beyond character JSON here..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2
                       text-xs text-gray-100 placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-purple-500 focus:border-transparent
                       font-mono resize-y"
          />
          <button
            onClick={() => onImportJson(jsonText)}
            disabled={!jsonText.trim() || importState === "importing"}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800
                       text-white py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            {importState === "importing" ? "Parsing..." : "Parse JSON"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/10 rounded px-2 py-1.5">
          {error}
          {fallbackHint && (
            <div className="mt-1 text-yellow-500/80">{fallbackHint}</div>
          )}
        </div>
      )}
    </div>
  );
}
