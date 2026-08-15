import { useEffect, useMemo, useState } from "react";
import { api, type Company, type Credential, type Employee, type Visitor } from "../lib/api";

export default function Credenciais() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [subjectType, setSubjectType] = useState<"employee" | "visitor">("employee");
  const [subjectId, setSubjectId] = useState("");
  const [method, setMethod] = useState<"card" | "pin">("card");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [c, e, v, cr] = await Promise.all([
      api.listCompanies(),
      api.listEmployees(),
      api.listVisitors(),
      api.listCredentials(),
    ]);
    setCompanies(c);
    setEmployees(e);
    setVisitors(v);
    setCredentials(cr);
  }

  useEffect(() => {
    refresh();
  }, []);

  const subjects = useMemo(() => {
    if (!companyId) return [];
    const list = subjectType === "employee" ? employees : visitors;
    return list.filter((s) => s.companyId === Number(companyId));
  }, [companyId, subjectType, employees, visitors]);

  function subjectLabel(subjectType: "employee" | "visitor", subjectId: number) {
    const list = subjectType === "employee" ? employees : visitors;
    return list.find((s) => s.id === subjectId)?.name ?? `#${subjectId}`;
  }

  const companyCredentials = useMemo(() => {
    if (!companyId) return [];
    const employeeIds = new Set(employees.filter((e) => e.companyId === Number(companyId)).map((e) => e.id));
    const visitorIds = new Set(visitors.filter((v) => v.companyId === Number(companyId)).map((v) => v.id));
    return credentials.filter(
      (c) => (c.subjectType === "employee" && employeeIds.has(c.subjectId)) || (c.subjectType === "visitor" && visitorIds.has(c.subjectId))
    );
  }, [credentials, companyId, employees, visitors]);

  async function create() {
    if (!subjectId || !code.trim()) return;
    setSaving(true);
    try {
      await api.createCredential({ subjectType, subjectId: Number(subjectId), method, label: label.trim() || undefined, code: code.trim() });
      setLabel("");
      setCode("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(cr: Credential) {
    await api.setCredentialActive(cr.id, !cr.active);
    await refresh();
  }

  async function remove(id: number) {
    if (!confirm("Remover esta credencial?")) return;
    await api.deleteCredential(id);
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Credenciais</h1>
      <p className="hint">
        Métodos de acesso alternativos ao rosto — cartão ou PIN — para quando o reconhecimento facial
        não estiver disponível.
      </p>

      <section className="panel">
        <h2>Nova credencial</h2>
        <div className="row">
          <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setSubjectId(""); }}>
            <option value="">Selecione a empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={subjectType} onChange={(e) => { setSubjectType(e.target.value as "employee" | "visitor"); setSubjectId(""); }}>
            <option value="employee">Funcionário</option>
            <option value="visitor">Visitante</option>
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!companyId}>
            <option value="">Selecione a pessoa…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <select value={method} onChange={(e) => setMethod(e.target.value as "card" | "pin")}>
            <option value="card">Cartão</option>
            <option value="pin">PIN</option>
          </select>
          <input placeholder="Rótulo (opcional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input placeholder={method === "card" ? "Número do cartão" : "PIN"} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary" onClick={create} disabled={saving || !subjectId || !code.trim()}>
            {saving ? "Adicionando…" : "Adicionar credencial"}
          </button>
        </div>
        {method === "pin" && (
          <p className="hint hint-warn">
            Protótipo: PIN ainda é guardado em texto puro no banco. Antes de usar com dados reais, isso
            precisa ser trocado por um hash.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Credenciais cadastradas</h2>
        {!companyId ? (
          <p className="muted">Selecione uma empresa acima para visualizar as credenciais.</p>
        ) : companyCredentials.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Método</th>
                <th>Rótulo</th>
                <th>Código</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companyCredentials.map((cr) => (
                <tr key={cr.id}>
                  <td>{subjectLabel(cr.subjectType, cr.subjectId)}</td>
                  <td className="muted">{cr.method === "card" ? "Cartão" : "PIN"}</td>
                  <td className="muted">{cr.label ?? "—"}</td>
                  <td className="muted">{cr.code}</td>
                  <td>
                    {cr.active ? <span className="status-chip ok">Ativa</span> : <span className="status-chip fail">Inativa</span>}
                  </td>
                  <td className="table-actions">
                    <button className="btn btn-ghost" onClick={() => toggle(cr)}>
                      {cr.active ? "Desativar" : "Ativar"}
                    </button>
                    <button className="btn btn-ghost danger" onClick={() => remove(cr.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhuma credencial cadastrada para essa empresa ainda.</p>
        )}
      </section>
    </div>
  );
}
