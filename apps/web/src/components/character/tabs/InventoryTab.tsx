import { useState, useMemo } from "react";
import type { CharacterData, InventoryItem } from "@aidnd/shared/types";
import { FilterChipBar } from "../FilterChipBar";
import { RARITY_COLORS } from "../utils";

interface InventoryTabProps {
  character: CharacterData;
  onItemClick: (item: InventoryItem) => void;
}

export function InventoryTab({ character, onItemClick }: InventoryTabProps) {
  const [filter, setFilter] = useState<string>("all");
  const d = character.dynamic;

  const counts = useMemo(() => {
    const equipped = d.inventory.filter((i) => i.equipped).length;
    const attunement = d.inventory.filter((i) => i.attunement).length;
    return { equipped, attunement };
  }, [d.inventory]);

  const chips = [
    { id: "all", label: "ALL", count: d.inventory.length },
    { id: "equipment", label: "EQUIPPED", count: counts.equipped },
    ...(counts.attunement > 0
      ? [{ id: "attunement", label: "ATTUNEMENT", count: counts.attunement }]
      : []),
  ];

  const filtered = useMemo(() => {
    switch (filter) {
      case "equipment":
        return d.inventory.filter((i) => i.equipped);
      case "attunement":
        return d.inventory.filter((i) => i.attunement);
      default:
        return d.inventory;
    }
  }, [d.inventory, filter]);

  // Sort: equipped first, then by name
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  return (
    <div className="space-y-2">
      <FilterChipBar chips={chips} activeChipId={filter} onSelect={setFilter} />

      {sorted.length === 0 && (
        <div className="text-xs text-gray-600 text-center py-4">
          No items
        </div>
      )}

      <div className="space-y-0.5">
        {sorted.map((item, i) => {
          const rarityColor =
            item.rarity && RARITY_COLORS[item.rarity]
              ? RARITY_COLORS[item.rarity]
              : item.equipped
              ? "text-gray-200"
              : "text-gray-400";

          return (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center gap-1.5 text-xs px-1.5 py-1 rounded cursor-pointer hover:bg-gray-700/30 transition-colors group"
              onClick={() => onItemClick(item)}
            >
              {/* Equipped indicator */}
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.equipped ? "bg-green-500" : "bg-gray-700"
                }`}
              />

              {/* Name */}
              <span
                className={`truncate flex-1 group-hover:text-purple-300 transition-colors ${rarityColor}`}
              >
                {item.name}
                {item.isMagicItem && (
                  <span className="text-purple-400 ml-0.5">✦</span>
                )}
              </span>

              {/* Attunement indicator */}
              {item.attunement && (
                <span
                  className={`text-[9px] shrink-0 ${
                    item.isAttuned ? "text-purple-400" : "text-gray-600"
                  }`}
                  title={item.isAttuned ? "Attuned" : "Requires attunement"}
                >
                  ◈
                </span>
              )}

              {/* Quantity */}
              {item.quantity > 1 && (
                <span className="text-gray-500 text-[10px] shrink-0">
                  ×{item.quantity}
                </span>
              )}

              {/* Type badge */}
              {item.type && (
                <span className="text-[9px] text-gray-600 shrink-0">
                  {item.type}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
