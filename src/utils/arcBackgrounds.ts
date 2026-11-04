import romanceDawnBg from "../../assets/images/backgrounds/romance_dawn.jpeg";
import orangeTownBg from "../../assets/images/backgrounds/orange_town.jpeg";
import syrupVillageBg from "../../assets/images/backgrounds/syrup_village.jpeg";
import baratieBg from "../../assets/images/backgrounds/baretie.jpeg";
import arlongParkBg from "../../assets/images/backgrounds/arlong_park.jpeg";
import loguetownBg from "../../assets/images/backgrounds/loguetown.jpeg";
import reverseMountainBg from "../../assets/images/backgrounds/reverse_mountain.jpeg";
import whiskyPeakBg from "../../assets/images/backgrounds/whisky_peak.jpeg";
import littleGardenBg from "../../assets/images/backgrounds/little_garden.jpeg";
import drumIslandBg from "../../assets/images/backgrounds/drum_island.jpeg";
import alabastaBg from "../../assets/images/backgrounds/alabasta.jpeg";
import jayaBg from "../../assets/images/backgrounds/jaya.jpeg";
import skypieaBg from "../../assets/images/backgrounds/skypia.jpeg";
import longRingBg from "../../assets/images/backgrounds/long_ring_long_island.jpeg";
import waterSevenBg from "../../assets/images/backgrounds/water_seven.jpeg";
import eniesLobbyBg from "../../assets/images/backgrounds/enies_lobby.jpeg";
import thrillerBarkBg from "../../assets/images/backgrounds/thriller_bark.jpeg";
import sabaodyBg from "../../assets/images/backgrounds/sabaody_archipelago.jpeg";
import amazonLilyBg from "../../assets/images/backgrounds/amazon_lilly.jpeg";
import impelDownBg from "../../assets/images/backgrounds/impel_down.jpeg";
import marinefordBg from "../../assets/images/backgrounds/marineford.jpeg";
import fishmanIslandBg from "../../assets/images/backgrounds/fishman_island.jpeg";
import punkHazardBg from "../../assets/images/backgrounds/punk_hazard.jpeg";

export const DEFAULT_ARC_BACKGROUND =
  "https://images5.alphacoders.com/132/1329624.png";

/**
 * Mapping of Arc IDs to their custom background image asset.
 */
export const ARC_BACKGROUNDS_BY_ID: Record<number, string> = {
  1: romanceDawnBg,
  2: orangeTownBg,
  3: syrupVillageBg,
  5: baratieBg,
  6: arlongParkBg,
  8: loguetownBg,
  9: reverseMountainBg,
  10: whiskyPeakBg,
  12: littleGardenBg,
  13: drumIslandBg,
  14: alabastaBg,
  15: jayaBg,
  16: skypieaBg,
  17: longRingBg,
  18: waterSevenBg,
  19: eniesLobbyBg,
  21: thrillerBarkBg,
  22: sabaodyBg,
  23: amazonLilyBg,
  24: impelDownBg,
  26: marinefordBg,
  29: fishmanIslandBg,
  30: punkHazardBg,
};

/**
 * Normalizes an arc title to check against known arc names.
 */
export const ARC_BACKGROUNDS_BY_TITLE: Record<string, string> = {
  "romance dawn": romanceDawnBg,
  "orange town": orangeTownBg,
  "syrup village": syrupVillageBg,
  baratie: baratieBg,
  "arlong park": arlongParkBg,
  loguetown: loguetownBg,
  "reverse mountain": reverseMountainBg,
  "whisky peak": whiskyPeakBg,
  "little garden": littleGardenBg,
  "drum island": drumIslandBg,
  alabasta: alabastaBg,
  arabasta: alabastaBg,
  jaya: jayaBg,
  skypiea: skypieaBg,
  "long ring long land": longRingBg,
  "water seven": waterSevenBg,
  "enies lobby": eniesLobbyBg,
  "thriller bark": thrillerBarkBg,
  "sabaody archipelago": sabaodyBg,
  "amazon lily": amazonLilyBg,
  "impel down": impelDownBg,
  marineford: marinefordBg,
  "fishman island": fishmanIslandBg,
  "fish-man island": fishmanIslandBg,
  "punk hazard": punkHazardBg,
};

interface ArcLike {
  id: number;
  title?: string;
  backgroundImage?: string;
}

/**
 * Returns the appropriate background image URL for a given arc,
 * falling back to the default background if none is specifically provided.
 */
export function getArcBackground(arc?: ArcLike | number | null): string {
  if (!arc) {
    return DEFAULT_ARC_BACKGROUND;
  }

  const arcId = typeof arc === "number" ? arc : arc.id;
  if (ARC_BACKGROUNDS_BY_ID[arcId]) {
    return ARC_BACKGROUNDS_BY_ID[arcId];
  }

  if (typeof arc !== "number") {
    if (arc.title) {
      const normalized = arc.title.trim().toLowerCase();
      if (ARC_BACKGROUNDS_BY_TITLE[normalized]) {
        return ARC_BACKGROUNDS_BY_TITLE[normalized];
      }
    }

    if (arc.backgroundImage) {
      return arc.backgroundImage;
    }
  }

  return DEFAULT_ARC_BACKGROUND;
}
