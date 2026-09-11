import type { FreeModeChoice, FreeModeRound } from "@/lib/free-mode/types";
import type {
  PokedexEntry,
  PokemonRecord,
  PokemonSummary,
  SimilarityStrategy,
  VersionPokemonIndex,
} from "@/lib/pokedex/types";

type RandomIndex = (upperBound: number) => number;

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const censorPokemonName = (text: string, name: string) =>
  text.replace(new RegExp(escapeForRegExp(name), "gi"), "_______");

const shuffle = <Value,>(values: Value[], randomIndex: RandomIndex) => {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const toChoice = (pokemon: PokemonSummary): FreeModeChoice => ({
  id: pokemon.id,
  name: pokemon.name,
  imagePath: pokemon.imagePath,
  types: pokemon.types,
});

export const createFreeModeRound = (
  answer: PokemonRecord,
  catalog: PokemonSummary[],
  versionPokemonIndex: VersionPokemonIndex,
  randomIndex: RandomIndex,
  roundId: string,
  selectedGameIds?: string[],
): FreeModeRound => {
  const selectedGames = selectedGameIds && selectedGameIds.length > 0
    ? new Set(selectedGameIds)
    : null;
  const eligibleEntries = answer.entries.filter((entry) =>
    !selectedGames || selectedGames.has(entry.version),
  );
  if (eligibleEntries.length === 0) {
    throw new Error(`${answer.name} has no Pokédex entries for the selected games.`);
  }

  const summariesById = new Map(catalog.map((pokemon) => [pokemon.id, pokemon]));
  const strategyEntries = Object.entries(answer.similarityPools) as Array<
    [SimilarityStrategy, number[]]
  >;
  const getViableStrategies = (entry: PokedexEntry) => {
    const availableInGame = new Set(versionPokemonIndex[entry.version] ?? []);
    return strategyEntries
      .map(([strategy, ids]) => ({
        strategy,
        ids: ids.filter((id) => availableInGame.has(id) && summariesById.has(id)),
      }))
      .filter((candidatePool) => candidatePool.ids.length >= 3);
  };
  const hardEntryOptions = eligibleEntries
    .map((entry) => ({ entry, strategies: getViableStrategies(entry) }))
    .filter((option) => option.strategies.length > 0);
  const selectedEntryOption = hardEntryOptions.length > 0
    ? hardEntryOptions[randomIndex(hardEntryOptions.length)]
    : null;
  const entry = selectedEntryOption?.entry ?? eligibleEntries[randomIndex(eligibleEntries.length)];
  const availableInGame = new Set(versionPokemonIndex[entry.version] ?? []);
  const clueTraits = new Set(entry.traits ?? []);
  const clueKeywords = entry.keywords?.slice(0, 24) ?? [];
  const keywordWeights = new Map(clueKeywords.map((keyword, index) => [keyword, clueKeywords.length - index]));
  const rankedCandidates = new Map<number, { matches: number; score: number }>();

  strategyEntries.forEach(([, ids]) => {
    ids.forEach((id, index) => {
      if (!availableInGame.has(id) || !summariesById.has(id)) return;
      const current = rankedCandidates.get(id) ?? { matches: 0, score: 0 };
      rankedCandidates.set(id, {
        matches: current.matches + 1,
        score: current.score + Math.max(1, ids.length - index),
      });
    });
  });

  const sortedCandidates = [...rankedCandidates.entries()]
    .map(([id, candidate]) => ({
      id,
      ...candidate,
      traitMatches: summariesById.get(id)?.entryTraits.filter((trait) => clueTraits.has(trait)).length ?? 0,
      keywordScore: summariesById.get(id)?.entryKeywords.reduce(
        (score, keyword) => score + (keywordWeights.get(keyword) ?? 0),
        0,
      ) ?? 0,
    }))
    .sort((left, right) => right.keywordScore - left.keywordScore || right.matches - left.matches || right.traitMatches - left.traitMatches || right.score - left.score || left.id - right.id);
  const sharedSignalCandidates = sortedCandidates.filter((candidate) => candidate.matches >= 2);
  const candidateIds = (sharedSignalCandidates.length >= 3 ? sharedSignalCandidates : sortedCandidates)
    .map((candidate) => candidate.id);
  const fallbackIds = answer.similarPokemonIds.filter((id) => summariesById.has(id) && availableInGame.has(id));
  const distractors = [...candidateIds, ...fallbackIds.filter((id) => !candidateIds.includes(id))]
    .slice(0, 3)
    .map((id) => summariesById.get(id))
    .filter((pokemon): pokemon is PokemonSummary => pokemon !== undefined);

  if (distractors.length !== 3) {
    throw new Error("Not enough Pokémon are available to create four choices.");
  }

  const answerSummary = summariesById.get(answer.id);
  if (!answerSummary) {
    throw new Error(`${answer.name} is missing from the catalog index.`);
  }

  return {
    roundId,
    entryText: censorPokemonName(entry.text, answer.name),
    sourceGame: entry.versionDisplayName,
    answerId: answer.id,
    choices: shuffle(
      [answerSummary, ...distractors].map(toChoice),
      randomIndex,
    ),
    similarityStrategy: "overall",
  };
};