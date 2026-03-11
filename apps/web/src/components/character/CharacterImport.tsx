"use client";

import { useState, useRef } from "react";
import type { CharacterData } from "@aidnd/shared/types";
import { formatClassString, getTotalLevel } from "@aidnd/shared/utils";

type ImportTab = "ddb" | "aidedd";

interface CharacterImportProps {
  importState: "idle" | "importing" | "success" | "error";
  character: CharacterData | null;
  error: string;
  fallbackHint: string;
  warnings: string[];
  onImportUrl: (url: string) => Promise<void>;
  onImportJson: (json: string) => Promise<void>;
  onImportAideDD: (xml: string) => Promise<void>;
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
  onImportAideDD,
  onClear,
}: CharacterImportProps) {
  const [tab, setTab] = useState<ImportTab>("ddb");
  const [url, setUrl] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [showJsonMode, setShowJsonMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const xml = evt.target?.result as string;
      if (xml) onImportAideDD(xml);
    };
    reader.readAsText(file);
    // Reset file input so re-uploading the same file triggers onChange
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {/* Tab Selector */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setTab("ddb")}
          className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
            tab === "ddb"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          D&D Beyond
        </button>
        <button
          onClick={() => setTab("aidedd")}
          className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
            tab === "aidedd"
              ? "text-emerald-400 border-b-2 border-emerald-400"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          AideDD
        </button>
      </div>

      {tab === "ddb" && (
        <>
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
        </>
      )}

      {tab === "aidedd" && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Create your character at{" "}
            <a
              href="https://www.aidedd.org/dnd-creator/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              aidedd.org/dnd-creator
            </a>
            , click EXPORT, then upload the XML file here.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importState === "importing"}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700
                       text-white py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            {importState === "importing" ? "Parsing..." : "Upload XML File"}
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
