/**
 * Suíte de testes de ponta a ponta contra a API local (mesma lógica de
 * negócio da Edge Function do Supabase — access.js e turnstile.js são
 * compartilhados/espelhados). Roda contra um servidor já em pé em
 * http://localhost:4000.
 *
 * Uso: node test/run-tests.js
 */

const BASE = "http://localhost:4000/api";
let passed = 0;
let failed = 0;

function seededDescriptor(seed) {
  // PRNG determinístico simples — mesmo seed sempre gera o mesmo "rosto".
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: 128 }, () => rnd() * 2 - 1);
}

function withNoise(descriptor, amount) {
  return descriptor.map((v) => v + (Math.random() * 2 - 1) * amount);
}

async function req(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  return { status: res.status, body };
}

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("== Setup: empresas ==");
  const { body: empresaA } = await req("/companies", { method: "POST", body: JSON.stringify({ name: "Parafixar Ind. (teste)" }) });
  const { body: empresaB } = await req("/companies", { method: "POST", body: JSON.stringify({ name: "Metalúrgica Sul (teste)" }) });
  check("cria empresa A", !!empresaA.id);
  check("cria empresa B", !!empresaB.id);

  console.log("\n== Funcionário com rosto: cadastro e reconhecimento ==");
  const anaDescriptor = seededDescriptor(1);
  const { body: ana } = await req("/employees", {
    method: "POST",
    body: JSON.stringify({ name: "Ana Ferreira (teste)", role: "Analista", companyId: empresaA.id, descriptor: anaDescriptor }),
  });
  check("cadastra Ana com rosto", ana.hasFace === true, JSON.stringify(ana));

  // libera almoço o dia todo pra não depender do dia/hora real da máquina
  await req(`/employees/${ana.id}/rules`, {
    method: "PUT",
    body: JSON.stringify({
      days: [0, 1, 2, 3, 4, 5, 6],
      cafe: { allowed: false, start: "07:00", end: "09:00" },
      almoco: { allowed: true, start: "00:00", end: "23:59" },
      janta: { allowed: false, start: "18:00", end: "20:00" },
    }),
  });

  const exact = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: anaDescriptor, gateId: "teste" }) });
  check("reconhece rosto idêntico", exact.body.granted === true && exact.body.employee?.name === "Ana Ferreira (teste)", JSON.stringify(exact.body));
  check("dispara a catraca (mock) quando libera", exact.body.turnstile?.released === true);

  const slightlyOff = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: withNoise(anaDescriptor, 0.02), gateId: "teste" }) });
  check("reconhece o mesmo rosto com leve variação (nova captura da mesma pessoa)", slightlyOff.body.granted === true, JSON.stringify(slightlyOff.body));

  const strangerDescriptor = seededDescriptor(999);
  const stranger = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: strangerDescriptor, gateId: "teste" }) });
  check("NÃO reconhece rosto totalmente diferente", stranger.body.granted === false && stranger.body.reason === "Rosto não reconhecido", JSON.stringify(stranger.body));
  check("não dispara a catraca quando não reconhece", stranger.body.turnstile == null);

  console.log("\n== Regras de dia/horário ==");
  await req(`/employees/${ana.id}/rules`, {
    method: "PUT",
    body: JSON.stringify({
      days: [], // nenhum dia permitido
      cafe: { allowed: true, start: "00:00", end: "23:59" },
      almoco: { allowed: true, start: "00:00", end: "23:59" },
      janta: { allowed: true, start: "00:00", end: "23:59" },
    }),
  });
  const noDays = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: anaDescriptor }) });
  check("bloqueia quando nenhum dia da semana está liberado", noDays.body.granted === false && noDays.body.reason === "Dia da semana não autorizado", JSON.stringify(noDays.body));

  await req(`/employees/${ana.id}/rules`, {
    method: "PUT",
    body: JSON.stringify({
      days: [0, 1, 2, 3, 4, 5, 6],
      cafe: { allowed: false, start: "00:00", end: "23:59" },
      almoco: { allowed: false, start: "00:00", end: "23:59" },
      janta: { allowed: false, start: "00:00", end: "23:59" },
    }),
  });
  const noMeals = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: anaDescriptor }) });
  check("bloqueia quando a refeição do horário atual não está autorizada", noMeals.body.granted === false && noMeals.body.reason.startsWith("Sem permissão"), JSON.stringify(noMeals.body));

  await req(`/employees/${ana.id}/rules`, {
    method: "PUT",
    body: JSON.stringify({
      days: [0, 1, 2, 3, 4, 5, 6],
      cafe: { allowed: false, start: "01:00", end: "01:01" },
      almoco: { allowed: false, start: "01:02", end: "01:03" },
      janta: { allowed: false, start: "01:04", end: "01:05" },
    }),
  });
  const outsideWindows = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: anaDescriptor }) });
  check("bloqueia quando o horário atual não cai em nenhuma janela de refeição", outsideWindows.body.granted === false && outsideWindows.body.reason === "Fora do horário de qualquer refeição", JSON.stringify(outsideWindows.body));

  console.log("\n== Funcionário sem rosto (simulando importação CSV) ==");
  const { body: bruno } = await req("/employees", {
    method: "POST",
    body: JSON.stringify({ name: "Bruno Lima (teste)", role: "Ajudante", companyId: empresaA.id }),
  });
  check("cadastra sem descriptor (pendente)", bruno.hasFace === false, JSON.stringify(bruno));

  const list1 = await req("/employees");
  const brunoInList = list1.body.find((e) => e.id === bruno.id);
  check("aparece na listagem como pendente", brunoInList?.hasFace === false);
  check("listagem não vaza o array de descriptor bruto", brunoInList && !("descriptor" in brunoInList));

  const brunoDescriptor = seededDescriptor(2);
  const strangerVsBrunoPending = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: brunoDescriptor }) });
  check("funcionário pendente não é reconhecido por engano antes de capturar o rosto", strangerVsBrunoPending.body.employee?.id !== bruno.id, JSON.stringify(strangerVsBrunoPending.body));

  const enrolled = await req(`/employees/${bruno.id}/face`, { method: "PUT", body: JSON.stringify({ descriptor: brunoDescriptor }) });
  check("captura de rosto posterior funciona", enrolled.body.hasFace === true, JSON.stringify(enrolled.body));

  await req(`/employees/${bruno.id}/rules`, {
    method: "PUT",
    body: JSON.stringify({
      days: [0, 1, 2, 3, 4, 5, 6],
      cafe: { allowed: true, start: "00:00", end: "23:59" },
      almoco: { allowed: true, start: "00:00", end: "23:59" },
      janta: { allowed: true, start: "00:00", end: "23:59" },
    }),
  });
  const brunoNowRecognized = await req("/checkin", { method: "POST", body: JSON.stringify({ descriptor: brunoDescriptor }) });
  check("reconhece o funcionário depois de capturar o rosto", brunoNowRecognized.body.granted === true && brunoNowRecognized.body.employee?.name === "Bruno Lima (teste)", JSON.stringify(brunoNowRecognized.body));

  console.log("\n== Isolamento entre empresas ==");
  const { body: carla } = await req("/employees", {
    method: "POST",
    body: JSON.stringify({ name: "Carla Souza (teste)", role: "Supervisora", companyId: empresaB.id, descriptor: seededDescriptor(3) }),
  });
  const list2 = await req("/employees");
  const companyAIds = list2.body.filter((e) => e.companyId === empresaA.id).map((e) => e.name);
  const companyBIds = list2.body.filter((e) => e.companyId === empresaB.id).map((e) => e.name);
  check("funcionários da empresa A não aparecem misturados na B", !companyBIds.includes("Ana Ferreira (teste)") && companyAIds.includes("Ana Ferreira (teste)"));
  check("Carla está corretamente na empresa B", companyBIds.includes("Carla Souza (teste)"));

  console.log("\n== Logs ==");
  const logs = await req("/logs?limit=100");
  check("logs foram registrados", logs.body.length > 0, `total: ${logs.body.length}`);
  const deniedLogs = logs.body.filter((l) => !l.granted);
  const grantedLogs = logs.body.filter((l) => l.granted);
  check("existe pelo menos 1 log de acesso liberado", grantedLogs.length > 0);
  check("existe pelo menos 1 log de acesso negado", deniedLogs.length > 0);

  console.log("\n== Remoção ==");
  const del = await req(`/employees/${carla.id}`, { method: "DELETE" });
  check("remove funcionário", del.status === 204);
  const listAfterDelete = await req("/employees");
  check("funcionário removido não aparece mais na listagem", !listAfterDelete.body.find((e) => e.id === carla.id));

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro fatal na suíte de testes:", err);
  process.exit(1);
});
