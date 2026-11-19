import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CircleCheck, ExternalLink, Hammer, HeartPulse, Info, LifeBuoy, MessagesSquare, ShoppingBag, Waypoints } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import type { Botao, Hoje, Tarefa } from "@/lib/painel/hoje";
import { SETORES, type SetorId } from "@/lib/painel/setores";
import { COR_DO_TOM, type Tom } from "@/lib/painel/tons";
import { ICONE_DO_TOM } from "../Pecas";

/**
 * O desenho da tela Hoje, separado da leitura para a prévia local usar o
 * mesmo componente com dados inventados.
 *
 * Desenhada para 375 px primeiro: cada coisa a fazer é um cartão em coluna,
 * com o título, a cor de estado (sempre com ícone e palavra), há quanto tempo
 * espera, o motivo em uma frase, até três exemplos e o botão que leva ao lugar
 * de resolver. Nada de tabela. A cor de identidade de cada cartão é a do setor
 * para onde o botão leva.
 */

const DA_FONTE: Record<Tarefa["fonte"], { setor: SetorId; Icone: LucideIcon; nome: string }> = {
  kommo: { setor: "vendas", Icone: Waypoints, nome: "Kommo" },
  vendas: { setor: "vendas", Icone: ShoppingBag, nome: "Vendas" },
  suporte: { setor: "vendas", Icone: LifeBuoy, nome: "Suporte" },
  chat: { setor: "time", Icone: MessagesSquare, nome: "Chat do time" },
  fabrica: { setor: "fabrica", Icone: Hammer, nome: "Fábrica" },
  saude: { setor: "sistema", Icone: HeartPulse, nome: "Saúde" },
};

const PALAVRA_DO_TOM: Partial<Record<Tom, string>> = { ruim: "Passou do prazo", atencao: "Pede atenção" };

const corDoSetor = (id: SetorId) => SETORES.find((s) => s.id === id)?.cor;

function BotaoDaTarefa({ b }: { b: Botao }) {
  const classe =
    "painel-toque mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white sm:w-auto";
  const estilo = { background: "var(--setor)" } as CSSProperties;
  if (b.externo) {
    return (
      <a href={b.href} target="_blank" rel="noopener noreferrer" className={classe} style={estilo}>
        {b.rotulo} <ExternalLink size={14} aria-hidden="true" />
        <span className="sr-only"> (abre a Kommo em outra aba)</span>
      </a>
    );
  }
  return (
    <LinkRapido href={b.href} className={classe} style={estilo}>
      {b.rotulo} <ArrowUpRight size={15} aria-hidden="true" />
    </LinkRapido>
  );
}

function CartaoDaTarefa({ t }: { t: Tarefa }) {
  const f = DA_FONTE[t.fonte];
  const cor = COR_DO_TOM[t.tom];
  const IconeDoTom = ICONE_DO_TOM[t.tom];
  const palavra = PALAVRA_DO_TOM[t.tom];
  return (
    <li className="relative min-w-0" style={{ "--setor": corDoSetor(f.setor) } as CSSProperties}>
      <article
        className="glass relative overflow-hidden rounded-[18px] p-4 sm:p-5"
        style={t.tom === "neutro" ? undefined : { background: cor.fundo, borderColor: "transparent" }}
      >
        <div className="flex items-start gap-3">
          <span className="painel-selo painel-selo-ativo grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" aria-hidden="true">
            <f.Icone size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] font-bold uppercase tracking-wider">
              <span className="painel-cor">{f.nome}</span>
              {t.espera ? <span className="numeros font-semibold normal-case tracking-normal text-muted">{t.espera}</span> : null}
            </p>
            <h2 className="font-display mt-0.5 break-words text-xl leading-tight text-ink sm:text-[1.4rem]">{t.titulo}</h2>
            {palavra && IconeDoTom ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold" style={{ color: cor.texto }}>
                <IconeDoTom size={12} aria-hidden="true" /> {palavra}
              </p>
            ) : null}
            <p className="mt-1.5 break-words text-sm leading-snug text-muted">{t.motivo}</p>
          </div>
        </div>

        {t.itens.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-ink/[0.08] pt-3">
            {t.itens.map((i) => {
              const conteudo = (
                <>
                  <span className="min-w-0 break-words font-semibold text-ink [overflow-wrap:anywhere]">{i.texto}</span>
                  {i.apoio ? <span className="numeros min-w-0 break-words text-xs text-muted">{i.apoio}</span> : null}
                </>
              );
              const classe = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm";
              return (
                <li key={i.chave}>
                  {i.href ? (
                    i.externo ? (
                      <a href={i.href} target="_blank" rel="noopener noreferrer" className={`${classe} rounded-md hover:underline`}>
                        {conteudo}
                      </a>
                    ) : (
                      <LinkRapido href={i.href} className={`${classe} rounded-md hover:underline`}>
                        {conteudo}
                      </LinkRapido>
                    )
                  ) : (
                    <div className={classe}>{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        <BotaoDaTarefa b={t.botao} />
      </article>
    </li>
  );
}

export function TelaDoHoje({ nome, dia, hoje, depois }: { nome: string; /** "terça, 18 de novembro" */ dia: string; hoje: Hoje; depois: Botao[] }) {
  const { tarefas, convites, avisoDaKommo } = hoje;
  const vazio = tarefas.length === 0;
  const urgentes = tarefas.filter((t) => t.tom === "ruim").length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="eyebrow">Hoje, {dia}</p>
        <h1 className="font-display mt-2 break-words text-3xl text-ink sm:text-4xl">
          {vazio ? `Tudo em dia, ${nome}` : `${nome}, isto espera por você`}
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          {vazio
            ? "Nada esperando por você agora."
            : `${tarefas.length === 1 ? "1 coisa" : `${tarefas.length} coisas`} para fazer${urgentes > 0 ? `, ${urgentes === 1 ? "1 passou" : `${urgentes} passaram`} do prazo` : ""}. O mais urgente vem primeiro.`}
        </p>
      </header>

      {avisoDaKommo ? (
        <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-ink/[0.04] p-3 text-xs leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{avisoDaKommo}</span>
        </p>
      ) : null}

      {vazio ? (
        <section className="glass mt-6 rounded-[18px] p-5" aria-label="Nada esperando">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <CircleCheck size={18} style={{ color: COR_DO_TOM.bom.texto }} aria-hidden="true" />
            Nenhum cliente, caso ou pedido esperando você.
          </p>
          <p className="mt-1.5 text-sm text-muted">Esta lista se refaz cada vez que você abre a tela.{depois.length > 0 ? " Enquanto isso, vale olhar:" : ""}</p>
          {depois.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {depois.map((b) => (
                <LinkRapido key={b.href} href={b.href} className="painel-toque inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
                  {b.rotulo} <ArrowUpRight size={14} aria-hidden="true" />
                </LinkRapido>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <ol className="mt-6 grid grid-cols-1 gap-3" aria-label="O que fazer agora, do mais urgente para o menos">
          {tarefas.map((t) => (
            <CartaoDaTarefa key={t.chave} t={t} />
          ))}
        </ol>
      )}

      {convites.length > 0 ? (
        <section className="mt-8" aria-label="Vale olhar">
          <p className="eyebrow">Vale olhar, sem prazo</p>
          <ul className="mt-3 grid grid-cols-1 gap-3">
            {convites.map((t) => (
              <CartaoDaTarefa key={t.chave} t={t} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Cada item sai da mesma conta da tela de origem, e as cores seguem os prazos de lá. Os prazos de resposta (Kommo, chat e suporte) e os da
        fábrica são premissas do painel até a JK dizer o combinado.
      </p>
    </div>
  );
}
