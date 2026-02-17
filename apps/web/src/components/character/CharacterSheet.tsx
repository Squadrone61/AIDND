"use client";

import { useState } from "react";
import type { CharacterData } from "@aidnd/shared/types";
import { formatClassString, getTotalLevel, ABILITY_NAMES } from "@aidnd/shared/utils";
import { AbilityScoreCard } from "./AbilityScoreCard";
import { HPBar } from "./HPBar";
import { SpellSlotTracker } from "./SpellSlotTracker";

interface CharacterSheetProps {
  character: CharacterData;
}

export function CharacterSheet({ character }: CharacterSheetProps) {
  const s = character.static;
  const d = character.dynamic;
  const totalLevel = getTotalLevel(s.classes);
  const [spellsOpen, setSpellsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(false);

  const preparedSpells = s.spells.filter((sp) => sp.prepared);
  const cantrips = preparedSpells.filter((sp) => sp.level === 0);
  const leveledSpells = preparedSpells.filter((sp) => sp.level > 0);
  const equippedItems = d.inventory.filter((i) => i.equipped);
  const otherItems = d.inventory.filter((i) => !i.equipped);

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-purple-400">{s.name}</h3>
        <div className="text-xs text-gray-400">
          {s.race} &middot; {formatClassString(s.classes)} &middot; Lvl{" "}
          {totalLevel}
        </div>
      </div>

      {/* Vital Stats */}
      <div className="space-y-3">
        <HPBar current={d.currentHP} max={s.maxHP} temp={d.tempHP} />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg py-2">
            <div className="text-[10px] text-gray-500 uppercase">AC</div>
            <div className="text-lg font-bold text-gray-200">
              {s.armorClass}
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg py-2">
            <div className="text-[10px] text-gray-500 uppercase">Speed</div>
            <div className="text-lg font-bold text-gray-200">{s.speed} ft</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg py-2">
            <div className="text-[10px] text-gray-500 uppercase">Prof</div>
            <div className="text-lg font-bold text-gray-200">
              +{s.proficiencyBonus}
            </div>
          </div>
        </div>
      </div>

      {/* Conditions */}
      {d.conditions.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Conditions
          </div>
          <div className="flex flex-wrap gap-1">
            {d.conditions.map((c, i) => (
              <span
                key={i}
                className="bg-red-900/30 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-800/50"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Death Saves */}
      {(d.deathSaves.successes > 0 || d.deathSaves.failures > 0) && (
        <div className="flex gap-4">
          <div>
            <span className="text-[10px] text-gray-500">Saves: </span>
            {Array.from({ length: 3 }, (_, i) => (
              <span
                key={i}
                className={`inline-block w-2 h-2 rounded-full mx-0.5 ${
                  i < d.deathSaves.successes
                    ? "bg-green-500"
                    : "bg-gray-700"
                }`}
              />
            ))}
          </div>
          <div>
            <span className="text-[10px] text-gray-500">Fails: </span>
            {Array.from({ length: 3 }, (_, i) => (
              <span
                key={i}
                className={`inline-block w-2 h-2 rounded-full mx-0.5 ${
                  i < d.deathSaves.failures ? "bg-red-500" : "bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Ability Scores */}
      <div>
        <div className="text-xs text-gray-400 font-medium mb-2">
          Abilities
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(ABILITY_NAMES) as [keyof typeof s.abilities, string][]).map(
            ([key, label]) => (
              <AbilityScoreCard
                key={key}
                label={label}
                score={s.abilities[key]}
              />
            )
          )}
        </div>
      </div>

      {/* Spell Slots */}
      <SpellSlotTracker slots={d.spellSlotsUsed} />

      {/* Spells (collapsible) */}
      {preparedSpells.length > 0 && (
        <div>
          <button
            onClick={() => setSpellsOpen(!spellsOpen)}
            className="flex items-center justify-between w-full text-xs text-gray-400 font-medium"
          >
            <span>
              Spells ({preparedSpells.length})
            </span>
            <span className="text-gray-600">{spellsOpen ? "−" : "+"}</span>
          </button>
          {spellsOpen && (
            <div className="mt-1.5 space-y-1">
              {cantrips.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-0.5">
                    Cantrips
                  </div>
                  <div className="text-xs text-gray-300">
                    {cantrips.map((sp) => sp.name).join(", ")}
                  </div>
                </div>
              )}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
                const spellsAtLevel = leveledSpells.filter(
                  (sp) => sp.level === lvl
                );
                if (spellsAtLevel.length === 0) return null;
                return (
                  <div key={lvl}>
                    <div className="text-[10px] text-gray-500 mb-0.5">
                      Level {lvl}
                    </div>
                    <div className="text-xs text-gray-300">
                      {spellsAtLevel.map((sp) => sp.name).join(", ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inventory (collapsible) */}
      {d.inventory.length > 0 && (
        <div>
          <button
            onClick={() => setInventoryOpen(!inventoryOpen)}
            className="flex items-center justify-between w-full text-xs text-gray-400 font-medium"
          >
            <span>Inventory ({d.inventory.length})</span>
            <span className="text-gray-600">
              {inventoryOpen ? "−" : "+"}
            </span>
          </button>
          {inventoryOpen && (
            <div className="mt-1.5 space-y-1">
              {equippedItems.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-0.5">
                    Equipped
                  </div>
                  {equippedItems.map((item, i) => (
                    <div
                      key={i}
                      className="text-xs text-purple-300 flex justify-between"
                    >
                      <span>{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-gray-500">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {otherItems.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-0.5">
                    Other
                  </div>
                  {otherItems.map((item, i) => (
                    <div
                      key={i}
                      className="text-xs text-gray-400 flex justify-between"
                    >
                      <span>{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-gray-500">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Currency */}
      {(d.currency.gp > 0 ||
        d.currency.sp > 0 ||
        d.currency.cp > 0 ||
        d.currency.ep > 0 ||
        d.currency.pp > 0) && (
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Currency
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {d.currency.pp > 0 && (
              <span className="text-gray-300">{d.currency.pp} PP</span>
            )}
            {d.currency.gp > 0 && (
              <span className="text-yellow-400">{d.currency.gp} GP</span>
            )}
            {d.currency.ep > 0 && (
              <span className="text-gray-300">{d.currency.ep} EP</span>
            )}
            {d.currency.sp > 0 && (
              <span className="text-gray-400">{d.currency.sp} SP</span>
            )}
            {d.currency.cp > 0 && (
              <span className="text-orange-400">{d.currency.cp} CP</span>
            )}
          </div>
        </div>
      )}

      {/* Traits (collapsible) */}
      {(s.traits.personalityTraits ||
        s.traits.ideals ||
        s.traits.bonds ||
        s.traits.flaws) && (
        <div>
          <button
            onClick={() => setTraitsOpen(!traitsOpen)}
            className="flex items-center justify-between w-full text-xs text-gray-400 font-medium"
          >
            <span>Traits</span>
            <span className="text-gray-600">{traitsOpen ? "−" : "+"}</span>
          </button>
          {traitsOpen && (
            <div className="mt-1.5 space-y-1.5">
              {s.traits.personalityTraits && (
                <div>
                  <div className="text-[10px] text-gray-500">Personality</div>
                  <div className="text-xs text-gray-300">
                    {s.traits.personalityTraits}
                  </div>
                </div>
              )}
              {s.traits.ideals && (
                <div>
                  <div className="text-[10px] text-gray-500">Ideals</div>
                  <div className="text-xs text-gray-300">{s.traits.ideals}</div>
                </div>
              )}
              {s.traits.bonds && (
                <div>
                  <div className="text-[10px] text-gray-500">Bonds</div>
                  <div className="text-xs text-gray-300">{s.traits.bonds}</div>
                </div>
              )}
              {s.traits.flaws && (
                <div>
                  <div className="text-[10px] text-gray-500">Flaws</div>
                  <div className="text-xs text-gray-300">{s.traits.flaws}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
