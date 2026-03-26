// Preservation Evoker spell IDs
export const SPELLS = {
  // Core heals
  ECHO: 364343,
  REVERSION: 366155,
  DREAM_BREATH: 355936,
  DREAM_BREATH_FONT: 382614, // Font of Magic variant
  EMERALD_BLOSSOM: 355913,
  EMERALD_BLOSSOM_HEAL: 355916,
  VERDANT_EMBRACE: 360995,
  VERDANT_EMBRACE_CAST: 361195,
  TEMPORAL_ANOMALY: 373861,
  TEMPORAL_ANOMALY_SHIELD: 373862,
  MERITHRAS_BLESSING: 1256581,
  MERITHRAS_BLESSING_BUFF: 1256579,
  SPIRITBLOOM: 382731,

  // Cooldowns
  REWIND: 363534,
  DREAM_FLIGHT: 359816,
  STASIS: 370537,
  TIME_DILATION: 357170,
  TIP_THE_SCALES: 370553,
  ZEPHYR: 374227,
  TIME_SPIRAL: 374968,

  // Damage / Utility
  FIRE_BREATH: 357208,
  DISINTEGRATE: 356995,
  LIVING_FLAME: 361469,
  CHRONO_FLAMES: 431443,

  // Buffs
  ESSENCE_BURST: 369299,
  ECHO_BUFF: 364343, // same as cast
  ANCIENT_FLAME: 375583,
  CALL_OF_YSERA: 373835,
  TEMPORAL_COMPRESSION: 431637,
  SPARK_OF_INSIGHT: 431648,

  // Defensive
  OBSIDIAN_SCALES: 363916,
  RENEWING_BLAZE: 374348,
  RESCUE: 370665,

  // Movement
  HOVER: 358267,
  GLIDE: 358733,

  // Dispel
  NATURALIZE: 360823,
} as const;

// Spell name lookup
export const SPELL_NAMES: Record<number, string> = {
  [SPELLS.ECHO]: "Echo",
  [SPELLS.REVERSION]: "Reversion",
  [SPELLS.DREAM_BREATH]: "Dream Breath",
  [SPELLS.EMERALD_BLOSSOM]: "Emerald Blossom",
  [SPELLS.EMERALD_BLOSSOM_HEAL]: "Emerald Blossom (heal)",
  [SPELLS.VERDANT_EMBRACE]: "Verdant Embrace",
  [SPELLS.VERDANT_EMBRACE_CAST]: "Verdant Embrace (cast)",
  [SPELLS.TEMPORAL_ANOMALY]: "Temporal Anomaly",
  [SPELLS.TEMPORAL_ANOMALY_SHIELD]: "Temporal Anomaly (shield)",
  [SPELLS.MERITHRAS_BLESSING]: "Merithra's Blessing",
  [SPELLS.MERITHRAS_BLESSING_BUFF]: "Merithra's Blessing (buff)",
  [SPELLS.SPIRITBLOOM]: "Spiritbloom",
  [SPELLS.REWIND]: "Rewind",
  [SPELLS.DREAM_FLIGHT]: "Dream Flight",
  [SPELLS.STASIS]: "Stasis",
  [SPELLS.TIME_DILATION]: "Time Dilation",
  [SPELLS.TIP_THE_SCALES]: "Tip the Scales",
  [SPELLS.ZEPHYR]: "Zephyr",
  [SPELLS.TIME_SPIRAL]: "Time Spiral",
  [SPELLS.FIRE_BREATH]: "Fire Breath",
  [SPELLS.DISINTEGRATE]: "Disintegrate",
  [SPELLS.LIVING_FLAME]: "Living Flame",
  [SPELLS.CHRONO_FLAMES]: "Chrono Flames",
  [SPELLS.ESSENCE_BURST]: "Essence Burst",
  [SPELLS.OBSIDIAN_SCALES]: "Obsidian Scales",
  [SPELLS.HOVER]: "Hover",
  [SPELLS.GLIDE]: "Glide",
  [SPELLS.NATURALIZE]: "Naturalize",
  [SPELLS.RESCUE]: "Rescue",
  [SPELLS.RENEWING_BLAZE]: "Renewing Blaze",
};

export function spellName(id: number): string {
  return SPELL_NAMES[id] ?? `Unknown(${id})`;
}

// Spell icon lookup (icon filenames from WCL abilityIcon, without .jpg)
export const SPELL_ICONS: Record<number, string> = {
  [SPELLS.ECHO]: "ability_evoker_echo",
  [SPELLS.REVERSION]: "ability_evoker_reversion",
  [SPELLS.DREAM_BREATH]: "ability_evoker_dreambreath",
  [SPELLS.EMERALD_BLOSSOM]: "ability_evoker_emeraldblossom",
  [SPELLS.VERDANT_EMBRACE]: "ability_evoker_rescue",
  [SPELLS.VERDANT_EMBRACE_CAST]: "ability_evoker_rescue",
  [SPELLS.TEMPORAL_ANOMALY]: "ability_evoker_temporalanomaly",
  [SPELLS.MERITHRAS_BLESSING]: "ability_evoker_spiritbloom",
  [SPELLS.SPIRITBLOOM]: "ability_evoker_spiritbloom",
  [SPELLS.REWIND]: "ability_evoker_rewind",
  [SPELLS.DREAM_FLIGHT]: "ability_evoker_dreamflight",
  [SPELLS.TIME_DILATION]: "ability_evoker_timedilation",
  [SPELLS.TIP_THE_SCALES]: "ability_evoker_tipthescales",
  [SPELLS.ZEPHYR]: "ability_evoker_hoverblack",
  [SPELLS.TIME_SPIRAL]: "ability_evoker_timespiral",
  [SPELLS.FIRE_BREATH]: "ability_evoker_firebreath",
  [SPELLS.DISINTEGRATE]: "ability_evoker_disintegrate",
  [SPELLS.LIVING_FLAME]: "ability_evoker_livingflame",
  [SPELLS.CHRONO_FLAMES]: "inv_ability_chronowardenevoker_chronoflame",
  [SPELLS.ESSENCE_BURST]: "ability_evoker_essenceburst",
  [SPELLS.OBSIDIAN_SCALES]: "inv_artifact_dragonscales",
  [SPELLS.HOVER]: "ability_evoker_hover",
  [SPELLS.GLIDE]: "ability_racial_glide",
  [SPELLS.NATURALIZE]: "ability_evoker_fontofmagic_green",
  [SPELLS.RESCUE]: "ability_evoker_flywithme",
  [SPELLS.RENEWING_BLAZE]: "ability_evoker_masterylifebinder_red",
};

export function spellIcon(id: number): string | null {
  return SPELL_ICONS[id] ?? null;
}

export function spellIconUrl(id: number): string | null {
  const icon = SPELL_ICONS[id];
  if (!icon) return null;
  return `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`;
}

// For icons returned by WCL API (abilityIcon field like "ability_evoker_echo.jpg")
export function wclIconUrl(abilityIcon: string): string {
  const name = abilityIcon.replace(/\.jpg$/, "");
  return `https://wow.zamimg.com/images/wow/icons/large/${name}.jpg`;
}

// Healing GCD spells (for ABC analysis)
export const HEALING_GCDS = new Set<number>([
  SPELLS.ECHO,
  SPELLS.REVERSION,
  SPELLS.DREAM_BREATH,
  SPELLS.EMERALD_BLOSSOM,
  SPELLS.VERDANT_EMBRACE_CAST,
  SPELLS.TEMPORAL_ANOMALY,
  SPELLS.MERITHRAS_BLESSING,
  SPELLS.SPIRITBLOOM,
  SPELLS.LIVING_FLAME,
  SPELLS.NATURALIZE,
]);

// Empowered spells
export const EMPOWERED_SPELLS = new Set<number>([
  SPELLS.DREAM_BREATH,
  SPELLS.FIRE_BREATH,
  SPELLS.SPIRITBLOOM,
]);

// Spells that consume Echo
export const ECHO_CONSUMERS = new Set<number>([
  SPELLS.REVERSION,
  SPELLS.DREAM_BREATH,
  SPELLS.EMERALD_BLOSSOM,
  SPELLS.VERDANT_EMBRACE,
  SPELLS.VERDANT_EMBRACE_CAST,
  SPELLS.LIVING_FLAME,
  SPELLS.MERITHRAS_BLESSING,
  SPELLS.SPIRITBLOOM,
]);
