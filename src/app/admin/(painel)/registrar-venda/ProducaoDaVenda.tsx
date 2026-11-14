"use client";

import { useMemo, useState } from "react";
import { Bike, Plus, Store, Trash2, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PECA_VAZIA, PRODUCAO_VAZIA, TETO_DE_PECAS, type ModoDeEntrega, type PecaDoFormulario, type ProducaoDoFormulario, type TipoDeGravacao } from "@/lib/vendas/producao";

/**
 * A parte do formulário de venda que vai para a fábrica: as peças, com
 * numeração e gravação, e a entrega.
 *
 * Existe para a venda por fora parar de ser passada para a produção por
 * mensagem num grupo. O que a pessoa preenche aqui chega na fila da fábrica no
 * mesmo cartão de um pedido da loja.
 *
 * O estado mora aqui e vai para o servidor num campo escondido, em JSON: as
 * peças são uma lista que cresce, e isso não cabe em campos soltos de
 * formulário. Quem confere tudo é `lerProducao`, no servidor.
 */

export type ProdutoDoFormulario = { codigo: string; nome: string; miniatura: string | null };

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";

const ENTREGAS: { chave: ModoDeEntrega; nome: string; Icone: LucideIcon }[] = [
  { chave: "retirada", nome: "Retirar em loja", Icone: Store },
  { chave: "correios", nome: "Correios", Icone: Truck },
  { chave: "moto", nome: "Moto", Icone: Bike },
];

const GRAVACOES: { chave: TipoDeGravacao; nome: string }[] = [
  { chave: "sem", nome: "Sem gravação" },
  { chave: "laser", nome: "Laser" },
  { chave: "manual", nome: "Manual" },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Peca({
  p, n, total, indice, onMudar, onTirar,
}: {
  p: PecaDoFormulario;
  n: number;
  total: number;
  indice: { p: ProdutoDoFormulario; texto: string }[];
  onMudar: (m: Partial<PecaDoFormulario>) => void;
  onTirar: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const palavras = semAcento(p.nome).split(/\s+/).filter(Boolean);
  // Sugestão só enquanto a pessoa digita e ainda não escolheu uma peça do catálogo.
  const sugestoes = aberta && !p.codigo && palavras.length > 0 ? indice.filter((x) => palavras.every((w) => x.texto.includes(w))).slice(0, 6) : [];
  const id = (campoId: string) => `peca-${n}-${campoId}`;

  return (
    <fieldset className="min-w-0 rounded-[12px] border border-ink/10 bg-white/60 p-3">
      <legend className="flex w-full items-center justify-between gap-2 px-1 text-xs font-semibold text-ink">
        <span>{total > 1 ? `Peça ${n + 1}` : "A peça"}</span>
        {total > 1 ? (
          <button type="button" onClick={onTirar} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-semibold text-muted hover:text-[#b01919]" aria-label={`Tirar a peça ${n + 1}`}>
            <Trash2 size={12} aria-hidden="true" /> Tirar
          </button>
        ) : null}
      </legend>

      <div className="relative">
        <label className={rotulo} htmlFor={id("nome")}>Produto</label>
        <input
          id={id("nome")}
          value={p.nome}
          onChange={(e) => {
            onMudar({ nome: e.target.value, codigo: null });
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          // O atraso deixa o toque na sugestão chegar antes de a lista fechar.
          onBlur={() => setTimeout(() => setAberta(false), 150)}
          maxLength={200}
          autoComplete="off"
          placeholder="Digite o nome e escolha, ou descreva a peça"
          className={campo}
          role="combobox"
          aria-expanded={sugestoes.length > 0}
          aria-controls={id("sugestoes")}
          aria-autocomplete="list"
        />
        {p.codigo ? <p className="mt-1 text-[0.7rem] text-[#046c4e]">Do catálogo, código {p.codigo}. A fábrica vai ver a foto.</p> : null}
        {sugestoes.length > 0 ? (
          <ul id={id("sugestoes")} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-[12px] border border-ink/12 bg-white p-1 shadow-[0_8px_24px_rgba(26,24,21,0.14)]">
            {sugestoes.map((x) => (
              <li key={x.p.codigo} role="option" aria-selected="false">
                <button
                  type="button"
                  // `onMouseDown` roda antes do `onBlur` do campo, então a escolha não se perde.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onMudar({ nome: x.p.nome, codigo: x.p.codigo });
                    setAberta(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[9px] p-2 text-left hover:bg-ink/[0.05]"
                >
                  {x.p.miniatura ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.p.miniatura} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-[7px] border border-ink/10 bg-white object-contain" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-[7px] bg-ink/[0.05]" aria-hidden="true" />
                  )}
                  <span className="min-w-0 text-xs font-medium leading-snug text-ink">{x.p.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* `min-w-0` em cada coluna e no `fieldset`: campo de formulário tem largura mínima própria, e quatro lado a lado empurravam a página para 677 px num celular de 375. */}
      <div className="mt-3 grid grid-cols-4 gap-2 [&>div]:min-w-0">
        <div>
          <label className={rotulo} htmlFor={id("qtd")}>Qtd.</label>
          <input id={id("qtd")} type="number" min={1} max={20} value={p.quantidade} onChange={(e) => onMudar({ quantidade: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className={`${campo} numeros`} />
        </div>
        <div>
          <label className={rotulo} htmlFor={id("aro1")}>Aro 01</label>
          <input id={id("aro1")} value={p.aro1} onChange={(e) => onMudar({ aro1: e.target.value })} maxLength={10} inputMode="decimal" placeholder="17" className={`${campo} numeros`} />
        </div>
        <div>
          <label className={rotulo} htmlFor={id("aro2")}>Aro 02</label>
          <input id={id("aro2")} value={p.aro2} onChange={(e) => onMudar({ aro2: e.target.value })} maxLength={10} inputMode="decimal" placeholder="22" className={`${campo} numeros`} />
        </div>
        <div>
          <label className={rotulo} htmlFor={id("anel")}>Anel</label>
          <input id={id("anel")} value={p.anel} onChange={(e) => onMudar({ anel: e.target.value })} maxLength={10} inputMode="decimal" placeholder="17" className={`${campo} numeros`} />
        </div>
      </div>

      <div className="mt-3">
        <p className={rotulo} id={id("gravacao")}>Gravação</p>
        <div role="radiogroup" aria-labelledby={id("gravacao")} className="mt-1 grid grid-cols-3 gap-1 rounded-[10px] bg-ink/[0.05] p-1">
          {GRAVACOES.map((g) => (
            <button
              key={g.chave}
              type="button"
              role="radio"
              aria-checked={p.gravacao === g.chave}
              onClick={() => onMudar({ gravacao: g.chave })}
              className={`min-h-10 rounded-[8px] px-2 text-xs font-semibold ${p.gravacao === g.chave ? "bg-white text-ink shadow-sm" : "text-ink/60"}`}
            >
              {g.nome}
            </button>
          ))}
        </div>
        {p.gravacao !== "sem" ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor={id("gravar1")}>Gravar no aro 01</label>
              <input id={id("gravar1")} value={p.gravar1} onChange={(e) => onMudar({ gravar1: e.target.value })} maxLength={120} placeholder="Como o cliente escreveu" className={campo} />
            </div>
            <div>
              <label className={rotulo} htmlFor={id("gravar2")}>Gravar no aro 02</label>
              <input id={id("gravar2")} value={p.gravar2} onChange={(e) => onMudar({ gravar2: e.target.value })} maxLength={120} placeholder="Como o cliente escreveu" className={campo} />
            </div>
            <p className="text-[0.7rem] leading-relaxed text-muted sm:col-span-2">O texto vai para a fábrica exatamente como está aqui, com maiúsculas, espaços e pontos. Confira letra por letra.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <label className={rotulo} htmlFor={id("detalhes")}>Detalhes da peça</label>
        <input id={id("detalhes")} value={p.detalhes} onChange={(e) => onMudar({ detalhes: e.target.value })} maxLength={300} placeholder="Anel Forever, caixinha de coração, banho de ouro" className={campo} />
      </div>
    </fieldset>
  );
}

export function ProducaoDaVenda({ produtos, lojas }: { produtos: ProdutoDoFormulario[]; lojas: string[] }) {
  const [ligada, setLigada] = useState(false);
  const [dados, setDados] = useState<ProducaoDoFormulario>(PRODUCAO_VAZIA);
  const indice = useMemo(() => produtos.map((p) => ({ p, texto: semAcento(`${p.nome} ${p.codigo}`) })), [produtos]);

  const mudarPeca = (i: number, m: Partial<PecaDoFormulario>) => setDados((d) => ({ ...d, pecas: d.pecas.map((p, k) => (k === i ? { ...p, ...m } : p)) }));

  return (
    <div className="min-w-0 sm:col-span-2">
      {/* Vazio quando a venda não vai para a fábrica: o servidor só lê as peças se o campo vier preenchido. */}
      <input type="hidden" name="producao" value={ligada ? JSON.stringify(dados) : ""} />

      <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-ink/12 bg-white/70 p-3">
        <input type="checkbox" checked={ligada} onChange={(e) => setLigada(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--setor)]" />
        <span>
          <span className="block text-sm font-semibold text-ink">Mandar para a fábrica</span>
          <span className="block text-xs leading-relaxed text-muted">
            Marque quando a peça precisa ser produzida, gravada ou despachada. Ela entra na fila da fábrica com a numeração e a gravação, sem
            passar pelo grupo.
          </span>
        </span>
      </label>

      {ligada ? (
        <div className="mt-3 space-y-3">
          {dados.pecas.map((p, i) => (
            <Peca
              key={i}
              p={p}
              n={i}
              total={dados.pecas.length}
              indice={indice}
              onMudar={(m) => mudarPeca(i, m)}
              onTirar={() => setDados((d) => ({ ...d, pecas: d.pecas.filter((_, k) => k !== i) }))}
            />
          ))}
          {dados.pecas.length < TETO_DE_PECAS ? (
            <button type="button" onClick={() => setDados((d) => ({ ...d, pecas: [...d.pecas, PECA_VAZIA] }))} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink">
              <Plus size={14} aria-hidden="true" /> Outra peça
            </button>
          ) : null}

          <fieldset className="min-w-0 rounded-[12px] border border-ink/10 bg-white/60 p-3">
            <legend className="px-1 text-xs font-semibold text-ink">Como chega ao cliente</legend>
            <div role="radiogroup" aria-label="Como chega ao cliente" className="grid grid-cols-3 gap-1 rounded-[10px] bg-ink/[0.05] p-1">
              {ENTREGAS.map((e) => (
                <button
                  key={e.chave}
                  type="button"
                  role="radio"
                  aria-checked={dados.entrega === e.chave}
                  onClick={() => setDados((d) => ({ ...d, entrega: e.chave }))}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] px-1.5 text-xs font-semibold ${dados.entrega === e.chave ? "bg-white text-ink shadow-sm" : "text-ink/60"}`}
                >
                  <e.Icone size={14} aria-hidden="true" /> {e.nome}
                </button>
              ))}
            </div>

            {dados.entrega === "retirada" ? (
              <div className="mt-3">
                <label className={rotulo} htmlFor="producao-loja">Loja de retirada</label>
                <select id="producao-loja" value={dados.loja} onChange={(e) => setDados((d) => ({ ...d, loja: e.target.value }))} className={campo}>
                  <option value="">Escolha a loja</option>
                  {lojas.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_5rem]">
                <div className="sm:col-span-2">
                  <label className={rotulo} htmlFor="producao-endereco">Endereço de entrega, com número e CEP</label>
                  <textarea id="producao-endereco" value={dados.endereco} onChange={(e) => setDados((d) => ({ ...d, endereco: e.target.value }))} maxLength={300} rows={2} className={campo} />
                </div>
                <div>
                  <label className={rotulo} htmlFor="producao-cidade">Cidade</label>
                  <input id="producao-cidade" value={dados.cidade} onChange={(e) => setDados((d) => ({ ...d, cidade: e.target.value }))} maxLength={80} className={campo} />
                </div>
                <div>
                  <label className={rotulo} htmlFor="producao-uf">Estado</label>
                  <input id="producao-uf" value={dados.uf} onChange={(e) => setDados((d) => ({ ...d, uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} placeholder="SP" className={`${campo} numeros uppercase`} />
                </div>
                <p className="text-[0.7rem] leading-relaxed text-muted sm:col-span-2">
                  O endereço fica só no painel, para a fábrica despachar. CPF não entra aqui.
                  {dados.entrega === "moto" ? " Na moto, a corrida é paga pelo cliente." : ""}
                </p>
              </div>
            )}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
