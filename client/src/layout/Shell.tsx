import { Link, useLocation } from "react-router-dom";
import { NAV } from "./nav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/coral-logo.png" alt="Coral" className="sidebar-logo" onError={(e) => (e.currentTarget.style.display = "none")} />
          <span>Controle de Acesso</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((section, i) => (
            <div key={i} className="sidebar-section">
              {section.title && <div className="sidebar-title">{section.title}</div>}
              {section.items.map((item) =>
                item.external ? (
                  <a key={item.path} href={item.path} target="_blank" rel="noreferrer" className="sidebar-link">
                    {item.label}
                    <span className="ext-badge">↗</span>
                  </a>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-link ${location.pathname === item.path ? "active" : ""} ${!item.ready ? "stub" : ""}`}
                  >
                    {item.label}
                    {!item.ready && <span className="soon-badge">em breve</span>}
                  </Link>
                )
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-name">Conectado como</div>
          <div className="user-email">fundador@coral.com.br</div>
          <button className="btn btn-ghost sidebar-logout" disabled title="Login ainda não implementado">
            Sair
          </button>
        </div>
      </aside>
      <div className="shell-body">
        <header className="topbar">
          <input className="search" placeholder="Super-busca…" disabled title="Ainda não implementado" />
          <span className="topbar-badge">Coral · Controle de Acesso</span>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
