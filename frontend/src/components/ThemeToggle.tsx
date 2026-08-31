import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ compact, style }: { compact?: boolean; style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const icon = isDark ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{ ...(compact ? styles.compactButton : styles.button), ...style }}
    >
      {icon}
      {!compact && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "8px 10px", fontSize: 12.5, fontWeight: 600, color: "var(--muted)",
    cursor: "pointer", width: "100%",
  },
  compactButton: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 34, height: 34, borderRadius: "50%",
    background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)",
    cursor: "pointer", flexShrink: 0,
  },
};
