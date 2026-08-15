import { useEffect, useState } from "react";
import { api, type AccessLog } from "../lib/api";

export default function Logs() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [filter, setFilter] = useState<"all" | "granted" | "denied">("all");

  useEffect(() => {
    api.listLogs(200).then(setLogs);
  }, []);

  const filtered = logs.filter((l) => (filter === "all" ? true : filter === "granted" ? l.granted : !l.granted));

  return (
    <div>
      <h1 className="page-title">Logs do Sistema</h1>
      <div className="panel">
        <div className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Todos os registros</option>
            <option value="granted">Só liberados</option>
            <option value="denied">Só negados</option>
          </select>
          <span className="muted">{filtered.length} registro(s)</span>
        </div>
        {filtered.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Funcionário</th>
                <th>Empresa</th>
                <th>Refeição</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td>{log.ts.replace("T", " ").slice(0, 16)}</td>
                  <td>{log.employee_name ?? "Não reconhecido"}</td>
                  <td className="muted">{log.company_name ?? "—"}</td>
                  <td className="muted">{log.meal_type ?? "—"}</td>
                  <td>
                    <span className={`status-chip ${log.granted ? "ok" : "fail"}`}>{log.reason}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhum acesso registrado ainda.</p>
        )}
      </div>
    </div>
  );
}
