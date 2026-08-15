import { useEffect, useMemo, useState } from "react";
import { api, type Company, type Employee, type Visitor } from "../lib/api";
import FaceCapture from "../components/FaceCapture";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function NewVisitorModal({
  companyId,
  employees,
  onClose,
  onCreated,
}: {
  companyId: number;
  employees: Employee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [hostId, setHostId] = useState("");
  const [validFrom, setValidFrom] = useState(todayISO());
  const [validUntil, setValidUntil] = useState(todayISO());
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [skipFace, setSkipFace] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome.");
      return;
    }
    setSaving(true);
    try {
      await api.createVisitor({
        companyId,
        name: name.trim(),
        document: document.trim() || undefined,
        hostEmployeeId: hostId ? Number(hostId) : null,
        validFrom,
        validUntil,
        descriptor: skipFace ? null : descriptor,
      });
      onCreated();
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Novo visitante</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="row">
            <input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Documento (opcional)" value={document} onChange={(e) => setDocument(e.target.value)} />
          </div>
          <div className="row">
            <select value={hostId} onChange={(e) => setHostId(e.target.value)}>
              <option value="">Anfitrião (opcional)…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label className="hint">
              Válido de
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </label>
            <label className="hint">
              até
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
          </div>
          <label className="skip-face">
            <input type="checkbox" checked={skipFace} onChange={(e) => setSkipFace(e.target.checked)} />
            Cadastrar sem rosto (acesso liberado manualmente na portaria)
          </label>
          {!skipFace && <FaceCapture onCaptured={setDescriptor} />}
          {message && <p className="hint hint-warn">{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Cadastrando…" : "Cadastrar visitante"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Visitantes() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    const [c, e, v] = await Promise.all([api.listCompanies(), api.listEmployees(), api.listVisitors()]);
    setCompanies(c);
    setEmployees(e);
    setVisitors(v);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => (companyId ? visitors.filter((v) => v.companyId === Number(companyId)) : []),
    [visitors, companyId]
  );
  const companyEmployees = useMemo(
    () => (companyId ? employees.filter((e) => e.companyId === Number(companyId)) : []),
    [employees, companyId]
  );

  function hostName(id: number | null) {
    if (id == null) return "—";
    return employees.find((e) => e.id === id)?.name ?? "—";
  }

  function isExpired(v: Visitor) {
    return v.validUntil < todayISO();
  }

  async function remove(id: number) {
    if (!confirm("Mover este visitante para a lixeira?")) return;
    await api.deleteVisitor(id);
    await refresh();
  }

  return (
    <div>
      <h1 className="page-title">Visitantes</h1>

      <section className="panel">
        <div className="row">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Selecione a empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {!companyId && <p className="muted">Selecione uma empresa acima para visualizar os visitantes.</p>}

        {companyId && (
          <>
            <div className="toolbar">
              <span className="count-badge">
                {filtered.length} visitante{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="toolbar-actions">
                <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                  Novo visitante
                </button>
              </div>
            </div>

            {filtered.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Anfitrião</th>
                    <th>Validade</th>
                    <th>Rosto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td className="muted">{hostName(v.hostEmployeeId)}</td>
                      <td>
                        {v.validFrom} – {v.validUntil}{" "}
                        {isExpired(v) && <span className="status-chip fail">Expirado</span>}
                      </td>
                      <td>
                        {v.hasFace ? (
                          <span className="status-chip ok">Cadastrado</span>
                        ) : (
                          <span className="status-chip pending">Sem rosto</span>
                        )}
                      </td>
                      <td className="table-actions">
                        <button className="btn btn-ghost danger" onClick={() => remove(v.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Nenhum visitante cadastrado ainda.</p>
            )}
          </>
        )}
      </section>

      {showNew && companyId && (
        <NewVisitorModal
          companyId={Number(companyId)}
          employees={companyEmployees}
          onClose={() => setShowNew(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
