import { useEffect, useState } from "react";
import { api, type Company, type Employee, type MealRule } from "../lib/api";
import { loadModels, detectDescriptor } from "../lib/faceapi";
import { useCamera } from "../lib/useCamera";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MEAL_LABELS: Record<"cafe" | "almoco" | "janta", string> = {
  cafe: "Café da manhã",
  almoco: "Almoço",
  janta: "Janta",
};

function FaceCapture({ onCaptured }: { onCaptured: (descriptor: number[]) => void }) {
  const { videoRef, ready, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "capturing" | "done" | "notfound">("idle");

  useEffect(() => {
    loadModels().then(() => setModelsReady(true));
  }, []);

  async function capture() {
    if (!videoRef.current) return;
    setStatus("capturing");
    const result = await detectDescriptor(videoRef.current);
    if (!result) {
      setStatus("notfound");
      return;
    }
    onCaptured(result.descriptor);
    setStatus("done");
  }

  return (
    <div className="face-capture">
      <video ref={videoRef} autoPlay muted playsInline className="camera-preview" />
      {error && <p className="error">{error}</p>}
      <button type="button" onClick={capture} disabled={!ready || !modelsReady} className="btn btn-secondary">
        {modelsReady ? (ready ? "Capturar rosto" : "Ligando câmera…") : "Carregando modelo…"}
      </button>
      {status === "done" && <p className="hint hint-ok">Rosto capturado ✓</p>}
      {status === "notfound" && <p className="hint hint-warn">Nenhum rosto detectado, tente de novo.</p>}
    </div>
  );
}

function RulesEditor({ employee, onSaved }: { employee: Employee; onSaved: (e: Employee) => void }) {
  const [days, setDays] = useState<number[]>(employee.rules.days);
  const [meals, setMeals] = useState(employee.rules);
  const [saving, setSaving] = useState(false);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function updateMeal(key: "cafe" | "almoco" | "janta", patch: Partial<MealRule>) {
    setMeals((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateRules(employee.id, { ...meals, days });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rules-editor">
      <div className="days-row">
        {DAY_LABELS.map((label, i) => (
          <label key={i} className={`day-chip ${days.includes(i) ? "active" : ""}`}>
            <input type="checkbox" checked={days.includes(i)} onChange={() => toggleDay(i)} />
            {label}
          </label>
        ))}
      </div>
      {(["cafe", "almoco", "janta"] as const).map((key) => (
        <div key={key} className="meal-row">
          <label className="meal-toggle">
            <input
              type="checkbox"
              checked={meals[key].allowed}
              onChange={(e) => updateMeal(key, { allowed: e.target.checked })}
            />
            {MEAL_LABELS[key]}
          </label>
          <input
            type="time"
            value={meals[key].start}
            disabled={!meals[key].allowed}
            onChange={(e) => updateMeal(key, { start: e.target.value })}
          />
          <span>até</span>
          <input
            type="time"
            value={meals[key].end}
            disabled={!meals[key].allowed}
            onChange={(e) => updateMeal(key, { end: e.target.value })}
          />
        </div>
      ))}
      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? "Salvando…" : "Salvar regras"}
      </button>
    </div>
  );
}

export default function Admin() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [form, setForm] = useState({ name: "", role: "", companyId: "" });
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [c, e] = await Promise.all([api.listCompanies(), api.listEmployees()]);
    setCompanies(c);
    setEmployees(e);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createCompany() {
    if (!newCompanyName.trim()) return;
    const company = await api.createCompany(newCompanyName.trim());
    setNewCompanyName("");
    setCompanies((prev) => [...prev, company].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, companyId: String(company.id) }));
  }

  async function submitEmployee(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!form.name.trim() || !form.companyId) {
      setMessage("Preencha nome e empresa cliente.");
      return;
    }
    if (!descriptor) {
      setMessage("Capture o rosto do funcionário antes de cadastrar.");
      return;
    }
    setSaving(true);
    try {
      await api.createEmployee({
        name: form.name.trim(),
        role: form.role.trim() || undefined,
        companyId: Number(form.companyId),
        descriptor,
      });
      setForm({ name: "", role: "", companyId: form.companyId });
      setDescriptor(null);
      setMessage("Funcionário cadastrado.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  async function removeEmployee(id: number) {
    if (!confirm("Remover este funcionário?")) return;
    await api.deleteEmployee(id);
    await refresh();
  }

  const grouped = companies.map((c) => ({
    company: c,
    people: employees.filter((e) => e.companyId === c.id),
  }));

  return (
    <div className="admin">
      <section className="panel">
        <h2>Empresa cliente</h2>
        <div className="row">
          <input
            placeholder="Nome da empresa cliente"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={createCompany}>
            Adicionar empresa
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Cadastrar funcionário</h2>
        <form onSubmit={submitEmployee} className="employee-form">
          <div className="row">
            <input
              placeholder="Nome completo"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder="Cargo (opcional)"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
            <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">Empresa cliente…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <FaceCapture onCaptured={setDescriptor} />
          {message && <p className="hint">{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Cadastrando…" : "Cadastrar funcionário"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Funcionários cadastrados</h2>
        {grouped.map(({ company, people }) =>
          people.length ? (
            <div key={company.id} className="company-group">
              <h3>{company.name}</h3>
              {people.map((emp) => (
                <div key={emp.id} className="employee-card">
                  <div className="employee-row">
                    <div>
                      <strong>{emp.name}</strong>
                      {emp.role && <span className="muted"> · {emp.role}</span>}
                    </div>
                    <div className="employee-actions">
                      <button className="btn btn-ghost" onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}>
                        {expandedId === emp.id ? "Fechar" : "Regras de acesso"}
                      </button>
                      <button className="btn btn-ghost danger" onClick={() => removeEmployee(emp.id)}>
                        Remover
                      </button>
                    </div>
                  </div>
                  {expandedId === emp.id && (
                    <RulesEditor
                      employee={emp}
                      onSaved={(updated) => {
                        setEmployees((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null
        )}
        {!employees.length && <p className="muted">Nenhum funcionário cadastrado ainda.</p>}
      </section>
    </div>
  );
}
