import { useMemo, useState } from "react";
import { equipmentDb } from "@aidnd/shared/data";
import type { WeaponData, ArmorData } from "@aidnd/shared/data";
import type { StepProps, EquipmentEntry, BuilderAction } from "./types";

type EquipmentTab = "weapon" | "armor" | "gear" | "tool" | "item";

const TABS: { value: EquipmentTab; label: string }[] = [
  { value: "weapon", label: "Weapons" },
  { value: "armor", label: "Armor" },
  { value: "gear", label: "Gear" },
  { value: "tool", label: "Tools" },
  { value: "item", label: "Items" },
];

// Category grouping definitions
const WEAPON_CATEGORIES = [
  { label: "Simple Melee", filter: (w: WeaponData) => w.category === "simple" && w.type === "melee" },
  { label: "Simple Ranged", filter: (w: WeaponData) => w.category === "simple" && w.type === "ranged" },
  { label: "Martial Melee", filter: (w: WeaponData) => w.category === "martial" && w.type === "melee" },
  { label: "Martial Ranged", filter: (w: WeaponData) => w.category === "martial" && w.type === "ranged" },
];

const ARMOR_CATEGORIES = [
  { label: "Light Armor", filter: (a: ArmorData) => a.category === "light" },
  { label: "Medium Armor", filter: (a: ArmorData) => a.category === "medium" },
  { label: "Heavy Armor", filter: (a: ArmorData) => a.category === "heavy" },
  { label: "Shields", filter: (a: ArmorData) => a.category === "shield" },
];

export function StepEquipment({ state, dispatch }: StepProps) {
  const [tab, setTab] = useState<EquipmentTab>("weapon");
  const [search, setSearch] = useState("");

  const addItem = (name: string) => {
    const entry: EquipmentEntry = {
      name,
      quantity: 1,
      equipped: tab === "weapon" || tab === "armor",
      source: tab,
    };
    dispatch({ type: "ADD_EQUIPMENT", entry });
  };

  // Parse mastery name from "Name|Source" format
  const parseMastery = (mastery: string) => mastery.split("|")[0];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-amber-200/90 tracking-wide" style={{ fontFamily: "var(--font-cinzel)" }}>
          Equipment
        </h2>
        <p className="text-xs text-gray-500">Add weapons, armor, gear, and tools to your inventory.</p>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-gray-700/50 to-transparent mt-2" />
      </div>

      <div className="flex gap-6">
        {/* Left: Browser */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTab(t.value);
                  setSearch("");
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.value
                    ? "text-amber-300 border-b-2 border-amber-400/70"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab !== "item" && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}s...`}
              className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
            />
          )}

          <div className="max-h-[480px] overflow-y-auto">
            {tab === "item" ? (
              <CustomItemsPanel
                equipment={state.equipment}
                dispatch={dispatch}
              />
            ) : tab === "weapon" ? (
              <GroupedWeapons
                search={search}
                equipment={state.equipment}
                onAdd={addItem}
                parseMastery={parseMastery}
              />
            ) : tab === "armor" ? (
              <GroupedArmor
                search={search}
                equipment={state.equipment}
                onAdd={addItem}
              />
            ) : (
              <FlatList
                items={
                  tab === "gear"
                    ? equipmentDb.gear
                    : equipmentDb.tools
                }
                search={search}
                tab={tab}
                equipment={state.equipment}
                onAdd={addItem}
              />
            )}
          </div>
        </div>

        {/* Right: Inventory */}
        <div className="w-64 shrink-0 space-y-4">
          <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-4 space-y-2">
            <div className="text-xs font-medium text-gray-300">Inventory</div>
            {state.equipment.length === 0 ? (
              <div className="text-[10px] text-gray-600 text-center py-4">
                No items added
              </div>
            ) : (
              <div className="space-y-1">
                {state.equipment.map((entry) => (
                  <div
                    key={`${entry.source}-${entry.name}`}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <button
                      onClick={() =>
                        dispatch({ type: "TOGGLE_EQUIPPED", name: entry.name })
                      }
                      className={`w-3 h-3 rounded-sm border shrink-0 ${
                        entry.equipped
                          ? "border-amber-500 bg-amber-500/80"
                          : "border-gray-600"
                      }`}
                      title={entry.equipped ? "Equipped" : "Unequipped"}
                    />
                    <span className="flex-1 text-gray-300 truncate">
                      {entry.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          entry.quantity > 1
                            ? dispatch({
                                type: "SET_EQUIPMENT_QUANTITY",
                                name: entry.name,
                                quantity: entry.quantity - 1,
                              })
                            : dispatch({
                                type: "REMOVE_EQUIPMENT",
                                name: entry.name,
                              })
                        }
                        className="text-gray-600 hover:text-gray-400"
                      >
                        -
                      </button>
                      <span className="text-gray-400 w-4 text-center">
                        {entry.quantity}
                      </span>
                      <button
                        onClick={() =>
                          dispatch({
                            type: "SET_EQUIPMENT_QUANTITY",
                            name: entry.name,
                            quantity: entry.quantity + 1,
                          })
                        }
                        className="text-gray-600 hover:text-gray-400"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        dispatch({ type: "REMOVE_EQUIPMENT", name: entry.name })
                      }
                      className="text-gray-600 hover:text-red-400"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Currency */}
          <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-4 space-y-2">
            <div className="text-xs font-medium text-gray-300">Currency</div>
            <div className="grid grid-cols-5 gap-1">
              {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
                <div key={coin} className="text-center">
                  <div className="text-[9px] text-gray-500 uppercase">
                    {coin}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={state.currency[coin]}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_CURRENCY",
                        currency: {
                          ...state.currency,
                          [coin]: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-center text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Items Panel ─────────────────────────────────

const DAMAGE_TYPES = [
  "Slashing", "Piercing", "Bludgeoning", "Fire", "Cold", "Lightning",
  "Thunder", "Acid", "Poison", "Necrotic", "Radiant", "Force", "Psychic",
];

// Type pills grouped by category
const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Combat", types: ["Weapon", "Armor", "Shield", "Ammunition"] },
  { label: "Magic", types: ["Wondrous Item", "Ring", "Rod", "Staff", "Wand", "Scroll"] },
  { label: "Mundane", types: ["Gear", "Potion", "Tool"] },
];

// Rarity with D&D-standard colors
const RARITIES: { name: string; color: string; ring: string; bg: string }[] = [
  { name: "Common",    color: "text-gray-400",   ring: "ring-gray-500",    bg: "bg-gray-500" },
  { name: "Uncommon",  color: "text-green-400",  ring: "ring-green-500",   bg: "bg-green-500" },
  { name: "Rare",      color: "text-blue-400",   ring: "ring-blue-500",    bg: "bg-blue-500" },
  { name: "Very Rare", color: "text-purple-400", ring: "ring-purple-500",  bg: "bg-purple-500" },
  { name: "Legendary", color: "text-amber-400",  ring: "ring-amber-500",   bg: "bg-amber-500" },
  { name: "Artifact",  color: "text-red-400",    ring: "ring-red-500",     bg: "bg-red-500" },
];

// Rarity border colors for item cards
const RARITY_BORDER: Record<string, string> = {
  Common:    "border-l-gray-500",
  Uncommon:  "border-l-green-500",
  Rare:      "border-l-blue-500",
  "Very Rare": "border-l-purple-500",
  Legendary: "border-l-amber-500",
  Artifact:  "border-l-red-500",
};

// Types that show weapon-related fields
const WEAPON_TYPES = new Set(["Weapon", "Ammunition"]);
// Types that show AC field
const ARMOR_TYPES = new Set(["Armor", "Shield"]);

const inputCls = "w-full bg-gray-900/80 border border-gray-700/80 rounded-md px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30 transition-colors";
const selectCls = "w-full bg-gray-900/80 border border-gray-700/80 rounded-md px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30 transition-colors";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest shrink-0">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-gray-700 to-transparent" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-gray-500 leading-none">{children}</span>
  );
}

function CustomItemsPanel({
  equipment,
  dispatch,
}: {
  equipment: EquipmentEntry[];
  dispatch: React.Dispatch<BuilderAction>;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [itemType, setItemType] = useState("");
  const [damage, setDamage] = useState("");
  const [damageType, setDamageType] = useState("");
  const [range, setRange] = useState("");
  const [armorClass, setArmorClass] = useState("");
  const [attackBonus, setAttackBonus] = useState("");
  const [properties, setProperties] = useState("");
  const [rarity, setRarity] = useState("");
  const [attunement, setAttunement] = useState(false);
  const [isMagicItem, setIsMagicItem] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const resetForm = () => {
    setName("");
    setQuantity(1);
    setDescription("");
    setWeight("");
    setItemType("");
    setDamage("");
    setDamageType("");
    setRange("");
    setArmorClass("");
    setAttackBonus("");
    setProperties("");
    setRarity("");
    setAttunement(false);
    setIsMagicItem(false);
    setShowMore(false);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const parsedProps = properties.trim()
      ? properties.split(",").map((p) => p.trim()).filter(Boolean)
      : undefined;
    const entry: EquipmentEntry = {
      name: name.trim(),
      quantity,
      equipped: false,
      source: "item",
      ...(itemType && { itemType }),
      ...(description.trim() && { description: description.trim() }),
      ...(weight && { weight: Number(weight) }),
      ...(damage.trim() && { damage: damage.trim() }),
      ...(damageType && { damageType }),
      ...(range.trim() && { range: range.trim() }),
      ...(armorClass && { armorClass: Number(armorClass) }),
      ...(attackBonus && { attackBonus: Number(attackBonus) }),
      ...(parsedProps && { properties: parsedProps }),
      ...(rarity && { rarity }),
      ...(attunement && { attunement: true }),
      ...(isMagicItem && { isMagicItem: true }),
    };
    dispatch({ type: "ADD_EQUIPMENT", entry });
    resetForm();
  };

  const showWeaponFields = WEAPON_TYPES.has(itemType);
  const showArmorFields = ARMOR_TYPES.has(itemType);
  const customItems = equipment.filter((e) => e.source === "item");

  return (
    <div className="space-y-3">
      {/* ── Form Card ── */}
      <div className="relative rounded-lg overflow-hidden">
        {/* Gradient top accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        <div className="bg-gray-800/90 border border-gray-700/60 rounded-lg p-4 space-y-4">
          {/* ── Name ── */}
          <div className="space-y-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What are you adding?"
              className="w-full bg-transparent border-0 border-b border-gray-700 rounded-none px-0 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>

          {/* ── Type Selector (pill groups) ── */}
          <div className="space-y-2">
            <SectionLabel>Type</SectionLabel>
            <div className="space-y-1.5">
              {TYPE_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-wrap gap-1">
                  {group.types.map((t) => {
                    const selected = itemType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setItemType(selected ? "" : t)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150 ${
                          selected
                            ? "bg-amber-500/80 text-amber-50 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                            : "bg-gray-900/60 text-gray-500 hover:text-gray-300 hover:bg-gray-700/60"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── Qty + Weight ── */}
          <div className="grid grid-cols-[72px_96px] gap-3">
            <div className="space-y-1">
              <FieldLabel>Qty</FieldLabel>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className={inputCls + " text-center"}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Weight (lb.)</FieldLabel>
              <input
                type="number"
                min={0}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="--"
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Weapon Stats (contextual) ── */}
          {showWeaponFields && (
            <div className="space-y-2">
              <SectionLabel>Weapon Stats</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>Damage</FieldLabel>
                  <input
                    type="text"
                    value={damage}
                    onChange={(e) => setDamage(e.target.value)}
                    placeholder="e.g. 2d6"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Damage Type</FieldLabel>
                  <select
                    value={damageType}
                    onChange={(e) => setDamageType(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">--</option>
                    {DAMAGE_TYPES.map((dt) => (
                      <option key={dt} value={dt.toLowerCase()}>{dt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_72px] gap-2">
                <div className="space-y-1">
                  <FieldLabel>Range</FieldLabel>
                  <input
                    type="text"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    placeholder="e.g. 20/60 ft."
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Atk +</FieldLabel>
                  <input
                    type="number"
                    value={attackBonus}
                    onChange={(e) => setAttackBonus(e.target.value)}
                    placeholder="--"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <FieldLabel>Properties</FieldLabel>
                <input
                  type="text"
                  value={properties}
                  onChange={(e) => setProperties(e.target.value)}
                  placeholder="Versatile, Light, Finesse..."
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* ── Armor Stats (contextual) ── */}
          {showArmorFields && (
            <div className="space-y-2">
              <SectionLabel>Armor Stats</SectionLabel>
              <div className="w-24 space-y-1">
                <FieldLabel>Armor Class</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={armorClass}
                  onChange={(e) => setArmorClass(e.target.value)}
                  placeholder="--"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* ── More Options (expandable) ── */}
          {!showMore ? (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors group"
            >
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-700 group-hover:border-gray-500 transition-colors text-[8px]">
                +
              </span>
              Rarity, magic, description
            </button>
          ) : (
            <div className="space-y-3">
              {/* ── Rarity (colored dot pills) ── */}
              <div className="space-y-2">
                <SectionLabel>Rarity</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {RARITIES.map((r) => {
                    const selected = rarity === r.name;
                    return (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => setRarity(selected ? "" : r.name)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150 ${
                          selected
                            ? `${r.bg}/20 ${r.color} ring-1 ${r.ring}/50`
                            : "bg-gray-900/40 text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${selected ? r.bg : "bg-gray-700"}`} />
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Magic + Attunement (toggle pills) ── */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsMagicItem(!isMagicItem)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
                    isMagicItem
                      ? "bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/40"
                      : "bg-gray-900/40 text-gray-600 hover:text-gray-400 border border-gray-700/50"
                  }`}
                >
                  Magic Item
                </button>
                <button
                  type="button"
                  onClick={() => setAttunement(!attunement)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
                    attunement
                      ? "bg-amber-600/20 text-amber-300 ring-1 ring-amber-500/40"
                      : "bg-gray-900/40 text-gray-600 hover:text-gray-400 border border-gray-700/50"
                  }`}
                >
                  Requires Attunement
                </button>
              </div>

              {/* ── Description ── */}
              <div className="space-y-1">
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of the item..."
                  rows={2}
                  className={inputCls + " resize-none"}
                />
              </div>
            </div>
          )}

          {/* ── Add Button ── */}
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="w-full py-2 text-xs font-semibold rounded-md transition-all duration-200 bg-amber-600/80 hover:bg-amber-500/80 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_16px_rgba(245,158,11,0.25)]"
          >
            Add to Inventory
          </button>
        </div>
      </div>

      {/* ── Custom Items List ── */}
      {customItems.length > 0 && (
        <div className="space-y-1.5">
          {customItems.map((entry) => {
            const rarityBorder = entry.rarity ? RARITY_BORDER[entry.rarity] : null;
            const rarityData = entry.rarity ? RARITIES.find((r) => r.name === entry.rarity) : null;

            const stats: string[] = [];
            if (entry.damage) {
              let dmg = entry.damage;
              if (entry.damageType) dmg += ` ${entry.damageType}`;
              stats.push(dmg);
            }
            if (entry.armorClass != null) stats.push(`AC ${entry.armorClass}`);
            if (entry.attackBonus != null) stats.push(`+${entry.attackBonus}`);
            if (entry.range) stats.push(entry.range);
            if (entry.properties?.length) stats.push(entry.properties.join(", "));
            if (entry.weight != null && entry.weight > 0) stats.push(`${entry.weight} lb.`);

            return (
              <div
                key={entry.name}
                className={`pl-3 pr-2.5 py-2 rounded-md border-l-2 bg-gray-800/60 text-xs ${
                  rarityBorder ?? "border-l-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-200 font-medium truncate">{entry.name}</span>
                      {entry.quantity > 1 && (
                        <span className="text-[9px] text-gray-500 tabular-nums">x{entry.quantity}</span>
                      )}
                    </div>
                    {/* Tags row */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {entry.itemType && (
                        <span className="text-[9px] px-1.5 py-px rounded bg-gray-700/50 text-gray-500">
                          {entry.itemType}
                        </span>
                      )}
                      {rarityData && (
                        <span className={`text-[9px] px-1.5 py-px rounded ${rarityData.bg}/15 ${rarityData.color}`}>
                          {entry.rarity}
                        </span>
                      )}
                      {entry.isMagicItem && (
                        <span className="text-[9px] px-1.5 py-px rounded bg-purple-500/15 text-purple-400">
                          Magic
                        </span>
                      )}
                      {entry.attunement && (
                        <span className="text-[9px] px-1.5 py-px rounded bg-amber-500/15 text-amber-400">
                          Attunement
                        </span>
                      )}
                    </div>
                    {/* Stats line */}
                    {stats.length > 0 && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {stats.join(" \u00b7 ")}
                      </div>
                    )}
                    {entry.description && (
                      <div className="text-[10px] text-gray-600 line-clamp-1 italic">
                        {entry.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Grouped Weapons ─────────────────────────────────────

function GroupedWeapons({
  search,
  equipment,
  onAdd,
  parseMastery,
}: {
  search: string;
  equipment: EquipmentEntry[];
  onAdd: (name: string) => void;
  parseMastery: (m: string) => string;
}) {
  const q = search.toLowerCase();

  return (
    <div className="space-y-3">
      {WEAPON_CATEGORIES.map((cat) => {
        let weapons = equipmentDb.weapons.filter(cat.filter);
        if (search) {
          weapons = weapons.filter((w) => w.name.toLowerCase().includes(q));
        }
        if (weapons.length === 0) return null;

        return (
          <div key={cat.label}>
            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 sticky top-0 bg-gray-900 py-0.5">
              {cat.label}
            </div>
            <div className="space-y-1">
              {weapons.map((item) => {
                const alreadyAdded = equipment.some(
                  (e) => e.name === item.name && e.source === "weapon"
                );
                return (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
                      alreadyAdded
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-gray-700/50 bg-gray-800/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-gray-200 truncate">{item.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {item.damage} {item.damageType}
                        {item.cost && <span> &middot; {item.cost}</span>}
                        {item.weight > 0 && <span> &middot; {item.weight} lb.</span>}
                        {item.mastery && (
                          <span className="ml-1 text-amber-400/60">
                            [{parseMastery(item.mastery)}]
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onAdd(item.name)}
                      className={`shrink-0 text-[10px] px-2 py-1 rounded transition-colors ${
                        alreadyAdded
                          ? "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                          : "text-gray-400 bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      {alreadyAdded ? "+1" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Grouped Armor ───────────────────────────────────────

function GroupedArmor({
  search,
  equipment,
  onAdd,
}: {
  search: string;
  equipment: EquipmentEntry[];
  onAdd: (name: string) => void;
}) {
  const q = search.toLowerCase();

  return (
    <div className="space-y-3">
      {ARMOR_CATEGORIES.map((cat) => {
        let armorList = equipmentDb.armor.filter(cat.filter);
        if (search) {
          armorList = armorList.filter((a) => a.name.toLowerCase().includes(q));
        }
        if (armorList.length === 0) return null;

        return (
          <div key={cat.label}>
            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 sticky top-0 bg-gray-900 py-0.5">
              {cat.label}
            </div>
            <div className="space-y-1">
              {armorList.map((item) => {
                const alreadyAdded = equipment.some(
                  (e) => e.name === item.name && e.source === "armor"
                );
                return (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
                      alreadyAdded
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-gray-700/50 bg-gray-800/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-gray-200 truncate">{item.name}</div>
                      <div className="text-[10px] text-gray-500">
                        AC {item.ac}
                        {item.dexCap !== undefined && <span> (max Dex +{item.dexCap})</span>}
                        {item.stealthDisadvantage && <span> &middot; Stealth Disadv.</span>}
                        {item.cost && <span> &middot; {item.cost}</span>}
                        {item.weight > 0 && <span> &middot; {item.weight} lb.</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => onAdd(item.name)}
                      className={`shrink-0 text-[10px] px-2 py-1 rounded transition-colors ${
                        alreadyAdded
                          ? "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                          : "text-gray-400 bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      {alreadyAdded ? "+1" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Flat List (gear/tools) ──────────────────────────────

function FlatList({
  items,
  search,
  tab,
  equipment,
  onAdd,
}: {
  items: { name: string; cost: string; weight: number; description?: string }[];
  search: string;
  tab: EquipmentTab;
  equipment: EquipmentEntry[];
  onAdd: (name: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="space-y-1">
      {filtered.map((item) => {
        const alreadyAdded = equipment.some(
          (e) => e.name === item.name && e.source === tab
        );
        return (
          <div
            key={item.name}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
              alreadyAdded
                ? "border-amber-500/20 bg-amber-500/5"
                : "border-gray-700/50 bg-gray-800/50"
            }`}
          >
            <div className="min-w-0">
              <div className="text-gray-200 truncate">{item.name}</div>
              <div className="text-[10px] text-gray-500">
                {item.cost}
                {item.weight > 0 && <span> &middot; {item.weight} lb.</span>}
              </div>
            </div>
            <button
              onClick={() => onAdd(item.name)}
              className={`shrink-0 text-[10px] px-2 py-1 rounded transition-colors ${
                alreadyAdded
                  ? "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                  : "text-gray-400 bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {alreadyAdded ? "+1" : "Add"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
