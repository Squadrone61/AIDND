"use client";

import { useEffect, useCallback } from "react";

interface CharacterPopupOverlayProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function CharacterPopupOverlay({
  title,
  onClose,
  children,
}: CharacterPopupOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-950/80"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full max-h-[80%] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <h3 className="text-sm font-semibold text-gray-200 truncate pr-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
