import React from "react";

function Topbar({ onMenuClick, onLogout, logoutError, title, userName }) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu-button"
        type="button"
        aria-label="Open sidebar"
        onClick={onMenuClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="topbar-title">
        <span className="topbar-title-main">{title}</span>
        <span className="topbar-title-divider">/</span>
        <span className="topbar-title-sub">Personal workspace</span>
      </div>

      <div className="topbar-actions">
        <span className="model-indicator">
          <span className="status-dot" />
          AI assistant
        </span>
        <span className="topbar-user-name">{userName}</span>
        <button className="logout-button" type="button" onClick={onLogout}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 17l5-5-5-5M15 12H3" />
            <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
          </svg>
          <span>Log out</span>
        </button>
        <button className="avatar avatar-small" type="button" aria-label={`${userName} profile`}>
          S
        </button>
      </div>
      {logoutError && <p className="topbar-logout-error" role="alert">{logoutError}</p>}
    </header>
  );
}

export default Topbar;
