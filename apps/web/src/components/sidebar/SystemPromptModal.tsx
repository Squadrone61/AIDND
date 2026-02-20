"use client";

import { useState, useEffect } from "react";
import { DEFAULT_DM_PROMPT } from "@aidnd/shared";

interface SystemPromptModalProps {
  currentPrompt?: string;
  onSave: (prompt?: string) => void;
  onClose: () => void;
}

export function SystemPromptModal({
  currentPrompt,
  onSave,
  onClose,
}: SystemPromptModalProps) {
  const [text, setText] = useState(currentPrompt || DEFAULT_DM_PROMPT);
  const isCustom = text !== DEFAULT_DM_PROMPT;

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = () => {
    // If the text matches default, save as undefined (reset)
    if (text.trim() === DEFAULT_DM_PROMPT.trim()) {
      onSave(undefined);
    } else {
      onSave(text);
    }
    onClose();
  };

  const handleReset = () => {
    setText(DEFAULT_DM_PROMPT);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-200">
              DM System Prompt
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Customize the AI Dungeon Master&apos;s personality and style
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-80 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                       text-sm text-gray-200 font-mono leading-relaxed resize-y
                       focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            spellCheck={false}
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{text.length.toLocaleString()} characters</span>
            {isCustom && (
              <span className="text-yellow-500/80">Custom prompt</span>
            )}
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Technical instructions (structured output format, combat rules, few-shot examples)
            are always appended automatically and cannot be edited here.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700">
          <button
            onClick={handleReset}
            disabled={!isCustom}
            className="text-sm text-gray-400 hover:text-gray-200 disabled:text-gray-600
                       disabled:cursor-not-allowed transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm
                         rounded-lg font-medium transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
