import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BookOpen, Ruler, Weight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPokedexCatalog, getPokemonRecord } from "@/lib/pokedex/data";
import type { PokedexEntry } from "@/lib/pokedex/types";

type PokemonPageProps = {
  params: Promise<{ id: string }>;
};

type GroupedEntry = {
  text: string;
  revealsName: boolean;
  games: Array<{ id: number; name: string }>;
};

const groupEntries = (entries: PokedexEntry[]) => {
  const grouped = new Map<string, GroupedEntry>();

  for (const entry of entries) {
    const existing = grouped.get(entry.text);
    if (existing) {
      existing.games.push({ id: entry.versionId, name: entry.versionDisplayName });
      existing.revealsName ||= entry.revealsName;
    } else {
      grouped.set(entry.text, {
        text: entry.text,
        revealsName: entry.revealsName,
        games: [{ id: entry.versionId, name: entry.versionDisplayName }],
      });
    }
  }

  return [...grouped.values()];
};

export const generateMetadata = async ({ params }: PokemonPageProps): Promise<Metadata> => {
  const { id } = await params;
  const pokemon = await getPokemonRecord(Number(id));
  return pokemon
    ? { title: `${pokemon.name} | Who's That Pokemon?`, description: `Read ${pokemon.name}'s Pokédex entries by game.` }
    : { title: "Pokemon not found" };
};

const PokemonPage = async ({ params }: PokemonPageProps) => {
  const { id } = await params;
  const pokemonId = Number(id);
  if (!Number.isInteger(pokemonId) || pokemonId < 1) notFound();

  const pokemon = await getPokemonRecord(pokemonId);
  if (!pokemon) notFound();

  const catalog = getPokedexCatalog();
  const summariesById = new Map(catalog.pokemon.map((item) => [item.id, item]));
  const similarPokemon = pokemon.similarPokemonIds
    .slice(0, 8)
    .map((similarId) => summariesById.get(similarId))
    .filter((item) => item !== undefined);
  const groupedEntries = groupEntries(pokemon.entries);
  const previous = pokemon.id > 1 ? summariesById.get(pokemon.id - 1) : null;
  const next = summariesById.get(pokemon.id + 1);

  return (
    <main className="pokemon-detail-shell">
      <header className="detail-nav">
        <Link className="back-link" href="/pokedex">
          <ArrowLeft aria-hidden="true" size={18} /> All Pokémon
        </Link>
        <span className="detail-number">National #{pokemon.id.toString().padStart(3, "0")}</span>
      </header>

      <section className="pokemon-profile">
        <div className="profile-art" data-color={pokemon.color}>
          <Image
            alt={pokemon.name}
            height={475}
            priority
            sizes="(max-width: 800px) 85vw, 42vw"
            src={pokemon.imagePath}
            width={475}
          />
        </div>
        <div className="profile-copy">
          <p className="eyebrow">Generation {pokemon.generation} · {pokemon.genus}</p>
          <h1>{pokemon.name}</h1>
          <div className="type-list detail-types">
            {pokemon.types.map((type) => <span data-type={type} key={type}>{type}</span>)}
          </div>
          <dl className="pokemon-facts">
            <div><dt><Ruler aria-hidden="true" /> Height</dt><dd>{(pokemon.height / 10).toFixed(1)} m</dd></div>
            <div><dt><Weight aria-hidden="true" /> Weight</dt><dd>{(pokemon.weight / 10).toFixed(1)} kg</dd></div>
            <div><dt>Shape</dt><dd>{pokemon.shape?.replaceAll("-", " ") ?? "Unknown"}</dd></div>
            <div><dt>Habitat</dt><dd>{pokemon.habitat?.replaceAll("-", " ") ?? "Unknown"}</dd></div>
          </dl>
        </div>
      </section>

      <section className="entry-section">
        <div className="section-heading">
          <BookOpen aria-hidden="true" />
          <div><p className="eyebrow">Game archive</p><h2>Pokédex entries</h2></div>
          <span>{pokemon.entries.length} game records · {groupedEntries.length} unique entries</span>
        </div>
        <div className="entry-list">
          {groupedEntries.map((entry) => (
            <article className="entry-row" key={entry.text}>
              <div className="game-badges">
                {entry.games.map((game) => <span key={game.id}>{game.name}</span>)}
              </div>
              <p>{entry.text}</p>
              {entry.revealsName && <small>Names the Pokémon directly</small>}
            </article>
          ))}
          {groupedEntries.length === 0 && <p>No English Pokédex entries are available.</p>}
        </div>
      </section>

      <section className="similar-section">
        <div className="section-heading"><div><p className="eyebrow">Related records</p><h2>Similar Pokémon</h2></div></div>
        <div className="similar-strip">
          {similarPokemon.map((item) => (
            <Link href={`/pokedex/${item.id}`} key={item.id}>
              <Image alt="" height={475} src={item.imagePath} width={475} />
              <span>#{item.id.toString().padStart(3, "0")}</span>
              <strong>{item.name}</strong>
            </Link>
          ))}
        </div>
      </section>

      <nav className="record-navigation" aria-label="Adjacent Pokemon">
        {previous ? <Link href={`/pokedex/${previous.id}`}><ArrowLeft /> #{previous.id.toString().padStart(3, "0")} {previous.name}</Link> : <span />}
        {next && <Link href={`/pokedex/${next.id}`}>#{next.id.toString().padStart(3, "0")} {next.name} <ArrowRight /></Link>}
      </nav>
    </main>
  );
};

export default PokemonPage;