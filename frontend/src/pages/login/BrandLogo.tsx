// Fully code-based logo — swap `name`/`subtitle`/`accent` here or via props, never an <img>.
export default function BrandLogo({
  name, subtitle, accent = "#6D4AFF", size = 34,
}: { name: string; subtitle?: string; accent?: string; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: size, height: size, borderRadius: size * 0.28,
          background: `linear-gradient(135deg, ${accent}, #4F6FFF)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: size * 0.5,
          fontFamily: "Inter, sans-serif", flexShrink: 0,
          boxShadow: `0 6px 16px ${accent}33`,
        }}
        aria-hidden="true"
      >
        {name.charAt(0)}
      </div>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontWeight: 800, fontSize: size * 0.5, color: "var(--ink)", letterSpacing: "-.01em" }}>
          {name}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: "var(--muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
