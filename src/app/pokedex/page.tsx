import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PokedexBrowser } from "@/features/pokedex/pokedex-browser";
import { getPokedexCatalog } from "@/lib/pokedex/data";

const PokedexPage = () => {
  const catalog = getPokedexCatalog();

  return (
    <main className="pokedex-shell">
      <header className="pokedex-header">
        <Link className="back-link" href="/">
          <ArrowLeft aria-hidden="true" size={18} /> Back to game
        </Link>
        <div className="pokedex-title">
          <span aria-hidden="true" className="pokeball-icon" />
          <div>
            <p className="eyebrow">National archive</p>
            <h1>Pokédex</h1>
          </div>
        </div>
        <p className="pokedex-deck">
          Browse all {catalog.speciesCount.toLocaleString("en-US")} Pokémon by
          generation, then open a record to trace its entries across games.
        </p>
      </header>
      <div className="pokedex-content">
        <PokedexBrowser catalog={catalog} />
      </div>
    </main>
  );
};

export default PokedexPage;