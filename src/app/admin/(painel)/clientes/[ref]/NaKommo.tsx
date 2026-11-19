import { ExternalLink, MessagesSquare, Search, UserRound } from "lucide-react";
import { tempoPorExtenso, tomDaEsperaNaKommo } from "@/lib/kommo/funil";
import { negociosDoBloco, type DadosDaLinha, type NegocioDoBloco } from "@/lib/clientes/linha-do-tempo";
import { SeloDeTom } from "../../Pecas";

/**
 * O bloco "Na Kommo" da ficha (cartão 31): os negócios deste cliente no CRM,
 * achados pelo telefone e pelo e-mail do contato no espelho. Só leitura: para
 * mexer no negócio, o link abre na Kommo.
 *
 * "Esperando resposta" e o prazo de cor são a mesma régua do funil e da tela
 * Hoje (`PRAZOS_DA_KOMMO`, premissa de 30 minutos e 2 horas).
 */

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Negocio({ n }: { n: NegocioDoBloco }) {
  const estado = n.aberto
    ? { tom: "neutro" as const, nome: "Aberto" }
    : n.ganho
      ? { tom: "bom" as const, nome: "Venda ganha" }
      : n.perdido
        ? { tom: "neutro" as const, nome: "Perdido" }
        : { tom: "neutro" as const, nome: "Fechado" };
  const tomDaEspera = tomDaEsperaNaKommo(n.esperandoMin);
  return (
    <li className="min-w-0 rounded-[14px] border border-ink/[0.08] bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{n.nome ?? "Negócio sem nome"}</p>
        <SeloDeTom tom={estado.tom}>{estado.nome}</SeloDeTom>
      </div>
      <p className="mt-1 break-words text-xs text-muted">
        {[n.funil, n.etapa].filter(Boolean).join(" · ") || "Etapa não lida"}
        {n.aberto && n.naEtapaMin !== null ? <span>, há {tempoPorExtenso(n.naEtapaMin)} nesta etapa</span> : null}
      </p>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
        <UserRound size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1 break-words">
          {n.pessoa ? (
            <span className="font-semibold text-ink">{n.pessoa}{n.meu ? " (você)" : ""}</span>
          ) : n.responsavel ? (
            <>
              <span className="text-ink">{n.responsavel}</span>, sem dono no painel
            </>
          ) : (
            "sem responsável"
          )}
        </span>
        {n.valor !== null && n.valor > 0 ? <span className="numeros shrink-0 font-semibold text-ink">{reais(n.valor)}</span> : null}
      </p>
      {n.esperandoMin !== null ? (
        <p className="mt-2">
          <SeloDeTom tom={tomDaEspera}>
            <MessagesSquare size={11} aria-hidden="true" /> Cliente esperando resposta há {tempoPorExtenso(n.esperandoMin)}
          </SeloDeTom>
        </p>
      ) : null}
      <a
        href={n.link}
        target="_blank"
        rel="noreferrer"
        className="painel-toque mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3 text-xs font-semibold text-ink hover:bg-ink/[0.04]"
      >
        <ExternalLink size={12} aria-hidden="true" /> Abrir na Kommo
      </a>
    </li>
  );
}

export function NaKommo({ linha, agora, buscaNaKommo }: { linha: DadosDaLinha | null; agora: number; buscaNaKommo: string | null }) {
  const negocios = linha ? negociosDoBloco(linha.kommo.negocios, agora) : [];
  const abertos = negocios.filter((n) => n.aberto);
  const fechados = negocios.filter((n) => !n.aberto);
  return (
    <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-labelledby="na-kommo">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="na-kommo" className="font-display text-xl text-ink">Na Kommo</h2>
        {linha?.kommo.lidoEm ? <p className="numeros text-[0.7rem] text-muted">lida em {hora(linha.kommo.lidoEm)}</p> : null}
      </div>

      {!linha ? (
        <p className="mt-2 text-sm text-muted">Não deu para ler a Kommo agora. Recarregue a página em alguns segundos.</p>
      ) : negocios.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {linha.kommo.contatos > 0
            ? "O contato existe na Kommo, mas sem negócio."
            : "Nenhum contato na Kommo com o telefone ou o e-mail deste cliente."}
          {buscaNaKommo ? (
            <>
              {" "}
              <a href={buscaNaKommo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-2">
                <Search size={12} aria-hidden="true" /> Procurar na Kommo
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <>
          {abertos.length > 0 ? (
            <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {abertos.map((n) => (
                <Negocio key={n.id} n={n} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Nenhum negócio aberto agora.</p>
          )}
          {fechados.length > 0 ? (
            <details className="mt-3" open={abertos.length === 0 && fechados.length <= 2}>
              <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">
                {fechados.length === 1 ? "1 negócio fechado" : `${fechados.length} negócios fechados`}
              </summary>
              <ul className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {fechados.map((n) => (
                  <Negocio key={n.id} n={n} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
