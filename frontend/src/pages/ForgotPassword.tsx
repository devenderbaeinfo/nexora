import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { loginPageConfig } from "../config/loginPageConfig";
import BrandLogo from "./login/BrandLogo";
import ThemeToggle from "../components/ThemeToggle";
import "./login/login.css";

// No self-service reset exists (no email infrastructure in this app) — submitting this form
// just flags the account so whoever manages it (People → Accounts you manage) sees a
// highlighted "Reset password" action and can hand the person a new temporary password,
// which then runs through the existing forced-password-change flow on next login.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bae-login">
      <div className="bae-login-theme-toggle">
        <ThemeToggle compact />
      </div>

      <div className="bae-login-panel" style={{ margin: "0 auto" }}>
        <div className="bae-login-panel-inner">
          <BrandLogo name={loginPageConfig.branding.name} subtitle={loginPageConfig.branding.subtitle} />

          <div style={{ marginTop: 40, marginBottom: 30 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px", color: "var(--ink)" }}>
              Forgot your password?
            </h1>
            {submitted ? (
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                Thanks — your administrator has been notified. Please contact them directly to have
                your password reset; they'll give you a temporary one to sign in with.
              </p>
            ) : (
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                There's no self-service reset here — enter your work email and we'll flag your
                account for your administrator, then contact them directly to get a new password.
              </p>
            )}
          </div>

          {!submitted && (
            <form onSubmit={onSubmit}>
              <label htmlFor="forgot-email" style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Work email</label>
              <input
                id="forgot-email" type="email" className="bae-input" style={{ marginBottom: 18 }}
                value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" required
              />
              {error && <div className="bae-field-error" style={{ marginBottom: 14 }}>{error}</div>}
              <button type="submit" className="bae-submit-button" disabled={isSubmitting}>
                {isSubmitting ? "Notifying…" : "Notify my administrator"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 24 }}>
            <Link className="bae-link" to="/login">← Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
