"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import type { Area } from "@/lib/auth/acessos";
import {
  LayoutDashboard, FileText, ImageIcon, MessageCircle, Package,
  TrendingUp, Plug, Users, MapPin, PenLine, Palette, LayoutTemplate, BookCheck, ListChecks, CalendarDays, Milestone,
  Smartphone, UsersRound, QrCode, Bot, Percent, Tags, Megaphone, Banknote, RotateCcw, Wallet, HandCoins, Trophy,
  Loader2,
} from "lucide-react";

/**
 * Navegação do painel, agrupada por finalidade.
 *
 * Uma fileira única com oito itens obriga a pessoa a ler tudo para achar o que
 * quer. Agrupado, ela vai direto ao grupo certo. Os nomes dizem o que a área
 * faz, não como foi implementada.
 */
type Item = { href: string; area: Area; label: string; Icone: LucideIcon; desc: string };

const GRUPOS: { nome: string; itens: Item[] }[] = [
  {
    nome: "Editorial",
    itens: [
      { href: "/admin/pautas", area: "conteudo", label: "Pautas", Icone: ListChecks, desc: "O que escrever a seguir" },
      { href: "/admin/conteudos", area: "conteudo", label: "Conteúdos", Icone: FileText, desc: "Posts do site" },
      { href: "/admin/calendario", area: "conteudo", label: "Calendário", Icone: CalendarDays, desc: "Quando cada coisa sai" },
      { href: "/admin/midia", area: "conteudo", label: "Mídia", Icone: ImageIcon, desc: "Imagens do portal" },
      { href: "/admin/comentarios", area: "conteudo", label: "Comentários", Icone: MessageCircle, desc: "Fila de moderação" },
      { href: "/admin/autores", area: "conteudo", label: "Autores", Icone: PenLine, desc: "Quem assina" },
      { href: "/admin/fatos", area: "conteudo", label: "Base de fatos", Icone: BookCheck, desc: "O que dá para afirmar" },
    ],
  },
  {
    nome: "Loja",
    itens: [
      { href: "/admin/produtos", area: "catalogo", label: "Produtos", Icone: Package, desc: "Fotos, preço e link de cada peça" },
      { href: "/admin/campanhas", area: "campanhas", label: "Campanhas", Icone: Tags, desc: "Descontos com aprovação" },
      { href: "/admin/margem", area: "margem", label: "Margem", Icone: Percent, desc: "Custo, ouro e margem mínima" },
      { href: "/admin/anuncios", area: "anuncios", label: "Anúncios", Icone: Megaphone, desc: "Quanto pagar por venda" },
      { href: "/admin/lojas", area: "catalogo", label: "Lojas", Icone: MapPin, desc: "Endereço e horário" },
    ],
  },
  {
    nome: "Resultado",
    itens: [
      { href: "/admin/registrar-venda", area: "lancar_venda", label: "Registrar venda", Icone: HandCoins, desc: "O que foi fechado fora da loja" },
      { href: "/admin/vendas", area: "vendas", label: "Vendas", Icone: Banknote, desc: "Pedidos pagos da loja" },
      { href: "/admin/vendedores", area: "vendas", label: "Vendedores", Icone: Trophy, desc: "Quanto cada um vendeu" },
      { href: "/admin/recuperacao", area: "recuperacao", label: "Recuperação", Icone: RotateCcw, desc: "Quem não pagou o pedido" },
      { href: "/admin/custos", area: "custos", label: "Custos", Icone: Wallet, desc: "O que a loja gasta por mês" },
      { href: "/admin/metricas", area: "metricas", label: "Métricas", Icone: TrendingUp, desc: "Busca e cliques" },
      { href: "/admin/integracoes", area: "equipe", label: "Integrações", Icone: Plug, desc: "Google e loja" },
    ],
  },
  {
    nome: "Site",
    itens: [
      { href: "/admin/home", area: "site", label: "Home", Icone: LayoutTemplate, desc: "Seções da página inicial" },
      { href: "/admin/bio", area: "site", label: "Link da bio", Icone: Smartphone, desc: "A página do Instagram" },
      { href: "/admin/grupo", area: "site", label: "Grupo de ofertas", Icone: UsersRound, desc: "Página do anúncio e contatos" },
      { href: "/admin/qrcode", area: "site", label: "QR codes", Icone: QrCode, desc: "Um por lugar, com as leituras" },
      { href: "/admin/aparencia", area: "site", label: "Aparência", Icone: Palette, desc: "Cores e cantos" },
      { href: "/admin/redirects", area: "site", label: "Redirects", Icone: Milestone, desc: "Endereços que mudaram" },
    ],
  },
  {
    nome: "Equipe",
    itens: [
      { href: "/admin/usuarios", area: "equipe", label: "Usuários", Icone: Users, desc: "Acesso e papéis" },
      { href: "/admin/conector", area: "equipe", label: "Conector do Claude", Icone: Bot, desc: "Claude lendo e escrevendo aqui" },
    ],
  },
];

/**
 * Ícone do item, que vira giro enquanto a página não chega.
 *
 * O clique no painel abre rota dinâmica (sessão e consulta ao Supabase em toda
 * visita), então existe um intervalo real entre clicar e ver. Sem isto a tela
 * fica parada e a pessoa clica de novo.
 *
 * `useLinkStatus` só funciona DENTRO do Link, por isso o ícone é um componente
 * separado em vez de um `if` lá em cima. O `data-carregando` existe para o
 * próprio Link poder se pintar por `:has()`, já que o pai não enxerga o estado
 * do filho de outro jeito.
 */
function IconeDoItem({ Icone }: { Icone: LucideIcon }) {
  const { pending } = useLinkStatus();

  if (!pending) return <Icone size={15} className="shrink-0" />;

  return (
    <>
      <Loader2
        size={15}
        className="shrink-0 animate-spin text-brand-nav"
        data-carregando=""
        aria-hidden="true"
      />
      <span className="sr-only">Carregando</span>
    </>
  );
}

export function Navegacao({ pendentes, areas }: { pendentes: number; areas: Area[] }) {
  const caminho = usePathname();
  const ativo = (href: string) =>
    href === "/admin" ? caminho === "/admin" : caminho.startsWith(href);

  // O `:has()` deixa o link inteiro reagir ao giro que mora dentro dele.
  const base =
    "group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors " +
    "[&:has([data-carregando])]:bg-brand/12 [&:has([data-carregando])]:text-brand-strong";

  // Cada pessoa só vê o que o nível dela abre, e grupo vazio some inteiro.
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => areas.includes(i.area)) })).filter(
    (g) => g.itens.length > 0,
  );

  return (
    <nav aria-label="Administração" className="space-y-6">
      <Link
        href="/admin"
        className={`${base} ${
          ativo("/admin") && caminho === "/admin"
            ? "bg-ink text-white"
            : "text-ink/75 hover:bg-brand/10 hover:text-brand-nav"
        }`}
      >
        <IconeDoItem Icone={LayoutDashboard} />
        <span className="font-medium">Visão geral</span>
      </Link>

      {grupos.map((g) => (
        <div key={g.nome}>
          <p className="px-3 pb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
            {g.nome}
          </p>
          <ul className="space-y-0.5">
            {g.itens.map(({ href, label, Icone, desc }) => {
              const estaAtivo = ativo(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={estaAtivo ? "page" : undefined}
                    className={`${base} ${
                      estaAtivo
                        ? "bg-brand/15 text-brand-strong"
                        : "text-ink/75 hover:bg-brand/8 hover:text-brand-nav"
                    }`}
                  >
                    <IconeDoItem Icone={Icone} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-tight">{label}</span>
                      <span className="block text-[0.68rem] leading-tight text-muted">{desc}</span>
                    </span>
                    {href === "/admin/comentarios" && pendentes > 0 ? (
                      <span className="shrink-0 rounded-full bg-[#c9a227] px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                        {pendentes}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
