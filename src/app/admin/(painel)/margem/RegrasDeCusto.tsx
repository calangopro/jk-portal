"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MATERIAIS_POR_MM,
  MODELOS,
  REGRAS_VAZIAS,
  ROTULO_DO_MATERIAL,
  ROTULO_DO_MODELO,
  TAMANHOS_DE_PEDRA,
  type MaterialPorMm,
  type Modelo,
  type RegrasDeCusto,
  type TipoDePeca,
} from "@/lib/margem/calculo";
import { salvarParametrosDeCusto } from "./actions";
import { lerNumero } from "./PainelDeMargem";

export type GramasMedidas = { material: MaterialPorMm; modelo: Modelo; mediana: number; produtos: number }[];

const mostrar = (n: number | null, casas = 4) => (n === null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: casas, useGrouping: false }));
const campo = "h-10 w-full rounded-[10px] border border-border bg-white/80 px-3 text-sm text-ink outline-none focus:border-brand";

type Def = { chave: string; rotulo: string; ajuda?: string; pct?: boolean; max?: number };

const TIPO: Record<TipoDePeca, string> = { alianca: "aliança", anel: "anel" };

/** Cada campo do formulário tem uma chave plana; `paraRegras` remonta o objeto. */
function valoresIniciais(r: RegrasDeCusto): Record<string, string> {
  const v: Record<string, string> = {};
  for (const m of MATERIAIS_POR_MM) for (const t of ["alianca", "anel"] as TipoDePeca[]) v[`g.${m}.${t}`] = mostrar(r.gramasPorMm[m][t]);
  for (const m of MODELOS) v[`f.${m}`] = mostrar(r.fatorDoModelo[m], 3);
  for (const t of TAMANHOS_DE_PEDRA) v[`p.${t}`] = mostrar(r.custoDaPedra[t]);
  v.meia = mostrar(r.pedrasMeiaVolta, 0);
  v.completa = mostrar(r.pedrasVoltaCompleta, 0);
  v.brinde = mostrar(r.brinde, 2);
  v.caixinha = mostrar(r.caixinha, 2);
  v.folga = r.folga === null ? "" : mostrar(r.folga * 100, 2);
  return v;
}

/**
 * As regras do custo das peças (cartão 82). O painel lê o nome de cada produto
 * e calcula o custo com estes números; peso gravado no produto e custo fixo
 * continuam vencendo. Campo vazio fica vazio: o produto que precisa dele
 * aparece sem custo, com o motivo, na cobertura.
 */
export function FormRegrasDeCusto({ inicial, medidas = [] }: { inicial: RegrasDeCusto | undefined; medidas?: GramasMedidas }) {
  const router = useRouter();
  const [valores, setValores] = useState(() => valoresIniciais(inicial ?? REGRAS_VAZIAS));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, comecar] = useTransition();

  const numero = (k: string) => lerNumero(valores[k] ?? "");
  const invalido = (d: Def) => {
    const n = numero(d.chave);
    return n !== null && (!Number.isFinite(n) || n < 0 || (d.max !== undefined && n > d.max));
  };

  const medida = (material: MaterialPorMm, modelo: Modelo) => medidas.find((m) => m.material === material && m.modelo === modelo);
  const referencia = (material: MaterialPorMm): string | null => {
    const ms = medidas.filter((m) => m.material === material);
    if (!ms.length) return null;
    return `Nos pesos gravados (mediana por peça): ${ms.map((m) => `${ROTULO_DO_MODELO[m.modelo].toLowerCase()} ${mostrar(m.mediana, 3)} g/mm em ${m.produtos} produtos`).join(", ")}. Só referência: não entra na conta sozinha.`;
  };
  const referenciaDoFator = (modelo: (typeof MODELOS)[number]): string | null => {
    for (const material of MATERIAIS_POR_MM) {
      const base = medida(material, "reta");
      const este = medida(material, modelo);
      if (base && este) return `No ${ROTULO_DO_MATERIAL[material].toLowerCase()} gravado: ${mostrar(este.mediana / base.mediana, 2)} (${este.produtos} produtos).`;
    }
    return null;
  };

  const GRAMAS: Def[] = MATERIAIS_POR_MM.flatMap((m) =>
    (["alianca", "anel"] as TipoDePeca[]).map((t) => ({ chave: `g.${m}.${t}`, rotulo: `${ROTULO_DO_MATERIAL[m]}, ${TIPO[t]} (g por mm)`, max: 50 })),
  );
  const FATORES: Def[] = MODELOS.map((m) => ({ chave: `f.${m}`, rotulo: `${ROTULO_DO_MODELO[m]}`, max: 10 }));
  const PEDRAS: Def[] = [
    ...TAMANHOS_DE_PEDRA.map((t) => ({ chave: `p.${t}`, rotulo: `Zircônia de ${t} mm: custo de uma pedra (R$)` })),
    { chave: "meia", rotulo: "Pedras na meia volta", ajuda: "Numa peça. Nome com cravejada sem dizer a volta conta como meia volta." },
    { chave: "completa", rotulo: "Pedras na volta completa", ajuda: "Numa peça." },
  ];
  const OUTROS: Def[] = [
    { chave: "brinde", rotulo: "Anel solitário de brinde (R$)", ajuda: "Entra quando o nome tem \"+ Anel ...\" (Brinde, Diamond, Roma e os outros)." },
    { chave: "caixinha", rotulo: "Caixinha de alianças (R$)", ajuda: "Uma por produto de aliança, par ou peça. Preenchida, a caixinha sai da média de embalagem da lista de Custos, para não contar duas vezes." },
    { chave: "folga", rotulo: "Folga sobre o custo estimado (%)", pct: true, max: 99, ajuda: "Só no metal calculado pela largura e nas pedras. Não entra no peso gravado nem no brinde e na caixinha. Não é a margem mínima." },
  ];
  const todos = [...GRAMAS, ...FATORES, ...PEDRAS, ...OUTROS];

  const paraRegras = (): RegrasDeCusto => ({
    gramasPorMm: Object.fromEntries(
      MATERIAIS_POR_MM.map((m) => [m, { alianca: numero(`g.${m}.alianca`), anel: numero(`g.${m}.anel`) }]),
    ) as RegrasDeCusto["gramasPorMm"],
    fatorDoModelo: Object.fromEntries(MODELOS.map((m) => [m, numero(`f.${m}`)])) as RegrasDeCusto["fatorDoModelo"],
    custoDaPedra: Object.fromEntries(TAMANHOS_DE_PEDRA.map((t) => [t, numero(`p.${t}`)])) as RegrasDeCusto["custoDaPedra"],
    pedrasMeiaVolta: numero("meia"),
    pedrasVoltaCompleta: numero("completa"),
    brinde: numero("brinde"),
    caixinha: numero("caixinha"),
    folga: numero("folga") === null ? null : (numero("folga") as number) / 100,
  });

  const salvar = () =>
    comecar(async () => {
      const ruim = todos.find(invalido);
      if (ruim) {
        setAviso({ ok: false, texto: `Valor inválido em "${ruim.rotulo}".` });
        return;
      }
      const r = await salvarParametrosDeCusto({ regras: paraRegras() });
      setAviso(r.ok ? { ok: true, texto: "Salvo. Os custos já usam as regras novas." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });

  const entrada = (d: Def, extra?: string | null) => (
    <label key={d.chave} className="block min-w-0">
      <span className="text-xs font-semibold text-ink">{d.rotulo}</span>
      <input
        inputMode="decimal"
        value={valores[d.chave] ?? ""}
        onChange={(e) => setValores((v) => ({ ...v, [d.chave]: e.target.value }))}
        aria-invalid={invalido(d)}
        className={`mt-1 ${campo} ${invalido(d) ? "border-wine" : ""}`}
      />
      {d.ajuda ? <span className="mt-0.5 block text-[0.7rem] text-muted">{d.ajuda}</span> : null}
      {extra ? <span className="mt-0.5 block text-[0.7rem] text-brand-strong">{extra}</span> : null}
    </label>
  );

  return (
    <section className="glass mt-6 rounded-[20px] p-5" id="regras">
      <p className="text-sm font-semibold text-ink">Regras de custo das peças</p>
      <p className="mt-1 text-sm text-muted">
        O painel lê o nome de cada produto (largura, par ou peça, aliança ou anel, modelo, pedras e brinde) e calcula o custo
        com estes números. Peso gravado no produto e custo fixo vencem as regras. Campo vazio fica vazio: quem precisa dele
        aparece sem custo, com o motivo, na cobertura acima.
      </p>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">Gramas por milímetro de largura, numa peça</p>
      <p className="mt-1 text-xs text-muted">Par conta duas peças. O peso varia com o aro: este é o médio.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MATERIAIS_POR_MM.map((m) => (
          <div key={m} className="contents">
            {entrada(GRAMAS.find((g) => g.chave === `g.${m}.alianca`)!, referencia(m))}
            {entrada(GRAMAS.find((g) => g.chave === `g.${m}.anel`)!)}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Peso do modelo, em relação à reta</p>
      <p className="mt-1 text-xs text-muted">Reta é 1. 1,33 pesa 33% mais. Vazio: o modelo conta como reta, e o detalhe do produto diz isso.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{FATORES.map((f) => entrada(f, referenciaDoFator(f.chave.slice(2) as (typeof MODELOS)[number])))}</div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Pedras</p>
      <p className="mt-1 text-xs text-muted">O nome não diz o tamanho da pedra: a conta usa a mais cara preenchida. No par, só uma peça leva pedras.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{PEDRAS.map((p) => entrada(p))}</div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Brinde, caixinha e folga</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{OUTROS.map((o) => entrada(o))}</div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar regras"}
        </button>
        {aviso ? (
          <p role="status" className={`text-xs ${aviso.ok ? "text-brand-strong" : "text-wine"}`}>
            {aviso.texto}
          </p>
        ) : null}
      </div>
    </section>
  );
}
