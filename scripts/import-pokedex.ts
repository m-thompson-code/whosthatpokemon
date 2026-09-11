import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  PokedexCatalog,
  PokedexEntry,
  EntryWordIndex,
  PokemonRecord,
  PokemonSummary,
  SimilarityPools,
  SimilarityStrategy,
  VersionPokemonIndex,
} from "../src/lib/pokedex/types.ts";
import { SimilarityStrategy as Strategy } from "../src/lib/pokedex/types";
import { extractEntryTraits } from "../src/lib/pokedex/traits";
import { isCommonEntryWord, normalizeEntryWords } from "../src/lib/pokedex/keywords";

const API_BASE_URL = "https://pokeapi.co/api/v2";
const CACHE_DIRECTORY = resolve(".cache/pokeapi");
const OUTPUT_DIRECTORY = resolve("data/pokedex");
const POKEMON_OUTPUT_DIRECTORY = resolve(OUTPUT_DIRECTORY, "pokemon");
const DEFAULT_CONCURRENCY = 6;
const MAX_ATTEMPTS = 3;
const SIMILARITY_LIMIT = 40;
const STRATEGY_POOL_LIMIT = 16;

type NamedResource = { name: string; url: string };
type LocalizedName = { name: string; language: NamedResource };
type ResourceList = { count: number; results: NamedResource[] };
type SpeciesResponse = {
  id: number;
  name: string;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  color: NamedResource;
  shape: NamedResource | null;
  habitat: NamedResource | null;
  egg_groups: NamedResource[];
  generation: NamedResource;
  evolution_chain: { url: string } | null;
  evolves_from_species: NamedResource | null;
  names: LocalizedName[];
  genera: Array<{ genus: string; language: NamedResource }>;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: NamedResource;
    version: NamedResource;
  }>;
  varieties: Array<{ is_default: boolean; pokemon: NamedResource }>;
};
type PokemonResponse = {
  height: number;
  weight: number;
  types: Array<{ slot: number; type: NamedResource }>;
  stats: Array<{ base_stat: number; stat: NamedResource }>;
};
type VersionGroupResponse = {
  name: string;
  order: number;
};
type VersionResponse = {
  id: number;
  name: string;
  names: LocalizedName[];
  version_group: NamedResource;
};
type ImportOptions = {
  end: number | null;
  concurrency: number;
  refresh: boolean;
};

const parseResourceId = (url: string) => {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
};

const parseGeneration = (name: string) => {
  const values: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
  };
  return values[name.replace("generation-", "")] ?? 0;
};

const formatPokemonId = (id: number) => id.toString().padStart(3, "0");
const normalizeText = (text: string) =>
  text.replace(/[\n\r\f]+/g, " ").replace(/\s+/g, " ").trim();
const displaySlug = (slug: string) =>
  slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

const readPositiveFlag = (flag: string, fallback: number | null) => {
  const argumentsList = process.argv.slice(2);
  const index = argumentsList.indexOf(flag);
  if (index === -1) return fallback;
  const value = Number(argumentsList[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return value;
};

const parseOptions = (): ImportOptions => ({
  end: readPositiveFlag("--end", null),
  concurrency: readPositiveFlag("--concurrency", DEFAULT_CONCURRENCY) ?? DEFAULT_CONCURRENCY,
  refresh: process.argv.includes("--refresh"),
});

const wait = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const writeJson = async (path: string, value: unknown) => {
  const temporaryPath = `${path}.part`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
};

const fetchJson = async <Value>(path: string, cacheKey: string, refresh: boolean): Promise<Value> => {
  const cachePath = resolve(CACHE_DIRECTORY, `${cacheKey}.json`);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(cachePath, "utf8")) as Value;
    } catch {
      // Missing or invalid cache entries are fetched below.
    }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE_URL}/${path}`, {
        headers: { "User-Agent": "whosthatpokemon-catalog-importer/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
      const value = await response.json() as Value;
      await writeJson(cachePath, value);
      return value;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await wait(attempt * 750);
    }
  }

  throw new Error(`Unable to fetch ${path}`);
};

const mapConcurrent = async <Input, Output,>(
  values: Input[],
  concurrency: number,
  transform: (value: Input) => Promise<Output>,
) => {
  const output = new Array<Output>(values.length);
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await transform(values[index]);
      completed += 1;
      if (completed % 25 === 0 || completed === values.length) {
        console.log(`${completed}/${values.length} resources prepared`);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return output;
};

const overlapCount = (left: string[], right: string[]) =>
  left.filter((value) => right.includes(value)).length;
const vectorDistance = (left: number[], right: number[]) =>
  Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0));
const categoryMatches = (left: PokemonRecord, right: PokemonRecord) =>
  left.isBaby === right.isBaby &&
  left.isLegendary === right.isLegendary &&
  left.isMythical === right.isMythical;

const scoreSimilarity = (source: PokemonRecord, candidate: PokemonRecord) => {
  let score = 0;
  if (source.types[0] === candidate.types[0]) score += 24;
  score += overlapCount(source.types, candidate.types) * 12;
  if (source.shape && source.shape === candidate.shape) score += 14;
  score += overlapCount(source.eggGroups, candidate.eggGroups) * 7;
  if (source.color === candidate.color) score += 5;
  if (source.evolutionStage === candidate.evolutionStage) score += 9;
  if (categoryMatches(source, candidate)) score += 7;
  score += Math.max(0, 8 - Math.abs(source.generation - candidate.generation) * 2);
  score += Math.max(0, 18 - vectorDistance(source.stats, candidate.stats) / 12);
  score += Math.max(0, 5 - Math.abs(source.height - candidate.height) / 10);
  score += Math.max(0, 5 - Math.abs(source.weight - candidate.weight) / 150);
  if (source.evolutionChainId === candidate.evolutionChainId) score += 8;
  return score;
};

const baseStatTotal = (pokemon: PokemonRecord) =>
  pokemon.stats.reduce((sum, stat) => sum + stat, 0);

const sizeDistance = (source: PokemonRecord, candidate: PokemonRecord) =>
  Math.abs(source.height - candidate.height) * 3 +
  Math.abs(source.weight - candidate.weight) / 20;

const hasSharedType = (source: PokemonRecord, candidate: PokemonRecord) =>
  overlapCount(source.types, candidate.types) > 0;

const hasSharedEcology = (source: PokemonRecord, candidate: PokemonRecord) =>
  overlapCount(source.eggGroups, candidate.eggGroups) > 0 ||
  (source.habitat !== null && source.habitat === candidate.habitat);

const sortStrategyCandidates = (
  source: PokemonRecord,
  records: PokemonRecord[],
  strategy: SimilarityStrategy,
) => {
  const candidates = records.filter((candidate) => {
    if (candidate.id === source.id || candidate.entryCount === 0) return false;
    if (candidate.evolutionChainId === source.evolutionChainId) return false;
    if (!categoryMatches(source, candidate)) return false;

    switch (strategy) {
      case Strategy.TypeAndStage:
        return hasSharedType(source, candidate) && candidate.evolutionStage === source.evolutionStage;
      case Strategy.StatsAndRole:
        return candidate.evolutionStage === source.evolutionStage;
      case Strategy.ShapeAndSize:
        return source.shape !== null && candidate.shape === source.shape;
      case Strategy.Ecology:
        return hasSharedEcology(source, candidate);
      case Strategy.Generation:
        return candidate.generation === source.generation && candidate.evolutionStage === source.evolutionStage;
    }
  });

  return candidates
    .map((candidate) => {
      let strategyScore = scoreSimilarity(source, candidate);

      switch (strategy) {
        case Strategy.TypeAndStage:
          strategyScore += overlapCount(source.types, candidate.types) * 30;
          if (source.types.join("|") === candidate.types.join("|")) strategyScore += 24;
          break;
        case Strategy.StatsAndRole:
          strategyScore -= vectorDistance(source.stats, candidate.stats) * 1.8;
          strategyScore -= Math.abs(baseStatTotal(source) - baseStatTotal(candidate)) * 0.7;
          break;
        case Strategy.ShapeAndSize:
          strategyScore -= sizeDistance(source, candidate) * 2;
          if (source.color === candidate.color) strategyScore += 18;
          break;
        case Strategy.Ecology:
          strategyScore += overlapCount(source.eggGroups, candidate.eggGroups) * 22;
          if (source.habitat && source.habitat === candidate.habitat) strategyScore += 26;
          break;
        case Strategy.Generation:
          strategyScore += hasSharedType(source, candidate) ? 22 : 0;
          strategyScore -= Math.abs(baseStatTotal(source) - baseStatTotal(candidate)) * 0.25;
          break;
      }

      return { id: candidate.id, score: strategyScore };
    })
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, STRATEGY_POOL_LIMIT)
    .map((candidate) => candidate.id);
};

const createSimilarityPools = (
  source: PokemonRecord,
  records: PokemonRecord[],
): SimilarityPools => ({
  [Strategy.TypeAndStage]: sortStrategyCandidates(source, records, Strategy.TypeAndStage),
  [Strategy.StatsAndRole]: sortStrategyCandidates(source, records, Strategy.StatsAndRole),
  [Strategy.ShapeAndSize]: sortStrategyCandidates(source, records, Strategy.ShapeAndSize),
  [Strategy.Ecology]: sortStrategyCandidates(source, records, Strategy.Ecology),
  [Strategy.Generation]: sortStrategyCandidates(source, records, Strategy.Generation),
});

const getEvolutionStage = (
  speciesId: number,
  evolvesFromById: Map<number, number | null>,
) => {
  let stage = 1;
  let parentId = evolvesFromById.get(speciesId) ?? null;
  const visited = new Set([speciesId]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    stage += 1;
    parentId = evolvesFromById.get(parentId) ?? null;
  }
  return stage;
};

const main = async () => {
  const options = parseOptions();
  if (options.concurrency > 12) throw new Error("--concurrency cannot exceed 12.");

  await Promise.all([
    mkdir(CACHE_DIRECTORY, { recursive: true }),
    mkdir(POKEMON_OUTPUT_DIRECTORY, { recursive: true }),
  ]);

  const [speciesList, versionList, versionGroupList] = await Promise.all([
    fetchJson<ResourceList>("pokemon-species?limit=1", "species-list", options.refresh),
    fetchJson<ResourceList>("version?limit=100", "version-list", options.refresh),
    fetchJson<ResourceList>("version-group?limit=100", "version-group-list", options.refresh),
  ]);
  const end = Math.min(options.end ?? speciesList.count, speciesList.count);
  const speciesIds = Array.from({ length: end }, (_, index) => index + 1);

  const [versions, versionGroups] = await Promise.all([
    mapConcurrent(versionList.results, options.concurrency, async (resource) => {
      const id = parseResourceId(resource.url);
      if (!id) throw new Error(`Version is missing an ID: ${resource.url}`);
      return fetchJson<VersionResponse>(`version/${id}`, `version-${id}`, options.refresh);
    }),
    mapConcurrent(versionGroupList.results, options.concurrency, async (resource) => {
      const id = parseResourceId(resource.url);
      if (!id) throw new Error(`Version group is missing an ID: ${resource.url}`);
      return fetchJson<VersionGroupResponse>(`version-group/${id}`, `version-group-${id}`, options.refresh);
    }),
  ]);

  const versionGroupOrder = new Map(versionGroups.map((group) => [group.name, group.order]));
  const versionMetadata = new Map(versions.map((version) => [version.name, {
    id: version.id,
    displayName: version.names.find((name) => name.language.name === "en")?.name ?? displaySlug(version.name),
    group: version.version_group.name,
    order: versionGroupOrder.get(version.version_group.name) ?? Number.MAX_SAFE_INTEGER,
  }]));

  const sourceRecords = await mapConcurrent(speciesIds, options.concurrency, async (id) => {
    const species = await fetchJson<SpeciesResponse>(
      `pokemon-species/${id}`,
      `species-${id}`,
      options.refresh,
    );
    const defaultVariety = species.varieties.find((variety) => variety.is_default)?.pokemon;
    if (!defaultVariety) throw new Error(`${species.name} has no default variety.`);
    const pokemonId = parseResourceId(defaultVariety.url);
    if (!pokemonId) throw new Error(`${species.name} default variety has no ID.`);
    const pokemon = await fetchJson<PokemonResponse>(
      `pokemon/${pokemonId}`,
      `pokemon-${pokemonId}`,
      options.refresh,
    );
    return { species, pokemon };
  });

  const evolvesFromById = new Map(sourceRecords.map(({ species }) => [
    species.id,
    species.evolves_from_species ? parseResourceId(species.evolves_from_species.url) : null,
  ]));

  const records: PokemonRecord[] = sourceRecords.map(({ species, pokemon }) => {
    const name = species.names.find((item) => item.language.name === "en")?.name ?? displaySlug(species.name);
    const entries: PokedexEntry[] = species.flavor_text_entries
      .filter((entry) => entry.language.name === "en" && versionMetadata.has(entry.version.name))
      .map((entry) => {
        const version = versionMetadata.get(entry.version.name)!;
        const text = normalizeText(entry.flavor_text);
        return {
          versionId: version.id,
          version: entry.version.name,
          versionDisplayName: version.displayName,
          versionGroup: version.group,
          text,
          revealsName: text.toLocaleLowerCase("en-US").includes(name.toLocaleLowerCase("en-US")),
          traits: extractEntryTraits(text),
          keywords: [],
        };
      })
      .sort((left, right) => {
        const groupDifference =
          (versionMetadata.get(left.version)?.order ?? 0) -
          (versionMetadata.get(right.version)?.order ?? 0);
        return groupDifference || left.versionId - right.versionId;
      });

    return {
      id: species.id,
      slug: species.name,
      name,
      generation: parseGeneration(species.generation.name),
      genus: species.genera.find((item) => item.language.name === "en")?.genus ?? "Pokemon",
      types: pokemon.types.sort((left, right) => left.slot - right.slot).map((item) => item.type.name),
      imagePath: `/assets/pokemon/${formatPokemonId(species.id)}.png`,
      entryCount: entries.length,
      entryTraits: [...new Set(entries.flatMap((entry) => entry.traits))],
      entryKeywords: [],
      color: species.color.name,
      shape: species.shape?.name ?? null,
      habitat: species.habitat?.name ?? null,
      eggGroups: species.egg_groups.map((group) => group.name),
      evolutionChainId: species.evolution_chain ? parseResourceId(species.evolution_chain.url) : null,
      evolvesFromId: evolvesFromById.get(species.id) ?? null,
      evolutionStage: getEvolutionStage(species.id, evolvesFromById),
      height: pokemon.height,
      weight: pokemon.weight,
      stats: pokemon.stats.map((stat) => stat.base_stat),
      isBaby: species.is_baby,
      isLegendary: species.is_legendary,
      isMythical: species.is_mythical,
      entries,
      similarPokemonIds: [],
      similarityPools: {
        [Strategy.TypeAndStage]: [],
        [Strategy.StatsAndRole]: [],
        [Strategy.ShapeAndSize]: [],
        [Strategy.Ecology]: [],
        [Strategy.Generation]: [],
      },
    };
  });

  const entryDocumentCount = records.reduce((count, record) => count + record.entries.length, 0);
  const wordFrequencies = new Map<string, number>();
  records.forEach((record) => {
    record.entries.forEach((entry) => {
      new Set(normalizeEntryWords(entry.text)).forEach((word) => {
        wordFrequencies.set(word, (wordFrequencies.get(word) ?? 0) + 1);
      });
    });
  });
  const wordIndex: EntryWordIndex = Object.fromEntries(
    [...wordFrequencies.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([word, frequency]) => [word, {
        frequency,
        common: isCommonEntryWord(word, frequency, entryDocumentCount),
      }]),
  );
  records.forEach((record) => {
    const nameWords = new Set(normalizeEntryWords(record.name));
    record.entries.forEach((entry) => {
      entry.keywords = [...new Set(normalizeEntryWords(entry.text))]
        .filter((word) => !nameWords.has(word) && !wordIndex[word].common)
        .sort((left, right) => wordIndex[left].frequency - wordIndex[right].frequency || left.localeCompare(right));
    });
    record.entryKeywords = [...new Set(record.entries.flatMap((entry) => entry.keywords))]
      .sort((left, right) => wordIndex[left].frequency - wordIndex[right].frequency || left.localeCompare(right));
  });

  for (const record of records) {
    record.similarPokemonIds = records
      .filter((candidate) => candidate.id !== record.id && candidate.entryCount > 0)
      .map((candidate) => ({ id: candidate.id, score: scoreSimilarity(record, candidate) }))
      .sort((left, right) => right.score - left.score || left.id - right.id)
      .slice(0, SIMILARITY_LIMIT)
      .map((candidate) => candidate.id);
    record.similarityPools = createSimilarityPools(record, records);
  }

  await Promise.all(records.map((record) =>
    writeJson(resolve(POKEMON_OUTPUT_DIRECTORY, `${record.id}.json`), record),
  ));

  const summaries: PokemonSummary[] = records.map((record) => ({
    id: record.id,
    slug: record.slug,
    name: record.name,
    generation: record.generation,
    genus: record.genus,
    types: record.types,
    imagePath: record.imagePath,
    entryCount: record.entryCount,
    entryTraits: record.entryTraits,
    entryKeywords: record.entryKeywords,
  }));
  const generationIds = [...new Set(summaries.map((pokemon) => pokemon.generation))]
    .sort((left, right) => left - right);
  const catalog: PokedexCatalog = {
    schemaVersion: 4,
    generatedAt: new Date().toISOString(),
    source: API_BASE_URL,
    speciesCount: records.length,
    generations: generationIds.map((id) => ({
      id,
      name: `Generation ${id}`,
      pokemonCount: summaries.filter((pokemon) => pokemon.generation === id).length,
    })),
    pokemon: summaries,
  };

  await writeJson(resolve(OUTPUT_DIRECTORY, "index.json"), catalog);
  await writeJson(resolve(OUTPUT_DIRECTORY, "word-index.json"), wordIndex);
  const versionPokemonIndex: VersionPokemonIndex = Object.fromEntries(
    versions.map((version) => [
      version.name,
      records
        .filter((record) => record.entries.some((entry) => entry.version === version.name))
        .map((record) => record.id),
    ]),
  );
  await writeJson(resolve(OUTPUT_DIRECTORY, "version-pokemon.json"), versionPokemonIndex);
  const entryCount = records.reduce((sum, record) => sum + record.entryCount, 0);
  console.log(`Wrote ${records.length} Pokemon and ${entryCount} English entries.`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
