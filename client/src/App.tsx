import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Admin from "./pages/Admin";
import Kiosk from "./pages/Kiosk";

function Nav() {
  const location = useLocation();
  return (
    <nav className="top-nav">
      <span className="brand">Coral · Controle de Acesso</span>
      <div className="nav-links">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">
          Painel administrativo
        </Link>
        <Link className={location.pathname === "/kiosk" ? "active" : ""} to="/kiosk">
          Tela de check-in
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Admin />} />
          <Route path="/kiosk" element={<Kiosk />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
