/**
 * Spanish→English MTG vocabulary for lexical retrieval (SPEC §9.4).
 *
 * Pure TS, no Node APIs. The rules corpus is English-only, so Spanish
 * questions have zero token overlap. Retrieval normalizes both sides and
 * translates Spanish MTG terms so Spanish questions can match rule text.
 */

/**
 * @description Lowercase + strip diacritics (NFD → drop combining marks) +
 * collapse whitespace. Both sides of retrieval go through this, so
 * "instantáneo" and "instantaneo" compare equal. Pure, deterministic.
 * @param text Raw text (question or rule).
 * @returns Normalized lowercase text, ASCII-leaning.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * ES→EN MTG terms. Keys pre-normalized (accent-free, lowercase, plain
 * letters + spaces only — safe inside the match regex). Multi-word phrases
 * first — longest match wins.
 */
export const ES_MTG_TERMS: Readonly<Record<string, string>> = {
  // Multi-word phrases first: longest match wins.
  "paso de declarar atacantes": "declare attackers step",
  "paso de declarar bloqueadores": "declare blockers step",
  "fase de combate": "combat phase",
  "fase principal": "main phase",
  "campo de batalla": "battlefield",
  "vinculo vital": "lifelink",
  "toque mortal": "deathtouch",
  // Single-word terms.
  "pila": "stack",
  "criatura": "creature",
  "conjuro": "sorcery",
  "instantaneo": "instant",
  "encantamiento": "enchantment",
  "tierra": "land",
  "hechizo": "spell",
  "habilidad": "ability",
  "prioridad": "priority",
  "turno": "turn",
  "dano": "damage",
  "letal": "lethal",
  "atacar": "attack",
  "bloquear": "block",
  "vida": "life",
  "contador": "counter",
  "biblioteca": "library",
  "cementerio": "graveyard",
  "mano": "hand",
  "exilio": "exile",
  "mazo": "deck",
  "volar": "flying",
  "vigilancia": "vigilance",
  "amenaza": "menace",
  "defensor": "defender",
  "ganar": "win",
  "perder": "lose",
  "robar": "draw",
  "jugar": "play",
  "lanzar": "cast",
  "pagar": "pay",
  "mana": "mana",
  "comandante": "commander",
  "zona": "zone",
};

/** Longest key first — multi-word phrases match before their single words. */
const SORTED_TERMS: ReadonlyArray<readonly [string, string]> = Object.entries(
  ES_MTG_TERMS,
).sort((a, b) => b[0].length - a[0].length);

/**
 * @description Translate Spanish MTG terms in a question to English rule
 * vocabulary. Whole-word matches on the normalized question (accent-stripped,
 * so "vínculo vital" hits "vinculo vital"). Multi-word keys match verbatim.
 * @param question The player's trimmed question.
 * @returns Matched English terms — "combat phase", "stack", ... Deduped,
 * longest key first. Empty when the question holds no Spanish MTG vocabulary.
 */
export function translateTerms(question: string): string[] {
  const normalized = normalize(question);
  const found = new Set<string>();
  for (const [es, en] of SORTED_TERMS) {
    if (new RegExp(`(?<![a-z0-9])${es}(?![a-z0-9])`).test(normalized)) {
      found.add(en);
    }
  }
  return [...found];
}
