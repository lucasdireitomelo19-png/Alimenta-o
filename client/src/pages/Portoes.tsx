import { useEffect, useMemo, useState } from "react";
import { api, type AccessGate, type Company } from "../lib/api";

function slugify(s: string) {
  const stripped = Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300 || ch.codePointAt(0)! > 0x36f)
    .join("");
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Portoes() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [gates, setGates] = useState<AccessGate[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [c, g] = await Promise.all([api.listCompanies(), api.listAccessGates()]);
    setCompanies(c);
    setGates(g);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => (companyId ? gates.filter((g) => g.companyId === Number(companyId)) : []),
    [gates, companyId]
  );

  async function create() {
    if (!label.trim() || !companyId) return;
    setSaving(true);
    try {
      const slug = `${slugify(companies.find((c) => c.id === Number(companyId))?.name ?? "empresa")}-${slugify(label)}`;
      const gateKey = slug === "-" ? `portao-${Date.now()}` : slug;
      await api.createAccessGate({ companyId: Number(companyId), label: label.trim(), gateKey, location: location.trim() || undefined });
      setLabel("");
      setLocation("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(g: AccessGate) {
    await api.setAccessGateActive(g.id, !g.active);
    await refresh();
  }

  async function remove(id: number) {
    if (!confirm("Remover este portão/catraca?")) return;
    await api.deleteAccessGate(id);
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Portões de Acesso</h1>
      <p className="hint">
        Cada portão representa uma catraca física. O "código" abaixo é o <code>gateId</code> que o
        dispositivo (tablet/leitor) deve enviar em cada check-in — assim o log e a liberação ficam
        registrados no portão certo.
      </p>

      <section className="panel">
        <h2>Novo portão</h2>
        <div className="row">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Selecione a empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Nome do portão (ex: Catraca do refeitório)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input placeholder="Local (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <button className="btn btn-primary" onClick={create} disabled={saving || !companyId}>
            {saving ? "Adicionando…" : "Adicionar portão"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Portões cadastrados</h2>
        {!companyId ? (
          <p className="muted">Selecione uma empresa acima para visualizar os portões.</p>
        ) : filtered.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Portão</th>
                <th>Código (gateId)</th>
                <th>Local</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>{g.label}</td>
                  <td className="muted">
                    <code>{g.gateKey}</code>
                  </td>
                  <td className="muted">{g.location ?? "—"}</td>
                  <td>
                    {g.active ? <span className="status-chip ok">Ativo</span> : <span className="status-chip fail">Inativo</span>}
                  </td>
                  <td className="table-actions">
                    <button className="btn btn-ghost" onClick={() => toggle(g)}>
                      {g.active ? "Desativar" : "Ativar"}
                    </button>
                    <button className="btn btn-ghost danger" onClick={() => remove(g.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhum portão cadastrado para essa empresa ainda.</p>
        )}
      </section>
    </div>
  );
}
