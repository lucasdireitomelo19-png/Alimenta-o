const MEALS = [
  { key: "cafe", label: "Café da manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "janta", label: "Janta" },
];

function nowHHMM(date) {
  return date.toTimeString().slice(0, 5);
}

/** Euclidean distance between two 128-d face descriptors. */
function descriptorDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Decide grant/deny for an employee's access_rules row at a given time. */
function evaluateAccess(rules, date = new Date()) {
  const days = JSON.parse(rules.days);
  const day = date.getDay();
  const hhmm = nowHHMM(date);

  if (!days.includes(day)) {
    return { granted: false, reason: "Dia da semana não autorizado", mealType: null };
  }

  for (const meal of MEALS) {
    const start = rules[`${meal.key}_start`];
    const end = rules[`${meal.key}_end`];
    if (hhmm >= start && hhmm <= end) {
      if (rules[`${meal.key}_allowed`]) {
        return { granted: true, reason: `Acesso liberado — ${meal.label}`, mealType: meal.label };
      }
      return { granted: false, reason: `Sem permissão para ${meal.label}`, mealType: meal.label };
    }
  }

  return { granted: false, reason: "Fora do horário de qualquer refeição", mealType: null };
}

module.exports = { descriptorDistance, evaluateAccess, MEALS };
