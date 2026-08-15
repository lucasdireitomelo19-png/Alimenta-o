import { supabase } from "./supabase";

export interface Company {
  id: number;
  name: string;
}

export interface MealRule {
  allowed: boolean;
  start: string;
  end: string;
}

export interface Employee {
  id: number;
  name: string;
  role: string | null;
  active: boolean;
  hasFace: boolean;
  companyId: number;
  companyName: string;
  rules: {
    days: number[];
    cafe: MealRule;
    almoco: MealRule;
    janta: MealRule;
  };
}

export interface CheckinResult {
  granted: boolean;
  reason: string;
  mealType: string | null;
  distance: number;
  employee: { id: number; name: string; companyName: string } | null;
  turnstile: { released: boolean; gateId: string; at: string } | null;
}

export interface AccessLog {
  id: number;
  employee_id: number | null;
  employee_name: string | null;
  company_name: string | null;
  ts: string;
  granted: number;
  reason: string;
  meal_type: string | null;
  distance: number | null;
}

export interface Sector {
  id: number;
  companyId: number;
  name: string;
}

export interface JobFunction {
  id: number;
  companyId: number | null;
  name: string;
}

export interface AccessGate {
  id: number;
  companyId: number;
  label: string;
  gateKey: string;
  location: string | null;
  active: boolean;
}

export interface Visitor {
  id: number;
  companyId: number;
  name: string;
  document: string | null;
  hostEmployeeId: number | null;
  hasFace: boolean;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

export interface Credential {
  id: number;
  subjectType: "employee" | "visitor";
  subjectId: number;
  method: "card" | "pin";
  label: string | null;
  code: string | null;
  active: boolean;
}

export interface TrashItem {
  kind: "company" | "employee" | "sector" | "function" | "visitor";
  id: number;
  label: string;
  deletedAt: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

// deno-lint-ignore no-explicit-any
type Row = any;

function serializeEmployee(row: Row): Employee {
  const rules = Array.isArray(row.access_rules) ? row.access_rules[0] : row.access_rules;
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    active: row.active,
    hasFace: !!row.has_face,
    companyId: row.company_id,
    companyName: company?.name ?? "",
    rules: {
      days: rules?.days ?? [1, 2, 3, 4, 5],
      cafe: { allowed: !!rules?.cafe_allowed, start: rules?.cafe_start ?? "07:00", end: rules?.cafe_end ?? "09:00" },
      almoco: { allowed: !!rules?.almoco_allowed, start: rules?.almoco_start ?? "11:30", end: rules?.almoco_end ?? "14:00" },
      janta: { allowed: !!rules?.janta_allowed, start: rules?.janta_start ?? "18:00", end: rules?.janta_end ?? "20:00" },
    },
  };
}

// Note: never selects `descriptor` — that's the raw face embedding, it must stay
// server-side only (used exclusively inside the checkin Edge Function).
const EMPLOYEE_SELECT = "id, name, role, active, has_face, company_id, companies(name), access_rules(*)";

async function logAudit(action: string, entityType: string, entityId: number | null, detail?: Record<string, unknown>) {
  // best-effort: sem login ainda, não dá pra saber quem fez — actor_user_id fica nulo
  await supabase.from("audit_log").insert({ action, entity_type: entityType, entity_id: entityId, detail: detail ?? null });
}

export const api = {
  async listCompanies(): Promise<Company[]> {
    const { data, error } = await supabase.from("companies").select("*").is("deleted_at", null).order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  async createCompany(name: string): Promise<Company> {
    const { data, error } = await supabase.from("companies").insert({ name }).select().single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "empresa", data.id, { nome: name });
    return data;
  },

  async deleteCompany(id: number): Promise<void> {
    const { error } = await supabase.from("companies").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "empresa", id);
  },

  async listEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase.from("employees").select(EMPLOYEE_SELECT).is("deleted_at", null).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map(serializeEmployee);
  },

  async createEmployee(input: { name: string; companyId: number; role?: string; descriptor?: number[] | null }): Promise<Employee> {
    const { data, error } = await supabase
      .from("employees")
      .insert({ name: input.name, company_id: input.companyId, role: input.role ?? null, descriptor: input.descriptor ?? null })
      .select(EMPLOYEE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "funcionario", data.id, { nome: input.name });
    return serializeEmployee(data);
  },

  async enrollFace(id: number, descriptor: number[]): Promise<Employee> {
    const { error } = await supabase.from("employees").update({ descriptor }).eq("id", id);
    if (error) throw new Error(error.message);
    const { data, error: fetchError } = await supabase.from("employees").select(EMPLOYEE_SELECT).eq("id", id).single();
    if (fetchError) throw new Error(fetchError.message);
    return serializeEmployee(data);
  },

  async updateRules(id: number, rules: Employee["rules"]): Promise<Employee> {
    const { error } = await supabase
      .from("access_rules")
      .update({
        days: rules.days,
        cafe_allowed: rules.cafe.allowed, cafe_start: rules.cafe.start, cafe_end: rules.cafe.end,
        almoco_allowed: rules.almoco.allowed, almoco_start: rules.almoco.start, almoco_end: rules.almoco.end,
        janta_allowed: rules.janta.allowed, janta_start: rules.janta.start, janta_end: rules.janta.end,
      })
      .eq("employee_id", id);
    if (error) throw new Error(error.message);

    const { data, error: fetchError } = await supabase.from("employees").select(EMPLOYEE_SELECT).eq("id", id).single();
    if (fetchError) throw new Error(fetchError.message);
    return serializeEmployee(data);
  },

  async deleteEmployee(id: number): Promise<void> {
    const { error } = await supabase.from("employees").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "funcionario", id);
  },

  async checkin(descriptor: number[], gateId = "kiosk-1"): Promise<CheckinResult> {
    const { data, error } = await supabase.functions.invoke("checkin", { body: { descriptor, gateId } });
    if (error) throw new Error(error.message);
    return data;
  },

  async listLogs(limit = 50): Promise<AccessLog[]> {
    const { data, error } = await supabase.from("access_logs").select("*").order("ts", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data;
  },

  // ---------- Setores ----------
  async listSectors(): Promise<Sector[]> {
    const { data, error } = await supabase.from("sectors").select("*").is("deleted_at", null).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({ id: r.id, companyId: r.company_id, name: r.name }));
  },
  async createSector(input: { companyId: number; name: string }): Promise<void> {
    const { data, error } = await supabase.from("sectors").insert({ company_id: input.companyId, name: input.name }).select().single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "setor", data.id, { nome: input.name });
  },
  async deleteSector(id: number): Promise<void> {
    const { error } = await supabase.from("sectors").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "setor", id);
  },

  // ---------- Funções ----------
  async listJobFunctions(): Promise<JobFunction[]> {
    const { data, error } = await supabase.from("job_functions").select("*").is("deleted_at", null).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({ id: r.id, companyId: r.company_id, name: r.name }));
  },
  async createJobFunction(input: { companyId: number | null; name: string }): Promise<void> {
    const { data, error } = await supabase.from("job_functions").insert({ company_id: input.companyId, name: input.name }).select().single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "funcao", data.id, { nome: input.name });
  },
  async deleteJobFunction(id: number): Promise<void> {
    const { error } = await supabase.from("job_functions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "funcao", id);
  },

  // ---------- Portões de Acesso ----------
  async listAccessGates(): Promise<AccessGate[]> {
    const { data, error } = await supabase.from("access_gates").select("*").order("label");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      id: r.id, companyId: r.company_id, label: r.label, gateKey: r.gate_key, location: r.location, active: r.active,
    }));
  },
  async createAccessGate(input: { companyId: number; label: string; gateKey: string; location?: string }): Promise<void> {
    const { data, error } = await supabase
      .from("access_gates")
      .insert({ company_id: input.companyId, label: input.label, gate_key: input.gateKey, location: input.location ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "portao", data.id, { label: input.label });
  },
  async setAccessGateActive(id: number, active: boolean): Promise<void> {
    const { error } = await supabase.from("access_gates").update({ active }).eq("id", id);
    if (error) throw new Error(error.message);
  },
  async deleteAccessGate(id: number): Promise<void> {
    const { error } = await supabase.from("access_gates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "portao", id);
  },

  // ---------- Visitantes ----------
  async listVisitors(): Promise<Visitor[]> {
    const { data, error } = await supabase.from("visitors").select("*").is("deleted_at", null).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      id: r.id, companyId: r.company_id, name: r.name, document: r.document, hostEmployeeId: r.host_employee_id,
      hasFace: !!r.has_face, validFrom: r.valid_from, validUntil: r.valid_until, active: r.active,
    }));
  },
  async createVisitor(input: {
    companyId: number; name: string; document?: string; hostEmployeeId?: number | null;
    validFrom: string; validUntil: string; descriptor?: number[] | null;
  }): Promise<void> {
    const { data, error } = await supabase
      .from("visitors")
      .insert({
        company_id: input.companyId, name: input.name, document: input.document ?? null,
        host_employee_id: input.hostEmployeeId ?? null, valid_from: input.validFrom, valid_until: input.validUntil,
        descriptor: input.descriptor ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "visitante", data.id, { nome: input.name });
  },
  async enrollVisitorFace(id: number, descriptor: number[]): Promise<void> {
    const { error } = await supabase.from("visitors").update({ descriptor }).eq("id", id);
    if (error) throw new Error(error.message);
  },
  async deleteVisitor(id: number): Promise<void> {
    const { error } = await supabase.from("visitors").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "visitante", id);
  },

  // ---------- Credenciais ----------
  async listCredentials(): Promise<Credential[]> {
    const { data, error } = await supabase.from("credentials").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({
      id: r.id, subjectType: r.subject_type, subjectId: r.subject_id, method: r.method, label: r.label, code: r.code, active: r.active,
    }));
  },
  async createCredential(input: { subjectType: "employee" | "visitor"; subjectId: number; method: "card" | "pin"; label?: string; code: string }): Promise<void> {
    const { data, error } = await supabase
      .from("credentials")
      .insert({ subject_type: input.subjectType, subject_id: input.subjectId, method: input.method, label: input.label ?? null, code: input.code })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAudit("criar", "credencial", data.id, { método: input.method });
  },
  async setCredentialActive(id: number, active: boolean): Promise<void> {
    const { error } = await supabase.from("credentials").update({ active }).eq("id", id);
    if (error) throw new Error(error.message);
  },
  async deleteCredential(id: number): Promise<void> {
    const { error } = await supabase.from("credentials").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit("remover", "credencial", id);
  },

  // ---------- Lixeira ----------
  async listTrash(): Promise<TrashItem[]> {
    const [companies, employees, sectors, jobFunctions, visitors] = await Promise.all([
      supabase.from("companies").select("id, name, deleted_at").not("deleted_at", "is", null),
      supabase.from("employees").select("id, name, deleted_at").not("deleted_at", "is", null),
      supabase.from("sectors").select("id, name, deleted_at").not("deleted_at", "is", null),
      supabase.from("job_functions").select("id, name, deleted_at").not("deleted_at", "is", null),
      supabase.from("visitors").select("id, name, deleted_at").not("deleted_at", "is", null),
    ]);
    for (const r of [companies, employees, sectors, jobFunctions, visitors]) {
      if (r.error) throw new Error(r.error.message);
    }
    const items: TrashItem[] = [
      ...(companies.data ?? []).map((r: Row) => ({ kind: "company" as const, id: r.id, label: r.name, deletedAt: r.deleted_at })),
      ...(employees.data ?? []).map((r: Row) => ({ kind: "employee" as const, id: r.id, label: r.name, deletedAt: r.deleted_at })),
      ...(sectors.data ?? []).map((r: Row) => ({ kind: "sector" as const, id: r.id, label: r.name, deletedAt: r.deleted_at })),
      ...(jobFunctions.data ?? []).map((r: Row) => ({ kind: "function" as const, id: r.id, label: r.name, deletedAt: r.deleted_at })),
      ...(visitors.data ?? []).map((r: Row) => ({ kind: "visitor" as const, id: r.id, label: r.name, deletedAt: r.deleted_at })),
    ];
    return items.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  },
  async restoreTrashItem(item: TrashItem): Promise<void> {
    const table = { company: "companies", employee: "employees", sector: "sectors", function: "job_functions", visitor: "visitors" }[item.kind];
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", item.id);
    if (error) throw new Error(error.message);
    await logAudit("restaurar", item.kind, item.id, { nome: item.label });
  },
  async permanentlyDeleteTrashItem(item: TrashItem): Promise<void> {
    const table = { company: "companies", employee: "employees", sector: "sectors", function: "job_functions", visitor: "visitors" }[item.kind];
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) throw new Error(error.message);
    await logAudit("excluir_definitivo", item.kind, item.id, { nome: item.label });
  },

  // ---------- Histórico ----------
  async listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Row) => ({ id: r.id, action: r.action, entityType: r.entity_type, entityId: r.entity_id, detail: r.detail, createdAt: r.created_at }));
  },
};
