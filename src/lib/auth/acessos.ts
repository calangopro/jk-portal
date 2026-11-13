/**
 * Níveis de acesso do painel e as áreas que eles abrem.
 *
 * A REGRA de quem vê o quê não mora aqui: mora na tabela `acessos_por_papel`
 * (0056), que o banco usa em `tem_acesso()` e o painel lê por `meus_acessos()`.
 * Este arquivo só dá nome às coisas (para a tela de usuários e o menu) e diz
 * quais níveis valem como administrador. Mudar o acesso de um nível é mudar
 * uma linha naquela tabela, sem publicar código.
 *
 * Arquivo puro, sem `server-only`: o menu e os formulários de convite, que são
 * componentes de cliente, também leem os nomes daqui.
 */

export type AppRole =
  | "admin"
  | "dono"
  | "gm"
  | "gerente"
  | "trafego"
  | "vendas"
  | "fabrica"
  | "editor"
  | "reviewer"
  | "author";

export type Area =
  | "conteudo"
  | "site"
  | "catalogo"
  | "campanhas"
  | "vendas"
  | "recuperacao"
  | "metricas"
  | "anuncios"
  | "margem"
  | "custos"
  | "equipe"
  | "fabrica";

/** Na ordem em que aparecem para quem convida: da empresa para o editorial. */
export const NIVEIS: { papel: AppRole; nome: string; resumo: string }[] = [
  { papel: "dono", nome: "Dono", resumo: "Vê e faz tudo" },
  { papel: "gm", nome: "GM", resumo: "Vê e faz tudo" },
  { papel: "gerente", nome: "Gerente", resumo: "Quase tudo, menos custos, margem e acessos" },
  { papel: "trafego", nome: "Tráfego", resumo: "Vendas, origem, métricas e campanhas" },
  { papel: "vendas", nome: "Vendas", resumo: "Fila de recuperação e consulta de produto" },
  { papel: "fabrica", nome: "Fábrica", resumo: "Só a área da fábrica" },
  { papel: "editor", nome: "Editor", resumo: "Conteúdo, site, produtos e campanhas" },
  { papel: "reviewer", nome: "Revisor", resumo: "Conteúdo e métricas" },
  { papel: "author", nome: "Autor", resumo: "Conteúdo e métricas" },
  { papel: "admin", nome: "Administrador", resumo: "Vê e faz tudo (conta técnica)" },
];

export const PAPEIS: AppRole[] = NIVEIS.map((n) => n.papel);

export const ROLE_LABEL = Object.fromEntries(NIVEIS.map((n) => [n.papel, n.nome])) as Record<AppRole, string>;

/**
 * Dono e GM têm o mesmo acesso do administrador: muda só o nome. É a mesma
 * lista de `is_admin()` no banco, e as duas precisam andar juntas.
 */
export function ehAdmin(papel: string | null | undefined): boolean {
  return papel === "admin" || papel === "dono" || papel === "gm";
}

/**
 * Vendas e fábrica não mexem em conteúdo: ficam de fora de `is_staff()` no
 * banco, e por isso também de `requireStaff()` no painel.
 */
export function ehEquipeDeConteudo(papel: string | null | undefined): boolean {
  return Boolean(papel) && papel !== "vendas" && papel !== "fabrica";
}
