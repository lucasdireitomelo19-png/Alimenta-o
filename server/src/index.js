const express = require("express");
const cors = require("cors");
const db = require("./db");
const { descriptorDistance, evaluateAccess } = require("./access");
const { releasePassage } = require("./turnstile");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const MATCH_THRESHOLD = 0.5;

function serializeEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    active: !!row.active,
    hasFace: !!row.has_face,
    companyId: row.company_id,
    companyName: row.company_name,
    rules: {
      days: JSON.parse(row.days),
      cafe: { allowed: !!row.cafe_allowed, start: row.cafe_start, end: row.cafe_end },
      almoco: { allowed: !!row.almoco_allowed, start: row.almoco_start, end: row.almoco_end },
      janta: { allowed: !!row.janta_allowed, start: row.janta_start, end: row.janta_end },
    },
  };
}

const employeeWithRulesQuery = `
  SELECT e.id, e.name, e.role, e.active, (e.descriptor IS NOT NULL) AS has_face, e.company_id, c.name AS company_name,
         r.days, r.cafe_allowed, r.cafe_start, r.cafe_end,
         r.almoco_allowed, r.almoco_start, r.almoco_end,
         r.janta_allowed, r.janta_start, r.janta_end
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  JOIN access_rules r ON r.employee_id = e.id
`;

// ---------- companies ----------
app.get("/api/companies", (req, res) => {
  res.json(db.prepare("SELECT * FROM companies ORDER BY name").all());
});

app.post("/api/companies", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nome da empresa é obrigatório" });
  const info = db.prepare("INSERT INTO companies (name) VALUES (?)").run(name.trim());
  res.status(201).json(db.prepare("SELECT * FROM companies WHERE id = ?").get(info.lastInsertRowid));
});

// ---------- employees ----------
app.get("/api/employees", (req, res) => {
  const rows = db.prepare(`${employeeWithRulesQuery} ORDER BY e.name`).all();
  res.json(rows.map(serializeEmployee));
});

app.post("/api/employees", (req, res) => {
  const { name, companyId, role, descriptor } = req.body;
  if (!name || !companyId) {
    return res.status(400).json({ error: "name e companyId são obrigatórios" });
  }
  if (descriptor !== undefined && descriptor !== null && (!Array.isArray(descriptor) || descriptor.length !== 128)) {
    return res.status(400).json({ error: "descriptor, quando enviado, precisa ter 128 números" });
  }
  const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(companyId);
  if (!company) return res.status(404).json({ error: "Empresa cliente não encontrada" });

  const insertEmployee = db.prepare(
    "INSERT INTO employees (company_id, name, role, descriptor) VALUES (?, ?, ?, ?)"
  );
  const insertRules = db.prepare(
    "INSERT INTO access_rules (employee_id, days) VALUES (?, '[1,2,3,4,5]')"
  );

  const tx = db.transaction(() => {
    const info = insertEmployee.run(companyId, name.trim(), role || null, descriptor ? JSON.stringify(descriptor) : null);
    insertRules.run(info.lastInsertRowid);
    return info.lastInsertRowid;
  });

  const id = tx();
  const row = db.prepare(`${employeeWithRulesQuery} WHERE e.id = ?`).get(id);
  res.status(201).json(serializeEmployee(row));
});

app.put("/api/employees/:id/rules", (req, res) => {
  const { id } = req.params;
  const { days, cafe, almoco, janta } = req.body;
  const employee = db.prepare("SELECT id FROM employees WHERE id = ?").get(id);
  if (!employee) return res.status(404).json({ error: "Funcionário não encontrado" });

  db.prepare(
    `UPDATE access_rules SET
      days = ?,
      cafe_allowed = ?, cafe_start = ?, cafe_end = ?,
      almoco_allowed = ?, almoco_start = ?, almoco_end = ?,
      janta_allowed = ?, janta_start = ?, janta_end = ?
     WHERE employee_id = ?`
  ).run(
    JSON.stringify(days ?? [1, 2, 3, 4, 5]),
    cafe?.allowed ? 1 : 0, cafe?.start ?? "07:00", cafe?.end ?? "09:00",
    almoco?.allowed ? 1 : 0, almoco?.start ?? "11:30", almoco?.end ?? "14:00",
    janta?.allowed ? 1 : 0, janta?.start ?? "18:00", janta?.end ?? "20:00",
    id
  );

  const row = db.prepare(`${employeeWithRulesQuery} WHERE e.id = ?`).get(id);
  res.json(serializeEmployee(row));
});

app.put("/api/employees/:id/face", (req, res) => {
  const { descriptor } = req.body;
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ error: "descriptor (128 números) é obrigatório" });
  }
  const employee = db.prepare("SELECT id FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ error: "Funcionário não encontrado" });
  db.prepare("UPDATE employees SET descriptor = ? WHERE id = ?").run(JSON.stringify(descriptor), req.params.id);
  const row = db.prepare(`${employeeWithRulesQuery} WHERE e.id = ?`).get(req.params.id);
  res.json(serializeEmployee(row));
});

app.delete("/api/employees/:id", (req, res) => {
  db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---------- check-in (kiosk) ----------
app.post("/api/checkin", async (req, res) => {
  const { descriptor, gateId } = req.body;
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ error: "descriptor (128 números) é obrigatório" });
  }

  const rows = db.prepare(`${employeeWithRulesQuery} WHERE e.active = 1`).all();

  let best = null;
  let bestDistance = Infinity;
  for (const row of rows) {
    if (!row.has_face) continue; // importado via CSV, ainda sem rosto capturado
    const storedDescriptor = JSON.parse(
      db.prepare("SELECT descriptor FROM employees WHERE id = ?").get(row.id).descriptor
    );
    const distance = descriptorDistance(descriptor, storedDescriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }

  const logStmt = db.prepare(
    `INSERT INTO access_logs (employee_id, employee_name, company_name, granted, reason, meal_type, distance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  if (!best || bestDistance > MATCH_THRESHOLD) {
    logStmt.run(null, null, null, 0, "Rosto não reconhecido", null, bestDistance === Infinity ? null : bestDistance);
    return res.json({ granted: false, reason: "Rosto não reconhecido", employee: null });
  }

  const decision = evaluateAccess(best);
  logStmt.run(
    best.id,
    best.name,
    best.company_name,
    decision.granted ? 1 : 0,
    decision.reason,
    decision.mealType,
    bestDistance
  );

  let turnstile = null;
  if (decision.granted) {
    turnstile = await releasePassage({ gateId, employeeId: best.id, mealType: decision.mealType });
  }

  res.json({
    granted: decision.granted,
    reason: decision.reason,
    mealType: decision.mealType,
    distance: bestDistance,
    employee: { id: best.id, name: best.name, companyName: best.company_name },
    turnstile,
  });
});

// ---------- logs ----------
app.get("/api/logs", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json(db.prepare("SELECT * FROM access_logs ORDER BY ts DESC LIMIT ?").all(limit));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
