import { BrowserRouter, Routes, Route } from "react-router-dom";
import Shell from "./layout/Shell";
import { NAV } from "./layout/nav";
import Painel from "./pages/Painel";
import Empresas from "./pages/Empresas";
import Funcionarios from "./pages/Funcionarios";
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
