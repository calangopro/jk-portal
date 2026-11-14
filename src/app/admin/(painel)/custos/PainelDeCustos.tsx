import { CalendarDays, FileText, Package, Paperclip, Receipt, Wallet } from "lucide-react";
import {
  CATEGORIAS,
  NOME_DA_CATEGORIA,
  somarDespesas,
  type Categoria,
  type Despesa,
} from "@/lib/custos/dados";
import { contaDoMes } from "@/lib/custos/conta";
import { nomeDoMes } from "@/lib/vendas/periodo";
import { Cartao, Dinheiro, reais } from "../vendas/PainelDeVendas";
import { BotaoDeAcao } from "../recuperacao/BotaoDeAcao";
import { AnexarComprovante } from "./AnexarComprovante";

/**
 * A parte da tela de custos que só desenha. Sem `acoes` (na prévia de
 * desenvolvimento) não aparecem formulário nem botão de anexar.
 *
 * O custo do mês até hoje é uma conta simples e dita na tela (`contaDoMes`):
 * os custos mensais na proporção dos dias que já passaram, mais o custo por
 * pedido vezes os pedidos pagos, mais o anúncio. O anúncio entra pelo gasto de
 * verdade lançado em Tráfego quando ele existe, no lugar da estimativa da
 * lista, e a tela mostra os dois lado a lado. A conta NÃO inclui o custo das
 * peças, e a tela repete isso ao lado do número, para ninguém ler "sobra" onde
 * só existe uma parte da conta.
 */

type Acao = (formData: FormData) => Promise<void>;
export type AcoesDeCustos = { salvar: Acao; ligar: Acao };
export type MesDaLoja = {
  hoje: string;
  diasNoMes: number;
  pedidosPagos: number;
  faturamento: number;
  porFora: number;
  /** Gasto de anúncio lançado em Tráfego do dia 1 até hoje, e em quantos dias. */
  anuncio?: { gasto: number; dias: number } | null;
};

const campo = "w-full rounded-[8px] border border-border bg-white px-2.5 py-1.5 text-sm text-ink";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";
const pilula =
  "inline-block cursor-pointer list-none rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/60 hover:text-brand-nav";

function Formulario({ d, acao }: { d?: Despesa; acao: Acao }) {
  const id = d?.id ?? "novo";
  return (
    <form action={acao} className="mt-3 grid gap-3 sm:grid-cols-2">
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <div className="sm:col-span-2">
        <label className={rotulo} htmlFor={`nome-${id}`}>O que é</label>
        <input id={`nome-${id}`} name="nome" required minLength={2} maxLength={120} defaultValue={d?.nome} className={campo} />
      </div>
      <div>
        <label className={rotulo} htmlFor={`valor-${id}`}>Valor em reais</label>
        <input
          id={`valor-${id}`}
          name="valor"
          required
          inputMode="decimal"
          pattern="[0-9.,]+"
          placeholder="0,00"
          defaultValue={d ? d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : undefined}
          className={`${campo} numeros`}
        />
      </div>
      <div>
        <label className={rotulo} htmlFor={`tipo-${id}`}>Quando se paga</label>
        <select id={`tipo-${id}`} name="tipo" defaultValue={d?.tipo ?? "mensal"} className={campo}>
          <option value="mensal">Todo mês</option>
          <option value="por_pedido">A cada pedido enviado</option>
        </select>
      </div>
      <div>
        <label className={rotulo} htmlFor={`categoria-${id}`}>Grupo</label>
        <select id={`categoria-${id}`} name="categoria" defaultValue={d?.categoria ?? "outros"} className={campo}>
          {CATEGORIAS.map((c) => <option key={c.chave} value={c.chave}>{c.nome}</option>)}
        </select>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="confirmado" defaultChecked={d?.confirmado} className="h-4 w-4 accent-[var(--color-brand-strong)]" />
          Valor exato, com comprovante
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className={rotulo} htmlFor={`fonte-${id}`}>De onde veio o número</label>
        <input id={`fonte-${id}`} name="fonte" maxLength={300} defaultValue={d?.fonte ?? undefined} placeholder="Boleto de novembro, orçamento da gráfica, extrato" className={campo} />
      </div>
      <div className="sm:col-span-2">
        <label className={rotulo} htmlFor={`obs-${id}`}>Observação</label>
        <input id={`obs-${id}`} name="observacao" maxLength={500} defaultValue={d?.observacao ?? undefined} className={campo} />
      </div>
      <div className="sm:col-span-2">
        <BotaoDeAcao forte>{d ? "Salvar" : "Adicionar custo"}</BotaoDeAcao>
      </div>
    </form>
  );
}

function Linha({ d, acoes, unidade }: { d: Despesa; acoes?: AcoesDeCustos; unidade: string }) {
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="min-w-0 text-sm font-semibold text-ink">{d.nome}</p>
        <p className="numeros text-sm text-ink">
          {reais(d.valor)} <span className="text-xs text-muted">{unidade}</span>
        </p>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span
          className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${
            d.confirmado ? "bg-emerald-100 text-emerald-800" : "bg-brand/15 text-brand-strong"
          }`}
        >
          {d.confirmado ? "Valor exato" : "Estimativa"}
        </span>
        {d.fonte ? <span>{d.fonte}</span> : null}
      </p>
      {d.observacao ? <p className="mt-1 text-xs text-ink/80">{d.observacao}</p> : null}

      {d.anexos.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {d.anexos.map((a) => (
            <li key={a.id}>
              {a.link ? (
                <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
                  <Paperclip size={12} aria-hidden /> {a.nome}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted"><Paperclip size={12} aria-hidden /> {a.nome}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {acoes ? (
        <div className="mt-2.5 flex flex-wrap items-start gap-2">
          <AnexarComprovante despesaId={d.id} />
          <details>
            <summary className={pilula}>Alterar</summary>
            <Formulario d={d} acao={acoes.salvar} />
          </details>
          <form action={acoes.ligar}>
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="ativo" value={d.ativo ? "nao" : "sim"} />
            <BotaoDeAcao>{d.ativo ? "Desativar" : "Reativar"}</BotaoDeAcao>
          </form>
        </div>
      ) : null}
    </li>
  );
}

export function PainelDeCustos({
  despesas, mes, acoes,
}: {
  despesas: Despesa[] | null;
  mes: MesDaLoja | null;
  acoes?: AcoesDeCustos;
}) {
  const todas = despesas ?? [];
  const ativas = todas.filter((d) => d.ativo);
  const t = somarDespesas(todas);
  const mensais = ativas.filter((d) => d.tipo === "mensal");
  const porPedido = ativas.filter((d) => d.tipo === "por_pedido");
  const desativadas = todas.filter((d) => !d.ativo);

  const grupos = CATEGORIAS.map((c) => {
    const itens = mensais.filter((d) => d.categoria === c.chave);
    return { chave: c.chave as Categoria, itens, total: itens.reduce((s, d) => s + d.valor, 0) };
  })
    .filter((g) => g.itens.length > 0)
    .sort((a, b) => b.total - a.total);

  const dia = mes ? Number(mes.hoje.slice(8, 10)) : 0;
  const conta = mes
    ? contaDoMes({ despesas: todas, hoje: mes.hoje, diasNoMes: mes.diasNoMes, pedidosPagos: mes.pedidosPagos, anuncioReal: mes.anuncio })
    : null;
  const embalagemAteHoje = conta?.porPedidoAteHoje ?? 0;
  const custoAteHoje = conta?.total ?? 0;
  const comGastoReal = !!conta && conta.diasComGastoReal > 0;
  const vendido = mes ? mes.faturamento + mes.porFora : 0;
  const fatia = mes && vendido > 0 ? Math.round((custoAteHoje / vendido) * 100) : null;
  const sobra = vendido - custoAteHoje;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Diretoria</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Custos da empresa</h1>
        <p className="mt-3 max-w-3xl text-muted">
          O que a loja gasta para funcionar: pessoas, anúncios, plataformas, aluguel e embalagem, com o comprovante
          junto. O custo de cada peça fica em Margem. Só administrador vê esta tela e os arquivos.
        </p>
      </header>

      {despesas === null ? (
        <p className="glass mt-8 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler os custos agora.</span> Recarregue a página em alguns
          segundos. Se continuar, avise quem cuida do painel.
        </p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
            <Cartao Icone={Wallet} rotulo="Todo mês" apoio={`${mensais.length} custos, ${reais(t.mensal / 30)} por dia`}>
              <Dinheiro valor={t.mensal} />
            </Cartao>
            <Cartao Icone={Package} rotulo="A cada pedido" apoio={`${porPedido.length} itens de embalagem e garantia`}>
              <Dinheiro valor={t.porPedido} />
            </Cartao>
            {mes ? (
              <>
                <Cartao
                  Icone={CalendarDays}
                  rotulo={`${nomeDoMes(mes.hoje)} até hoje`}
                  tom={custoAteHoje > vendido ? "ruim" : "neutro"}
                  aviso="Passou do que foi vendido"
                  apoio={`${dia} de ${mes.diasNoMes} dias dos custos mensais, a embalagem de ${mes.pedidosPagos} pedidos e ${comGastoReal ? "o anúncio de verdade" : "a estimativa de anúncio"}`}
                >
                  <Dinheiro valor={custoAteHoje} />
                </Cartao>
                <Cartao
                  Icone={Receipt}
                  rotulo="Vendido no mesmo período"
                  apoio={`${reais(mes.faturamento)} na loja e ${reais(mes.porFora)} por fora`}
                >
                  <Dinheiro valor={vendido} />
                </Cartao>
              </>
            ) : null}
          </div>

          <p className="mt-3 max-w-3xl text-xs text-muted">
            {fatia !== null
              ? `Até hoje, os custos cadastrados equivalem a ${fatia}% do que foi vendido no mês, e ${
                  sobra >= 0 ? `sobram ${reais(sobra)}` : `faltam ${reais(-sobra)}`
                } antes do custo das peças. `
              : ""}
            Ainda falta nesta conta o custo das peças vendidas. Venda por fora só entra se foi registrada.{" "}
            {t.confirmados} de {t.itens} custos têm valor exato, os outros são estimativa.
          </p>

          {conta && comGastoReal ? (
            <p className="glass mt-4 max-w-3xl rounded-[14px] p-4 text-xs leading-relaxed text-muted">
              <span className="font-semibold text-ink">Anúncio no mês: {reais(conta.anuncioAteHoje)}.</span> São{" "}
              {reais(conta.anuncioReal)} de gasto lançado em Tráfego, em {conta.diasComGastoReal}{" "}
              {conta.diasComGastoReal === 1 ? "dia" : "dias"}
              {conta.diasSoNaEstimativa > 0
                ? `, mais a estimativa para ${conta.diasSoNaEstimativa} ${conta.diasSoNaEstimativa === 1 ? "dia que ainda não foi lançado" : "dias que ainda não foram lançados"}`
                : ""}
              . Pela estimativa da lista abaixo seriam {reais(conta.anuncioEstimado)} no mesmo período
              {conta.anuncioEstimado > 0
                ? conta.anuncioAteHoje > conta.anuncioEstimado
                  ? `: o gasto de verdade está ${Math.round((conta.anuncioAteHoje / conta.anuncioEstimado - 1) * 100)}% acima dela.`
                  : `: o gasto de verdade está ${Math.round((1 - conta.anuncioAteHoje / conta.anuncioEstimado) * 100)}% abaixo dela.`
                : "."}{" "}
              A conta usa o gasto de verdade, e a estimativa não é somada junto.
            </p>
          ) : null}

          {acoes ? (
            <details className="glass mt-6 rounded-[16px] p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Adicionar um custo</summary>
              <Formulario acao={acoes.salvar} />
            </details>
          ) : null}

          <section className="mt-10" aria-labelledby="todo-mes">
            <h2 id="todo-mes" className="font-display flex items-center gap-2 text-2xl text-ink">
              <FileText size={18} className="text-brand-nav" aria-hidden /> Todo mês
            </h2>
            {grupos.length === 0 ? (
              <p className="glass mt-4 rounded-[16px] p-5 text-sm text-muted">Nenhum custo mensal cadastrado.</p>
            ) : (
              grupos.map((g) => (
                <div key={g.chave} className="glass mt-4 rounded-[16px] px-4 pb-1 pt-4 sm:px-5">
                  <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
                    <p className="eyebrow">{NOME_DA_CATEGORIA[g.chave]}</p>
                    <p className="numeros text-xs text-muted">
                      {reais(g.total)} · {t.mensal > 0 ? Math.round((g.total / t.mensal) * 100) : 0}% do mês
                    </p>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {g.itens.map((d) => <Linha key={d.id} d={d} acoes={acoes} unidade="por mês" />)}
                  </ul>
                </div>
              ))
            )}
          </section>

          <section className="mt-10" aria-labelledby="cada-pedido">
            <h2 id="cada-pedido" className="font-display flex items-center gap-2 text-2xl text-ink">
              <Package size={18} className="text-brand-nav" aria-hidden /> A cada pedido
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-muted">
              O que vai dentro de cada envio.
              {mes ? ` Com ${mes.pedidosPagos} pedidos pagos no mês, já são ${reais(embalagemAteHoje)}.` : ""}
            </p>
            {porPedido.length === 0 ? (
              <p className="glass mt-4 rounded-[16px] p-5 text-sm text-muted">Nenhum custo por pedido cadastrado.</p>
            ) : (
              <div className="glass mt-4 rounded-[16px] px-4 py-1 sm:px-5">
                <ul className="divide-y divide-border/60">
                  {porPedido.map((d) => <Linha key={d.id} d={d} acoes={acoes} unidade="por pedido" />)}
                </ul>
              </div>
            )}
          </section>

          {desativadas.length > 0 ? (
            <details className="glass mt-10 rounded-[16px] px-4 py-4 sm:px-5">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Desativados <span className="numeros font-normal text-muted">({desativadas.length})</span>
              </summary>
              <ul className="mt-2 divide-y divide-border/60">
                {desativadas.map((d) => (
                  <Linha key={d.id} d={d} acoes={acoes} unidade={d.tipo === "mensal" ? "por mês" : "por pedido"} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
