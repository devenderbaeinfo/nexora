export default function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <p style={{ color: "var(--muted)", fontSize: 14 }}>
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  );
}
