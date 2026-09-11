"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { PokedexCatalog } from "@/lib/pokedex/types";

type PokedexBrowserProps = {
  catalog: PokedexCatalog;
};

export const PokedexBrowser = ({ catalog }: PokedexBrowserProps) => {
  const [generation, setGeneration] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("en-US"));
  const visiblePokemon = catalog.pokemon.filter((pokemon) => {
    const matchesGeneration = generation === 0 || pokemon.generation === generation;
    const matchesQuery =
      deferredQuery.length === 0 ||
      pokemon.name.toLocaleLowerCase("en-US").includes(deferredQuery) ||
      pokemon.id.toString().padStart(3, "0").includes(deferredQuery);
    return matchesGeneration && matchesQuery;
  });

  return (
    <>
      <div className="pokedex-tools">
        <div className="generation-tabs" aria-label="Filter by generation">
          <button
            aria-pressed={generation === 0}
            onClick={() => setGeneration(0)}
            type="button"
          >
            All
          </button>
          {catalog.generations.map((item) => (
            <button
              aria-pressed={generation === item.id}
              key={item.id}
              onClick={() => setGeneration(item.id)}
              type="button"
            >
              Gen {item.id}
            </button>
          ))}
        </div>
        <label className="pokedex-search">
          <span className="sr-only">Search Pokemon</span>
          <Search aria-hidden="true" size={19} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or number"
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="catalog-count">
        <strong>{visiblePokemon.length}</strong> Pokemon shown
      </div>

      <section className="pokemon-grid" aria-live="polite">
        {visiblePokemon.map((pokemon, index) => (
          <Link className="pokemon-tile" href={`/pokedex/${pokemon.id}`} key={pokemon.id}>
            <div className="pokemon-art">
              <Image
                alt={pokemon.name}
                height={475}
                loading={index < 8 ? "eager" : "lazy"}
                sizes="(max-width: 600px) 42vw, (max-width: 1000px) 28vw, 190px"
                src={pokemon.imagePath}
                width={475}
              />
              <span>#{pokemon.id.toString().padStart(3, "0")}</span>
            </div>
            <div className="pokemon-tile-copy">
              <h2>{pokemon.name}</h2>
              <p>{pokemon.genus}</p>
              <div className="type-list">
                {pokemon.types.map((type) => <span data-type={type} key={type}>{type}</span>)}
              </div>
            </div>
          </Link>
        ))}
        {visiblePokemon.length === 0 && (
          <p className="empty-catalog">No Pokemon match that search in this generation.</p>
        )}
      </section>
    </>
  );
};