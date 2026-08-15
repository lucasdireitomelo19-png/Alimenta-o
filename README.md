# Coral — Controle de Acesso por Reconhecimento Facial

Protótipo: cadastro de funcionários dos clientes da Coral, regras de dia/horário
por refeição, e check-in por reconhecimento facial rodando 100% no navegador
(nenhuma foto sai do dispositivo). Estrutura pronta para acoplar uma catraca real.

## Rodando localmente

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
