"use client";

import { useEffect, useState } from "react";
import { NOME_DA_CHEGADA, type CanalDeChegada } from "@/lib/origem/chegada";
import { comoLigou, ehAnuncio, lerChegadaCasada, nivelLigado, pelaBio, utmLegivel, type PedidoComOrigem } from "@/lib/origem/pedidos";
import type { Tom } from "@/lib/painel/tons";
import { createClient } from "@/lib/supabase/client";
import { SeloDeTom } from "../Pecas";

/**
 * De qual anúncio o pedido veio, dentro da gaveta: a campanha, o conjunto e o
 * anúncio a que a UTM foi ligada, as UTMs como chegaram e todas as chegadas do
 * visitante nos trinta dias antes do pedido.
 *
 * Lê `origem_do_pedido` (0112) à parte do histórico, para a gaveta abrir sem
 * esperar por isto. A função só responde a quem já vê pedido em alguma tela,
 * e não devolve valor nem dado de cliente.
 */

type Casada = Omit<PedidoComOrigem, "pedido" | "feitoEm" | "dia" | "situacao" | "status" | "total">;
type Chegada = { em: string; canal: string | null; source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null; clique: string | null; entrada: string | null; aparelho: string | null };
/** Negócio de carrinho abandonado na Kommo com a mesma sessão da loja (0182). */
type Carrinho = { id: number; criadoEm: string };
type Lido = { origem: Casada; chegadas: Chegada[]; carrinhos: Carrinho[] };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const nomeDoCanal = (c: string | null) => (c ? (NOME_DA_CHEGADA[c as CanalDeChegada] ?? c) : "Sem canal");
const PLATAFORMA = { meta: "Meta", google: "Google Ads" } as const;
const CLIQUE: Record<string, string> = { fbclid: "clique vindo do Meta", gclid: "clique de anúncio do Google", gbraid: "clique de anúncio do Google", wbraid: "clique de anúncio do Google", ttclid: "clique vindo do TikTok" };
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

async function ler(numero: number): Promise<Lido | null | "erro"> {
  try {
    const { data, error } = await createClient().rpc("origem_do_pedido", { p_numero: numero });
    if (error) return "erro";
    const d = data as { origem?: Record<string, unknown>; chegadas?: Record<string, unknown>[]; carrinhos?: Record<string, unknown>[] } | null;
    if (!d?.origem) return null;
    return {
      origem: lerChegadaCasada(d.origem),
      chegadas: (Array.isArray(d.chegadas) ? d.chegadas : [])
        .map((c) => ({
          em: texto(c.em) ?? "", canal: texto(c.canal), source: texto(c.source), medium: texto(c.medium), campaign: texto(c.campaign),
          content: texto(c.content), term: texto(c.term), clique: texto(c.clique), entrada: texto(c.entrada), aparelho: texto(c.aparelho),
        }))
        .filter((c) => c.em),
      carrinhos: (Array.isArray(d.carrinhos) ? d.carrinhos : [])
        .map((c) => ({ id: Number(c.id) || 0, criadoEm: texto(c.criado_em) ?? "" }))
        .filter((c) => c.id > 0 && c.criadoEm),
    };
  } catch {
    return "erro";
  }
}

const dl = "grid grid-cols-1 gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[8.5rem_1fr]";
const dt = "text-xs font-semibold text-muted";
const dd = "min-w-0 text-sm leading-snug text-ink [overflow-wrap:anywhere]";

function Linha({ nome, valor, apoio }: { nome: string; valor: string | null; apoio?: string | null }) {
  if (!valor) return null;
  return (
    <div className={dl}>
      <dt className={dt}>{nome}</dt>
      <dd className={dd}>
        {valor}
        {apoio ? <span className="block text-xs text-muted">{apoio}</span> : null}
      </dd>
    </div>
  );
}

export function OrigemDoPedido({ numero }: { numero: number }) {
  const [lido, setLido] = useState<Lido | null | "erro" | "lendo">("lendo");

  useEffect(() => {
    let vivo = true;
    setLido("lendo");
    void ler(numero).then((r) => {
      if (vivo) setLido(r);
    });
    return () => {
      vivo = false;
    };
  }, [numero]);

  // Sem acesso, sem pedido ou sem rede: a gaveta já diz por onde veio em uma linha, e este bloco é o detalhe.
  if (lido === "lendo" || lido === "erro" || lido === null) return null;
  const o = lido.origem;
  const carrinhos = lido.carrinhos.length > 0 ? <CarrinhosDoPedido carrinhos={lido.carrinhos} /> : null;
  if (!o.ligado && lido.chegadas.length === 0) {
    return carrinhos ? (
      <section aria-label="De qual anúncio veio" className="glass mt-3 rounded-[16px] px-3.5 py-3">
        <h3 className="eyebrow">De qual anúncio veio</h3>
        <p className="mt-1 text-xs leading-snug text-muted">{comoLigou(o)}</p>
        {carrinhos}
      </section>
    ) : null;
  }

  const nivel = nivelLigado(o);
  const selo: { tom: Tom; nome: string } | null = !ehAnuncio(o)
    ? null
    : nivel === "anuncio"
      ? { tom: "bom", nome: "Anúncio exato" }
      : nivel
        ? { tom: "atencao", nome: nivel === "conjunto" ? "Até o conjunto" : "Só a campanha" }
        : { tom: "atencao", nome: "Anúncio sem identificar" };
  const origem = [utmLegivel(o.source), utmLegivel(o.medium)].filter(Boolean).join(" / ") || null;

  return (
    <section aria-label="De qual anúncio veio" className="glass mt-3 rounded-[16px] px-3.5 py-3">
      <h3 className="eyebrow">De qual anúncio veio</h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
        {nomeDoCanal(o.canal)}
        {selo ? <SeloDeTom tom={selo.tom}>{selo.nome}</SeloDeTom> : null}
        {o.plataforma ? <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{PLATAFORMA[o.plataforma]}</span> : null}
        {pelaBio(o) ? <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">pelo link da bio</span> : null}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted">{comoLigou(o)}</p>

      <dl className="mt-2 divide-y divide-ink/[0.06]">
        <Linha nome="Campanha" valor={o.campanhaNome} />
        <Linha nome="Conjunto" valor={o.conjuntoNome} />
        <Linha nome="Anúncio" valor={o.anuncioNome} />
        <Linha nome="utm_source / medium" valor={origem} />
        <Linha nome="utm_campaign" valor={utmLegivel(o.campaign)} />
        <Linha nome="utm_term" valor={utmLegivel(o.term)} />
        <Linha nome="utm_content" valor={utmLegivel(o.content)} />
        <Linha nome="Chegou em" valor={o.chegouEm ? quando(o.chegouEm) : null} apoio={[o.aparelho, o.clique ? (CLIQUE[o.clique] ?? o.clique) : null].filter(Boolean).join(", ") || null} />
        <Linha nome="Página de entrada" valor={o.entrada} />
        <Linha nome="Etiqueta da Tray" valor={o.etiqueta} apoio="O que a loja guardou como UTM Source no pedido" />
      </dl>

      {carrinhos}

      {lido.chegadas.length > 1 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">
            Ver as {lido.chegadas.length} chegadas deste visitante em 30 dias
          </summary>
          <ol className="mt-2 space-y-2">
            {lido.chegadas.map((c, i) => (
              <li key={`${c.em}-${i}`} className="text-xs leading-snug">
                <span className="numeros text-muted">{quando(c.em)}</span> <span className="font-semibold text-ink">{nomeDoCanal(c.canal)}</span>
                {[utmLegivel(c.source), utmLegivel(c.medium), utmLegivel(c.campaign), utmLegivel(c.term), utmLegivel(c.content)].some(Boolean) ? (
                  <span className="block text-muted [overflow-wrap:anywhere]">
                    {[utmLegivel(c.source), utmLegivel(c.medium), utmLegivel(c.campaign), utmLegivel(c.term), utmLegivel(c.content)].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {c.entrada ? <span className="block text-muted [overflow-wrap:anywhere]">entrou por {c.entrada}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

/**
 * "Este pedido veio de um carrinho abandonado": o negócio que o n8n criou na
 * Kommo com o link do carrinho da MESMA sessão da loja, nos trinta dias antes
 * do pedido. O número abre o negócio na Kommo.
 */
function CarrinhosDoPedido({ carrinhos }: { carrinhos: Carrinho[] }) {
  const [primeiro, ...outros] = carrinhos;
  return (
    <div className="mt-2 rounded-[12px] bg-ink/[0.03] px-3 py-2 text-xs leading-snug text-ink">
      <p>
        Este pedido veio de um carrinho abandonado:{" "}
        <a
          href={`https://kathleengfz.kommo.com/leads/detail/${primeiro.id}`}
          target="_blank"
          rel="noreferrer"
          className="numeros font-semibold text-brand-nav hover:underline"
        >
          negócio {primeiro.id}
        </a>{" "}
        na Kommo, criado em <span className="numeros">{quando(primeiro.criadoEm)}</span>.
      </p>
      {outros.length > 0 ? (
        <p className="mt-0.5 text-muted">
          A mesma sessão tem mais {outros.length} {outros.length === 1 ? "carrinho" : "carrinhos"} antes:{" "}
          {outros.map((c, i) => (
            <span key={c.id}>
              {i > 0 ? ", " : ""}
              <a href={`https://kathleengfz.kommo.com/leads/detail/${c.id}`} target="_blank" rel="noreferrer" className="numeros hover:underline">
                {c.id}
              </a>
            </span>
          ))}
          .
        </p>
      ) : null}
    </div>
  );
}
