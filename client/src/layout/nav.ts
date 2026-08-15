export interface NavItem {
  label: string;
  path: string;
  ready: boolean;
  external?: boolean;
}

export interface NavSection {
  title: string | null;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  { title: null, items: [{ label: "Painel", path: "/", ready: true }] },
  {
    title: "Cadastro",
    items: [
      { label: "Empresas", path: "/empresas", ready: true },
      { label: "Funcionários", path: "/funcionarios", ready: true },
      { label: "Setores", path: "/setores", ready: true },
      { label: "Funções", path: "/funcoes", ready: true },
      { label: "Visitantes", path: "/visitantes", ready: true },
    ],
  },
  {
    title: "Operação",
    items: [
      { label: "Check-in", path: "/kiosk", ready: true, external: true },
      { label: "Refeição", path: "/refeicao", ready: false },
      { label: "Credenciais", path: "/credenciais", ready: true },
      { label: "Portões de Acesso", path: "/portoes", ready: true },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Usuários & Permissões", path: "/usuarios", ready: false },
      { label: "Logs do Sistema", path: "/logs", ready: true },
      { label: "Relatórios", path: "/relatorios", ready: false },
      { label: "Histórico", path: "/historico", ready: true },
      { label: "Lixeira", path: "/lixeira", ready: true },
    ],
  },
];
