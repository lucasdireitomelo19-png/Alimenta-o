import { useEffect, useState } from "react";
import { api, type TrashItem } from "../lib/api";

const KIND_LABEL: Record<TrashItem["kind"], string> = {
  company: "Empresa",
  employee: "Funcionário",
  sector: "Setor",
  function: "Função",
  visitor: "Visitante",
};

export default function Lixeira() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setItems(await api.listTrash());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function restore(item: TrashItem) {
    await api.restoreTrashItem(item);
    await refresh();
  }

  async function purge(item: TrashItem) {
    if (!confirm(`Excluir "${item.label}" definitivamente? Essa ação não pode ser desfeita.`)) return;
    await api.permanentlyDeleteTrashItem(item);
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Lixeira</h1>
      <p className="hint">
        Empresas, funcionários, setores, funções e visitantes removidos ficam aqui antes de sumir de
        verdade. Restaure ou exclua definitivamente.
      </p>

      <section className="panel">
        {loading ? (
          <p className="muted">Carregando…</p>
        ) : items.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th>Removido em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`}>
                  <td className="muted">{KIND_LABEL[item.kind]}</td>
                  <td>{item.label}</td>
                  <td className="muted">{new Date(item.deletedAt).toLocaleString("pt-BR")}</td>
                  <td className="table-actions">
                    <button className="btn btn-ghost" onClick={() => restore(item)}>
                      Restaurar
                    </button>
                    <button className="btn btn-ghost danger" onClick={() => purge(item)}>
                      Excluir definitivamente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">A lixeira está vazia.</p>
        )}
      </section>
    </div>
  );
}
