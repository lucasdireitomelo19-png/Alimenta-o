import { useEffect, useMemo, useState } from "react";
import { api, type Company, type Sector } from "../lib/api";

export default function Setores() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [c, s] = await Promise.all([api.listCompanies(), api.listSectors()]);
    setCompanies(c);
    setSectors(s);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => (companyId ? sectors.filter((s) => s.companyId === Number(companyId)) : []),
    [sectors, companyId]
  );

  async function create() {
    if (!name.trim() || !companyId) return;
    setSaving(true);
    try {
      await api.createSector({ companyId: Number(companyId), name: name.trim() });
      setName("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Mover este setor para a lixeira?")) return;
    await api.deleteSector(id);
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Setores</h1>

      <section className="panel">
        <h2>Novo setor</h2>
        <div className="row">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Selecione a empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Nome do setor" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" onClick={create} disabled={saving || !companyId}>
            {saving ? "Adicionando…" : "Adicionar setor"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Setores cadastrados</h2>
        {!companyId ? (
          <p className="muted">Selecione uma empresa acima para visualizar os setores.</p>
        ) : filtered.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Setor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="table-actions">
                    <button className="btn btn-ghost danger" onClick={() => remove(s.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhum setor cadastrado para essa empresa ainda.</p>
        )}
      </section>
    </div>
  );
}
