const BASE_URL = "http://localhost:4000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

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

export const api = {
  listCompanies: () => request<Company[]>("/companies"),
  createCompany: (name: string) =>
    request<Company>("/companies", { method: "POST", body: JSON.stringify({ name }) }),

  listEmployees: () => request<Employee[]>("/employees"),
  createEmployee: (data: { name: string; companyId: number; role?: string; descriptor: number[] }) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),
  updateRules: (id: number, rules: Employee["rules"]) =>
    request<Employee>(`/employees/${id}/rules`, { method: "PUT", body: JSON.stringify(rules) }),
  deleteEmployee: (id: number) => request<void>(`/employees/${id}`, { method: "DELETE" }),

  checkin: (descriptor: number[], gateId = "kiosk-1") =>
    request<CheckinResult>("/checkin", { method: "POST", body: JSON.stringify({ descriptor, gateId }) }),

  listLogs: (limit = 50) => request<AccessLog[]>(`/logs?limit=${limit}`),
};
