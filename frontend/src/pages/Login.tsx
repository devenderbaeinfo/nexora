import { loginPageConfig } from "../config/loginPageConfig";
import BrandLogo from "./login/BrandLogo";
import LoginForm from "./login/LoginForm";
import SecurityMessage from "./login/SecurityMessage";
import HeroPanel from "./login/HeroPanel";
import ThemeToggle from "../components/ThemeToggle";
import "./login/login.css";

// The hero panel (right) stays a fixed dark navy in both themes — that split-panel contrast
// is the design. The form panel (left) follows the viewer's own light/dark preference via the
// toggle in its corner, using the same tokens.css variables as the rest of the app. All copy
// and demo data come from loginPageConfig; nothing here touches the existing auth flow beyond
// LoginForm calling the same useAuth().login it always has.
export default function Login() {
  const cfg = loginPageConfig.login;

  return (
    <div className="bae-login">
      <div className="bae-login-panel">
        <div className="bae-login-theme-toggle">
          <ThemeToggle compact />
        </div>
        <div className="bae-login-panel-inner">
          <BrandLogo name={loginPageConfig.branding.name} subtitle={loginPageConfig.branding.subtitle} />

          <div style={{ marginTop: 40, marginBottom: 30 }}>
            <p style={{ fontSize: 14.5, color: "var(--muted)", margin: "0 0 6px", fontWeight: 600 }}>
              {cfg.welcomeText}
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.25, margin: "0 0 12px", color: "var(--ink)" }}>
              {cfg.titlePrefix}{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #6D4AFF, #4F6FFF 60%, #12D6C5)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {cfg.titleHighlight}
              </span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{cfg.description}</p>
          </div>

          <LoginForm />

          <SecurityMessage text={cfg.securityMessage} />
        </div>
      </div>

      <HeroPanel />
    </div>
  );
}
