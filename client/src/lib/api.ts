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

export const api = {
  async listCompanies(): Promise<Company[]> {
    const { data, error } = await supabase.from("companies").select("*").order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  async createCompany(name: string): Promise<Company> {
    const { data, error } = await supabase.from("companies").insert({ name }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async listEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase.from("employees").select(EMPLOYEE_SELECT).order("name");
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
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw new Error(error.message);
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
};
