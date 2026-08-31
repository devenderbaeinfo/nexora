import { loginPageConfig } from "../../config/loginPageConfig";
import NetworkBackground from "./NetworkBackground";
import DashboardPreview from "./DashboardPreview";
import LaptopFrame from "./LaptopFrame";

// Splits a description into text + highlighted-phrase segments, driven entirely by
// `hero.highlightPhrases` in config rather than hand-placed <span> tags per phrase.
function renderHighlighted(text: string, phrases: string[]) {
  if (phrases.length === 0) return text;
  const pattern = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(pattern).map((part, i) =>
    phrases.includes(part) ? <span className="teal" key={i}>{part}</span> : <span key={i}>{part}</span>
  );
}

export default function HeroPanel() {
  const { hero } = loginPageConfig;

  return (
    <section className="bae-hero-panel" aria-label="Product highlights">
      <NetworkBackground />

      <div className="bae-hero-content">
        <h1 className="bae-hero-title">
          {hero.titleLine1}
          <br />
          <span className="grad">{hero.titleLine2}</span> {hero.titleLine3}
        </h1>
        <p className="bae-hero-desc">{renderHighlighted(hero.description, hero.highlightPhrases)}</p>

        <LaptopFrame>
          <DashboardPreview />
        </LaptopFrame>
      </div>
    </section>
  );
}
