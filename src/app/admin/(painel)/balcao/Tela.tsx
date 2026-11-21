"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Loader2, MessageCircle, Plus, Search, UserPlus, UserRound, Users } from "lucide-react";
import { SeloDeTom } from "../Pecas";
import {
  agrupar, atrasado, dataCurta, dinheiro, dinheiroRedondo, kommoEmPalavras, linkDoWhatsapp, numeroDoPedido, pagamento, pecaEmTexto, situacao,
  type LeadDoBalcao, type PedidoDoBalcao, type VendedorDaLoja,
} from "@/lib/balcao/regras";
import { salvarVendedor } from "./actions";
import { TIPOS_DE_PRODUTO } from "@/lib/kommo/balcao-regra";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A lista do balcão, no celular primeiro: cada pedido é um cartão que abre com um toque. */
export function TelaDoBalcao({
  lista, vendedores, leads = [], loja, minhaLoja, lojas, busca, semLoja, hoje,
}: {
  lista: PedidoDoBalcao[] | null;
  vendedores: VendedorDaLoja[];
  leads?: LeadDoBalcao[];
  loja: string | null;
  minhaLoja: string | null;
  lojas: string[];
  busca: string;
  semLoja: boolean;
  hoje: string;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState(busca);
  const [buscando, setBuscando] = useState(false);
  const pedidos = useMemo(() => {
    const todos = lista ?? [];
    const w = semAcento(filtro).split(/\s+/).filter(Boolean);
    if (!w.length || busca) return todos;
    return todos.filter((p) => {
      const t = semAcento(`${p.numero} pl-${p.numero} ${p.cliente_nome} ${p.cliente_telefone} ${p.vendedor_nome} ${p.numero_papel ?? ""} ${p.pecas.map((x) => x.nome).join(" ")}`);
      return w.every((x) => t.includes(x));
    });
  }, [lista, filtro, busca]);
  const grupos = agrupar(pedidos);

  const abertos = (lista ?? []).filter((p) => !p.cancelado_em && !p.entregue_em);
  const paraEntregar = abertos.filter((p) => situacao(p).chave === "na_loja").length;
  const aReceber = abertos.reduce((s, p) => s + Math.max(0, pagamento(p).falta), 0);
  const atrasados = abertos.filter((p) => atrasado(p, hoje)).length;
  const sufixo = loja && !minhaLoja ? `?loja=${encodeURIComponent(loja)}` : "";

  if (semLoja) {
    return (
      <div className="glass mx-auto max-w-xl rounded-[18px] p-5">
        <h1 className="text-lg font-semibold text-ink">Falta escolher a loja desta conta</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Esta é uma conta de loja física, mas ainda não tem loja ligada. Peça à diretoria para escolher a loja em Usuários. Até lá, o balcão fica fechado,
          para ninguém ver pedido de outra loja.
        </p>
      </div>
    );
  }

  const buscarNoBanco = (e: React.FormEvent) => {
    e.preventDefault();
    const q = filtro.trim();
    const p = new URLSearchParams();
    if (loja && !minhaLoja) p.set("loja", loja);
    if (q) p.set("busca", q);
    setBuscando(true);
    router.push(`/admin/balcao${p.size ? `?${p}` : ""}`);
    setTimeout(() => setBuscando(false), 1200);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Balcão da loja</p>
          {minhaLoja ? (
            <h1 className="text-xl font-semibold text-ink">{minhaLoja}</h1>
          ) : (
            <select
              value={loja ?? ""}
              onChange={(e) => router.push(e.target.value ? `/admin/balcao?loja=${encodeURIComponent(e.target.value)}` : "/admin/balcao")}
              className="mt-1 min-h-11 rounded-[12px] border border-border bg-white px-3 text-base font-semibold text-ink"
              aria-label="Loja"
            >
              <option value="">Todas as lojas</option>
              {lojas.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          {loja ? (
            <Link href={`/admin/balcao/lead${sufixo}`} className="painel-toque inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-base font-semibold text-ink">
              <UserPlus size={18} aria-hidden="true" /> Lead
            </Link>
          ) : null}
          <Link href={`/admin/balcao/novo${sufixo}`} className="painel-toque painel-aba-ativa inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-semibold">
            <Plus size={18} aria-hidden="true" /> Pedido
          </Link>
        </div>
      </header>

      {lista === null ? (
        <p role="alert" className="mt-4 rounded-[12px] bg-[#fde8e8] p-3 text-sm font-semibold text-[#b01919]">Não deu para ler os pedidos agora. Recarregue a página.</p>
      ) : null}

      {abertos.length ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Resumo numero={String(paraEntregar)} texto="para entregar" destaque={paraEntregar > 0} />
          <Resumo numero={dinheiroRedondo(aReceber)} texto="a receber" destaque={aReceber > 0} />
          <Resumo numero={String(atrasados)} texto="atrasados" destaque={atrasados > 0} ruim />
        </div>
      ) : null}

      <form onSubmit={buscarNoBanco} className="relative mt-4" role="search">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Número, cliente, telefone ou peça"
          aria-label="Buscar pedido"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-[14px] border border-border bg-white pl-10 pr-24 text-base text-ink"
        />
        <button type="submit" className="absolute right-1.5 top-1/2 inline-flex min-h-9 -translate-y-1/2 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted hover:text-ink">
          {buscando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} {busca ? "Buscar" : "Em tudo"}
        </button>
      </form>
      {busca ? (
        <p className="mt-2 text-xs text-muted">
          Resultado da busca por &ldquo;{busca}&rdquo; em todos os pedidos.{" "}
          <Link href={`/admin/balcao${sufixo}`} className="font-semibold underline">Voltar para a lista</Link>
        </p>
      ) : null}

      <div className="mt-4 space-y-5">
        {grupos.map((g) => (
          <section key={g.chave}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              {g.nome} <span className="numeros rounded-full bg-ink/[0.06] px-2 text-xs text-muted">{g.pedidos.length}</span>
            </h2>
            <ul className="space-y-2">
              {g.pedidos.map((p) => (
                <li key={p.id}>
                  <CartaoDoPedido p={p} hoje={hoje} mostrarLoja={!loja} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {lista && !grupos.length ? (
          <div className="glass rounded-[18px] p-5 text-center">
            <p className="text-sm font-semibold text-ink">{filtro ? "Nenhum pedido com isso." : "Nenhum pedido ainda."}</p>
            <p className="mt-1 text-xs text-muted">{filtro && !busca ? "Toque em \"Em tudo\" para procurar nos pedidos antigos também." : "O primeiro pedido da loja começa no botão Novo pedido."}</p>
          </div>
        ) : null}
      </div>

      {leads.length ? <Leads leads={leads} hoje={hoje} /> : null}

      {loja ? <Vendedores vendedores={vendedores} loja={loja} /> : null}
    </div>
  );
}

function Resumo({ numero, texto, destaque, ruim = false }: { numero: string; texto: string; destaque: boolean; ruim?: boolean }) {
  return (
    <div className="glass min-w-0 rounded-[14px] p-3 text-center">
      <p className={`numeros truncate text-base font-bold ${destaque ? (ruim ? "text-[#b01919]" : "text-[#9a4a07]") : "text-ink"}`}>{numero}</p>
      <p className="text-[0.7rem] font-semibold text-muted">{texto}</p>
    </div>
  );
}

function CartaoDoPedido({ p, hoje, mostrarLoja }: { p: PedidoDoBalcao; hoje: string; mostrarLoja: boolean }) {
  const s = situacao(p);
  const g = pagamento(p);
  const tarde = atrasado(p, hoje);
  return (
    <Link href={`/admin/balcao/${p.id}`} className="glass painel-toque flex min-w-0 items-center gap-3 rounded-[16px] p-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="numeros text-xs font-bold text-muted">{numeroDoPedido(p.numero)}</span>
          <span className="min-w-0 truncate text-base font-semibold text-ink">{p.cliente_nome}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">{p.pecas.map((x) => pecaEmTexto({ ...x, info: null })).join(", ")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SeloDeTom tom={s.tom}>{s.nome}</SeloDeTom>
          {!p.cancelado_em ? <SeloDeTom tom={g.chave === "pago" ? "bom" : g.chave === "nada" ? "ruim" : "atencao"}>{g.chave === "sinal" ? `Falta ${dinheiro(g.falta)}` : g.nome}</SeloDeTom> : null}
          {tarde ? (
            <SeloDeTom tom="ruim">
              <AlertTriangle size={11} aria-hidden="true" /> Prazo era {dataCurta(p.prazo, hoje)}
            </SeloDeTom>
          ) : p.prazo && !p.entregue_em && !p.cancelado_em ? (
            <SeloDeTom tom="neutro">Até {dataCurta(p.prazo, hoje)}</SeloDeTom>
          ) : null}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
          <UserRound size={12} aria-hidden="true" /> {p.vendedor_nome}
          {mostrarLoja ? ` · ${p.loja}` : ""}
          {p.os ? ` · OS ${p.os}` : ""}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
    </Link>
  );
}

function Vendedores({ vendedores, loja }: { vendedores: VendedorDaLoja[]; loja: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const agir = async (id: string | null, n: string, ativo: boolean) => {
    setOcupado(id ?? "novo");
    setErro(null);
    try {
      const r = await salvarVendedor(id, loja, n, ativo);
      if (!r.ok) setErro(r.erro);
      else {
        if (!id) setNome("");
        router.refresh();
      }
    } catch {
      setErro("Sem internet agora. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  };
  const ativos = vendedores.filter((v) => v.ativo);
  return (
    <details className="glass mt-6 rounded-[18px] p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
        <Users size={16} aria-hidden="true" /> Vendedores da loja <span className="numeros text-xs text-muted">({ativos.length})</span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted">Quem atende no balcão. Quem saiu da loja fica marcado como fora: os pedidos dele continuam com o nome.</p>
      <ul className="mt-3 space-y-1.5">
        {vendedores.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm">
            <span className={v.ativo ? "text-ink" : "text-muted line-through"}>{v.nome}</span>
            <button type="button" onClick={() => void agir(v.id, v.nome, !v.ativo)} disabled={Boolean(ocupado)} className="min-h-9 rounded-full px-3 text-xs font-semibold text-muted hover:text-ink disabled:opacity-60">
              {ocupado === v.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : v.ativo ? "Saiu da loja" : "Voltou"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim().length >= 2) void agir(null, nome, true);
        }}
      >
        <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Nome de quem entrou" aria-label="Nome do vendedor novo" className="min-h-11 w-full rounded-[12px] border border-border bg-white px-3 text-base text-ink" />
        <button type="submit" disabled={Boolean(ocupado) || nome.trim().length < 2} className="painel-toque painel-aba-ativa inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold disabled:opacity-60">
          {ocupado === "novo" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Pôr"}
        </button>
      </form>
      {erro ? <p role="alert" className="mt-2 text-sm font-semibold text-[#b01919]">{erro}</p> : null}
    </details>
  );
}

function Leads({ leads, hoje }: { leads: LeadDoBalcao[]; hoje: string }) {
  return (
    <details className="glass mt-6 rounded-[18px] p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
        <UserPlus size={16} aria-hidden="true" /> Leads dos últimos 30 dias <span className="numeros text-xs text-muted">({leads.length})</span>
      </summary>
      <ul className="mt-3 space-y-2">
        {leads.map((l) => {
          const k = kommoEmPalavras(l.kommo);
          const tipo = TIPOS_DE_PRODUTO.find((t) => t.chave === l.tipo_produto)?.nome;
          const zap = linkDoWhatsapp(l.cliente_telefone, `Olá, ${l.cliente_nome.split(" ")[0]}! Aqui é da JK Alianças, ${l.loja}.`);
          return (
            <li key={l.id} className="rounded-[12px] border border-ink/10 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{l.cliente_nome}</p>
                  <p className="text-xs text-muted [overflow-wrap:anywhere]">{[tipo, l.interesse].filter(Boolean).join(", ") || "Sem o que procurava"}</p>
                  <p className="mt-1 text-xs text-muted">{dataCurta(l.criado_em.slice(0, 10), hoje)} · {l.vendedor_nome}</p>
                </div>
                {zap ? (
                  <a href={zap} target="_blank" rel="noopener noreferrer" className="painel-toque inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-ink/12 bg-white px-3 text-xs font-semibold text-ink" aria-label={`Chamar ${l.cliente_nome} no WhatsApp`}>
                    <MessageCircle size={14} aria-hidden="true" /> Chamar
                  </a>
                ) : null}
              </div>
              {k ? <div className="mt-2"><SeloDeTom tom={k.tom}>{k.texto}</SeloDeTom></div> : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
