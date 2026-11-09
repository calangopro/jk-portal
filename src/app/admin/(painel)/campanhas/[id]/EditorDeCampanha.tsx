"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Loader2, Plus, Trash2 } from "lucide-react";
import type { Avaliacao, Campanha, ItemDaCampanha } from "@/lib/campanhas/dados";
import { precoComDesconto } from "@/lib/margem/calculo";
import { lerNumero } from "../../margem/PainelDeMargem";
import { pct, reais } from "../../produtos/util";
import { mudarEstado, mudarPreco, descontoParaTodos, adicionar, remover, ajustarAoMaximo, salvarDados } from "../actions";
import { COR_DO_STATUS, ROTULO_DO_STATUS } from "../status";
import { LevarPromocaoParaLoja } from "./LevarPromocaoParaLoja";

export type ProdutoParaAdicionar = {
  id: string;
  trayId: string;
  nome: string;
  categoria: string;
  precoCheio: number | null;
  vendidos: number;
};

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function EditorDeCampanha({
  campanha,
  itens,
  avaliacao,
  margemMinima,
  admin,
  paraAdicionar,
}: {
  campanha: Campanha;
  itens: ItemDaCampanha[];
  avaliacao: Record<string, Avaliacao>;
  margemMinima: number | null;
  admin: boolean;
  paraAdicionar: ProdutoParaAdicionar[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, comecar] = useTransition();
  const editavel = campanha.status === "rascunho" || (campanha.status === "em_aprovacao" && admin);

  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) =>
    comecar(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Algo deu errado.");
      else {
        depois?.();
        router.refresh();
      }
    });

  const passam = itens.filter((i) => avaliacao[i.productId]?.situacao === "passa").length;
  const semCusto = itens.filter((i) => avaliacao[i.productId]?.situacao === "sem_custo").length;
  const descontoMedio = itens.length
    ? itens.reduce((s, i) => s + (i.desconto ?? 0), 0) / itens.length
    : 0;

  return (
    <div data-painel-largo>
      <Link href="/admin/campanhas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-nav hover:underline">
        <ArrowLeft size={14} /> Campanhas
      </Link>

      <Cabecalho campanha={campanha} editavel={campanha.status === "rascunho"} executar={executar} pendente={pendente} />

      {erro ? (
        <p role="alert" className="mt-4 rounded-[12px] bg-wine/10 px-4 py-3 text-sm text-wine">
          {erro}
        </p>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Numero rotulo="Produtos" valor={String(itens.length)} />
        <Numero rotulo="Desconto médio" valor={pct(descontoMedio)} />
        <Numero rotulo="Abaixo da margem mínima" valor={String(passam)} alerta={passam > 0} />
        <Numero rotulo="Sem custo cadastrado" valor={String(semCusto)} alerta={semCusto > 0} />
      </section>

      <Situacao campanha={campanha} admin={admin} passam={passam + semCusto} itens={itens.length} executar={executar} pendente={pendente} />

      {editavel ? (
        <Ferramentas
          campanhaId={campanha.id}
          admin={admin}
          passam={passam}
          executar={executar}
          pendente={pendente}
        />
      ) : null}

      <section className="glass mt-6 overflow-hidden rounded-[20px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">Cheio</th>
                <th className="px-4 py-3 font-semibold">Desconto</th>
                <th className="px-4 py-3 font-semibold">Na campanha</th>
                {admin ? <th className="px-4 py-3 font-semibold">Margem</th> : null}
                <th className="px-4 py-3 font-semibold">Situação</th>
                {editavel ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    Nenhum produto ainda. Adicione abaixo.
                  </td>
                </tr>
              ) : (
                itens.map((i) => (
                  <LinhaDoItem
                    // O preço na chave: quando "Aplicar a todos" muda o preço, a linha nasce de novo com o valor novo.
                    key={`${i.productId}-${i.precoCampanha}`}
                    campanhaId={campanha.id}
                    item={i}
                    avaliacao={avaliacao[i.productId]}
                    admin={admin}
                    editavel={editavel}
                    executar={executar}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {admin && margemMinima !== null ? (
          <p className="border-t border-border/60 px-4 py-2 text-xs text-muted">
            Margem mínima: {pct(margemMinima)}. Margem calculada no preço da campanha.
          </p>
        ) : null}
      </section>

      {editavel ? (
        <Adicionar campanhaId={campanha.id} produtos={paraAdicionar} executar={executar} pendente={pendente} />
      ) : null}
    </div>
  );
}

type Executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) => void;

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="glass rounded-[18px] p-4">
      <p className={`font-display text-2xl ${alerta ? "text-wine" : "text-ink"}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-muted">{rotulo}</p>
    </div>
  );
}

function Cabecalho({
  campanha,
  editavel,
  executar,
  pendente,
}: {
  campanha: Campanha;
  editavel: boolean;
  executar: Executar;
  pendente: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(campanha.nome);
  const [inicio, setInicio] = useState(campanha.inicio);
  const [fim, setFim] = useState(campanha.fim);

  if (editando) {
    const campo = "h-10 rounded-[10px] border border-border bg-white/80 px-3 text-sm outline-none focus:border-brand";
    return (
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} className={`${campo} min-w-[16rem] flex-1`} aria-label="Nome" />
        <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} aria-label="Começa em" />
        <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} aria-label="Termina em" />
        <button
          type="button"
          disabled={pendente}
          onClick={() => executar(() => salvarDados(campanha.id, { nome, inicio, fim }), () => setEditando(false))}
          className="h-10 rounded-full bg-brand px-4 text-sm font-semibold text-ink"
        >
          Salvar
        </button>
        <button type="button" onClick={() => setEditando(false)} className="h-10 px-3 text-sm text-muted">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow">Campanha</p>
        <h1 className="font-display mt-2 break-words text-4xl text-ink">{campanha.nome}</h1>
        <p className="mt-2 text-sm text-muted">
          De {dataBr(campanha.inicio)} a {dataBr(campanha.fim)}
          {campanha.criadaPor ? ` · criada por ${campanha.criadaPor}` : ""}
          {editavel ? (
            <button type="button" onClick={() => setEditando(true)} className="ml-2 font-semibold text-brand-nav hover:underline">
              Editar
            </button>
          ) : null}
        </p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${COR_DO_STATUS[campanha.status]}`}>
        {ROTULO_DO_STATUS[campanha.status]}
      </span>
    </header>
  );
}

function Situacao({
  campanha,
  admin,
  passam,
  itens,
  executar,
  pendente,
}: {
  campanha: Campanha;
  admin: boolean;
  passam: number;
  itens: number;
  executar: Executar;
  pendente: boolean;
}) {
  const [nota, setNota] = useState("");
  const botao = "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50";

  return (
    <section className="glass mt-6 rounded-[20px] p-5">
      {campanha.nota ? (
        <p className="mb-3 rounded-[10px] bg-brand/10 px-3 py-2 text-sm text-ink">
          <span className="font-semibold">Nota{campanha.decididaPor ? ` de ${campanha.decididaPor}` : ""}:</span> {campanha.nota}
        </p>
      ) : null}

      {campanha.status === "rascunho" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Monte os preços e mande para um administrador aprovar.</p>
          <button
            type="button"
            disabled={pendente || itens === 0}
            onClick={() => executar(() => mudarEstado(campanha.id, "em_aprovacao"))}
            className={`${botao} bg-ink text-white hover:bg-charcoal`}
          >
            Mandar para aprovação
          </button>
        </div>
      ) : null}

      {campanha.status === "em_aprovacao" ? (
        admin ? (
          <div>
            <p className="text-sm text-ink">Confira os preços e aprove, ou devolva dizendo o que mudar.</p>
            {passam ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-wine">
                <AlertTriangle size={14} /> {passam} {passam === 1 ? "produto fica" : "produtos ficam"} abaixo da margem mínima
                ou sem custo. Para aprovar mesmo assim, escreva o porquê.
              </p>
            ) : null}
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Nota (obrigatória para devolver, ou para aprovar com produto abaixo da margem)"
              className="mt-3 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pendente}
                onClick={() => executar(() => mudarEstado(campanha.id, "aprovada", nota))}
                className={`${botao} bg-brand text-ink hover:bg-brand-light`}
              >
                {pendente ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={() => executar(() => mudarEstado(campanha.id, "rascunho", nota))}
                className={`${botao} border border-wine/40 text-wine hover:bg-wine/5`}
              >
                Devolver para ajuste
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Esperando um administrador aprovar.</p>
            <button
              type="button"
              disabled={pendente}
              onClick={() => executar(() => mudarEstado(campanha.id, "rascunho"))}
              className={`${botao} border border-border text-ink hover:border-brand`}
            >
              Voltar para rascunho
            </button>
          </div>
        )
      ) : null}

      {campanha.status === "aprovada" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <LevarPromocaoParaLoja campanhaId={campanha.id} exportadaEm={campanha.exportadaEm} />
          {admin ? (
            <div className="flex flex-wrap items-start gap-2">
              <button
                type="button"
                disabled={pendente}
                onClick={() => executar(() => mudarEstado(campanha.id, "rascunho", "Reaberta para ajuste."))}
                className={`${botao} border border-border text-ink hover:border-brand`}
              >
                Reabrir
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={() => executar(() => mudarEstado(campanha.id, "encerrada"))}
                className={`${botao} border border-border text-muted hover:border-ink`}
              >
                Encerrar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {campanha.status === "encerrada" ? <p className="text-sm text-muted">Campanha encerrada. Fica aqui como histórico.</p> : null}
    </section>
  );
}

function Ferramentas({
  campanhaId,
  admin,
  passam,
  executar,
  pendente,
}: {
  campanhaId: string;
  admin: boolean;
  passam: number;
  executar: Executar;
  pendente: boolean;
}) {
  const [desconto, setDesconto] = useState("20");
  return (
    <section className="mt-6 flex flex-wrap items-center gap-3">
      <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-white/70 px-4 text-sm">
        Desconto para todos
        <input
          inputMode="decimal"
          value={desconto}
          onChange={(e) => setDesconto(e.target.value)}
          className="w-12 bg-transparent text-right outline-none"
          aria-label="Desconto em porcentagem"
        />
        %
      </label>
      <button
        type="button"
        disabled={pendente}
        onClick={() => executar(() => descontoParaTodos(campanhaId, lerNumero(desconto) ?? NaN))}
        className="h-10 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-charcoal disabled:opacity-60"
      >
        Aplicar a todos
      </button>
      {admin && passam > 0 ? (
        <button
          type="button"
          disabled={pendente}
          onClick={() => executar(() => ajustarAoMaximo(campanhaId))}
          className="h-10 rounded-full border border-wine/40 px-4 text-sm font-semibold text-wine hover:bg-wine/5 disabled:opacity-60"
        >
          Subir os {passam} que passam ao preço mínimo
        </button>
      ) : null}
      <p className="text-xs text-muted">Os preços terminam em ,90.</p>
    </section>
  );
}

function LinhaDoItem({
  campanhaId,
  item,
  avaliacao,
  admin,
  editavel,
  executar,
}: {
  campanhaId: string;
  item: ItemDaCampanha;
  avaliacao: Avaliacao | undefined;
  admin: boolean;
  editavel: boolean;
  executar: Executar;
}) {
  const precoTexto = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  const [preco, setPreco] = useState(precoTexto(item.precoCampanha));
  const [desconto, setDesconto] = useState(item.desconto !== null ? (item.desconto * 100).toFixed(0) : "");

  const salvarPreco = (valor: number | null) => {
    if (valor === null || !Number.isFinite(valor) || valor <= 0 || Math.abs(valor - item.precoCampanha) < 0.005) return;
    executar(() => mudarPreco(campanhaId, item.productId, valor));
  };

  const situacao = avaliacao?.situacao ?? "sem_custo";
  const pequeno = "h-9 w-20 rounded-[8px] border border-border bg-white px-2 text-right text-sm outline-none focus:border-brand";

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-2">
        <div className="flex items-center gap-3">
          {item.miniatura ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.miniatura} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-[6px] bg-white object-contain" />
          ) : null}
          <span className="min-w-0">
            <Link href={`/admin/produtos?p=${item.trayId}`} className="line-clamp-2 break-words text-ink hover:underline">
              {item.nome}
            </Link>
            <span className="text-xs text-muted">
              Cód. {item.trayId} · {item.categoria}
              {!item.disponivel ? <span className="text-wine"> · indisponível</span> : null}
            </span>
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-muted">{item.precoCheio !== null ? reais(item.precoCheio) : "sem preço"}</td>
      <td className="px-4 py-2">
        {editavel && item.precoCheio ? (
          <span className="inline-flex items-center gap-1">
            <input
              inputMode="decimal"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              onBlur={() => {
                const d = lerNumero(desconto);
                if (d !== null && d >= 0 && d < 95) salvarPreco(precoComDesconto(item.precoCheio!, d / 100));
              }}
              className={`${pequeno} w-14`}
              aria-label={`Desconto de ${item.nome}`}
            />
            %
          </span>
        ) : (
          pct(item.desconto)
        )}
      </td>
      <td className="px-4 py-2">
        {editavel ? (
          <input
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onBlur={() => salvarPreco(lerNumero(preco))}
            className={`${pequeno} w-24`}
            aria-label={`Preço na campanha de ${item.nome}`}
          />
        ) : (
          <span className="font-semibold text-ink">{reais(item.precoCampanha)}</span>
        )}
      </td>
      {admin ? (
        <td className="px-4 py-2 text-xs">
          {avaliacao?.margem !== undefined ? (
            <>
              <span className={`font-semibold ${situacao === "passa" ? "text-wine" : "text-emerald-800"}`}>{pct(avaliacao.margem, 1)}</span>
              <span className="block text-muted">
                máx. {pct(avaliacao.descontoMaximo ?? 0)}
                {situacao === "passa" && avaliacao.precoMinimo ? `, mín. ${reais(avaliacao.precoMinimo)}` : ""}
              </span>
            </>
          ) : (
            <span className="text-muted">sem custo</span>
          )}
        </td>
      ) : null}
      <td className="px-4 py-2">
        {situacao === "ok" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Dentro</span>
        ) : situacao === "passa" ? (
          <span className="rounded-full bg-wine/10 px-2 py-0.5 text-xs font-semibold text-wine">Passa do limite</span>
        ) : (
          <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-semibold text-muted">Sem custo</span>
        )}
      </td>
      {editavel ? (
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => executar(() => remover(campanhaId, [item.productId]))}
            className="rounded-full p-2 text-muted hover:bg-wine/10 hover:text-wine"
            aria-label={`Tirar ${item.nome} da campanha`}
          >
            <Trash2 size={14} />
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function Adicionar({
  campanhaId,
  produtos,
  executar,
  pendente,
}: {
  campanhaId: string;
  produtos: ProdutoParaAdicionar[];
  executar: Executar;
  pendente: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [desconto, setDesconto] = useState("20");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const categorias = useMemo(() => Array.from(new Set(produtos.map((p) => p.categoria))).sort((a, b) => a.localeCompare(b, "pt-BR")), [produtos]);
  const filtrados = useMemo(() => {
    const t = semAcento(busca.trim());
    return produtos
      .filter((p) => (!categoria || p.categoria === categoria) && (!t || semAcento(p.nome).includes(t) || p.trayId === t))
      .sort((a, b) => b.vendidos - a.vendidos);
  }, [produtos, busca, categoria]);
  const mostrados = filtrados.slice(0, 80);

  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="glass mt-6 rounded-[20px] p-5">
      <p className="text-sm font-semibold text-ink">Adicionar produtos</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código"
          className="h-10 min-w-[14rem] flex-1 rounded-full border border-border bg-white/80 px-4 text-sm outline-none focus:border-brand"
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="h-10 rounded-full border border-border bg-white/80 px-3 text-sm"
          aria-label="Categoria"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMarcados(new Set(filtrados.map((p) => p.id)))}
          className="h-10 px-2 text-sm font-semibold text-brand-nav hover:underline"
        >
          Marcar os {filtrados.length}
        </button>
        {marcados.size ? (
          <button type="button" onClick={() => setMarcados(new Set())} className="h-10 px-2 text-sm text-muted hover:underline">
            Desmarcar
          </button>
        ) : null}
      </div>

      <ul className="mt-3 max-h-[24rem] divide-y divide-border/50 overflow-y-auto rounded-[12px] border border-border/60 bg-white/50">
        {mostrados.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-white/70">
              <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} className="accent-[var(--color-brand-strong)]" />
              <span className="min-w-0 flex-1 break-words text-ink">{p.nome}</span>
              <span className="shrink-0 text-xs text-muted">
                {p.precoCheio !== null ? reais(p.precoCheio) : ""} · Cód. {p.trayId}
              </span>
            </label>
          </li>
        ))}
        {filtrados.length > mostrados.length ? (
          <li className="px-3 py-2 text-xs text-muted">
            E mais {filtrados.length - mostrados.length}. Refine a busca, ou use “Marcar os {filtrados.length}”.
          </li>
        ) : null}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-white/70 px-4 text-sm">
          Desconto
          <input
            inputMode="decimal"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            className="w-12 bg-transparent text-right outline-none"
            aria-label="Desconto dos produtos adicionados"
          />
          %
        </label>
        <button
          type="button"
          disabled={pendente || marcados.size === 0}
          onClick={() =>
            executar(
              () => adicionar(campanhaId, Array.from(marcados), lerNumero(desconto) ?? NaN),
              () => setMarcados(new Set()),
            )
          }
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-50"
        >
          <Plus size={14} /> Adicionar {marcados.size || ""}
        </button>
      </div>
    </section>
  );
}
