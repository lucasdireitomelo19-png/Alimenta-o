import { useEffect, useState } from "react";
import { api, type Company, type Employee } from "../lib/api";

export default function Empresas() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [c, e] = await Promise.all([api.listCompanies(), api.listEmployees()]);
    setCompanies(c);
    setEmployees(e);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createCompany(name.trim());
      setName("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Empresas</h1>

      <section className="panel">
        <h2>Nova empresa cliente</h2>
        <div className="row">
          <input placeholder="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" onClick={create} disabled={saving}>
            {saving ? "Adicionando…" : "Adicionar empresa"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Empresas cadastradas</h2>
        {companies.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Funcionários</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{employees.filter((e) => e.companyId === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhuma empresa cadastrada ainda.</p>
        )}
      </section>
    </div>
  );
}
