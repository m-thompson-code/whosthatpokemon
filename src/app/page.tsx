import { BookOpen, Crown, Gamepad2 } from "lucide-react";
import Link from "next/link";

import { JoinRoomForm } from "@/features/rooms/join-room-form";

const Home = () => (
  <main className="home-shell">
    <header className="site-header">
      <Link className="wordmark" href="/">
        <span className="wordmark-dot" aria-hidden="true" />
        Who&apos;s That Pokemon?
      </Link>
      <nav className="header-actions" aria-label="Primary navigation">
        <Link className="header-link" href="/play">
          <Gamepad2 aria-hidden="true" size={18} />
          Play
        </Link>
        <Link className="header-link" href="/pokedex">
          <BookOpen aria-hidden="true" size={18} />
          Pokedex
        </Link>
        <Link className="host-link" href="/host">
          <Crown aria-hidden="true" size={18} />
          Host a game
        </Link>
      </nav>
    </header>

    <section className="entry-stage">
      <div className="entry-copy">
        <h1>
          Read. Guess.<br />
          <span>Reveal.</span>
        </h1>
        <p className="intro">
          Match one Pokédex entry to four Pokémon. Start a room as the host, or join an existing room with a code.
        </p>

        <div className="room-setup-card" aria-label="Room setup options">
          <JoinRoomForm />
        </div>

        <div className="free-mode-section">
          <Link className="free-mode-cta" href="/play">
            <span className="free-mode-cta__copy">
              <Gamepad2 aria-hidden="true" />
              <span><strong>Free Mode</strong><small>No lobby required</small></span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  </main>
);

export default Home;