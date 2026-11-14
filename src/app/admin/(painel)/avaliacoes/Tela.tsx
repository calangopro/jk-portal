import { Clock, ExternalLink, Star } from "lucide-react";
import { horarioEmTexto, mesmoHorario } from "@/lib/google-perfil/horario";
import type { AvaliacaoDoPainel, LojaDoPainel } from "@/lib/google-perfil/painel";
import type { Tom } from "@/lib/painel/tons";
import { SeloDeTom } from "../Pecas";
import { ResponderAvaliacao, UsarHorarioDoGoogle } from "./Responder";

/**
 * Avaliações do Google, só o desenho. A leitura fica em `page.tsx`, para a
 * tela poder ser vista sem sessão durante o desenvolvimento.
 *
 * Uma loja por cartão, da que mais pede resposta para a que menos. Dentro de
 * cada uma, só as avaliações SEM resposta: o trabalho da tela é zerar a fila,
 * e avaliação respondida não tem o que fazer aqui.
 *
 * O painel só tem as 100 avaliações mais recentes de cada loja (a regra de uso
 * da API não deixa guardar o histórico), e a tela diz isso. A nota e o total
 * são os do Google, de todas as avaliações: o painel nunca calcula média.
 */

type Responder = (name: string, resposta: string) => Promise<{ ok: true } | { ok: false; erro: string }>;
type UsarHorario = (localName: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

/** Quantas avaliações cada loja mostra abertas. O resto fica num bloco que abre. */
const A_VISTA = 6;

function tomDaLoja(l: LojaDoPainel): Tom {
  if (l.semResposta === 0) return "bom";
  if (l.baixasSemResposta > 0 || (l.lidas > 0 && l.semResposta / l.lidas >= 0.3)) return "ruim";
  return "atencao";
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} aria-hidden="true" className={n <= nota ? "fill-[#b8841f] text-[#b8841f]" : "text-ink/20"} />
      ))}
    </span>
  );
}

function Avaliacao({ a, responder }: { a: AvaliacaoDoPainel; responder?: Responder }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Estrelas nota={a.nota} />
        <span className="text-xs font-semibold text-ink">{a.autor ?? "Sem nome"}</span>
        {a.criadaEm ? (
          <span className="numeros text-[0.7rem] text-muted">{new Date(a.criadaEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
        ) : null}
        {a.nota <= 3 ? <SeloDeTom tom="ruim">Nota baixa</SeloDeTom> : null}
      </div>
      {a.texto ? <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{a.texto}</p> : <p className="mt-1 text-xs text-muted">Só a nota, sem texto.</p>}
      {responder ? <ResponderAvaliacao name={a.name} autor={a.autor} nota={a.nota} responder={responder} /> : null}
    </li>
  );
}

function Horario({ l, usarHorario }: { l: LojaDoPainel; usarHorario?: UsarHorario }) {
  if (!l.horarioDoGoogle) return null;
  const noGoogle = horarioEmTexto(l.horarioDoGoogle);
  return (
    <div className="mt-3 rounded-[12px] border border-ink/10 bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Clock size={13} aria-hidden="true" /> Horário no Google
      </p>
      <p className="mt-1 text-sm text-ink">{noGoogle}</p>
      {!l.portal ? (
        <p className="mt-1 text-[0.7rem] text-muted">O painel não conseguiu ligar esta loja do Google a uma loja do portal, então não dá para levar o horário daqui.</p>
      ) : mesmoHorario(l.portal.horario, l.horarioDoGoogle) ? (
        <p className="mt-1 text-[0.7rem] text-muted">A página de {l.portal.nome} mostra o mesmo horário.</p>
      ) : l.portal.horario ? (
        <>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
            A página de {l.portal.nome} mostra outro: {horarioEmTexto(l.portal.horario)}
            {l.portal.fonte ? ` (fonte: ${l.portal.fonte})` : ""}. Confira qual vale antes de trocar.
          </p>
          {usarHorario ? <UsarHorarioDoGoogle local={l.name} usarHorario={usarHorario} /> : null}
        </>
      ) : (
        <>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">A página de {l.portal.nome} está sem horário. Levando daqui, ela passa a mostrar este, com o Google escrito como fonte.</p>
          {usarHorario ? <UsarHorarioDoGoogle local={l.name} usarHorario={usarHorario} /> : null}
        </>
      )}
    </div>
  );
}

export function TelaDeAvaliacoes({ lojas, responder, usarHorario }: { lojas: LojaDoPainel[] | null; responder?: Responder; usarHorario?: UsarHorario }) {
  const lista = lojas ?? [];
  const semResposta = lista.reduce((s, l) => s + l.semResposta, 0);
  const baixas = lista.reduce((s, l) => s + l.baixasSemResposta, 0);

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Loja</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Avaliações do Google</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          O que está sem resposta, por loja. Responder aqui publica no Google, no nome da loja. O painel tem as 100 avaliações mais recentes de
          cada loja; a nota e o total são os do Google, de todas.
        </p>
      </header>

      {lojas === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler as avaliações agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : lista.length === 0 ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Nenhuma loja lida do Google ainda.</span> A ligação com o Google fica em Integrações, e a leitura roda uma vez por dia.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <SeloDeTom tom={semResposta === 0 ? "bom" : "atencao"}>
              {semResposta === 0 ? "Tudo respondido" : semResposta === 1 ? "1 avaliação sem resposta" : `${semResposta} avaliações sem resposta`}
            </SeloDeTom>
            {baixas > 0 ? <SeloDeTom tom="ruim">{baixas === 1 ? "1 de nota baixa" : `${baixas} de nota baixa`}</SeloDeTom> : null}
          </div>
          {!responder ? <p className="mt-3 text-xs text-muted">O seu nível vê as avaliações. Responder em nome da loja é de administrador, dono, GM e gerente.</p> : null}

          <ul className="mt-4 space-y-3">
            {lista.map((l) => {
              const tom = tomDaLoja(l);
              const aVista = l.pendentes.slice(0, A_VISTA);
              const resto = l.pendentes.slice(A_VISTA);
              return (
                <li key={l.name} className="glass rounded-[18px] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-bold leading-tight text-ink">{l.titulo}</h2>
                      <p className="mt-0.5 text-xs text-muted">
                        {l.nota !== null ? `Nota ${l.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} no Google` : "Sem nota no Google"}
                        {l.total !== null ? `, em ${l.total.toLocaleString("pt-BR")} avaliações` : ""}
                      </p>
                    </div>
                    {/* Sem `shrink-0`: o selo comprido mais o botão não cabem numa linha de celular, e travados empurravam a página 21 px para o lado. */}
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <SeloDeTom tom={tom}>{l.semResposta === 0 ? "Tudo respondido" : `${l.semResposta} sem resposta nas ${l.lidas} mais recentes`}</SeloDeTom>
                      {l.mapa ? (
                        <a href={l.mapa} target="_blank" rel="noreferrer" className="painel-toque inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3 text-xs font-semibold text-ink">
                          <ExternalLink size={13} aria-hidden="true" /> No Google
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <Horario l={l} usarHorario={usarHorario} />

                  {l.pendentes.length > 0 ? (
                    <>
                      <ul className="mt-2 divide-y divide-ink/[0.07]">
                        {aVista.map((a) => (
                          <Avaliacao key={a.name} a={a} responder={responder} />
                        ))}
                      </ul>
                      {resto.length > 0 ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-semibold text-[var(--setor)]">
                            Ver {resto.length === 1 ? "a outra" : `as outras ${resto.length}`} sem resposta
                          </summary>
                          <ul className="mt-1 divide-y divide-ink/[0.07]">
                            {resto.map((a) => (
                              <Avaliacao key={a.name} a={a} responder={responder} />
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-4 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            A leitura do Google roda uma vez por dia, de manhã. Resposta publicada aqui aparece como respondida na hora; avaliação nova de hoje
            entra amanhã. O Google aceita uma resposta por avaliação.
          </p>
        </>
      )}
    </div>
  );
}
