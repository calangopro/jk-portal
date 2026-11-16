"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Clock, LoaderCircle, Plus } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { horaCurta, nomeDoMes, porDia, type DiaDoCalendario, type ItemDoCalendario } from "@/lib/redes/calendario";
import { faixaEmPalavra, type HorariosDaRede } from "@/lib/redes/horarios";
import { nomeDaRede, nomeDoFormatoNaRede, type Formato } from "@/lib/redes/redes";
import { Miniatura } from "../Miniatura";

/**
 * O calendário, a parte que mexe: tocar num dia mostra o que sai e o que
 * saiu nele, com os botões de criar post e story já na data. A leitura vem
 * pronta do servidor (`page.tsx`).
 *
 * No celular cada dia mostra pontos (um por item, até três); no computador,
 * as miniaturas. O dia escolhido abre embaixo no celular e ao lado no
 * computador.
 */

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const SEMANA_INTEIRA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const FORMATOS: Formato[] = ["post", "carrossel", "video_curto", "story", "video", "texto"];

const COR = { publicado: "var(--setor)", agendado: "var(--setor)", publicando: "#9a4a07", erro: "#b01919" };

function formatoEmPalavra(formato: string | null, rede: ItemDoCalendario["redes"][number] | undefined): string {
  if (!formato || !rede || !FORMATOS.includes(formato as Formato)) return "Publicação";
  return nomeDoFormatoNaRede(formato as Formato, rede);
}

function Ponto({ i }: { i: ItemDoCalendario }) {
  const cheio = i.situacao === "publicado" || i.situacao === "erro";
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={cheio ? { background: COR[i.situacao] } : { boxShadow: `inset 0 0 0 1.5px ${COR[i.situacao]}` }} aria-hidden="true" />;
}

function rotuloDaSituacao(i: ItemDoCalendario): { texto: string; cor: string } {
  if (i.situacao === "agendado") return { texto: `Agendado para ${horaCurta(i.quando)}`, cor: "var(--setor)" };
  if (i.situacao === "publicando") return { texto: "Saindo agora", cor: COR.publicando };
  if (i.situacao === "erro") return { texto: "Deu erro", cor: COR.erro };
  return { texto: `Saiu às ${horaCurta(i.quando)}`, cor: "var(--color-muted)" };
}

const comMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "quinta, 20 de novembro". */
function diaPorExtenso(data: string): string {
  const d = new Date(`${data}T12:00:00-03:00`);
  return `${SEMANA_INTEIRA[d.getUTCDay()]}, ${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" })}`;
}

export function Calendario({
  mes, anterior, seguinte, dias, itens, hojeData, agora, horarios,
}: {
  mes: string;
  anterior: string;
  seguinte: string;
  dias: DiaDoCalendario[];
  itens: ItemDoCalendario[];
  hojeData: string;
  agora: number;
  horarios: HorariosDaRede[];
}) {
  const doDia = useMemo(() => porDia(itens), [itens]);
  const inicial = dias.some((d) => d.data === hojeData) ? hojeData : dias.find((d) => d.doMes)?.data ?? dias[0].data;
  const [escolhido, setEscolhido] = useState(inicial);
  const lista = doDia.get(escolhido) ?? [];
  const passou = escolhido < hojeData;

  // As horas sugeridas para o dia escolhido: o meio das melhores faixas de cada rede (19h na das 18h às 21h).
  const sugeridas = useMemo(() => {
    const horas = [...new Set(horarios.map((h) => h.melhor?.inicio).filter((x): x is NonNullable<typeof x> => x !== undefined && x !== null))].map((f) => f + 1).sort((a, b) => a - b);
    const base = horas.length ? horas : [19];
    return base.filter((h) => Date.parse(`${escolhido}T${String(h).padStart(2, "0")}:00:00-03:00`) > agora + 30 * 60_000);
  }, [horarios, escolhido, agora]);
  const motivos = horarios.filter((h) => h.melhor);

  const novo = (hora: number, formato?: "story") => `/admin/redes/publicar/novo?quando=${escolhido}T${String(hora).padStart(2, "0")}:00${formato ? `&formato=${formato}` : ""}`;

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <section className="glass min-w-0 rounded-[20px] p-3 sm:p-5" aria-label={`Calendário de ${nomeDoMes(mes)}`}>
        <div className="flex items-center justify-between gap-2">
          <Link href={`?mes=${anterior}`} scroll={false} aria-label={`Ir para ${nomeDoMes(anterior)}`} className="painel-toque grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-ink/[0.06]">
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
          <h2 className="font-display text-xl text-ink sm:text-2xl">{comMaiuscula(nomeDoMes(mes))}</h2>
          <Link href={`?mes=${seguinte}`} scroll={false} aria-label={`Ir para ${nomeDoMes(seguinte)}`} className="painel-toque grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-ink/[0.06]">
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-muted" aria-hidden="true">
          {SEMANA.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {dias.map((d) => {
            const doisDias = doDia.get(d.data) ?? [];
            const ativo = d.data === escolhido;
            return (
              <button
                key={d.data}
                type="button"
                aria-pressed={ativo}
                aria-label={`${diaPorExtenso(d.data)}: ${doisDias.length ? `${doisDias.length} ${doisDias.length === 1 ? "publicação" : "publicações"}` : "nada"}`}
                onClick={() => setEscolhido(d.data)}
                className={
                  "painel-toque flex min-h-[3.4rem] min-w-0 flex-col items-stretch rounded-[10px] border p-1 text-left sm:min-h-[5.6rem] sm:p-1.5 " +
                  (ativo ? "border-[var(--setor)] bg-[var(--setor)]/[0.07]" : "border-transparent hover:bg-ink/[0.04]") +
                  (d.doMes ? "" : " opacity-45")
                }
              >
                <span className={"grid h-6 w-6 place-items-center self-start rounded-full text-xs font-semibold " + (d.hoje ? "bg-ink text-white" : "text-ink")}>{Number(d.data.slice(8))}</span>
                {doisDias.length ? (
                  <>
                    {/* Celular: pontos. */}
                    <span className="mt-auto flex items-center gap-0.5 px-0.5 pb-0.5 sm:hidden">
                      {doisDias.slice(0, 3).map((i) => (
                        <Ponto key={i.chave} i={i} />
                      ))}
                      {doisDias.length > 3 ? <span className="text-[0.55rem] font-bold leading-none text-muted">+{doisDias.length - 3}</span> : null}
                    </span>
                    {/* Computador: miniaturas. */}
                    <span className="mt-1 hidden flex-wrap items-center gap-0.5 sm:flex">
                      {doisDias.slice(0, 3).map((i) => (
                        <span key={i.chave} className="relative h-6 w-6 overflow-hidden rounded-[5px]" style={i.situacao === "publicado" ? undefined : { outline: `1.5px solid ${COR[i.situacao]}`, outlineOffset: "-1.5px" }}>
                          {i.miniatura ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                          ) : (
                            <span className="grid h-full w-full place-items-center bg-ink/[0.06]">
                              <SeloDaRede id={i.redes[0] ?? "instagram"} tamanho={14} />
                            </span>
                          )}
                        </span>
                      ))}
                      {doisDias.length > 3 ? <span className="text-[0.62rem] font-bold text-muted">+{doisDias.length - 3}</span> : null}
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.68rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--setor)" }} aria-hidden="true" /> saiu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ boxShadow: "inset 0 0 0 1.5px var(--setor)" }} aria-hidden="true" /> agendado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COR.erro }} aria-hidden="true" /> deu erro
          </span>
        </p>
      </section>

      <section className="min-w-0 lg:sticky lg:top-[calc(var(--painel-topo,4rem)+1rem)]" aria-labelledby="t-dia">
        <h2 id="t-dia" className="text-base font-semibold text-ink">
          {comMaiuscula(diaPorExtenso(escolhido))}
        </h2>

        {passou ? null : (
          <div className="glass mt-3 rounded-[16px] p-3.5">
            <p className="text-xs font-semibold text-ink">Criar para este dia</p>
            {sugeridas.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugeridas.map((h) => (
                  <Link key={`p${h}`} href={novo(h)} className="painel-toque inline-flex items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white">
                    <Plus size={13} aria-hidden="true" /> Post às {h}h
                  </Link>
                ))}
                {sugeridas.slice(0, 1).map((h) => (
                  <Link key={`s${h}`} href={novo(h, "story")} className="painel-toque inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink">
                    <Plus size={13} aria-hidden="true" /> Story às {h}h
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-muted">
                O horário bom de hoje já passou.{" "}
                <Link href="/admin/redes/publicar/novo" className="font-semibold text-[var(--setor)] underline underline-offset-2">
                  Criar mesmo assim
                </Link>
              </p>
            )}
            {motivos.length ? (
              <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">
                Melhor faixa pelo histórico de cada rede:{" "}
                {motivos.map((h, i) => (
                  <span key={h.rede}>
                    {i ? ", " : ""}
                    {nomeDaRede(h.rede)} {faixaEmPalavra(h.melhor!.inicio)} ({h.melhor!.mediana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o normal)
                  </span>
                ))}
                . A hora pode ser trocada no post.
              </p>
            ) : (
              <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">Ainda não há posts com número suficiente para sugerir horário: 19h é o padrão.</p>
            )}
          </div>
        )}

        {lista.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{passou ? "Nada saiu neste dia." : "Nada marcado para este dia ainda."}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lista.map((i) => {
              const s = rotuloDaSituacao(i);
              return (
                <li key={i.chave}>
                  <Link href={i.href} className="glass flex items-center gap-3 rounded-[14px] p-2.5 hover:bg-white">
                    <Miniatura src={i.miniatura} rede={i.redes[0] ?? "instagram"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold" style={{ color: s.cor }}>
                        {i.situacao === "agendado" ? <Clock size={12} aria-hidden="true" /> : i.situacao === "publicando" ? <LoaderCircle size={12} aria-hidden="true" /> : i.situacao === "erro" ? <CircleAlert size={12} aria-hidden="true" /> : null}
                        {s.texto}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1">
                        {i.redes.map((r) => (
                          <SeloDaRede key={r} id={r} tamanho={16} />
                        ))}
                        <span className="ml-0.5 text-[0.7rem] text-muted">
                          {formatoEmPalavra(i.formato, i.redes[0])}
                          {i.sequencia ? ` ${i.sequencia.split(":")[1]} da sequência` : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink">{i.legenda.trim() || "Sem legenda"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
