import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Painel() {
  const [stats, setStats] = useState<{ companies: number; employees: number; todayLogs: number; todayGranted: number } | null>(null);

  useEffect(() => {
    Promise.all([api.listCompanies(), api.listEmployees(), api.listLogs(200)]).then(([companies, employees, logs]) => {
      const today = new Date().toISOString().slice(0, 10);
      const todayLogs = logs.filter((l) => l.ts.slice(0, 10) === today);
      setStats({
        companies: companies.length,
        employees: employees.length,
        todayLogs: todayLogs.length,
        todayGranted: todayLogs.filter((l) => l.granted).length,
      });
    });
  }, []);

  return (
    <div className="painel">
      <h1 className="page-title">Painel</h1>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.companies ?? "…"}</div>
          <div className="stat-label">Empresas clientes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.employees ?? "…"}</div>
          <div className="stat-label">Funcionários cadastrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.todayLogs ?? "…"}</div>
          <div className="stat-label">Tentativas de acesso hoje</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.todayGranted ?? "…"}</div>
          <div className="stat-label">Acessos liberados hoje</div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: "1.5rem" }}>
        Relatórios e histórico detalhado ainda não foram construídos — por enquanto, os números acima já vêm do banco de verdade.
      </p>
    </div>
  );
}
