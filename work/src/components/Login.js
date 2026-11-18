import React, { useState } from "react";

function Login({ onLogin, error, isSubmitting }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!password.trim() || isSubmitting) return;
    onLogin(password);
  };

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">✳</span>
          <span className="brand-name">aura<span>AI</span></span>
        </div>
        <div className="login-eyebrow">YOUR PERSONAL AI WORKSPACE</div>
        <h1 id="login-title">Welcome back,<br /><span>Sanidhya.</span></h1>
        <p className="login-description">Sign in to pick up where your ideas left off.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-password">Password</label>
          <div className="login-password-field">
            <input
              id="login-password"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={4}
            />
            <button
              className="password-visibility-button"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {showPassword ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.4 0 9 7 9 7a15.7 15.7 0 0 1-3.1 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.6 7 9 7a9.8 9.8 0 0 0 3-.5" />
                  </>
                ) : (
                  <>
                    <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </>
                )}
              </svg>
            </button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={isSubmitting || !password}>
            {isSubmitting ? "Signing in..." : "Sign in"}
            {!isSubmitting && <span aria-hidden="true">↗</span>}
          </button>
        </form>

        <p className="login-secure-note"><span className="login-secure-dot" /> Your session is private and secure.</p>
      </section>
      <span className="login-footer">Made for the moments in between.</span>
    </main>
  );
}

export default Login;
