# Coral — Controle de Acesso por Reconhecimento Facial

Protótipo: cadastro de funcionários dos clientes da Coral, regras de dia/horário
por refeição, e check-in por reconhecimento facial rodando 100% no navegador
(nenhuma foto sai do dispositivo). Estrutura pronta para acoplar uma catraca real.

O app fala com o **Supabase** (Postgres + Edge Function) em vez de precisar
de um servidor próprio — por isso dá pra publicar como site estático em
qualquer host (Netlify, Vercel, etc.). A pasta `server/` (Express + SQLite)
continua no repo só como referência para rodar 100% local, sem Supabase.

## Configurando o Supabase (uma vez só)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → Run.
3. **Edge Functions** → Deploy a new function → nome `checkin` → cole o
   conteúdo de `supabase/functions/checkin/index.ts` → Deploy.
4. **Project Settings → API** → copie a "Project URL" e a chave "anon public".
5. Em `client/`, copie `.env.example` para `.env` e preencha com esses dois valores.

## Rodando localmente (com Supabase)

```bash
cd client
npm install
npm run dev         # http://localhost:5173
```

## Publicando (arquivos estáticos)

```bash
cd client
npm run build        # gera client/dist — suba essa pasta em qualquer host estático
```

## Alternativa 100% local (sem Supabase, sem internet)

```bash
# Terminal 1 — API
cd server
npm install
npm start          # http://localhost:4000

# Terminal 2 — app
cd client
npm install
npm run dev         # http://localhost:5173
```

Abra `http://localhost:5173/` para o **painel administrativo** (cadastrar
empresas clientes, funcionários e regras de acesso) e
`http://localhost:5173/kiosk` para a **tela de check-in** (a que fica no
tablet perto da catraca).

## Como funciona

- **Reconhecimento facial**: `@vladmandic/face-api` (TensorFlow.js), com os
  modelos já embutidos em `client/public/models` — não depende de internet
  pra funcionar depois de instalado. O navegador calcula um "descritor" de
  128 números a partir do rosto; nenhuma imagem é enviada ao servidor.
- **Validação de acesso**: o servidor compara o descritor recebido no
  check-in com os descritores cadastrados (distância euclidiana) e, se achar
  um funcionário, confere se o dia da semana e o horário atual batem com a
  regra dele (café da manhã / almoço / janta).
- **Catraca**: `server/src/turnstile.js` é o ponto de integração. Hoje é
  simulado (só loga no console) — trocar essa implementação é o único passo
  necessário para ligar numa catraca de verdade (rede local, relé ou serial,
  dependendo do modelo).

## Importante — LGPD

Rosto é dado pessoal sensível. Antes de usar isso com funcionários de um
cliente de verdade: colete consentimento explícito, defina a base legal, e
trate os dados (mesmo sendo só o descritor numérico, não a foto) com o mesmo
cuidado que qualquer dado biométrico exige.
