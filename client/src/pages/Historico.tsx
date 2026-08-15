import { useEffect, useState } from "react";
import { api, type AuditLogEntry } from "../lib/api";

const ACTION_LABEL: Record<string, string> = {
  criar: "criou",
  remover: "removeu",
  restaurar: "restaurou",
  excluir_definitivo: "excluiu definitivamente",
};

const ENTITY_LABEL: Record<string, string> = {
  empresa: "empresa",
  funcionario: "funcionário",
  setor: "setor",
  funcao: "função",
  portao: "portão",
  visitante: "visitante",
  credencial: "credencial",
  company: "empresa",
  employee: "funcionário",
  sector: "setor",
  function: "função",
  visitor: "visitante",
};

export default function Historico() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listAuditLog(200).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className="page-title">Histórico</h1>
      <p className="hint">
        Ações administrativas (cadastros, remoções, restaurações) — diferente dos Logs do Sistema, que
        são de check-in na catraca. O login ainda não existe, então "quem fez" ainda não é registrado.
      </p>

      <section className="panel">
        {loading ? (
          <p className="muted">Carregando…</p>
        ) : entries.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const detailName = e.detail && typeof e.detail === "object" ? Object.values(e.detail)[0] : null;
                return (
                  <tr key={e.id}>
                    <td className="muted">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                    <td>
                      {ACTION_LABEL[e.action] ?? e.action} {ENTITY_LABEL[e.entityType] ?? e.entityType}
                    </td>
                    <td className="muted">{detailName ? String(detailName) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhuma ação registrada ainda.</p>
        )}
      </section>
    </div>
  );
}
