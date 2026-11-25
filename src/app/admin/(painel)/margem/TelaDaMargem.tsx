import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { CoberturaDoCusto, MotivoDaFalta, Parametros } from "@/lib/margem/calculo";
import type { FamiliaComProdutos } from "@/lib/margem/dados";
import { FormParametros, ImportarPlanilha, TabelaDeFamilias } from "./PainelDeMargem";
import { FormRegrasDeCusto, type GramasMedidas } from "./RegrasDeCusto";

export type LinhaDaMargem = { codigo: string; nome: string; direita: string };

/** O desenho da tela de Margem. A leitura fica em `page.tsx`, para a tela de exemplo do Como usar poder montar este desenho com dados inventados. */
export function TelaDaMargem({
  parametros, daLista, familias, comCusto, total, hojePassa, abaixo, semCusto, cobertura, medidas,
}: {
  parametros: Parametros;
  /** O que a lista de Custos daria para os parâmetros vazios (imposto em fração, frete e embalagem em reais). */
  daLista?: { imposto: number | null; frete: number | null; embalagem: number | null };
  familias: FamiliaComProdutos[];
  comCusto: number;
  total: number;
  hojePassa: { n: number; linhas: LinhaDaMargem[] };
  abaixo: { n: number; linhas: LinhaDaMargem[] };
  semCusto: LinhaDaMargem[];
  /** Quantos produtos o painel calcula pelas regras, quantos têm valor gravado e por que os outros ficam sem custo. */
  cobertura: CoberturaDoCusto;
  /** As gramas por mm que os pesos já gravados dão, como referência para as regras. */
  medidas?: GramasMedidas;
}) {
  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Diretoria</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Margem</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Quanto sobra em cada peça e até quanto dá para dar de desconto. Só administradores veem esta tela.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Produtos com custo" valor={`${comCusto} de ${total}`} />
        <Numero rotulo="Promoção de hoje abaixo da margem mínima" valor={String(hojePassa.n)} alerta={hojePassa.n > 0} />
        <Numero rotulo="Abaixo da margem mínima no preço cheio" valor={String(abaixo.n)} alerta={abaixo.n > 0} />
      </section>

      <Cobertura c={cobertura} />

      {parametros.margemMinima === null ? (
        <p className="mt-4 rounded-[12px] bg-brand/10 px-4 py-3 text-sm text-brand-strong">
          Sem margem mínima definida, nenhum produto aparece como abaixo do limite. Preencha nos parâmetros.
        </p>
      ) : null}

      {hojePassa.n ? (
        <Lista
          titulo="Promoção de hoje abaixo da margem mínima"
          explica="A promoção que está valendo na loja deixa menos do que a margem mínima. Vale rever antes da Black."
          linhas={hojePassa.linhas}
          resto={hojePassa.n - hojePassa.linhas.length}
        />
      ) : null}

      {abaixo.n ? (
        <Lista
          titulo="Abaixo da margem mínima no preço cheio"
          explica="Mesmo sem desconto, a peça deixa menos que a margem mínima. Ou o custo está errado, ou o preço precisa subir."
          linhas={abaixo.linhas}
          resto={abaixo.n - abaixo.linhas.length}
        />
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <FormParametros inicial={parametros} daLista={daLista} />
        <ImportarPlanilha />
      </section>

      <FormRegrasDeCusto inicial={parametros.regras} medidas={medidas} />

      <TabelaDeFamilias familias={familias} parametros={parametros} />

      {semCusto.length ? (
        <Lista
          titulo="Mais vendidos ainda sem custo"
          explica="O custo se preenche na planilha do dono ou na gaveta do produto, em Produtos."
          linhas={semCusto}
        />
      ) : null}
    </div>
  );
}

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`glass rounded-[18px] p-5 ${alerta ? "ring-1 ring-wine/40" : ""}`}>
      <p className={`font-display text-3xl ${alerta ? "text-wine" : "text-ink"}`}>{valor}</p>
      <p className="mt-1 text-sm text-muted">{rotulo}</p>
    </div>
  );
}

function Lista({
  titulo,
  explica,
  linhas,
  resto = 0,
}: {
  titulo: string;
  explica: string;
  linhas: { codigo: string; nome: string; direita: string }[];
  resto?: number;
}) {
  return (
    <section className="glass mt-6 rounded-[20px] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle size={15} className="text-wine" /> {titulo}
      </p>
      <p className="mt-1 text-sm text-muted">{explica}</p>
      <ul className="mt-3 divide-y divide-border/60">
        {linhas.map((l) => (
          <li key={l.codigo} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <Link href={`/admin/produtos?p=${l.codigo}`} className="min-w-0 flex-1 break-words text-ink hover:text-brand-nav hover:underline">
              {l.nome}
            </Link>
            <span className="text-xs text-muted">{l.direita}</span>
          </li>
        ))}
      </ul>
      {resto > 0 ? <p className="mt-2 text-xs text-muted">E mais {resto}. Veja todos em Produtos, com o filtro de margem.</p> : null}
    </section>
  );
}

/** Os motivos que se resolvem nas regras desta tela: o link leva até elas. */
const NAS_REGRAS = new Set<MotivoDaFalta>(["falta_gramas_por_mm", "falta_preco_do_grama"]);

const qtd = (n: number) => n.toLocaleString("pt-BR");

/** Quanto do catálogo tem custo, de onde ele vem, e o que falta para o resto. */
function Cobertura({ c }: { c: CoberturaDoCusto }) {
  const vendidosTotal = c.porOrigem.regras.vendidos + c.porOrigem.gravado.vendidos + c.porOrigem.fixo.vendidos + c.semCusto.vendidos;
  const parte = (v: number) => (vendidosTotal > 0 ? `${Math.round((v / vendidosTotal) * 100)}% das peças vendidas` : null);
  const grupos = [
    { rotulo: "Calculado pelas regras", n: c.porOrigem.regras, tom: "text-ink" },
    { rotulo: "Peso ou custo gravado no produto", n: { produtos: c.porOrigem.gravado.produtos + c.porOrigem.fixo.produtos, vendidos: c.porOrigem.gravado.vendidos + c.porOrigem.fixo.vendidos }, tom: "text-ink" },
    { rotulo: "Sem custo", n: c.semCusto, tom: c.semCusto.produtos ? "text-wine" : "text-ink" },
  ];
  return (
    <section className="glass mt-6 rounded-[20px] p-5" aria-labelledby="cobertura-titulo">
      <p id="cobertura-titulo" className="text-sm font-semibold text-ink">
        Cobertura do custo
      </p>
      <p className="mt-1 text-sm text-muted">
        Dos {qtd(c.total)} produtos à venda, quantos o painel calcula sozinho e por que os outros ficam de fora. As peças vendidas são
        a contagem da própria loja, para mostrar o que pesa no faturamento.
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {grupos.map((g) => (
          <div key={g.rotulo} className="min-w-0 rounded-[14px] border border-border bg-white/70 p-4">
            <dt className="text-xs text-muted">{g.rotulo}</dt>
            <dd className={`font-display mt-1 text-2xl ${g.tom}`}>{qtd(g.n.produtos)} produtos</dd>
            {parte(g.n.vendidos) ? <dd className="text-xs text-muted">{parte(g.n.vendidos)}</dd> : null}
          </div>
        ))}
      </dl>
      {c.faltas.length ? (
        <ul className="mt-4 divide-y divide-border/60">
          {c.faltas.map((f) => (
            <li key={f.motivo} className="py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1 break-words font-semibold text-ink">
                  {f.rotulo}
                  {NAS_REGRAS.has(f.motivo) ? (
                    <a href="#regras" className="ml-2 text-xs font-semibold text-brand-nav hover:underline">
                      Preencher
                    </a>
                  ) : null}
                </span>
                <span className="text-xs text-muted">
                  {qtd(f.produtos)} produtos{parte(f.vendidos) ? `, ${parte(f.vendidos)}` : ""}
                </span>
              </div>
              {f.exemplos.length ? <p className="mt-0.5 break-words text-xs text-muted [overflow-wrap:anywhere]">Ex.: {f.exemplos.join("; ")}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
