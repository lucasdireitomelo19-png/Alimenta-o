import { useState } from "react";
import { api, type Employee, type MealRule } from "../lib/api";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MEAL_LABELS: Record<"cafe" | "almoco" | "janta", string> = {
  cafe: "Café da manhã",
  almoco: "Almoço",
  janta: "Janta",
};

export default function RulesEditor({ employee, onSaved }: { employee: Employee; onSaved: (e: Employee) => void }) {
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
