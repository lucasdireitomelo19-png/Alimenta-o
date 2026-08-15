import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api, type Company, type Employee } from "../lib/api";
import { toCSV, downloadCSV, parseCSV } from "../lib/csv";
import FaceCapture from "../components/FaceCapture";
import RulesEditor from "../components/RulesEditor";

function NewEmployeeModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [skipFace, setSkipFace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome.");
      return;
    }
    if (!skipFace && !descriptor) {
      setMessage("Capture o rosto, ou marque 'cadastrar sem rosto por agora'.");
      return;
    }
    setSaving(true);
    try {
      await api.createEmployee({ name: name.trim(), role: role.trim() || undefined, companyId, descriptor: skipFace ? null : descriptor });
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
          <h2>Novo funcionário</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="row">
            <input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Cargo (opcional)" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <label className="skip-face">
            <input type="checkbox" checked={skipFace} onChange={(e) => setSkipFace(e.target.checked)} />
            Cadastrar sem rosto por agora (completa depois)
          </label>
          {!skipFace && <FaceCapture onCaptured={setDescriptor} />}
          {message && <p className="hint hint-warn">{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Cadastrando…" : "Cadastrar funcionário"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EnrollFaceModal({ employee, onClose, onDone }: { employee: Employee; onClose: () => void; onDone: () => void }) {
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!descriptor) return;
    setSaving(true);
    try {
      await api.enrollFace(employee.id, descriptor);
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Capturar rosto — {employee.name}</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <FaceCapture onCaptured={setDescriptor} />
        <button className="btn btn-primary" onClick={save} disabled={!descriptor || saving}>
          {saving ? "Salvando…" : "Salvar rosto"}
        </button>
      </div>
    </div>
  );
}

export default function Funcionarios() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<Employee | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [c, e] = await Promise.all([api.listCompanies(), api.listEmployees()]);
    setCompanies(c);
    setEmployees(e);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!companyId) return [];
    return employees
      .filter((e) => e.companyId === Number(companyId))
      .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [employees, companyId, search]);

  function exportCSV() {
    const csv = toCSV(
      filtered.map((e) => ({
        nome: e.name,
        cargo: e.role ?? "",
        rosto_cadastrado: e.hasFace ? "sim" : "não",
        dias: e.rules.days.join(";"),
        cafe: e.rules.cafe.allowed ? `${e.rules.cafe.start}-${e.rules.cafe.end}` : "",
        almoco: e.rules.almoco.allowed ? `${e.rules.almoco.start}-${e.rules.almoco.end}` : "",
        janta: e.rules.janta.allowed ? `${e.rules.janta.start}-${e.rules.janta.end}` : "",
      })),
      ["nome", "cargo", "rosto_cadastrado", "dias", "cafe", "almoco", "janta"]
    );
    const companyName = companies.find((c) => c.id === Number(companyId))?.name ?? "funcionarios";
    downloadCSV(`${companyName}.csv`, csv);
  }

  async function importCSV(file: File) {
    setImportMsg("Importando…");
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      setImportMsg("Nenhuma linha encontrada. O arquivo precisa ter uma coluna 'nome' (e opcionalmente 'cargo').");
      return;
    }
    let created = 0;
    let failed = 0;
    for (const row of rows) {
      const name = row.nome || row.Nome || row.name;
      if (!name) {
        failed++;
        continue;
      }
      try {
        await api.createEmployee({ name, role: row.cargo || row.Cargo || undefined, companyId: Number(companyId), descriptor: null });
        created++;
      } catch {
        failed++;
      }
    }
    setImportMsg(`Importação concluída: ${created} cadastrados sem rosto (pendente de captura)${failed ? `, ${failed} com erro` : ""}.`);
    await refresh();
  }

  const selectedCompanyName = companies.find((c) => c.id === Number(companyId))?.name;

  return (
    <div>
      <h1 className="page-title">Funcionários</h1>

      <div className="panel">
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

        {!companyId && <p className="muted">Selecione uma empresa acima para visualizar os funcionários.</p>}

        {companyId && (
          <>
            <div className="toolbar">
              <span className="count-badge">
                {filtered.length} pessoa{filtered.length === 1 ? "" : "s"} cadastrada{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="toolbar-actions">
                <button className="btn btn-ghost" onClick={() => setShowFilters((v) => !v)}>
                  Filtros
                </button>
                <button className="btn btn-ghost" onClick={exportCSV}>
                  Exportar CSV
                </button>
                <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                  Importar CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}
                />
                <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                  Novo funcionário
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="filters-row">
                <input placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}

            {importMsg && <p className="hint">{importMsg}</p>}

            {filtered.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Rosto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <Fragment key={emp.id}>
                      <tr>
                        <td>{emp.name}</td>
                        <td className="muted">{emp.role ?? "—"}</td>
                        <td>
                          {emp.hasFace ? (
                            <span className="status-chip ok">Cadastrado</span>
                          ) : (
                            <span className="status-chip pending">Pendente</span>
                          )}
                        </td>
                        <td className="table-actions">
                          {!emp.hasFace && (
                            <button className="btn btn-ghost" onClick={() => setEnrollTarget(emp)}>
                              Capturar rosto
                            </button>
                          )}
                          <button className="btn btn-ghost" onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}>
                            {expandedId === emp.id ? "Fechar" : "Regras"}
                          </button>
                          <button
                            className="btn btn-ghost danger"
                            onClick={async () => {
                              if (!confirm("Remover este funcionário?")) return;
                              await api.deleteEmployee(emp.id);
                              await refresh();
                            }}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                      {expandedId === emp.id && (
                        <tr>
                          <td colSpan={4}>
                            <RulesEditor
                              employee={emp}
                              onSaved={(updated) => setEmployees((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Nenhum funcionário para "{selectedCompanyName}" ainda.</p>
            )}
          </>
        )}
      </div>

      {showNew && companyId && (
        <NewEmployeeModal companyId={Number(companyId)} onClose={() => setShowNew(false)} onCreated={refresh} />
      )}
      {enrollTarget && (
        <EnrollFaceModal employee={enrollTarget} onClose={() => setEnrollTarget(null)} onDone={refresh} />
      )}
    </div>
  );
}
