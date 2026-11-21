"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, Loader2, UserRound } from "lucide-react";
import { MOTIVOS, emPortugues, telefoneNaTela, telefoneParaLink, type VendedorDaLoja } from "@/lib/balcao/regras";
import { ORIGENS, TIPOS_DE_PRODUTO } from "@/lib/kommo/balcao-regra";
import { salvarLeadDoBalcao, type LeadParaSalvar } from "../actions";
import { novoId } from "../arquivos";

/**
 * O lead do balcão (cartão 72): o cliente olhou, não comprou, e deixou o
 * WhatsApp. Precisa caber em trinta segundos, com o cliente ainda na frente:
 * quem atendeu (lembrado do pedido), WhatsApp, nome, o que procurava e para
 * quê. O resto é opcional. Salvou, vai para a Kommo com a tag da loja, e a
 * tela limpa para o próximo.
 */

const campo = "w-full rounded-[12px] border border-border bg-white px-3 text-base text-ink min-h-12";
const rotulo = "block pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted";
const chip = (ativo: boolean) =>
  `painel-toque inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${ativo ? "border-transparent painel-aba-ativa" : "border-ink/12 bg-white text-ink"}`;

const chaveDoVendedor = (loja: string) => `jk:balcao:vendedor:${loja}`;

const vazio = (loja: string, vendedor: string): LeadParaSalvar => ({
  id: novoId(), loja, vendedor, cliente_nome: "", cliente_telefone: "", interesse: "", tipo_produto: "", motivo: "", data_especial: "", origem_cliente: "", observacao: "",
});

export function LeadDoBalcaoNaTela({ loja, vendedores, kommoLigada }: { loja: string; vendedores: VendedorDaLoja[]; kommoLigada: boolean }) {
  const ativos = vendedores.filter((v) => v.ativo && v.loja === loja);
  const [l, setL] = useState<LeadParaSalvar>(() => vazio(loja, ""));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<string[]>([]);

  useEffect(() => {
    try {
      const ultimo = localStorage.getItem(chaveDoVendedor(loja));
      const id = ultimo ? JSON.parse(ultimo) : null;
      if (id && ativos.some((v) => v.id === id)) setL((x) => (x.vendedor ? x : { ...x, vendedor: id }));
    } catch {
      // Sem armazenamento no aparelho: escolhe a cada vez.
    }
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudar = (m: Partial<LeadParaSalvar>) => setL((x) => ({ ...x, ...m }));
  const motivo = MOTIVOS.find((m) => m.chave === l.motivo);
  const falta = [
    !l.vendedor ? "quem atendeu" : null,
    !telefoneParaLink(l.cliente_telefone) ? "o WhatsApp do cliente" : null,
    l.cliente_nome.trim().length < 2 ? "o nome" : null,
  ].filter((x): x is string => Boolean(x));

  const salvar = async () => {
    if (falta.length) {
      setErro(`Falta ${emPortugues(falta)}.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarLeadDoBalcao(l);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      try {
        localStorage.setItem(chaveDoVendedor(loja), JSON.stringify(l.vendedor));
      } catch {
        // Sem armazenamento: tudo bem.
      }
      setSalvos((s) => [l.cliente_nome.trim(), ...s].slice(0, 5));
      setL(vazio(loja, l.vendedor));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErro("Sem internet agora. O lead continua na tela: tente salvar de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl pb-6">
      <Link href="/admin/balcao" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> Balcão
      </Link>
      <header className="mt-1">
        <p className="eyebrow">{loja}</p>
        <h1 className="text-xl font-semibold text-ink">Lead do balcão</h1>
        <p className="mt-1 text-sm text-muted">O cliente olhou e não fechou? Anote o WhatsApp para a loja chamar depois.</p>
      </header>

      {salvos.length ? (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-[12px] bg-[#e3f4ec] px-3 py-2 text-sm font-semibold text-[#046c4e]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Lead de {salvos[0]} salvo{kommoLigada ? " e indo para a Kommo" : ""}.{salvos.length > 1 ? ` Hoje nesta tela: ${salvos.length}.` : ""}
          </span>
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        <section className="glass rounded-[18px] p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Quem atendeu</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quem atendeu">
            {ativos.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={l.vendedor === v.id} onClick={() => mudar({ vendedor: v.id })} className={chip(l.vendedor === v.id)}>
                <UserRound size={15} aria-hidden="true" /> {v.nome}
              </button>
            ))}
          </div>
          {!ativos.length ? (
            <p className="text-sm text-muted">
              Nenhum vendedor na lista da loja. Ponha em <Link href="/admin/balcao" className="font-semibold underline">Vendedores da loja</Link>, no fim do Balcão.
            </p>
          ) : null}
        </section>

        <section className="glass rounded-[18px] p-4">
          <label className={rotulo} htmlFor="lead-tel">WhatsApp</label>
          <input
            id="lead-tel"
            value={l.cliente_telefone}
            onChange={(e) => mudar({ cliente_telefone: e.target.value.replace(/[^\d()\s+-]/g, "").slice(0, 20) })}
            onBlur={() => {
              const t = telefoneParaLink(l.cliente_telefone);
              if (t) mudar({ cliente_telefone: telefoneNaTela(t) });
            }}
            inputMode="tel"
            autoComplete="off"
            placeholder="(11) 99999-9999"
            className={`${campo} numeros`}
          />
          <label className={`${rotulo} mt-3`} htmlFor="lead-nome">Nome</label>
          <input id="lead-nome" value={l.cliente_nome} onChange={(e) => mudar({ cliente_nome: e.target.value.slice(0, 120) })} autoComplete="off" autoCapitalize="words" placeholder="Nome do cliente" className={campo} />

          <span className={`${rotulo} mt-3`}>O que procurava</span>
          <div className="flex flex-wrap gap-2">
            {TIPOS_DE_PRODUTO.map((t) => (
              <button key={t.chave} type="button" onClick={() => mudar({ tipo_produto: l.tipo_produto === t.chave ? "" : t.chave })} className={chip(l.tipo_produto === t.chave)} aria-pressed={l.tipo_produto === t.chave}>
                {t.nome}
              </button>
            ))}
          </div>
          <input value={l.interesse} onChange={(e) => mudar({ interesse: e.target.value.slice(0, 300) })} placeholder="Ex.: par de ouro 5 mm, achou caro, volta no sábado" aria-label="O que procurava, em palavras" className={`${campo} mt-2`} />

          <span className={`${rotulo} mt-3`}>Para quê</span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button key={m.chave} type="button" onClick={() => mudar({ motivo: l.motivo === m.chave ? "" : m.chave })} className={chip(l.motivo === m.chave)} aria-pressed={l.motivo === m.chave}>
                {m.nome}
              </button>
            ))}
          </div>
          {motivo?.data ? (
            <>
              <label className={`${rotulo} mt-3`} htmlFor="lead-data">{motivo.data}</label>
              <input id="lead-data" type="date" value={l.data_especial} onChange={(e) => mudar({ data_especial: e.target.value })} className={`${campo} numeros`} />
            </>
          ) : null}

          <span className={`${rotulo} mt-3`}>Como conheceu a JK</span>
          <div className="flex flex-wrap gap-2">
            {ORIGENS.map((o) => (
              <button key={o.chave} type="button" onClick={() => mudar({ origem_cliente: l.origem_cliente === o.chave ? "" : o.chave })} className={chip(l.origem_cliente === o.chave)} aria-pressed={l.origem_cliente === o.chave}>
                {o.nome}
              </button>
            ))}
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted">Observação</summary>
            <textarea value={l.observacao} onChange={(e) => mudar({ observacao: e.target.value.slice(0, 1000) })} rows={2} aria-label="Observação" className={`${campo} mt-2 py-2.5`} />
          </details>
        </section>
      </div>

      <div className="sticky bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-4">
        <div className="glass rounded-[18px] px-3 py-2.5 shadow-lg">
          {erro ? <p role="alert" className="mb-2 text-sm font-semibold text-[#b01919]">{erro}</p> : null}
          <button type="button" disabled={salvando} onClick={() => void salvar()} className="painel-toque painel-aba-ativa inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-base font-semibold disabled:opacity-60">
            {salvando ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />} Salvar lead
          </button>
        </div>
      </div>
    </div>
  );
}
