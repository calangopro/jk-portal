import type { LucideIcon } from "lucide-react";
import {
  Activity, Banknote, BellRing, BookCheck, Bot, CalendarDays, Contact, Crosshair, FileText, Filter, Globe, Hammer, HandCoins, HeartPulse,
  History, ImageIcon, LayoutDashboard, LayoutTemplate, ListChecks, MapPin, MessageCircle, Milestone, Package, PackageSearch, Palette, PenLine,
  Percent, Plug, QrCode, RotateCcw, Settings, Smartphone, Store, Table2, Tags, TrendingUp, Trophy, Users,
  UsersRound, Wallet,
} from "lucide-react";
import type { Area } from "@/lib/auth/acessos";

/**
 * Os setores do painel: o escritório da JK, sala por sala.
 *
 * O menu antigo era uma lista de vinte e nove telas em cinco grupos, e a pessoa
 * precisava ler tudo para achar o que queria. Agora são oito salas, cada uma
 * com a sua cor, e dentro de cada sala ficam as telas dela. Este arquivo é a
 * ÚNICA lista: dele saem a barra lateral do computador, a barra de baixo do
 * celular, as abas de cada setor e a folha "Mais". Tela nova entra aqui e
 * aparece nos quatro lugares.
 *
 * Quem vê o quê continua sendo decisão do banco (`acessos_por_papel`): cada
 * item diz a área que ele pede, e item sem área (`null`) é de qualquer pessoa
 * ativa. Setor em que a pessoa não tem nenhum item some inteiro.
 *
 * A cor do setor é de navegação, não de dado. Verde, âmbar e vermelho ficam de
 * fora de propósito: no painel eles querem dizer bom, atenção e ruim, e sempre
 * vêm com ícone e palavra. As cores abaixo foram medidas: todas passam de
 * 5,4:1 sobre o marfim do painel, de 6:1 sobre branco e de 4,5:1 sobre a
 * própria cor a 12% (o fundo da aba ativa). Ao trocar uma, meça de novo.
 */

export type ItemDoSetor = {
  href: string;
  /** Área que a tela pede. `null`: qualquer pessoa com sessão. */
  area: Area | null;
  label: string;
  /** Nome curto para a barra de baixo e as abas do celular. */
  curto?: string;
  Icone: LucideIcon;
  desc: string;
};

export type SetorId = "diretoria" | "vendas" | "trafego" | "loja" | "fabrica" | "conteudo" | "site" | "sistema";

export type Setor = {
  id: SetorId;
  nome: string;
  /** Uma linha dizendo o que se resolve ali. */
  frase: string;
  /** Cor forte: texto, ícone e aba ativa. */
  cor: string;
  Icone: LucideIcon;
  itens: ItemDoSetor[];
};

export const SETORES: Setor[] = [
  {
    id: "diretoria",
    nome: "Diretoria",
    frase: "O negócio numa tela",
    cor: "#1a1815",
    Icone: LayoutDashboard,
    itens: [
      { href: "/admin", area: null, label: "Visão geral", curto: "Início", Icone: LayoutDashboard, desc: "O que pede atenção hoje" },
      { href: "/admin/gargalos", area: "vendas", label: "Gargalos", Icone: Filter, desc: "Onde o dinheiro vaza" },
      { href: "/admin/custos", area: "custos", label: "Custos", Icone: Wallet, desc: "O que a loja gasta por mês" },
      { href: "/admin/margem", area: "margem", label: "Margem", Icone: Percent, desc: "Custo, ouro e margem mínima" },
    ],
  },
  {
    id: "vendas",
    nome: "Vendas",
    frase: "Pedidos, clientes e vendedores",
    cor: "#1a64a8",
    Icone: Banknote,
    itens: [
      { href: "/admin/vendas", area: "vendas", label: "Pedidos da loja", curto: "Pedidos", Icone: Banknote, desc: "O que foi pago, por dia e por origem" },
      { href: "/admin/consulta", area: "consulta", label: "Consulta", Icone: PackageSearch, desc: "Produto, pronta entrega e prazo" },
      { href: "/admin/registrar-venda", area: "lancar_venda", label: "Registrar venda", curto: "Registrar", Icone: HandCoins, desc: "O que foi fechado fora da loja" },
      { href: "/admin/oportunidades", area: "lancar_venda", label: "Oportunidades", curto: "Chamar", Icone: BellRing, desc: "Quem vale chamar nos próximos dias" },
      { href: "/admin/clientes", area: "lancar_venda", label: "Clientes", Icone: Contact, desc: "A ficha de cada cliente" },
      { href: "/admin/vendedores", area: "vendas", label: "Vendedores", Icone: Trophy, desc: "Quanto cada um vendeu" },
      { href: "/admin/recuperacao", area: "recuperacao", label: "Recuperação", curto: "Recuperar", Icone: RotateCcw, desc: "Quem não pagou o pedido" },
    ],
  },
  {
    id: "trafego",
    nome: "Tráfego",
    frase: "O que os anúncios vendem",
    cor: "#6548c0",
    Icone: Activity,
    itens: [
      { href: "/admin/trafego", area: "trafego", label: "Gasto e retorno", curto: "Resumo", Icone: Activity, desc: "Quanto saiu e quanto voltou" },
      { href: "/admin/trafego/campanhas", area: "trafego", label: "Campanhas e anúncios", curto: "Anúncios", Icone: Table2, desc: "Campanha, conjunto e anúncio" },
      { href: "/admin/anuncios", area: "anuncios", label: "Limite de anúncio", curto: "Limite", Icone: Crosshair, desc: "Quanto dá para pagar por venda" },
    ],
  },
  {
    id: "loja",
    nome: "Loja",
    frase: "Produtos e descontos",
    cor: "#aa3570",
    Icone: Store,
    itens: [
      { href: "/admin/produtos", area: "catalogo", label: "Produtos", Icone: Package, desc: "Fotos, preço e estoque de cada peça" },
      { href: "/admin/campanhas", area: "campanhas", label: "Campanhas de desconto", curto: "Descontos", Icone: Tags, desc: "Descontos com aprovação" },
      { href: "/admin/alteracoes-na-loja", area: "loja", label: "Alterações na loja", curto: "Alterações", Icone: History, desc: "Quem mudou o quê na Tray" },
      { href: "/admin/lojas", area: "catalogo", label: "Lojas físicas", curto: "Lojas", Icone: MapPin, desc: "Endereço e horário" },
    ],
  },
  {
    id: "fabrica",
    nome: "Fábrica",
    frase: "Do pedido pago ao envio",
    cor: "#566217",
    Icone: Hammer,
    itens: [
      { href: "/admin/fabrica", area: "fabrica", label: "Fila da fábrica", curto: "Fila", Icone: Hammer, desc: "O que produzir e o que enviar" },
    ],
  },
  {
    id: "conteudo",
    nome: "Conteúdo",
    frase: "Posts e busca do Google",
    cor: "#0b6f6a",
    Icone: FileText,
    itens: [
      { href: "/admin/conteudos", area: "conteudo", label: "Conteúdos", curto: "Posts", Icone: FileText, desc: "Posts do site" },
      { href: "/admin/pautas", area: "conteudo", label: "Pautas", Icone: ListChecks, desc: "O que escrever a seguir" },
      { href: "/admin/calendario", area: "conteudo", label: "Calendário", Icone: CalendarDays, desc: "Quando cada coisa sai" },
      { href: "/admin/metricas", area: "metricas", label: "Métricas", Icone: TrendingUp, desc: "Visitas, busca e cliques" },
      { href: "/admin/comentarios", area: "conteudo", label: "Comentários", Icone: MessageCircle, desc: "Fila de moderação" },
      { href: "/admin/midia", area: "conteudo", label: "Mídia", Icone: ImageIcon, desc: "Imagens do site" },
      { href: "/admin/autores", area: "conteudo", label: "Autores", Icone: PenLine, desc: "Quem assina" },
      { href: "/admin/fatos", area: "conteudo", label: "Base de fatos", curto: "Fatos", Icone: BookCheck, desc: "O que dá para afirmar" },
    ],
  },
  {
    id: "site",
    nome: "Site",
    frase: "Home, bio, grupo e QR",
    cor: "#76582b",
    Icone: Globe,
    itens: [
      { href: "/admin/home", area: "site", label: "Home", Icone: LayoutTemplate, desc: "Seções da página inicial" },
      { href: "/admin/bio", area: "site", label: "Link da bio", curto: "Bio", Icone: Smartphone, desc: "A página do Instagram" },
      { href: "/admin/grupo", area: "site", label: "Grupo de ofertas", curto: "Grupo", Icone: UsersRound, desc: "Página do anúncio e contatos" },
      { href: "/admin/qrcode", area: "site", label: "QR codes", Icone: QrCode, desc: "Um por lugar, com as leituras" },
      { href: "/admin/aparencia", area: "site", label: "Aparência", Icone: Palette, desc: "Cores e cantos" },
      { href: "/admin/redirects", area: "site", label: "Redirects", Icone: Milestone, desc: "Endereços que mudaram" },
    ],
  },
  {
    id: "sistema",
    nome: "Sistema",
    frase: "Pessoas e integrações",
    cor: "#55606e",
    Icone: Settings,
    itens: [
      { href: "/admin/usuarios", area: "equipe", label: "Usuários", Icone: Users, desc: "Acesso e níveis" },
      { href: "/admin/integracoes", area: "equipe", label: "Integrações", Icone: Plug, desc: "Google, Meta e a loja" },
      { href: "/admin/saude", area: "equipe", label: "Saúde das ligações", curto: "Saúde", Icone: HeartPulse, desc: "O que roda sozinho e o que parou" },
      { href: "/admin/conector", area: "equipe", label: "Conector do Claude", curto: "Conector", Icone: Bot, desc: "Claude lendo e escrevendo aqui" },
    ],
  },
];

/** Os setores que a pessoa enxerga, cada um só com as telas que o nível dela abre. */
export function setoresDe(areas: readonly Area[]): Setor[] {
  return SETORES.map((s) => ({
    ...s,
    itens: s.itens.filter((i) => i.area === null || areas.includes(i.area)),
  })).filter((s) => s.itens.length > 0);
}

/** `/admin/trafego/campanhas` está em `/admin/trafego`, mas `/admin/trafegos` não. */
function dentroDe(caminho: string, href: string): boolean {
  if (href === "/admin") return caminho === "/admin";
  return caminho === href || caminho.startsWith(`${href}/`);
}

/**
 * Onde a pessoa está: o setor e o item da tela aberta.
 *
 * Vale o endereço MAIS COMPRIDO que casa. Sem isso, em
 * `/admin/trafego/campanhas` acenderiam duas abas, porque o endereço também
 * começa com `/admin/trafego`.
 */
export function ondeEstou(setores: Setor[], caminho: string): { setor: Setor | null; item: ItemDoSetor | null } {
  let melhor: { setor: Setor; item: ItemDoSetor } | null = null;
  for (const setor of setores) {
    for (const item of setor.itens) {
      if (dentroDe(caminho, item.href) && (!melhor || item.href.length > melhor.item.href.length)) {
        melhor = { setor, item };
      }
    }
  }
  return melhor ?? { setor: null, item: null };
}

/**
 * Nome do primeiro setor para quem olha. Quem só tem a Visão geral ali (um
 * vendedor, um autor) não está na diretoria: para essa pessoa a sala se chama
 * Início.
 */
export function nomeDoSetor(setor: Setor): string {
  return setor.id === "diretoria" && setor.itens.length === 1 ? "Início" : setor.nome;
}

/** Quantas abas cabem na barra de baixo antes do "Mais". */
export const ABAS_NA_BARRA = 4;

export type AbaDaBarra = { href: string; label: string; Icone: LucideIcon; cor: string; setor: SetorId };

/**
 * As abas da barra de baixo do celular.
 *
 * Quem tem três setores ou mais navega por SETOR: cada aba abre a primeira tela
 * daquele setor, e as outras telas ficam nas abas de cima. Quem tem um ou dois
 * (um vendedor: registrar, recuperar, consultar produto) navega direto pelas
 * TELAS, porque para essa pessoa um nível a mais de menu só atrapalha.
 */
export function abasDaBarra(setores: Setor[]): AbaDaBarra[] {
  if (setores.length >= 3) {
    return setores.slice(0, ABAS_NA_BARRA).map((s) => ({
      href: s.itens[0].href,
      label: s.id === "diretoria" ? "Início" : s.nome,
      Icone: s.Icone,
      cor: s.cor,
      setor: s.id,
    }));
  }
  return setores
    .flatMap((s) => s.itens.map((i) => ({ href: i.href, label: i.curto ?? i.label, Icone: i.Icone, cor: s.cor, setor: s.id })))
    .slice(0, ABAS_NA_BARRA);
}
