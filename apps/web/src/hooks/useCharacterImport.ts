"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CharacterData } from "@aidnd/shared/types";
import { mergeReimport } from "@aidnd/shared/utils";

type ImportState = "idle" | "importing" | "success" | "error";

interface UseCharacterImportOptions {
  /** When provided, re-imports will merge with this character to preserve dynamic state (HP, conditions, etc.) */
  existingCharacter?: CharacterData | null;
}

interface UseCharacterImportResult {
  importState: ImportState;
  character: CharacterData | null;
  warnings: string[];
  error: string;
  fallbackHint: string;
  importFromUrl: (url: string) => Promise<void>;
  importFromJson: (jsonString: string) => Promise<void>;
  clearCharacter: () => void;
  /** Reset import state to idle (shows the form) without clearing character from storage */
  resetForReimport: () => void;
}

function getWorkerUrl(): string {
  return process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
}

const STORAGE_KEY = "imported_character";

export function useCharacterImport(
  options?: UseCharacterImportOptions
): UseCharacterImportResult {
  const [importState, setImportState] = useState<ImportState>("idle");
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [fallbackHint, setFallbackHint] = useState("");

  // Keep a ref to the existing character so callbacks always see the latest value
  const existingRef = useRef(options?.existingCharacter ?? null);
  existingRef.current = options?.existingCharacter ?? null;

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as CharacterData;
        if (data?.static?.name) {
          setCharacter(data);
          setImportState("success");
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }, []);

  const saveCharacter = useCallback((newChar: CharacterData) => {
    // If we have an existing character, merge to preserve dynamic state
    const existing = existingRef.current;
    const finalChar =
      existing
        ? mergeReimport(existing, newChar.static, newChar.dynamic)
        : newChar;

    setCharacter(finalChar);
    setImportState("success");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalChar));
  }, []);

  const importFromUrl = useCallback(async (url: string) => {
    setImportState("importing");
    setError("");
    setFallbackHint("");
    setWarnings([]);

    try {
      const res = await fetch(`${getWorkerUrl()}/api/character/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setFallbackHint(data.fallbackHint || "");
        setImportState("error");
        return;
      }

      const importWarnings = data.warnings ? [...data.warnings] : [];
      if (existingRef.current) {
        importWarnings.unshift("Re-imported: dynamic data (HP, conditions, etc.) preserved from previous version.");
      }
      setWarnings(importWarnings);
      saveCharacter(data.character);
    } catch {
      setError("Failed to reach the server. Is it running?");
      setImportState("error");
    }
  }, [saveCharacter]);

  const importFromJson = useCallback(async (jsonString: string) => {
    setImportState("importing");
    setError("");
    setFallbackHint("");
    setWarnings([]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      setError("Invalid JSON. Please paste valid D&D Beyond character JSON.");
      setImportState("error");
      return;
    }

    try {
      const res = await fetch(`${getWorkerUrl()}/api/character/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "json", json: parsed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Parse failed");
        setImportState("error");
        return;
      }

      const importWarnings = data.warnings ? [...data.warnings] : [];
      if (existingRef.current) {
        importWarnings.unshift("Re-imported: dynamic data (HP, conditions, etc.) preserved from previous version.");
      }
      setWarnings(importWarnings);
      saveCharacter(data.character);
    } catch {
      setError("Failed to reach the server. Is it running?");
      setImportState("error");
    }
  }, [saveCharacter]);

  const clearCharacter = useCallback(() => {
    setCharacter(null);
    setImportState("idle");
    setError("");
    setFallbackHint("");
    setWarnings([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const resetForReimport = useCallback(() => {
    setImportState("idle");
    setError("");
    setFallbackHint("");
    setWarnings([]);
  }, []);

  return {
    importState,
    character,
    warnings,
    error,
    fallbackHint,
    importFromUrl,
    importFromJson,
    clearCharacter,
    resetForReimport,
  };
}
