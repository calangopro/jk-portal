"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Sparkles } from "lucide-react";
import type { Padroes } from "@/lib/catalogo/fotos";
import { salvarPadraoDeFoto } from "./actions";

/**
 * O pedido que a equipe cola no claude.ai, e o padrão escrito que o Claude lê
 * antes de gerar. O padrão mora no banco (`foto_padroes`) para ser ajustado
 * aqui, sem deploy, depois de testar nas primeiras peças.
 */
const PEDIDO = `Use o conector da JK Alianças e o Magnific.
1. Pegue os próximos 5 produtos da fila de fotos (catalogo.fila_de_fotos) e leia o padrão que vem junto.
2. Para cada um, gere a foto principal a partir da foto atual da loja, trocando fundo e luz, sem mudar a peça.
3. Me mostre cada foto ao lado da original antes de enviar.
4. Envie as que eu aprovar com catalogo.enviar_foto, dizendo como foi feita.`;

export function ComoGerar({
  padroes,
  categorias,
}: {
  padroes: Padroes;
  categorias: { nome: string; id: string | null }[];
}) {
  const [copiado, setCopiado] = useState(false);
  const [categoria, setCategoria] = useState<string>("");
  const [textos, setTextos] = useState<Record<string, string>>(() => ({
    "": padroes.geral,
    ...Object.fromEntries(Object.entries(padroes.porCategoria).map(([k, v]) => [k, v.instrucoes])),
  }));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, comecar] = useTransition();

  const texto = textos[categoria] ?? "";
  const herdaDoGeral = categoria !== "" && !(categoria in padroes.porCategoria) && textos[categoria] === undefined;

  const copiar = async () => {
    await navigator.clipboard.writeText(PEDIDO);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <details className="glass mt-5 rounded-[20px] p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles size={15} className="text-brand-nav" /> Gerar as fotos pelo Claude e o padrão de foto
      </summary>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-muted">
            <li>
              No claude.ai, ligue o conector da JK (o endereço e a chave estão em{" "}
              <Link href="/admin/conector" className="font-semibold text-brand-nav hover:underline">
                Conector do Claude
              </Link>
              ) e o do Magnific.
            </li>
            <li>Cole o pedido abaixo. Dá para trocar o número ou pedir uma categoria.</li>
            <li>Cada foto enviada aparece aqui como “Para aprovar”. Quem aprova é uma pessoa, aqui no painel.</li>
            <li>Duas pessoas podem gerar ao mesmo tempo: o produto pego fica reservado por 30 minutos.</li>
          </ol>
          <div className="relative mt-4">
            <pre className="whitespace-pre-wrap rounded-[12px] border border-border bg-white/80 p-4 pr-12 text-xs leading-relaxed text-ink">
              {PEDIDO}
            </pre>
            <button
              type="button"
              onClick={copiar}
              className="absolute right-2 top-2 rounded-full p-2 text-brand-nav hover:bg-brand/10"
              aria-label="Copiar o pedido"
            >
              {copiado ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="padrao-categoria" className="text-sm font-semibold text-ink">
              Padrão de foto
            </label>
            <select
              id="padrao-categoria"
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setAviso(null);
              }}
              className="h-9 rounded-full border border-border bg-white/80 px-3 text-xs text-ink"
            >
              <option value="">Geral (vale para todas)</option>
              {categorias
                .filter((c) => c.id)
                .map((c) => (
                  <option key={c.id} value={c.id!}>
                    {c.nome}
                    {c.id! in padroes.porCategoria ? " (próprio)" : ""}
                  </option>
                ))}
            </select>
          </div>
          {herdaDoGeral ? (
            <p className="mt-2 text-xs text-muted">
              Esta categoria usa o padrão geral. Escreva aqui só se ela precisar de outro (por exemplo, semijoia em
              fundo diferente).
            </p>
          ) : null}
          <textarea
            value={herdaDoGeral ? "" : texto}
            placeholder={herdaDoGeral ? padroes.geral : ""}
            onChange={(e) => setTextos((t) => ({ ...t, [categoria]: e.target.value }))}
            rows={12}
            maxLength={4000}
            className="mt-2 w-full rounded-[12px] border border-border bg-white/80 p-3 text-xs leading-relaxed text-ink outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              disabled={salvando || (textos[categoria] ?? "").trim().length < 10}
              onClick={() =>
                comecar(async () => {
                  const r = await salvarPadraoDeFoto({ categoryId: categoria || null, instrucoes: textos[categoria] ?? "" });
                  setAviso(r.ok ? { ok: true, texto: "Padrão salvo. O Claude lê a versão nova no próximo pedido." } : { ok: false, texto: r.erro });
                })
              }
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar padrão"}
            </button>
            {aviso ? <p className={`text-xs ${aviso.ok ? "text-brand-strong" : "text-wine"}`}>{aviso.texto}</p> : null}
          </div>
        </div>
      </div>
    </details>
  );
}
