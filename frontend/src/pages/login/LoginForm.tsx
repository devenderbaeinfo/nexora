import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { loginPageConfig } from "../../config/loginPageConfig";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const { login, isAuthenticating } = useAuth();
  const navigate = useNavigate();
  const cfg = loginPageConfig.login;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";

    if (!password) errors.password = "Password is required.";
    else if (password.length < loginPageConfig.validation.passwordMinLength) {
      errors.password = `Password must be at least ${loginPageConfig.validation.passwordMinLength} characters.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (isAuthenticating) return; // guards against a double-click firing a second request
    if (!validate()) return;

    try {
      const permissions = await login(email.trim(), password);
      // Role-based redirect: a platform SuperAdmin never lands on the client ERP shell —
      // everyone else (Admin/HR/Manager/Finance/Employee) goes to the usual client app.
      const isSuperAdmin = permissions.includes("platform.manage_tenants");
      navigate(isSuperAdmin ? "/admin/dashboard" : "/", { replace: true });
    } catch {
      // Deliberately generic — matches the backend's undifferentiated 401 so this screen
      // can never be used to enumerate which email addresses have accounts.
      setFormError(cfg.genericErrorMessage);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError && (
        <div className="bae-form-error" role="alert">{formError}</div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="email" style={labelStyle}>{cfg.emailLabel}</label>
        <input
          id="email"
          type="email"
          className={"bae-input" + (fieldErrors.email ? " has-error" : "")}
          placeholder={cfg.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email && <div className="bae-field-error" id="email-error">{fieldErrors.email}</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label htmlFor="password" style={labelStyle}>{cfg.passwordLabel}</label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className={"bae-input" + (fieldErrors.password ? " has-error" : "")}
            placeholder={cfg.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ paddingRight: 42 }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            className="bae-password-toggle"
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {fieldErrors.password && <div className="bae-field-error" id="password-error">{fieldErrors.password}</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <label className="bae-checkbox-row">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          {cfg.rememberMeLabel}
        </label>
        <a className="bae-link" href={cfg.forgotPasswordHref}>{cfg.forgotPasswordLabel}</a>
      </div>

      <button type="submit" className="bae-submit-button" disabled={isAuthenticating}>
        {isAuthenticating ? cfg.buttonLoadingLabel : cfg.buttonLabel}
        {!isAuthenticating && <span className="arrow" aria-hidden="true">→</span>}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6,
};

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M6.6 6.7C3.9 8.4 1.5 12 1.5 12S5 19 12 19c1.8 0 3.3-.5 4.6-1.1M9.9 5.2A10.8 10.8 0 0112 5c7 0 10.5 7 10.5 7-.4.7-1.4 2.2-2.9 3.6"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
