import Link from "next/link";
import NavBar from "./components/NavBar";
import BossSprite from "./components/BossSprite";
import AgentSprite from "./components/AgentSprite";

const SWATCHES = ["swatch-yellow", "swatch-cream", "swatch-green"];

const STEPS = [
  {
    n: "01",
    title: "ATTACK BLIND",
    body: "Pay 0.5 USDC and draw a hidden card from the boss's encrypted deck. You never see the weak point — only the damage.",
  },
  {
    n: "02",
    title: "FOG LIFTS",
    body: "Inco Lightning keeps the boss's HP and weak points encrypted onchain. Hints unlock only as HP crosses 75%, 50%, 25%.",
  },
  {
    n: "03",
    title: "POOL PAYS OUT",
    body: "When the boss falls, every USDC paid in gets batch-converted into real Megapot tickets — split by damage dealt, sent straight to raiders.",
  },
];

const FEATURES = [
  {
    icon: "[E]",
    title: "ENCRYPTED HP",
    body: "Boss HP and weak points live as encrypted state via Inco Lightning — nobody can read them, onchain or off, until the fight forces them open.",
  },
  {
    icon: "[R]",
    title: "FAIR SHUFFLE",
    body: "Damage cards come from a provably fair encrypted shuffle. No blockhash to front-run, no way to predict the next draw before you pay for it.",
  },
  {
    icon: "[P]",
    title: "COMMUNITY POOL",
    body: "Every attack fee from every raider joins one shared USDC pool — you're not grinding solo, the whole raid party wins together when the boss falls.",
  },
  {
    icon: "[$]",
    title: "REAL PAYOUT",
    body: "Boss defeat triggers a live Megapot batch ticket buy on Base, split by damage dealt.",
  },
];

const TECH = [
  { name: "Inco Lightning", body: "Encrypted onchain state" },
  { name: "Megapot", body: "Real USDC → jackpot tickets" },
  { name: "Base", body: "Fast, cheap settlement" },
];

export default function LandingPage() {
  return (
    <div className="container">
      <div className="mascot-wander" aria-hidden="true">
        <AgentSprite float size={9} />
      </div>
      <div className="mascot-wander right" aria-hidden="true">
        <BossSprite float size={9} />
      </div>

      <NavBar />

      <section className="hero">
        <div className="hero-badge-row">
          <span className="badge">INCO SUMMER GAME JAM</span>
          <span className="badge">BASE</span>
        </div>

        <div className="battle-row">
          <AgentSprite float size={12} />
          <div className="vs-badge pixel-font">VS</div>
          <BossSprite float size={12} />
        </div>

        <AgentSprite float size={7} />
        <h1 className="hero-title pixel-font">FOGPOT</h1>
        <p className="hero-sub">
          A hidden boss. A shared jackpot. Every hit is a secret until the
          fog lifts.
        </p>

        <div className="hero-cta-row">
          <Link href="/raid" className="attack-btn hero-cta">
            ENTER THE FOG
          </Link>
          <a href="#how" className="connect-btn hero-cta-secondary">
            HOW IT WORKS
          </a>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="stat-label">RAIDERS</div>
            <div className="stat-value hero-stat-value">128</div>
          </div>
          <div className="hero-stat">
            <div className="stat-label">POOL</div>
            <div className="stat-value hero-stat-value">$412</div>
          </div>
          <div className="hero-stat">
            <div className="stat-label">BOSS HP</div>
            <div className="stat-value hero-stat-value">64%</div>
          </div>
        </div>
      </section>

      <section className="panel swatch-green">
        <div className="section-title">
          <span className="badge">LIVE RAID</span>
        </div>
        <div className="live-preview-row">
          <BossSprite size={7} />
          <div className="live-preview-bar-wrap">
            <div className="hp-bar-track small">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className={`hp-seg${i < 13 ? " filled" : ""}`} />
              ))}
            </div>
            <div className="hp-label">
              <span>6,400 / 10,000 HP</span>
              <span>64%</span>
            </div>
          </div>
          <Link href="/raid" className="attack-btn live-preview-cta">
            JOIN
          </Link>
        </div>
      </section>

      <section id="how" className="panel">
        <div className="section-title">
          <span className="badge">HOW IT WORKS</span>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className={`step ${SWATCHES[i % SWATCHES.length]}`} key={s.n}>
              <div className="step-num pixel-font">{s.n}</div>
              <div className="step-title pixel-font">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <span className="badge">WHY FOGPOT</span>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div className={`feature-card ${SWATCHES[i % SWATCHES.length]}`} key={f.title}>
              <div className="feature-icon pixel-font">{f.icon}</div>
              <div className="feature-title pixel-font">{f.title}</div>
              <div className="feature-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <span className="badge">POWERED BY</span>
        </div>
        <div className="tech-row">
          {TECH.map((t, i) => (
            <div className={`tech-chip ${SWATCHES[i % SWATCHES.length]}`} key={t.name}>
              <strong>{t.name}</strong>
              <span>{t.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel cta-banner swatch-yellow">
        <div className="boss-title" style={{ marginBottom: 14 }}>
          READY TO RAID?
        </div>
        <p className="hero-sub cta-sub">
          The boss is waiting. Every hit funds the pool.
        </p>
        <Link href="/raid" className="attack-btn hero-cta">
          ENTER THE FOG
        </Link>
      </section>

      <div className="footer-note">
        BUILT FOR THE INCO SUMMER GAME JAM
        <br />
        Boss defeat triggers a real Megapot ticket batch-buy, split by contribution.
      </div>
    </div>
  );
}
