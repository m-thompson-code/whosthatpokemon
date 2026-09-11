import type { FreeModeChoice, FreeModeRound } from "@/lib/free-mode/types";
import type {
  PokedexEntry,
  PokemonRecord,
  PokemonSummary,
  SimilarityStrategy,
  VersionPokemonIndex,
} from "@/lib/pokedex/types";

type RandomIndex = (upperBound: number) => number;

const takeRandom = <Value,>(
  values: Value[],
  count: number,
  randomIndex: RandomIndex,
) => {
  const remaining = [...values];
  const selected: Value[] = [];

  while (selected.length < count && remaining.length > 0) {
    selected.push(remaining.splice(randomIndex(remaining.length), 1)[0]);
  }

  return selected;
};

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
  const safeEntries = answer.entries.filter((entry) =>
    !entry.revealsName && (!selectedGames || selectedGames.has(entry.version)),
  );
  if (safeEntries.length === 0) {
    throw new Error(`${answer.name} has no usable Pokédex entries.`);
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
  const hardEntryOptions = safeEntries
    .map((entry) => ({ entry, strategies: getViableStrategies(entry) }))
    .filter((option) => option.strategies.length > 0);
  const selectedEntryOption = hardEntryOptions.length > 0
    ? hardEntryOptions[randomIndex(hardEntryOptions.length)]
    : null;
  const entry = selectedEntryOption?.entry ?? safeEntries[randomIndex(safeEntries.length)];
  const strategyPool = selectedEntryOption
    ? selectedEntryOption.strategies[randomIndex(selectedEntryOption.strategies.length)]
    : null;
  const hardFallbackIds = [...new Set(strategyEntries.flatMap(([, ids]) => ids))]
    .filter((id) => summariesById.has(id));
  const fallbackIds = hardFallbackIds.length >= 3
    ? hardFallbackIds
    : answer.similarPokemonIds.filter((id) => summariesById.has(id));
  const candidateIds = strategyPool?.ids ?? fallbackIds;
  const distractors = takeRandom(candidateIds.slice(0, 8), 3, randomIndex)
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
    entryText: entry.text,
    sourceGame: entry.versionDisplayName,
    answerId: answer.id,
    choices: shuffle(
      [answerSummary, ...distractors].map(toChoice),
      randomIndex,
    ),
    similarityStrategy: strategyPool?.strategy ?? "overall",
  };
};