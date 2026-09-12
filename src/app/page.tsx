import Image from "next/image";
import Link from "next/link";

import { JoinRoomForm } from "@/features/rooms/join-room-form";

const Home = () => (
  <main className="home-shell">
    <Image
      alt=""
      aria-hidden="true"
      className="regirice-peek"
      height={512}
      priority
      src="/assets/regirice-nobackground.png"
      width={512}
    />
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
              <span aria-hidden="true" className="pokeball-icon" />
              <span><strong>Free Mode</strong><small>No lobby required</small></span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  </main>
);

export default Home;