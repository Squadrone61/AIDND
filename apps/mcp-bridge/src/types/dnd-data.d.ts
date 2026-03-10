/** Type declarations for dnd-data package (no built-in types) */

interface DndDataEntryRaw {
  name: string;
  description: string;
  properties: Record<string, string | number | undefined>;
  publisher: string;
  book: string;
}

declare module "dnd-data" {
  const data: {
    spells: DndDataEntryRaw[];
    monsters: DndDataEntryRaw[];
    items: DndDataEntryRaw[];
    classes: DndDataEntryRaw[];
    species: DndDataEntryRaw[];
    backgrounds: DndDataEntryRaw[];
  };
  export default data;
}
