import { useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ThemeToggle";
import AdminSidebar from "./AdminSidebar";

// The Super Admin never sees client ERP data, so this layout is intentionally its own thing —
// not AppShell reused with different nav items — to keep the two admin levels from bleeding
// into each other as either evolves. It does share AppShell's two screen-level behaviors
// though: the sidebar/topbar staying fixed while only the main content scrolls, and the
// dark-mode cursor spotlight spanning the whole screen (same .app-spotlight class/rule).
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const spotRef = useRef<HTMLDivElement>(null);
  const [spotVisible, setSpotVisible] = useState(false);

  const handleShellMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (spotRef.current) {
      spotRef.current.style.background = `radial-gradient(140px circle at ${e.clientX}px ${e.clientY}px, rgba(124,92,255,.16), transparent 70%)`;
    }
  };

  return (
    <div
      style={styles.shell}
      onMouseMove={handleShellMouseMove}
      onMouseEnter={() => setSpotVisible(true)}
      onMouseLeave={() => setSpotVisible(false)}
    >
      <div ref={spotRef} className="app-spotlight" style={{ opacity: spotVisible ? 1 : 0 }} />
      <AdminSidebar />
      <div style={styles.contentColumn}>
        <header style={styles.topbar}>
          <div style={styles.profile}>
            <div style={styles.avatar}>{(user?.displayName ?? "S").charAt(0).toUpperCase()}</div>
            <div>
              <div style={styles.profileName}>{user?.displayName}</div>
              <div style={styles.profileRole}>Super Admin · NEXORA</div>
            </div>
          </div>
          <div style={styles.topbarRight}>
            <ThemeToggle compact />
            <button style={styles.logout} onClick={logout}>Sign out</button>
          </div>
        </header>
        <main style={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: "grid", gridTemplateColumns: "256px 1fr", height: "100vh", position: "relative", overflow: "hidden" },
  contentColumn: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  topbar: {
    height: 68, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0,
  },
  profile: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14,
  },
  profileName: { fontSize: 13.5, fontWeight: 700, color: "var(--ink)" },
  profileRole: { fontSize: 11.5, color: "var(--faint)" },
  topbarRight: { display: "flex", alignItems: "center", gap: 14 },
  logout: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer",
  },
  main: { padding: "32px 40px", background: "var(--bg)", flex: 1, overflowY: "auto" },
};
