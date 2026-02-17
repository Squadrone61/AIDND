"use client";

import type { SpellSlotLevel } from "@aidnd/shared/types";

interface SpellSlotTrackerProps {
  slots: SpellSlotLevel[];
}

export function SpellSlotTracker({ slots }: SpellSlotTrackerProps) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-gray-400 font-medium">Spell Slots</div>
      {slots.map((slot) => {
        const available = slot.total - slot.used;
        return (
          <div key={slot.level} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-8 shrink-0">
              Lvl {slot.level}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: slot.total }, (_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < available
                      ? "bg-purple-500"
                      : "bg-gray-700 border border-gray-600"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-600">
              {available}/{slot.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
