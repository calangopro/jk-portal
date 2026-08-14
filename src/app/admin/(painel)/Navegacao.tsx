"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, ImageIcon, MessageCircle, Package,
  TrendingUp, Plug, Users, MapPin, PenLine, Palette, LayoutTemplate, BookCheck, ListChecks, CalendarDays, Milestone,
} from "lucide-react";

/**
 * Navegação do painel, agrupada por finalidade.
 *
 * Uma fileira única com oito itens obriga a pessoa a ler tudo para achar o que
 * quer. Agrupado, ela vai direto ao grupo certo. Os nomes dizem o que a área
 * faz, não como foi implementada.
 */
const GRUPOS = [
  {
    nome: "Editorial",
    itens: [
      { href: "/admin/pautas", label: "Pautas", Icone: ListChecks, desc: "O que escrever a seguir" },
      { href: "/admin/conteudos", label: "Conteúdos", Icone: FileText, desc: "Posts do site" },
      { href: "/admin/calendario", label: "Calendário", Icone: CalendarDays, desc: "Quando cada coisa sai" },
      { href: "/admin/midia", label: "Mídia", Icone: ImageIcon, desc: "Imagens do portal" },
      { href: "/admin/comentarios", label: "Comentários", Icone: MessageCircle, desc: "Fila de moderação" },
      { href: "/admin/autores", label: "Autores", Icone: PenLine, desc: "Quem assina" },
      { href: "/admin/fatos", label: "Base de fatos", Icone: BookCheck, desc: "O que dá para afirmar" },
    ],
  },
  {
    nome: "Loja",
    itens: [
      { href: "/admin/produtos", label: "Produtos", Icone: Package, desc: "Catálogo da Tray" },
      { href: "/admin/lojas", label: "Lojas", Icone: MapPin, desc: "Endereço e horário" },
    ],
  },
  {
    nome: "Resultado",
    itens: [
      { href: "/admin/metricas", label: "Métricas", Icone: TrendingUp, desc: "Busca e cliques" },
      { href: "/admin/integracoes", label: "Integrações", Icone: Plug, desc: "Google e loja" },
    ],
  },
  {
    nome: "Site",
    itens: [
      { href: "/admin/home", label: "Home", Icone: LayoutTemplate, desc: "Seções da página inicial" },
      { href: "/admin/aparencia", label: "Aparência", Icone: Palette, desc: "Cores e cantos" },
      { href: "/admin/redirects", label: "Redirects", Icone: Milestone, desc: "Endereços que mudaram" },
    ],
  },
  {
    nome: "Equipe",
    itens: [
      { href: "/admin/usuarios", label: "Usuários", Icone: Users, desc: "Acesso e papéis" },
    ],
  },
];

export function Navegacao({ pendentes }: { pendentes: number }) {
  const caminho = usePathname();
  const ativo = (href: string) =>
    href === "/admin" ? caminho === "/admin" : caminho.startsWith(href);

  const base =
    "group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors";

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
        <LayoutDashboard size={15} className="shrink-0" />
        <span className="font-medium">Visão geral</span>
      </Link>

      {GRUPOS.map((g) => (
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
                    <Icone size={15} className="shrink-0" />
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
