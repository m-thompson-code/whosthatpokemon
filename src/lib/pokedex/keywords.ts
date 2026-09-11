const commonWords = new Set([
  "a", "about", "after", "all", "also", "always", "an", "and", "any", "are", "around", "as", "at", "away", "back", "be", "because", "become", "becomes", "been", "being", "body", "bodies", "both", "but", "by", "can", "come", "comes", "control", "could", "day", "does", "each", "enemies", "enemy", "energy", "even", "every", "for", "from", "get", "gets", "give", "gives", "go", "goes", "grow", "grows", "has", "have", "he", "her", "him", "his", "how", "however", "if", "in", "into", "is", "it", "its", "just", "known", "like", "live", "lives", "make", "makes", "many", "may", "more", "most", "move", "moves", "much", "must", "never", "no", "not", "of", "off", "often", "on", "one", "only", "opponent", "opponents", "or", "other", "others", "out", "over", "people", "pokemon", "pokemons", "power", "powers", "said", "see", "seen", "she", "should", "some", "sometimes", "such", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "through", "time", "to", "too", "trainer", "trainers", "under", "up", "use", "used", "uses", "using", "very", "was", "way", "were", "what", "when", "where", "which", "while", "who", "will", "with", "without", "would", "you", "your",
]);

export const normalizeEntryWords = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .match(/[a-z0-9]+/g) ?? [];

export const isCommonEntryWord = (word: string, frequency: number, entryCount: number) =>
  commonWords.has(word) || frequency >= Math.ceil(entryCount * .01);