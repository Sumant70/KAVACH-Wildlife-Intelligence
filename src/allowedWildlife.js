// KAVACH Wildlife Intelligence — Centralized 15-Animal Configuration (Frontend)
// STRICT FILTER: ONLY THESE 15 APPROVED SPECIES ALLOWED:
// 1. Elephant
// 2. Tiger
// 3. Leopard
// 4. Wild Boar
// 5. Spotted Deer
// 6. Sloth Bear
// 7. Gaur / Indian Bison
// 8. Rhinoceros
// 9. Wild Buffalo
// 10. Crocodile
// 11. Snake
// 12. Cobra
// 13. Indian Python
// 14. Russell's Viper
// 15. Krait

export const ALLOWED_WILDLIFE = [
  "elephant",
  "tiger",
  "leopard",
  "wild_boar",
  "dog",
  "spotted_deer",
  "sloth_bear",
  "gaur",
  "rhinoceros",
  "wild_buffalo",
  "crocodile",
  "snake",
  "cobra",
  "indian_python",
  "russells_viper",
  "krait"
];

export const ALLOWED_SPECIES_CANONICAL = [
  "Elephant",
  "Tiger",
  "Leopard",
  "Wild Boar",
  "Dog",
  "Spotted Deer",
  "Sloth Bear",
  "Gaur / Indian Bison",
  "Rhinoceros",
  "Wild Buffalo",
  "Crocodile",
  "Snake",
  "Cobra",
  "Indian Python",
  "Russell's Viper",
  "Krait"
];

export const WILDLIFE_EMOJIS = {
  elephant: "🐘",
  tiger: "🐅",
  leopard: "🐆",
  wild_boar: "🐗",
  dog: "🐕",
  spotted_deer: "🦌",
  sloth_bear: "🐻",
  gaur: "🦬",
  rhinoceros: "🦏",
  wild_buffalo: "🐃",
  crocodile: "🐊",
  snake: "🐍",
  cobra: "🐍",
  indian_python: "🐍",
  russells_viper: "🐍",
  krait: "🐍"
};

export function normalizeWildlifeName(name) {
  if (!name) return "";
  return name.toString().trim().toLowerCase().replace(/[_-\s']/g, "");
}

export function isAllowedWildlife(speciesName) {
  if (!speciesName) return false;
  const norm = normalizeWildlifeName(speciesName);
  
  // Specific checks against allowed keys and aliases
  if (norm.includes("elephant")) return true;
  if (norm.includes("tiger") && !norm.includes("lion")) return true;
  if (norm.includes("leopard")) return true;
  if (norm.includes("boar") || norm.includes("wildboar")) return true;
  if (norm.includes("dog") || norm.includes("canine") || norm.includes("hound")) return true;
  if (norm.includes("spotteddeer") || norm.includes("chital")) return true;
  if (norm.includes("slothbear")) return true;
  if (norm.includes("gaur") || norm.includes("bison")) return true;
  if (norm.includes("rhino")) return true;
  if (norm.includes("wildbuffalo") || norm.includes("waterbuffalo")) return true;
  if (norm.includes("croc") || norm.includes("mugger")) return true;
  if (norm.includes("krait")) return true;
  if (norm.includes("cobra")) return true;
  if (norm.includes("python")) return true;
  if (norm.includes("viper")) return true;
  if (norm === "snake" || norm.includes("serpentes")) return true;

  return false;
}

export function getWildlifeEmoji(speciesName) {
  if (!speciesName) return "🐾";
  const norm = normalizeWildlifeName(speciesName);
  for (const [key, emoji] of Object.entries(WILDLIFE_EMOJIS)) {
    if (norm.includes(normalizeWildlifeName(key))) return emoji;
  }
  return "🐾";
}
