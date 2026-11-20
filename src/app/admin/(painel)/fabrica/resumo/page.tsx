import Link from "next/link";
import { AlertTriangle, Flame, Inbox, Repeat, Truck } from "lucide-react";
import { requireArea } from "@/lib/auth/session";
import { lerFilaDaFabrica, lerResumoDaFabrica } from "@/lib/fabrica/dados";
import { NOME_DO_TIPO, TIPOS, alteracoesAbertas, atrasado, duracaoCurta, ehFinal, etapasAtivas, nomeDaEtapa, parteDoRetrabalho } from "@/lib/fabrica/etapas";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { Barras } from "../../vendas/Barras";
import { Cartao, ListaComBarra } from "../../Pecas";

export const metadata = { title: "Resumo da fábrica" };

const PERIODOS = [7, 30, 90];

/**
 * A fábrica vista pela gestão (cartão 64): diretoria, GM e gerentes, sem
 * separar por setor. Em cima, o AGORA, tirado da própria fila: quantos em cada
 * etapa, atrasados, urgentes e alterações que a fábrica ainda não viu. Embaixo,
 * o PERÍODO, do histórico dos movimentos (`fabrica_resumo`, 0193): o que
 * entrou, o que saiu, quanto cada etapa segura um trabalho e quanto é
 * retrabalho.
 *
 * Área `vendas`, a mesma da tela de Vendas: quem vê faturamento vê a fábrica
 * por cima. A equipe da fábrica fica com a fila e o quadro.
 */
export default async function ResumoDaFabricaPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireArea("vendas");
  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  const [fila, resumo] = await Promise.all([lerFilaDaFabrica(db, 60), lerResumoDaFabrica(db, dias)]);

  const naFabrica = (fila?.pedidos ?? []).filter((p) => !ehFinal(p.etapa));
  const atrasados = naFabrica.filter((p) => atrasado(p, hoje));
  const urgentes = naFabrica.filter((p) => p.prioridade !== "normal");
  const comAlteracao = naFabrica.filter((p) => alteracoesAbertas(p.alteracoes).length > 0);
  const etapas = fila?.etapas ?? [];
  const porEtapa = etapasAtivas(etapas)
    .filter((e) => !ehFinal(e.chave))
    .map((e) => ({ e, n: naFabrica.filter((p) => p.etapa === e.chave).length, tarde: atrasados.filter((p) => p.etapa === e.chave).length }));
  const parte = resumo ? parteDoRetrabalho(resumo.retrabalho, resumo.entradas) : null;

  // As saídas por dia, com zero no dia sem saída: buraco no gráfico é dia parado, e precisa aparecer.
  const barras = resumo
    ? Array.from({ length: Math.min(dias, 30) }, (_, i) => {
        const d = new Date(Date.parse(`${hoje}T12:00:00Z`) - (Math.min(dias, 30) - 1 - i) * 86_400_000).toISOString().slice(0, 10);
        const n = resumo.saidasPorDia.find((x) => x.dia === d)?.saidas ?? 0;
        return { chave: d, eixo: i % 5 === 4 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "", valor: n, titulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`, detalhe: `${n} ${n === 1 ? "saída" : "saídas"}` };
      })
    : [];

  return (
    <div>
      <header>
        <p className="eyebrow">Fábrica</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Resumo da fábrica</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          O que está na fábrica agora e o que aconteceu no período: entradas, saídas, quanto cada etapa segura um trabalho e
          quanto é retrabalho.
        </p>
      </header>

      {fila === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">Não deu para ler a fila agora. Recarregue a página em alguns segundos.</p>
      ) : (
        <>
          <section aria-label="Agora" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cartao Icone={Inbox} rotulo="Na fábrica agora">
              {naFabrica.length}
            </Cartao>
            <Cartao Icone={AlertTriangle} rotulo="Atrasados" tom={atrasados.length ? "ruim" : "neutro"} aviso={atrasados.length ? "Passou do prazo ou espera demais" : undefined}>
              {atrasados.length}
            </Cartao>
            <Cartao Icone={Flame} rotulo="Urgentes e motoboy" tom={urgentes.length ? "atencao" : "neutro"} aviso={urgentes.length ? "Na frente da fila" : undefined}>
              {urgentes.length}
            </Cartao>
            <Cartao Icone={AlertTriangle} rotulo="Alteração sem ciência" tom={comAlteracao.length ? "ruim" : "neutro"} aviso={comAlteracao.length ? "A fábrica ainda não viu" : undefined}>
              {comAlteracao.length}
            </Cartao>
          </section>

          <section className="glass mt-4 rounded-[18px] p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">Em cada etapa agora</h2>
            <ListaComBarra
              total={Math.max(naFabrica.length, 1)}
              linhas={porEtapa.map(({ e, n, tarde }) => ({
                chave: e.chave,
                nome: e.nome,
                valor: n,
                direita: <span className="numeros font-semibold">{n}</span>,
                apoio: tarde ? `${tarde} atrasado${tarde === 1 ? "" : "s"}` : undefined,
                tom: tarde ? "ruim" : "neutro",
              }))}
            />
            <p className="mt-4 text-xs text-muted">
              <Link href="/admin/fabrica" className="font-semibold text-ink underline underline-offset-2">Abrir a fila</Link>
              {" ou "}
              <Link href="/admin/fabrica-quadro" className="font-semibold text-ink underline underline-offset-2">o quadro em tela cheia</Link>.
            </p>
          </section>
        </>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Nos últimos {dias} dias</h2>
        <nav aria-label="Período" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
          {PERIODOS.map((d) => (
            <Link key={d} href={`?dias=${d}`} scroll={false} aria-current={d === dias ? "page" : undefined} className={"whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold " + (d === dias ? "painel-aba-ativa" : "text-muted hover:text-ink")}>
              {d} dias
            </Link>
          ))}
        </nav>
      </div>

      {resumo === null ? (
        <p className="glass mt-3 rounded-[18px] p-5 text-sm text-muted">Não deu para ler o histórico agora.</p>
      ) : (
        <>
          <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Cartao Icone={Inbox} rotulo="Entraram" apoio="Pela data do pedido, da venda ou da OS">
              {resumo.entradas}
            </Cartao>
            <Cartao Icone={Truck} rotulo="Saíram da fábrica" apoio="Marcados como enviados no painel">
              {resumo.saidas}
            </Cartao>
            <Cartao
              Icone={Repeat}
              rotulo="Retrabalho"
              tom={parte !== null && parte >= 10 ? "atencao" : "neutro"}
              aviso={parte !== null && parte >= 10 ? "Troca, refazer e ajuste" : undefined}
              apoio={parte === null ? "Sem entrada no período" : `${parte}% do que entrou`}
            >
              {resumo.retrabalho}
            </Cartao>
          </section>

          <section className="glass mt-4 rounded-[18px] p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">Saídas por dia</h2>
            <Barras barras={barras} topo={`${Math.max(...barras.map((b) => b.valor), 0)}`} descricao="Trabalhos marcados como enviados, por dia" />
          </section>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">Quanto cada etapa segura um trabalho</h2>
              {resumo.tempos.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Ainda sem movimento suficiente no período. O tempo aparece quando um trabalho entra numa etapa e sai dela pelo painel.</p>
              ) : (
                <ul className="mt-3 divide-y divide-ink/[0.07]">
                  {etapasAtivas(etapas)
                    .map((e) => ({ e, t: resumo.tempos.find((x) => x.etapa === e.chave) }))
                    .filter((x) => x.t)
                    .map(({ e, t }) => (
                      <li key={e.chave} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 text-ink">{nomeDaEtapa(e.chave, etapas)}</span>
                        <span className="numeros shrink-0 text-right text-ink">
                          <span className="font-semibold">{duracaoCurta(t!.medianaS)}</span>
                          <span className="ml-2 text-xs text-muted">em {t!.vezes} {t!.vezes === 1 ? "trabalho" : "trabalhos"}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">A mediana: metade dos trabalhos ficou menos que isso. Medido entre dois movimentos do mesmo trabalho.</p>
            </section>

            <section className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">O que entrou, por tipo</h2>
              <ListaComBarra
                total={Math.max(resumo.entradas, 1)}
                linhas={TIPOS.filter((t) => resumo.porTipo[t.chave]).map((t) => ({
                  chave: t.chave,
                  nome: NOME_DO_TIPO[t.chave],
                  valor: resumo.porTipo[t.chave],
                  direita: <span className="numeros font-semibold">{resumo.porTipo[t.chave]}</span>,
                }))}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
