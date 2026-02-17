import { useState, useMemo } from "react";
import type { CharacterData, CharacterFeature } from "@aidnd/shared/types";
import { FilterChipBar } from "../FilterChipBar";

interface FeaturesTabProps {
  character: CharacterData;
  onFeatureClick: (feature: CharacterFeature) => void;
}

type FeatureFilter = "all" | "class" | "race" | "feat" | "background";

export function FeaturesTab({ character, onFeatureClick }: FeaturesTabProps) {
  const [filter, setFilter] = useState<string>("all");
  const [traitsOpen, setTraitsOpen] = useState(false);
  const s = character.static;
  const d = character.dynamic;

  const counts = useMemo(() => {
    const cls = s.features.filter((f) => f.source === "class").length;
    const race = s.features.filter((f) => f.source === "race").length;
    const feat = s.features.filter((f) => f.source === "feat").length;
    const bg = s.features.filter((f) => f.source === "background").length;
    return { cls, race, feat, bg };
  }, [s.features]);

  const chips = [
    { id: "all", label: "ALL", count: s.features.length },
    ...(counts.cls > 0 ? [{ id: "class", label: "CLASS", count: counts.cls }] : []),
    ...(counts.race > 0 ? [{ id: "race", label: "SPECIES", count: counts.race }] : []),
    ...(counts.feat > 0 ? [{ id: "feat", label: "FEATS", count: counts.feat }] : []),
    ...(counts.bg > 0 ? [{ id: "background", label: "BACKGROUND", count: counts.bg }] : []),
  ];

  const filtered = useMemo(() => {
    if (filter === "all") return s.features;
    return s.features.filter((f) => f.source === (filter as FeatureFilter));
  }, [s.features, filter]);

  // Group by source for "all" view
  const groups = useMemo(() => {
    if (filter !== "all") return [{ key: filter, label: "", features: filtered }];
    const sourceOrder: { key: string; label: string }[] = [
      { key: "class", label: "Class Features" },
      { key: "race", label: "Species Traits" },
      { key: "feat", label: "Feats" },
      { key: "background", label: "Background" },
    ];
    return sourceOrder
      .map((g) => ({
        ...g,
        features: filtered.filter((f) => f.source === g.key),
      }))
      .filter((g) => g.features.length > 0);
  }, [filtered, filter]);

  const hasCurrency =
    d.currency.gp > 0 ||
    d.currency.sp > 0 ||
    d.currency.cp > 0 ||
    d.currency.ep > 0 ||
    d.currency.pp > 0;

  const hasTraits =
    s.traits.personalityTraits ||
    s.traits.ideals ||
    s.traits.bonds ||
    s.traits.flaws;

  return (
    <div className="space-y-2">
      <FilterChipBar chips={chips} activeChipId={filter} onSelect={setFilter} />

      {/* Features list */}
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && (
            <div className="text-[10px] text-gray-500 font-medium mb-0.5 px-1.5">
              {group.label} ({group.features.length})
            </div>
          )}
          <div className="space-y-0.5">
            {group.features.map((feat) => (
              <div
                key={feat.name}
                className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  feat.description
                    ? "text-gray-300 cursor-pointer hover:text-purple-300 hover:bg-gray-700/30 transition-colors"
                    : "text-gray-400"
                }`}
                onClick={
                  feat.description
                    ? () => onFeatureClick(feat)
                    : undefined
                }
              >
                <span className="truncate">{feat.name}</span>
                {feat.source === "class" && feat.sourceLabel && (
                  <span className="text-[9px] text-purple-400/60 shrink-0">
                    {feat.sourceLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {s.features.length === 0 && (
        <div className="text-xs text-gray-600 text-center py-4">
          No features
        </div>
      )}

      {/* Divider — currency and traits */}
      {(hasCurrency || hasTraits) && (
        <div className="border-t border-gray-700/50 pt-2 mt-2 space-y-1.5">
          {/* Currency */}
          {hasCurrency && (
            <div className="px-1.5">
              <div className="text-[10px] text-gray-500 font-medium mb-0.5">
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

          {/* Traits */}
          {hasTraits && (
            <div>
              <button
                onClick={() => setTraitsOpen(!traitsOpen)}
                className="flex items-center justify-between w-full text-xs text-gray-400 font-medium px-1.5"
              >
                <span>Traits</span>
                <span className="text-gray-600">
                  {traitsOpen ? "\u2212" : "+"}
                </span>
              </button>
              {traitsOpen && (
                <div className="mt-1 space-y-1 px-1.5">
                  {s.traits.personalityTraits && (
                    <div>
                      <div className="text-[10px] text-gray-500">
                        Personality
                      </div>
                      <div className="text-xs text-gray-300">
                        {s.traits.personalityTraits}
                      </div>
                    </div>
                  )}
                  {s.traits.ideals && (
                    <div>
                      <div className="text-[10px] text-gray-500">Ideals</div>
                      <div className="text-xs text-gray-300">
                        {s.traits.ideals}
                      </div>
                    </div>
                  )}
                  {s.traits.bonds && (
                    <div>
                      <div className="text-[10px] text-gray-500">Bonds</div>
                      <div className="text-xs text-gray-300">
                        {s.traits.bonds}
                      </div>
                    </div>
                  )}
                  {s.traits.flaws && (
                    <div>
                      <div className="text-[10px] text-gray-500">Flaws</div>
                      <div className="text-xs text-gray-300">
                        {s.traits.flaws}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
