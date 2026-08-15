// Coral — Controle de Acesso — Edge Function: /checkin
//
// Recebe o descritor facial (128 números) capturado no navegador do kiosk,
// compara com os funcionários cadastrados, confere a regra de dia/horário,
// registra o log e — se liberado — aciona a catraca. Roda com a service role
// key (nunca exposta ao navegador), então é o único lugar que enxerga a lista
// de descritores cadastrados.
//
// Como publicar: Supabase Dashboard → Edge Functions → Deploy a new function
// → nome "checkin" → cole este arquivo. (Ou via CLI: `supabase functions deploy checkin`.)

import { createClient } from "jsr:@supabase/supabase-js@2";

const MATCH_THRESHOLD = 0.5;
const MEALS = [
  { key: "cafe", label: "Café da manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "janta", label: "Janta" },
] as const;

function descriptorDistance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function nowHHMM(date: Date) {
  return date.toISOString().slice(11, 16);
}

function evaluateAccess(rules: Record<string, unknown>, date: Date) {
  const days = rules.days as number[];
  const day = date.getUTCDay();
  const hhmm = nowHHMM(date);

  if (!days.includes(day)) {
    return { granted: false, reason: "Dia da semana não autorizado", mealType: null as string | null };
  }

  for (const meal of MEALS) {
    const start = rules[`${meal.key}_start`] as string;
    const end = rules[`${meal.key}_end`] as string;
    if (hhmm >= start && hhmm <= end) {
      if (rules[`${meal.key}_allowed`]) {
        return { granted: true, reason: `Acesso liberado — ${meal.label}`, mealType: meal.label };
      }
      return { granted: false, reason: `Sem permissão para ${meal.label}`, mealType: meal.label };
    }
  }

  return { granted: false, reason: "Fora do horário de qualquer refeição", mealType: null };
}

/**
 * Ponto de integração com a catraca física — simulado por enquanto.
 * Trocar por chamada de rede local / relé / serial quando o hardware for definido.
 */
async function releasePassage(gateId: string, employeeId: number, mealType: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  console.log(`[catraca:${gateId}] passagem liberada — funcionário #${employeeId}, refeição: ${mealType}`);
  return { released: true, gateId, at: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405 });
  }

  const { descriptor, gateId = "default" } = await req.json();
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return new Response(JSON.stringify({ error: "descriptor (128 números) é obrigatório" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, name, descriptor, company_id, companies(name), access_rules(*)")
    .eq("active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let best: (typeof employees)[number] | null = null;
  let bestDistance = Infinity;
  for (const emp of employees ?? []) {
    if (!emp.descriptor) continue; // importado via CSV, ainda sem rosto capturado
    const distance = descriptorDistance(descriptor, emp.descriptor as number[]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = emp;
    }
  }

  const now = new Date();

  if (!best || bestDistance > MATCH_THRESHOLD) {
    await supabase.from("access_logs").insert({
      granted: false,
      reason: "Rosto não reconhecido",
      distance: Number.isFinite(bestDistance) ? bestDistance : null,
    });
    return new Response(
      JSON.stringify({ granted: false, reason: "Rosto não reconhecido", employee: null }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // access_rules vem como array (join do Supabase) — pega o primeiro/único registro
  const rules = Array.isArray(best.access_rules) ? best.access_rules[0] : best.access_rules;
  const decision = evaluateAccess(rules, now);
  const companyName = Array.isArray(best.companies) ? best.companies[0]?.name : (best.companies as { name: string } | null)?.name;

  await supabase.from("access_logs").insert({
    employee_id: best.id,
    employee_name: best.name,
    company_name: companyName,
    granted: decision.granted,
    reason: decision.reason,
    meal_type: decision.mealType,
    distance: bestDistance,
  });

  let turnstile = null;
  if (decision.granted) {
    turnstile = await releasePassage(gateId, best.id, decision.mealType);
  }

  return new Response(
    JSON.stringify({
      granted: decision.granted,
      reason: decision.reason,
      mealType: decision.mealType,
      distance: bestDistance,
      employee: { id: best.id, name: best.name, companyName },
      turnstile,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
