"use client";

import { useState, useCallback } from "react";
import type { CharacterData } from "@aidnd/shared/types";

type ExportState = "idle" | "exporting" | "success" | "error";

interface UseCharacterExportResult {
  exportState: ExportState;
  error: string;
  warnings: string[];
  exportToAideDD: (character: CharacterData) => Promise<void>;
}

function getWorkerUrl(): string {
  return process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
}

export function useCharacterExport(): UseCharacterExportResult {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const exportToAideDD = useCallback(async (character: CharacterData) => {
    setExportState("exporting");
    setError("");
    setWarnings([]);

    try {
      const res = await fetch(`${getWorkerUrl()}/api/character/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "aidedd", character }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Export failed");
        setExportState("error");
        return;
      }

      if (data.warnings?.length) {
        setWarnings(data.warnings);
      }

      // Trigger browser download of XML file
      const blob = new Blob([data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${character.static.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportState("success");
      // Reset to idle after a moment
      setTimeout(() => setExportState("idle"), 2000);
    } catch {
      setError("Failed to reach the server. Is it running?");
      setExportState("error");
    }
  }, []);

  return { exportState, error, warnings, exportToAideDD };
}
