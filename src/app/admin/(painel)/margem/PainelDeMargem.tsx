"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, Loader2 } from "lucide-react";
import { cotacaoDo, reais, ROTULO_DO_MATERIAL, type Parametros } from "@/lib/margem/calculo";
import type { FamiliaComProdutos } from "@/lib/margem/dados";
import { lerXlsx } from "@/lib/margem/ler-xlsx";
import { lerPlanilhaDoDono, type ImportacaoDeCustos } from "@/lib/margem/planilha-do-dono";
import { importarPlanilhaDeCustos, salvarFamiliaDeOuro, salvarParametrosDeCusto } from "./actions";

/** "4,5" e "4.5" viram 4,5; vazio vira nulo; lixo vira NaN (e o formulário avisa). */
export function lerNumero(s: string): number | null {
  const t = s.trim().replace(/R\$|\s|%/g, "");
  if (!t) return null;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

const mostrar = (n: number | null, casas = 2) =>
  n === null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: casas, useGrouping: false });

const campo =
  "h-10 w-full rounded-[10px] border border-border bg-white/80 px-3 text-sm text-ink outline-none focus:border-brand";

// ------------------------------------------------------------------ parâmetros

const PARAMETROS: { chave: keyof Parametros; rotulo: string; pct: boolean; ajuda: string }[] = [
  { chave: "cotacao18k", rotulo: "Preço do grama do ouro 18k (R$)", pct: false, ajuda: "Quanto a JK paga hoje." },
  { chave: "cotacao10k", rotulo: "Preço do grama do ouro 10k (R$)", pct: false, ajuda: "Idem, ouro 10k." },
  { chave: "taxa", rotulo: "Taxa de cartão e gateway (%)", pct: true, ajuda: "Média por venda." },
  { chave: "imposto", rotulo: "Imposto sobre a venda (%)", pct: true, ajuda: "Sobre o valor vendido." },
  { chave: "frete", rotulo: "Frete grátis médio por pedido (R$)", pct: false, ajuda: "0 se o cliente paga." },
  { chave: "embalagem", rotulo: "Embalagem e brinde (R$)", pct: false, ajuda: "Caixinha, saquinho, cartão." },
  { chave: "margemMinima", rotulo: "Margem mínima (%)", pct: true, ajuda: "Abaixo disso, fica vermelho." },
];

export function FormParametros({ inicial }: { inicial: Parametros }) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PARAMETROS.map((p) => [p.chave, mostrar(inicial[p.chave] === null ? null : p.pct ? inicial[p.chave]! * 100 : inicial[p.chave])]),
    ),
  );
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, comecar] = useTransition();

  const salvar = () =>
    comecar(async () => {
      const p: Partial<Parametros> = {};
      for (const d of PARAMETROS) {
        const n = lerNumero(valores[d.chave] ?? "");
        if (n !== null && (!Number.isFinite(n) || n < 0 || (d.pct && n >= 100))) {
          setAviso({ ok: false, texto: `Valor inválido em "${d.rotulo}".` });
          return;
        }
        p[d.chave] = n === null ? null : d.pct ? n / 100 : n;
      }
      const r = await salvarParametrosDeCusto(p);
      setAviso(r.ok ? { ok: true, texto: "Salvo. As margens já usam os valores novos." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });

  return (
    <div className="glass rounded-[20px] p-5">
      <p className="text-sm font-semibold text-ink">Parâmetros</p>
      <p className="mt-1 text-sm text-muted">Quando o ouro mudar, troque só o preço do grama: todas as margens se recalculam.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PARAMETROS.map((d) => (
          <label key={d.chave} className="block">
            <span className="text-xs font-semibold text-ink">{d.rotulo}</span>
            <input
              inputMode="decimal"
              value={valores[d.chave] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [d.chave]: e.target.value }))}
              className={`mt-1 ${campo}`}
            />
            <span className="mt-0.5 block text-[0.7rem] text-muted">{d.ajuda}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar parâmetros"}
        </button>
        {aviso ? <p className={`text-xs ${aviso.ok ? "text-brand-strong" : "text-wine"}`}>{aviso.texto}</p> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ importar

export function ImportarPlanilha() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [lida, setLida] = useState<ImportacaoDeCustos | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [trabalhando, comecar] = useTransition();

  const ler = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);
    setResultado(null);
    setLida(null);
    try {
      const pasta = await lerXlsx(new Uint8Array(await arquivo.arrayBuffer()));
      setLida(lerPlanilhaDoDono(pasta));
      setNome(arquivo.name);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler a planilha.");
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  };

  const importar = () =>
    comecar(async () => {
      if (!lida) return;
      const r = await importarPlanilhaDeCustos(lida);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setLida(null);
      setResultado(
        `Importado: ${r.parametros} parâmetros, ${r.familias} famílias, ${r.ouro} exceções de ouro e ${r.fixos} custos fixos.` +
          (r.naoAchados.length ? ` ${r.naoAchados.length} códigos não estão no catálogo (${r.naoAchados.slice(0, 6).join(", ")}).` : ""),
      );
      router.refresh();
    });

  const total = lida ? Object.keys(lida.parametros).length + lida.familias.length + lida.ouro.length + lida.fixos.length : 0;

  return (
    <div className="glass rounded-[20px] p-5">
      <p className="text-sm font-semibold text-ink">Importar a planilha do dono</p>
      <p className="mt-1 text-sm text-muted">
        A planilha “custos-jk-para-o-dono.xlsx”, preenchida. Só as células com valor entram: vazio nunca apaga o que já está
        aqui. Também vale exportada do Google Planilhas ou do Numbers, em .xlsx.
      </p>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal">
        <FileUp size={14} /> Escolher a planilha
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => ler(e.target.files?.[0])}
        />
      </label>

      {erro ? (
        <p role="alert" className="mt-3 text-xs text-wine">
          {erro}
        </p>
      ) : null}

      {lida ? (
        <div className="mt-4 rounded-[12px] border border-border bg-white/70 p-4 text-sm" aria-live="polite">
          <p className="font-semibold text-ink">{nome}</p>
          <ul className="mt-2 space-y-0.5 text-muted">
            <li>{Object.keys(lida.parametros).length} parâmetros preenchidos</li>
            <li>{lida.familias.length} famílias de ouro com peso ou resto</li>
            <li>{lida.ouro.length} produtos de ouro com valor próprio</li>
            <li>{lida.fixos.length} produtos de prata e semijoia com custo</li>
          </ul>
          {lida.avisos.length ? (
            <ul className="mt-2 space-y-0.5 text-xs text-wine">
              {lida.avisos.slice(0, 5).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={importar}
            disabled={trabalhando || total === 0}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-50"
          >
            {trabalhando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {total === 0 ? "A planilha está vazia" : "Importar"}
          </button>
        </div>
      ) : null}

      {resultado ? <p className="mt-3 text-xs text-brand-strong">{resultado}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ famílias

export function TabelaDeFamilias({ familias, parametros }: { familias: FamiliaComProdutos[]; parametros: Parametros }) {
  return (
    <section className="glass mt-6 overflow-hidden rounded-[20px]">
      <div className="p-5">
        <p className="text-sm font-semibold text-ink">Ouro por família</p>
        <p className="mt-1 text-sm text-muted">
          O mesmo modelo pesa igual, então o peso se escreve uma vez por família. Gramas: o ouro do par (ou da peça) no
          tamanho que mais vende. Resto: tudo que não é ouro (feitio, pedras, prata, caixinha). Produto que pesar diferente
          se corrige na gaveta dele, em Produtos.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] text-left text-sm">
          <thead>
            <tr className="border-y border-border/70 text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-semibold">Família</th>
              <th className="px-4 py-3 font-semibold">Peça</th>
              <th className="px-4 py-3 font-semibold">Produtos</th>
              <th className="px-4 py-3 font-semibold">Gramas</th>
              <th className="px-4 py-3 font-semibold">Aros de referência</th>
              <th className="px-4 py-3 font-semibold">Resto (R$)</th>
              <th className="px-4 py-3 font-semibold">Custo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {familias.map((f) => (
              <LinhaDaFamilia key={f.codigo} f={f} parametros={parametros} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LinhaDaFamilia({ f, parametros }: { f: FamiliaComProdutos; parametros: Parametros }) {
  const router = useRouter();
  const [gramas, setGramas] = useState(mostrar(f.gramas, 3));
  const [aros, setAros] = useState(f.arosReferencia ?? "");
  const [resto, setResto] = useState(mostrar(f.resto));
  const [estado, setEstado] = useState<"" | "salvo" | string>("");
  const [salvando, comecar] = useTransition();

  const g = lerNumero(gramas);
  const r = lerNumero(resto);
  const cot = cotacaoDo(f.material, parametros);
  const custo = g === null && r === null ? null : (g ?? 0) * (cot ?? 0) + (r ?? 0);
  const mudou = gramas !== mostrar(f.gramas, 3) || aros !== (f.arosReferencia ?? "") || resto !== mostrar(f.resto);

  const salvar = () =>
    comecar(async () => {
      if ((g !== null && (!Number.isFinite(g) || g <= 0)) || (r !== null && (!Number.isFinite(r) || r < 0))) {
        setEstado("Número inválido");
        return;
      }
      const res = await salvarFamiliaDeOuro(f.codigo, { gramas: g, arosReferencia: aros || null, resto: r });
      setEstado(res.ok ? "salvo" : res.erro);
      if (res.ok) router.refresh();
    });

  const pequeno = "h-9 w-24 rounded-[8px] border border-border bg-white/80 px-2 text-sm outline-none focus:border-brand";
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-2 font-semibold text-ink">{f.codigo}</td>
      <td className="px-4 py-2">
        <span className="text-ink">{ROTULO_DO_MATERIAL[f.material]}</span>{" "}
        <span className="text-muted">
          · {f.tipo} · {f.largura} · {f.perfil}
        </span>
      </td>
      <td className="px-4 py-2 text-muted">{f.produtos}</td>
      <td className="px-4 py-2">
        <input inputMode="decimal" value={gramas} onChange={(e) => setGramas(e.target.value)} className={pequeno} aria-label={`Gramas da ${f.codigo}`} />
      </td>
      <td className="px-4 py-2">
        <input value={aros} onChange={(e) => setAros(e.target.value)} maxLength={60} className={`${pequeno} w-28`} aria-label={`Aros de referência da ${f.codigo}`} />
      </td>
      <td className="px-4 py-2">
        <input inputMode="decimal" value={resto} onChange={(e) => setResto(e.target.value)} className={pequeno} aria-label={`Resto da peça da ${f.codigo}`} />
      </td>
      <td className="px-4 py-2 text-ink">
        {custo !== null && Number.isFinite(custo) ? reais(custo) : <span className="text-muted">sem peso</span>}
        {g !== null && !cot ? <span className="block text-[0.7rem] text-wine">falta o preço do grama</span> : null}
      </td>
      <td className="px-4 py-2 text-right">
        {mudou ? (
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-light disabled:opacity-60"
          >
            {salvando ? "…" : "Salvar"}
          </button>
        ) : estado === "salvo" ? (
          <Check size={15} className="ml-auto text-brand-strong" aria-label="Salvo" />
        ) : estado ? (
          <span className="text-xs text-wine">{estado}</span>
        ) : null}
      </td>
    </tr>
  );
}
