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
  | "fabrica"
  | "lancar_venda"
  | "trafego"
  /** Alterar a loja na Tray pelo painel (0065). Preço fica mais fechado ainda: ver `lib/loja/produto.ts`. */
  | "loja"
  /** A consulta de quem atende cliente ou despacha peça: produto, pronta entrega e prazo (0073). */
  | "consulta";

/** Na ordem em que aparecem para quem convida: da empresa para o editorial. */
export const NIVEIS: { papel: AppRole; nome: string; resumo: string }[] = [
  { papel: "dono", nome: "Dono", resumo: "Vê e faz tudo" },
  { papel: "gm", nome: "GM", resumo: "Vê e faz tudo" },
  { papel: "gerente", nome: "Gerente", resumo: "Quase tudo, menos custos, margem e acessos" },
  { papel: "trafego", nome: "Tráfego", resumo: "Gasto de anúncio, retorno, vendas, métricas e campanhas" },
  { papel: "vendas", nome: "Vendas", resumo: "Consulta de produto e prazo, registrar venda e fila de recuperação" },
  { papel: "fabrica", nome: "Fábrica", resumo: "A fila da fábrica e a consulta de produto e prazo" },
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

/**
 * A falha ao ler a sessão é passageira (rede, limite de pedidos, serviço fora)
 * ou é sessão que não existe?
 *
 * Importa porque as duas davam no mesmo lugar: a pessoa logada que abria várias
 * telas em seguida caía na tela de login, com a sessão inteira. Medido em
 * 14/11/2026: de 21 telas pedidas em rajada, 7 responderam com o login; pedidas
 * devagar, as 21 abriram. Falha passageira merece uma segunda tentativa; sessão
 * que não existe, não.
 */
export function falhaPassageira(erro: { name?: string; status?: number } | null | undefined): boolean {
  if (!erro) return false;
  if (erro.name === "AuthRetryableFetchError") return true;
  const status = erro.status ?? 0;
  return status === 429 || status >= 500 || status === 0;
}
