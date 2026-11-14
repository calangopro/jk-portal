import Link from "next/link";
import { CircleCheck, CircleSlash, Clock, TriangleAlert, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EstadoDaLigacao, Ligacao } from "@/lib/painel/saude";

/**
 * Saúde das ligações, só o desenho. A leitura fica em `page.tsx`, para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 *
 * Duas listas: as rotinas que rodam sozinhas e os lugares para onde o contato
 * captado vai. Em cada linha, o estado com ícone e palavra, o número que o
 * sustenta e, quando não está bom, o que fazer. O que pede ação vem primeiro.
 */

const ESTADO: Record<EstadoDaLigacao, { nome: string; Icone: LucideIcon; texto: string; fundo: string }> = {
  ok: { nome: "Funcionando", Icone: CircleCheck, texto: "#046c4e", fundo: "#e3f4ec" },
  atencao: { nome: "Atenção", Icone: TriangleAlert, texto: "#9a4a07", fundo: "#fcefd9" },
  ruim: { nome: "Parada", Icone: XCircle, texto: "#b01919", fundo: "#fde8e8" },
  desligada: { nome: "Não ligada", Icone: CircleSlash, texto: "#9a4a07", fundo: "#fcefd9" },
  sem_registro: { nome: "Sem registro", Icone: Clock, texto: "#55606e", fundo: "#eef0f3" },
};

function Linha({ l }: { l: Ligacao }) {
  const e = ESTADO[l.estado];
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{l.nome}</p>
          <p className="mt-0.5 text-xs text-muted">{l.paraQue}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold" style={{ color: e.texto, background: e.fundo }}>
          <e.Icone size={12} aria-hidden="true" /> {l.grupo === "destino" && l.estado === "ruim" ? "Recusando" : e.nome}
        </span>
      </div>
      <p className="mt-1.5 break-words text-sm leading-relaxed text-ink">{l.frase}</p>
      {l.oQueFazer ? (
        <p className="mt-1 break-words text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink">O que fazer:</span> {l.oQueFazer}
        </p>
      ) : null}
    </li>
  );
}

export function TelaDaSaude({ ligacoes }: { ligacoes: Ligacao[] | null }) {
  const lista = ligacoes ?? [];
  const pedemAcao = lista.filter((l) => l.estado === "ruim" || l.estado === "desligada").length;
  const destinos = lista.filter((l) => l.grupo === "destino");
  const rotinas = lista.filter((l) => l.grupo === "rotina");

  return (
    <div>
      <header>
        <p className="eyebrow">Sistema</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Saúde das ligações</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          O que roda sozinho e para onde vão os contatos captados. Quando uma ligação para, ela aparece aqui e na Visão geral.
        </p>
      </header>

      {ligacoes === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler a saúde das ligações agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          <p
            role="status"
            className="mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold"
            style={pedemAcao > 0 ? { color: "#b01919", background: "#fde8e8" } : { color: "#046c4e", background: "#e3f4ec" }}
          >
            {pedemAcao > 0 ? <TriangleAlert size={15} aria-hidden="true" /> : <CircleCheck size={15} aria-hidden="true" />}
            {pedemAcao === 0 ? "Tudo funcionando" : pedemAcao === 1 ? "1 ligação pede ação" : `${pedemAcao} ligações pedem ação`}
          </p>

          <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-destinos">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="titulo-destinos" className="text-sm font-semibold text-ink">Para onde vai o contato captado</h2>
              <Link href="/admin/integracoes" className="text-xs font-semibold text-[var(--setor)] underline underline-offset-2">
                Abrir Integrações
              </Link>
            </div>
            {destinos.length === 0 ? (
              <p className="mt-2 text-xs text-muted">Nenhum contato captado nos últimos 90 dias.</p>
            ) : (
              <ul className="mt-1 divide-y divide-ink/[0.07]">
                {destinos.map((l) => (
                  <Linha key={l.chave} l={l} />
                ))}
              </ul>
            )}
          </section>

          <section className="glass mt-4 rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-rotinas">
            <h2 id="titulo-rotinas" className="text-sm font-semibold text-ink">O que roda sozinho</h2>
            <ul className="mt-1 divide-y divide-ink/[0.07]">
              {rotinas.map((l) => (
                <Linha key={l.chave} l={l} />
              ))}
            </ul>
          </section>

          <p className="mt-4 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            Uma rotina é dada como parada quando passa perto de três vezes o intervalo dela sem uma rodada boa. A de pedidos tolera a noite
            inteira, porque só roda das 8h às 23h. Os destinos contam os contatos dos últimos 90 dias, pelo último envio de cada um.
          </p>
        </>
      )}
    </div>
  );
}
