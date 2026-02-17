import { z } from "zod";

// === Auth schemas ===

export const authUserSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().optional(),
});

// === AI Config schema ===

export const aiConfigSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().optional(),
});

// === Character schemas ===

export const abilityScoresSchema = z.object({
  strength: z.number(),
  dexterity: z.number(),
  constitution: z.number(),
  intelligence: z.number(),
  wisdom: z.number(),
  charisma: z.number(),
});

export const characterClassSchema = z.object({
  name: z.string(),
  level: z.number(),
  subclass: z.string().optional(),
});

export const characterSpellSchema = z.object({
  name: z.string(),
  level: z.number(),
  prepared: z.boolean(),
  alwaysPrepared: z.boolean(),
  spellSource: z.enum(["class", "race", "feat", "item", "background"]),
  knownByClass: z.boolean(),
  school: z.string().optional(),
  castingTime: z.string().optional(),
  range: z.string().optional(),
  components: z.string().optional(),
  duration: z.string().optional(),
  description: z.string().optional(),
  ritual: z.boolean().optional(),
  concentration: z.boolean().optional(),
});

export const spellSlotLevelSchema = z.object({
  level: z.number(),
  total: z.number(),
  used: z.number(),
});

export const inventoryItemSchema = z.object({
  name: z.string(),
  equipped: z.boolean(),
  quantity: z.number(),
  type: z.string().optional(),
  armorClass: z.number().optional(),
  description: z.string().optional(),
  damage: z.string().optional(),
  damageType: z.string().optional(),
  range: z.string().optional(),
  attackBonus: z.number().optional(),
  properties: z.array(z.string()).optional(),
  weight: z.number().optional(),
  rarity: z.string().optional(),
  attunement: z.boolean().optional(),
  isAttuned: z.boolean().optional(),
  isMagicItem: z.boolean().optional(),
});

export const currencySchema = z.object({
  cp: z.number(),
  sp: z.number(),
  ep: z.number(),
  gp: z.number(),
  pp: z.number(),
});

export const characterTraitsSchema = z.object({
  personalityTraits: z.string().optional(),
  ideals: z.string().optional(),
  bonds: z.string().optional(),
  flaws: z.string().optional(),
});

export const deathSavesSchema = z.object({
  successes: z.number(),
  failures: z.number(),
});

export const skillProficiencySchema = z.object({
  name: z.string(),
  ability: z.enum([
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ]),
  proficient: z.boolean(),
  expertise: z.boolean(),
  bonus: z.number().optional(),
});

export const savingThrowProficiencySchema = z.object({
  ability: z.enum([
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ]),
  proficient: z.boolean(),
  bonus: z.number().optional(),
});

export const characterFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: z.enum(["class", "race", "feat", "background"]),
  sourceLabel: z.string(),
  requiredLevel: z.number().optional(),
});

export const advantageEntrySchema = z.object({
  type: z.enum(["advantage", "disadvantage"]),
  subType: z.string(),
  restriction: z.string().optional(),
  source: z.string(),
});

export const proficiencyGroupSchema = z.object({
  armor: z.array(z.string()),
  weapons: z.array(z.string()),
  tools: z.array(z.string()),
  other: z.array(z.string()),
});

export const characterStaticDataSchema = z.object({
  name: z.string(),
  race: z.string(),
  classes: z.array(characterClassSchema),
  abilities: abilityScoresSchema,
  maxHP: z.number(),
  armorClass: z.number(),
  proficiencyBonus: z.number(),
  speed: z.number(),
  features: z.array(characterFeatureSchema),
  proficiencies: proficiencyGroupSchema,
  skills: z.array(skillProficiencySchema),
  savingThrows: z.array(savingThrowProficiencySchema),
  senses: z.array(z.string()),
  languages: z.array(z.string()),
  spells: z.array(characterSpellSchema),
  spellcastingAbility: z
    .enum([
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ])
    .optional(),
  spellSaveDC: z.number().optional(),
  spellAttackBonus: z.number().optional(),
  advantages: z.array(advantageEntrySchema),
  traits: characterTraitsSchema,
  importedAt: z.number(),
  sourceUrl: z.string().optional(),
  ddbId: z.number().optional(),
});

export const characterDynamicDataSchema = z.object({
  currentHP: z.number(),
  tempHP: z.number(),
  spellSlotsUsed: z.array(spellSlotLevelSchema),
  conditions: z.array(z.string()),
  deathSaves: deathSavesSchema,
  inventory: z.array(inventoryItemSchema),
  currency: currencySchema,
  xp: z.number(),
});

export const characterDataSchema = z.object({
  static: characterStaticDataSchema,
  dynamic: characterDynamicDataSchema,
});

export const playerInfoSchema = z.object({
  name: z.string(),
  online: z.boolean(),
  isHost: z.boolean(),
});

// === Client → Server schemas ===

export const clientChatSchema = z.object({
  type: z.literal("client:chat"),
  content: z.string().min(1).max(2000),
  playerName: z.string().min(1).max(30),
});

export const clientJoinSchema = z.object({
  type: z.literal("client:join"),
  playerName: z.string().min(1).max(30),
  roomCode: z.string().length(6),
  aiConfig: aiConfigSchema.optional(),
  authToken: z.string().optional(),
  guestId: z.string().optional(),
  apiKey: z.string().optional(),
});

export const clientSetAIConfigSchema = z.object({
  type: z.literal("client:set_ai_config"),
  aiConfig: aiConfigSchema,
});

export const clientApproveJoinSchema = z.object({
  type: z.literal("client:approve_join"),
  playerName: z.string().min(1).max(30),
});

export const clientRejectJoinSchema = z.object({
  type: z.literal("client:reject_join"),
  playerName: z.string().min(1).max(30),
});

export const clientKickPlayerSchema = z.object({
  type: z.literal("client:kick_player"),
  playerName: z.string().min(1).max(30),
});

export const clientSetCharacterSchema = z.object({
  type: z.literal("client:set_character"),
  character: characterDataSchema,
});

export const clientStartStorySchema = z.object({
  type: z.literal("client:start_story"),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientChatSchema,
  clientJoinSchema,
  clientSetAIConfigSchema,
  clientApproveJoinSchema,
  clientRejectJoinSchema,
  clientKickPlayerSchema,
  clientSetCharacterSchema,
  clientStartStorySchema,
]);

// === Server → Client schemas ===

export const serverChatSchema = z.object({
  type: z.literal("server:chat"),
  content: z.string(),
  playerName: z.string(),
  timestamp: z.number(),
  id: z.string(),
});

export const serverAISchema = z.object({
  type: z.literal("server:ai"),
  content: z.string(),
  timestamp: z.number(),
  id: z.string(),
});

export const serverSystemSchema = z.object({
  type: z.literal("server:system"),
  content: z.string(),
  timestamp: z.number(),
});

export const serverRoomJoinedSchema = z.object({
  type: z.literal("server:room_joined"),
  roomCode: z.string(),
  players: z.array(z.string()),
  hostName: z.string(),
  hasApiKey: z.boolean(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  isHost: z.boolean().optional(),
  isReconnect: z.boolean().optional(),
  user: authUserSchema.optional(),
  characters: z.record(z.string(), characterDataSchema).optional(),
  allPlayers: z.array(playerInfoSchema).optional(),
  storyStarted: z.boolean().optional(),
});

export const serverPlayerJoinedSchema = z.object({
  type: z.literal("server:player_joined"),
  playerName: z.string(),
  players: z.array(z.string()),
  hostName: z.string(),
  allPlayers: z.array(playerInfoSchema).optional(),
});

export const serverPlayerLeftSchema = z.object({
  type: z.literal("server:player_left"),
  playerName: z.string(),
  players: z.array(z.string()),
  hostName: z.string(),
  allPlayers: z.array(playerInfoSchema).optional(),
});

export const serverCharacterUpdatedSchema = z.object({
  type: z.literal("server:character_updated"),
  playerName: z.string(),
  character: characterDataSchema,
});

export const serverErrorSchema = z.object({
  type: z.literal("server:error"),
  message: z.string(),
  code: z.string(),
});

export const serverJoinPendingSchema = z.object({
  type: z.literal("server:join_pending"),
  roomCode: z.string(),
  position: z.number().optional(),
});

export const serverJoinRequestSchema = z.object({
  type: z.literal("server:join_request"),
  playerName: z.string(),
  avatarUrl: z.string().optional(),
});

export const serverKickedSchema = z.object({
  type: z.literal("server:kicked"),
  reason: z.string(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverChatSchema,
  serverAISchema,
  serverSystemSchema,
  serverRoomJoinedSchema,
  serverPlayerJoinedSchema,
  serverPlayerLeftSchema,
  serverErrorSchema,
  serverJoinPendingSchema,
  serverJoinRequestSchema,
  serverKickedSchema,
  serverCharacterUpdatedSchema,
]);
