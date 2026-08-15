import { useEffect, useState } from "react";
import { api, type Company, type JobFunction } from "../lib/api";

export default function Funcoes() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [companyId, setCompanyId] = useState(""); // "" vazio na criação = função genérica
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [c, f] = await Promise.all([api.listCompanies(), api.listJobFunctions()]);
    setCompanies(c);
    setFunctions(f);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createJobFunction({ companyId: companyId ? Number(companyId) : null, name: name.trim() });
      setName("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Mover esta função para a lixeira?")) return;
    await api.deleteJobFunction(id);
    await refresh();
  }

  function companyName(id: number | null) {
    if (id == null) return "— genérica (todas as empresas) —";
    return companies.find((c) => c.id === id)?.name ?? "—";
  }

  return (
    <div>
      <h1 className="page-title">Funções</h1>

      <section className="panel">
        <h2>Nova função</h2>
        <div className="row">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Genérica (todas as empresas)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Nome da função" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" onClick={create} disabled={saving}>
            {saving ? "Adicionando…" : "Adicionar função"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Funções cadastradas</h2>
        {functions.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Função</th>
                <th>Empresa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {functions.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td className="muted">{companyName(f.companyId)}</td>
                  <td className="table-actions">
                    <button className="btn btn-ghost danger" onClick={() => remove(f.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhuma função cadastrada ainda.</p>
        )}
      </section>
    </div>
  );
}
