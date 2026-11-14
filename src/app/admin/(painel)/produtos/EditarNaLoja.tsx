"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Store, TriangleAlert } from "lucide-react";
import type { Previa, Resultado } from "@/lib/loja/alterar";
import type { Edicao, EstadoNaLoja } from "@/lib/loja/produto";

/**
 * Editar o produto na loja, de dentro da gaveta.
 *
 * SÃO TRÊS PASSOS, e o do meio não se pula:
 *   1. abrir: o painel lê o produto na Tray na hora (o que a lista mostra pode
 *      estar atrasado), e é sobre esse estado que a pessoa edita;
 *   2. conferir: o servidor devolve o "antes e depois" de cada campo, com os
 *      avisos (preço que muda demais, produto que sai da vitrine);
 *   3. gravar: só então a alteração vai para a loja. Editar e gravar no mesmo
 *      clique é como erro de digitação vira preço errado no ar.
 *
 * Com `abrirSozinho` (a aba Dados da gaveta), o primeiro passo acontece sem
 * clique: a pessoa abriu o produto para ver os dados, então o painel já lê.
 * Espera um instante antes, para quem está passando de produto em produto com
 * J e K não disparar uma leitura na Tray a cada tecla.
 *
 * As três ações vêm de fora, como propriedade, para a tela poder ser vista e
 * testada sem sessão.
 */

type Acoes = {
  ler: (trayId: string) => Promise<{ estado: "nao_autorizada" | "nao_achado" } | { estado: "ok"; atual: EstadoNaLoja }>;
  prever: (trayId: string, edicao: Edicao) => Promise<Previa>;
  gravar: (trayId: string, edicao: Edicao) => Promise<Resultado>;
};

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand disabled:bg-surface/60 disabled:text-muted";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";
const emTexto = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }));
const emNumero = (t: string) => {
  const n = Number(t.trim().replace(/\./g, "").replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? null : n;
};

type Form = { nome: string; preco: string; promocional: string; de: string; ate: string; estoque: string; disponivel: boolean };
const paraForm = (e: EstadoNaLoja): Form => ({
  nome: e.nome, preco: emTexto(e.preco), promocional: emTexto(e.promocional), de: e.promocaoDe ?? "", ate: e.promocaoAte ?? "", estoque: String(e.estoque), disponivel: e.disponivel,
});

export function EditarNaLoja({ trayId, podePreco, acoes, abrirSozinho = false }: { trayId: string; podePreco: boolean; acoes: Acoes; abrirSozinho?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [previa, setPrevia] = useState<Extract<Previa, { estado: "previa" }> | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  // A loja ainda não foi autorizada: não é erro de quem está usando, então
  // ganha uma explicação própria em vez de uma linha vermelha.
  const [desligada, setDesligada] = useState(false);
  const [ocupado, comecar] = useTransition();

  const abrir = () =>
    comecar(async () => {
      setAviso(null);
      const r = await acoes.ler(trayId);
      if (r.estado === "ok") {
        setDesligada(false);
        setForm(paraForm(r.atual));
      } else if (r.estado === "nao_autorizada") setDesligada(true);
      else setAviso({ ok: false, texto: "A Tray não achou este produto. Ele pode ter sido apagado na loja." });
    });

  const jaAbriu = useRef(false);
  useEffect(() => {
    if (!abrirSozinho || jaAbriu.current) return;
    const espera = setTimeout(() => {
      jaAbriu.current = true;
      abrir();
    }, 400);
    return () => clearTimeout(espera);
    // Só na chegada: `abrir` muda a cada desenho e não deve disparar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirSozinho, trayId]);

  /** Manda tudo: o servidor compara com a loja e só leva o que mudou. Sem acesso a preço, os campos de preço nem vão. */
  const edicao = (f: Form): Edicao => ({
    nome: f.nome,
    estoque: emNumero(f.estoque) ?? Number.NaN,
    disponivel: f.disponivel,
    ...(podePreco
      ? { preco: emNumero(f.preco) ?? Number.NaN, promocional: emNumero(f.promocional), promocaoDe: f.de || null, promocaoAte: f.ate || null }
      : {}),
  });

  const conferir = () =>
    form &&
    comecar(async () => {
      setAviso(null);
      const r = await acoes.prever(trayId, edicao(form));
      if (r.estado === "previa") {
        if (r.mudancas.length === 0) setAviso({ ok: true, texto: "Nada mudou em relação ao que está na loja." });
        else setPrevia(r);
      } else if (r.estado === "invalida") setAviso({ ok: false, texto: r.erro });
      else setAviso({ ok: false, texto: r.estado === "nao_autorizada" ? "A loja não está ligada ao painel para alterações." : "A Tray não achou este produto." });
    });

  const gravar = () =>
    form &&
    comecar(async () => {
      const r = await acoes.gravar(trayId, edicao(form));
      setPrevia(null);
      if (r.estado === "ok") {
        setForm(paraForm(r.depois));
        setAviso({ ok: true, texto: `Gravado na loja: ${r.mudancas.map((m) => m.rotulo.toLowerCase()).join(", ")}.` });
        router.refresh();
      } else if (r.estado === "sem_mudanca") setAviso({ ok: true, texto: "Nada mudou em relação ao que está na loja." });
      else if (r.estado === "invalida" || r.estado === "recusada" || r.estado === "erro") setAviso({ ok: false, texto: r.erro });
      else setAviso({ ok: false, texto: "A loja não está ligada ao painel para alterações." });
    });

  const mexer = (parte: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...parte } : f));
    setPrevia(null);
    setAviso(null);
  };

  return (
    <section className="mt-5" aria-label="Editar na loja">
      <p className="eyebrow flex items-center gap-1.5"><Store size={14} aria-hidden /> Editar na loja</p>

      {desligada ? (
        <div className="mt-3 rounded-[12px] bg-[#fcefd9] p-3.5 text-[#6d3505]">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden /> Ainda não dá para editar por aqui
          </p>
          <p className="mt-1.5 text-xs leading-relaxed">
            Falta a Tray liberar o aplicativo do painel e a loja ser autorizada em Integrações, no cartão da Tray. Até lá,
            nome, preço e estoque continuam sendo mudados no painel da própria Tray. Quando a loja for ligada, este
            espaço vira o formulário de edição, sem mais nada a fazer.
          </p>
          <button type="button" onClick={abrir} disabled={ocupado} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#9a4a07]/30 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#6d3505] disabled:opacity-60">
            {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            {ocupado ? "Conferindo…" : "Conferir de novo"}
          </button>
        </div>
      ) : form === null ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Muda o produto direto na Tray. O painel lê o produto na loja antes, mostra o antes e depois, e só grava quando
            você confirmar.
          </p>
          {abrirSozinho && !aviso ? (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted">
              <Loader2 size={13} className="animate-spin" aria-hidden /> Lendo o produto na loja…
            </p>
          ) : (
            <button type="button" onClick={abrir} disabled={ocupado} className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
              {ocupado ? "Lendo na loja…" : "Abrir para editar"}
            </button>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className={rotulo}>Nome</span>
            <input className={`${campo} mt-1`} value={form.nome} onChange={(e) => mexer({ nome: e.target.value })} maxLength={200} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={rotulo}>Preço</span>
              <input className={`${campo} numeros mt-1`} inputMode="decimal" value={form.preco} disabled={!podePreco} onChange={(e) => mexer({ preco: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>Estoque</span>
              <input className={`${campo} numeros mt-1`} inputMode="numeric" value={form.estoque} onChange={(e) => mexer({ estoque: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className={rotulo}>Preço promocional</span>
            <input className={`${campo} numeros mt-1`} inputMode="decimal" placeholder="vazio = sem promoção" value={form.promocional} disabled={!podePreco} onChange={(e) => mexer({ promocional: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className={rotulo}>Promoção de</span>
              <input type="date" className={`${campo} mt-1`} value={form.de} disabled={!podePreco} onChange={(e) => mexer({ de: e.target.value })} />
            </label>
            <label className="block min-w-0">
              <span className={rotulo}>Até</span>
              <input type="date" className={`${campo} mt-1`} value={form.ate} disabled={!podePreco} onChange={(e) => mexer({ ate: e.target.value })} />
            </label>
          </div>
          {!podePreco ? <p className="text-[0.7rem] text-muted">Preço e promoção só mudam com administrador, dono ou GM.</p> : null}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={form.disponivel} onChange={(e) => mexer({ disponivel: e.target.checked })} />
            Disponível para venda
          </label>

          {previa ? (
            <div className="rounded-[12px] border border-border bg-white/70 p-3" role="group" aria-label="Conferir antes de gravar">
              <p className="text-xs font-semibold text-ink">Confira antes de gravar na loja</p>
              <ul className="mt-2 space-y-1.5">
                {previa.mudancas.map((m) => (
                  <li key={m.campo} className="text-xs leading-relaxed text-ink">
                    <span className="font-semibold">{m.rotulo}:</span>{" "}
                    <span className="break-words text-muted line-through">{m.antes}</span>{" "}
                    <ArrowRight size={11} className="inline" aria-label="passa a ser" />{" "}
                    <span className="break-words font-semibold">{m.depois}</span>
                  </li>
                ))}
              </ul>
              {previa.avisos.map((a) => (
                <p key={a} className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-relaxed" style={{ color: "#b45309" }}>
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> <span>Atenção: {a}</span>
                </p>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={gravar} disabled={ocupado} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                  {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Check size={13} aria-hidden />}
                  {ocupado ? "Gravando na loja…" : "Gravar na loja"}
                </button>
                <button type="button" onClick={() => setPrevia(null)} disabled={ocupado} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink hover:border-brand/50 disabled:opacity-60">
                  Voltar a editar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={conferir} disabled={ocupado} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
              {ocupado ? "Conferindo com a loja…" : "Conferir mudanças"}
            </button>
          )}
        </div>
      )}

      {aviso ? (
        <p className={`mt-3 text-xs leading-relaxed ${aviso.ok ? "text-emerald-800" : "text-wine"}`} role="status">
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}
