import { BrowserRouter, Routes, Route } from "react-router-dom";
import Shell from "./layout/Shell";
import { NAV } from "./layout/nav";
import Painel from "./pages/Painel";
import Empresas from "./pages/Empresas";
import Funcionarios from "./pages/Funcionarios";
import Setores from "./pages/Setores";
import Funcoes from "./pages/Funcoes";
import Visitantes from "./pages/Visitantes";
import Portoes from "./pages/Portoes";
import Credenciais from "./pages/Credenciais";
import Historico from "./pages/Historico";
import Lixeira from "./pages/Lixeira";
import Logs from "./pages/Logs";
import Kiosk from "./pages/Kiosk";
import Stub from "./pages/Stub";

const stubRoutes = NAV.flatMap((s) => s.items).filter((i) => !i.ready && !i.external);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/kiosk" element={<Kiosk />} />
        <Route
          path="*"
          element={
            <Shell>
              <Routes>
                <Route path="/" element={<Painel />} />
                <Route path="/empresas" element={<Empresas />} />
                <Route path="/funcionarios" element={<Funcionarios />} />
                <Route path="/setores" element={<Setores />} />
                <Route path="/funcoes" element={<Funcoes />} />
                <Route path="/visitantes" element={<Visitantes />} />
                <Route path="/portoes" element={<Portoes />} />
                <Route path="/credenciais" element={<Credenciais />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/lixeira" element={<Lixeira />} />
                <Route path="/logs" element={<Logs />} />
                {stubRoutes.map((item) => (
                  <Route key={item.path} path={item.path} element={<Stub title={item.label} />} />
                ))}
              </Routes>
            </Shell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
