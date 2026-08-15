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
      { label: "Setores", path: "/setores", ready: false },
      { label: "Funções", path: "/funcoes", ready: false },
      { label: "Visitantes", path: "/visitantes", ready: false },
    ],
  },
  {
    title: "Operação",
    items: [
      { label: "Check-in", path: "/kiosk", ready: true, external: true },
      { label: "Refeição", path: "/refeicao", ready: false },
      { label: "Credenciais", path: "/credenciais", ready: false },
      { label: "Portões de Acesso", path: "/portoes", ready: false },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Usuários & Permissões", path: "/usuarios", ready: false },
      { label: "Logs do Sistema", path: "/logs", ready: true },
      { label: "Relatórios", path: "/relatorios", ready: false },
      { label: "Histórico", path: "/historico", ready: false },
      { label: "Lixeira", path: "/lixeira", ready: false },
    ],
  },
];
