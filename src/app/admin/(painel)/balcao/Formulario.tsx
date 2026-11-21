"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Factory, FileText, Loader2, Paperclip, Plus, RotateCcw, Trash2, UserRound, X } from "lucide-react";
import { ProducaoDaVenda, type ProdutoDoFormulario } from "../registrar-venda/ProducaoDaVenda";
import { PECA_VAZIA, PRODUCAO_VAZIA, type PecaDoFormulario, type ProducaoDoFormulario } from "@/lib/vendas/producao";
import type { SugestaoDaFoto } from "@/lib/fabrica/foto-do-pedido";
import {
  FORMAS, MOTIVOS, dinheiro, emPortugues, faltaNoRascunho, lerValor, numeroDoPedido, sinalSugerido, somarDias, telefoneNaTela, telefoneParaLink,
  type AnexoDoRascunho, type FormaDePagamento, type Motivo, type RascunhoDoBalcao, type VendedorDaLoja,
} from "@/lib/balcao/regras";
import { buscarCliente, lerFotoDoPapel, salvarPedidoDoBalcao, salvarVendedor, type ClienteConhecido } from "./actions";
import { fotoEmDataUrl, novoId, subirArquivo } from "./arquivos";

/**
 * O pedido do balcão (cartão 71), pensado para o vendedor de pé, atendendo,
 * com um celular que nem sempre ajuda:
 *
 * - quem atendeu é um toque, e o aparelho lembra o último;
 * - o telefone vem primeiro: se o cliente já comprou, o nome chega sozinho;
 * - a foto da OS de papel é lida pela IA e preenche o que der;
 * - o sinal sugere metade, e o comprovante é uma foto;
 * - tudo fica guardado NO APARELHO a cada mudança: a internet caiu, a tela
 *   fechou, o cliente voltou depois, o pedido continua ali;
 * - a barra de salvar fica sempre à vista e diz o que falta.
 *
 * Quem confere de verdade é o servidor e o banco. Nada aqui grava sozinho.
 */

const campo = "w-full rounded-[12px] border border-border bg-white px-3 text-base text-ink min-h-12";
const rotulo = "block pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted";
const chip = (ativo: boolean) =>
  `painel-toque inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${ativo ? "border-transparent painel-aba-ativa" : "border-ink/12 bg-white text-ink"}`;

const CHAVE_ABERTO = "jk:balcao:aberto";
const chaveDoRascunho = (id: string) => `jk:balcao:r:${id}`;
const chaveDoVendedor = (loja: string) => `jk:balcao:vendedor:${loja}`;

function ler<T>(chave: string): T | null {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Navegador sem armazenamento (janela anônima cheia): o pedido segue só na tela.
  }
}

export function rascunhoVazio(id: string, loja: string, producao: ProducaoDoFormulario): RascunhoDoBalcao {
  return {
    id, loja, vendedor: "", cliente_nome: "", cliente_telefone: "", cliente_email: "", motivo: "", data_especial: "",
    producao, prazo: "", total: "", observacao: "", numero_papel: "", fotos: [], transcricao: "", pagamento: null, anexos: [],
    mexido_em: new Date().toISOString(),
  };
}

/** Tem alguma coisa escrita? (para não oferecer "continuar" um pedido vazio) */
const temConteudo = (r: RascunhoDoBalcao) => Boolean(r.cliente_telefone || r.cliente_nome || r.total || r.fotos.length || r.producao.pecas.some((p) => p.nome));

/** A sugestão da IA vira peças do formulário. Gravação lida do papel fica "a confirmar": a IA não sabe se é laser ou manual. */
function pecasDaSugestao(s: SugestaoDaFoto, base: ProducaoDoFormulario): ProducaoDoFormulario {
  if (!s.pecas.length) return base;
  const pecas: PecaDoFormulario[] = s.pecas.slice(0, 8).map((x) => ({
    ...PECA_VAZIA,
    nome: x.nome ?? "",
    aro1: x.aro1 ?? "",
    aro2: x.aro2 ?? "",
    gravar1: x.gravar1 ?? "",
    gravar2: x.gravar2 ?? "",
    gravacao: x.gravar1 || x.gravar2 ? "a_confirmar" : "sem",
    detalhes: (x.detalhes ?? "").slice(0, 300),
  }));
  const e = (s.entrega ?? "").toLowerCase();
  const entrega: ProducaoDoFormulario["entrega"] = /sedex|correio|pac|transportadora/.test(e) ? "correios" : /moto|uber/.test(e) ? "moto" : base.entrega;
  return { ...base, pecas, entrega };
}

const minutosAtras = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia(s)`;
};

export function FormularioDoBalcao({
  inicial, editando, minhaLoja, lojas, vendedores: vendedoresIniciais, produtos, hoje,
}: {
  /** Reabrir um pedido salvo: o formulário cru que ele guardou. */
  inicial?: RascunhoDoBalcao;
  editando?: { id: string; numero: number; naFabrica: boolean };
  minhaLoja: string | null;
  lojas: string[];
  vendedores: VendedorDaLoja[];
  produtos: ProdutoDoFormulario[];
  hoje: string;
}) {
  const router = useRouter();
  const [r, setR] = useState<RascunhoDoBalcao>(() => inicial ?? rascunhoVazio(novoId(), minhaLoja ?? "", { ...PRODUCAO_VAZIA, loja: minhaLoja ?? "" }));
  // Trocar a versão remonta o bloco das peças com o que mudou de fora (IA, rascunho recuperado).
  const [versao, setVersao] = useState(0);
  const [pendente, setPendente] = useState<RascunhoDoBalcao | null>(null);
  const [vendedores, setVendedores] = useState(vendedoresIniciais);
  const [prioridade, setPrioridade] = useState<"normal" | "urgente" | "motoboy">("normal");
  const [salvando, setSalvando] = useState<"so" | "fabrica" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const pronto = useRef(false);

  const mudar = useCallback((m: Partial<RascunhoDoBalcao>) => setR((x) => ({ ...x, ...m, mexido_em: new Date().toISOString() })), []);

  // Ao abrir um pedido novo: há outro começado neste aparelho? E quem atendeu da última vez.
  useEffect(() => {
    if (!editando) {
      const aberto = ler<string>(CHAVE_ABERTO);
      const antigo = aberto ? ler<RascunhoDoBalcao>(chaveDoRascunho(aberto)) : null;
      if (antigo && temConteudo(antigo) && (!minhaLoja || antigo.loja === minhaLoja)) setPendente(antigo);
      else if (aberto) gravar(chaveDoRascunho(aberto), null);
    } else {
      const guardado = ler<RascunhoDoBalcao>(chaveDoRascunho(editando.id));
      if (guardado && inicial && guardado.mexido_em > inicial.mexido_em) setPendente(guardado);
    }
    setR((x) => {
      if (x.vendedor) return x;
      const ultimo = x.loja ? ler<string>(chaveDoVendedor(x.loja)) : null;
      return ultimo && vendedoresIniciais.some((v) => v.id === ultimo && v.ativo) ? { ...x, vendedor: ultimo } : x;
    });
    pronto.current = true;
    // Só ao montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda no aparelho a cada mudança (depois de decidir sobre o rascunho antigo).
  useEffect(() => {
    if (!pronto.current || pendente) return;
    const t = setTimeout(() => {
      if (!temConteudo(r)) return;
      gravar(chaveDoRascunho(r.id), r);
      if (!editando) gravar(CHAVE_ABERTO, r.id);
    }, 400);
    return () => clearTimeout(t);
  }, [r, pendente, editando]);

  const continuar = () => {
    if (!pendente) return;
    setR(pendente);
    setVersao((v) => v + 1);
    setPendente(null);
  };
  const descartar = () => {
    if (pendente && !editando) gravar(chaveDoRascunho(pendente.id), null);
    if (editando) gravar(chaveDoRascunho(editando.id), null);
    setPendente(null);
  };

  const precisaLoja = !minhaLoja && !editando;
  const daLoja = vendedores.filter((v) => v.loja === r.loja && (v.ativo || v.id === r.vendedor));
  const total = lerValor(r.total);
  const falta = faltaNoRascunho(r, precisaLoja);
  const pagoAgora = r.pagamento ? lerValor(r.pagamento.valor) ?? 0 : 0;

  const escolherVendedor = (id: string) => {
    mudar({ vendedor: id });
    if (r.loja) gravar(chaveDoVendedor(r.loja), id);
  };

  const salvar = async (mandar: boolean) => {
    setTentouSalvar(true);
    if (falta.length) {
      setErro(`Falta ${emPortugues(falta)}.`);
      return;
    }
    setErro(null);
    setSalvando(mandar ? "fabrica" : "so");
    try {
      const res = await salvarPedidoDoBalcao(r, mandar ? { prioridade } : null);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      gravar(chaveDoRascunho(r.id), null);
      if (!editando && ler<string>(CHAVE_ABERTO) === r.id) gravar(CHAVE_ABERTO, null);
      const aviso = res.avisoDaFabrica ? `&aviso=${encodeURIComponent(res.avisoDaFabrica)}` : "";
      router.push(`/admin/balcao/${res.id}?salvo=${res.fabrica ? "fabrica" : "1"}${aviso}`);
      router.refresh();
    } catch {
      setErro("Sem internet agora. O pedido está guardado neste aparelho: tente salvar de novo quando a rede voltar.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-6">
      <header className="mb-3">
        <p className="eyebrow">{r.loja || "Balcão da loja"}</p>
        <h1 className="text-xl font-semibold text-ink">{editando ? `Editar ${numeroDoPedido(editando.numero)}` : "Pedido novo"}</h1>
      </header>

      {pendente ? (
        <div role="status" className="glass mb-3 rounded-[16px] p-4">
          <p className="text-sm font-semibold text-ink">
            {editando ? "Este pedido tem mudanças guardadas neste aparelho que não foram salvas." : `Tem um pedido começado neste aparelho${pendente.cliente_nome ? `, de ${pendente.cliente_nome}` : ""}, mexido ${minutosAtras(pendente.mexido_em)}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={continuar} className={chip(true)}>
              <RotateCcw size={15} aria-hidden="true" /> {editando ? "Usar as mudanças" : "Continuar esse"}
            </button>
            <button type="button" onClick={descartar} className={chip(false)}>
              {editando ? "Descartar" : "Começar outro"}
            </button>
          </div>
        </div>
      ) : null}

      <div className={`space-y-3 ${pendente ? "pointer-events-none opacity-40" : ""}`} aria-hidden={pendente ? true : undefined}>
        {precisaLoja ? (
          <Secao titulo="Loja">
            <select value={r.loja} onChange={(e) => mudar({ loja: e.target.value, vendedor: "" })} className={campo} aria-label="Loja do pedido">
              <option value="">Escolha a loja</option>
              {lojas.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Secao>
        ) : null}

        <Secao titulo="Quem atendeu" alerta={tentouSalvar && !r.vendedor}>
          {r.loja ? (
            <QuemAtendeu
              vendedores={daLoja}
              escolhido={r.vendedor}
              escolher={escolherVendedor}
              loja={r.loja}
              aoCriar={(v) => {
                setVendedores((l) => [...l.filter((x) => x.id !== v.id), v]);
                escolherVendedor(v.id);
              }}
            />
          ) : (
            <p className="text-sm text-muted">Escolha a loja primeiro.</p>
          )}
        </Secao>

        <FotoDoPapel
          fotos={r.fotos}
          transcricao={r.transcricao}
          aoGuardar={(caminho) => setR((x) => ({ ...x, fotos: [...x.fotos, caminho].slice(0, 4), mexido_em: new Date().toISOString() }))}
          aoLer={(s) => {
            setR((x) => ({
              ...x,
              transcricao: s.transcricao || x.transcricao,
              cliente_nome: x.cliente_nome || s.cliente_nome || "",
              cliente_telefone: x.cliente_telefone || (s.cliente_telefone ?? ""),
              numero_papel: x.numero_papel || (s.numero_papel ?? ""),
              prazo: x.prazo || (s.prazo && /^\d{4}-\d{2}-\d{2}$/.test(s.prazo) && s.prazo >= hoje ? s.prazo : ""),
              observacao: x.observacao || (s.relato ?? ""),
              producao: editando?.naFabrica ? x.producao : pecasDaSugestao(s, x.producao),
              mexido_em: new Date().toISOString(),
            }));
            setVersao((v) => v + 1);
          }}
          tirar={(c) => setR((x) => ({ ...x, fotos: x.fotos.filter((f) => f !== c) }))}
        />

        <Cliente r={r} mudar={mudar} hoje={hoje} alertar={tentouSalvar} />

        <Secao titulo="Peças e entrega">
          {editando?.naFabrica ? (
            <p className="rounded-[12px] bg-ink/[0.04] p-3 text-sm leading-relaxed text-ink">
              Este pedido já está na fábrica: as peças e a entrega não mudam por aqui. Para mudar, peça a alteração na tela do pedido, e a fábrica confirma que viu.
            </p>
          ) : (
            <ProducaoDaVenda
              key={`p${versao}`}
              produtos={produtos}
              lojas={lojas}
              sempreLigada
              inicial={r.producao}
              aoMudar={(producao) => setR((x) => (x.producao === producao ? x : { ...x, producao, mexido_em: x.mexido_em }))}
            />
          )}
        </Secao>

        <Secao titulo="Prazo prometido ao cliente">
          <input type="date" value={r.prazo} min={editando ? undefined : hoje} onChange={(e) => mudar({ prazo: e.target.value })} className={`${campo} numeros`} aria-label="Prazo prometido" />
          <div className="mt-2 flex flex-wrap gap-2">
            {[7, 15, 20, 30].map((d) => {
              const dia = somarDias(hoje, d);
              return (
                <button key={d} type="button" onClick={() => mudar({ prazo: dia })} className={chip(r.prazo === dia)}>
                  {d} dias
                </button>
              );
            })}
          </div>
          {!editando?.naFabrica ? (
            <div className="mt-3">
              <span className={rotulo}>Urgência para a fábrica</span>
              <div className="flex flex-wrap gap-2">
                {(["normal", "urgente", "motoboy"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPrioridade(p)} className={chip(prioridade === p)} aria-pressed={prioridade === p}>
                    {p === "normal" ? "Normal" : p === "urgente" ? "Urgente" : "Motoboy"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Secao>

        <Secao titulo="Valor" alerta={tentouSalvar && !total}>
          <label className={rotulo} htmlFor="balcao-total">Total do pedido</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted">R$</span>
            <input
              id="balcao-total"
              value={r.total}
              onChange={(e) => mudar({ total: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) })}
              inputMode="decimal"
              placeholder="0,00"
              className={`${campo} numeros pl-10 text-lg font-semibold`}
            />
          </div>
          {editando ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">Pagamentos (parcela, saldo na retirada) ficam na tela do pedido.</p>
          ) : (
            <PagoAgora r={r} mudar={mudar} total={total} />
          )}
        </Secao>

        <Anexos pedido={r.id} anexos={r.anexos} mudar={(anexos) => mudar({ anexos })} />

        <Secao titulo="Mais detalhes">
          <label className={rotulo} htmlFor="balcao-obs">Observação</label>
          <textarea id="balcao-obs" value={r.observacao} onChange={(e) => mudar({ observacao: e.target.value.slice(0, 1000) })} rows={3} placeholder="O que a fábrica ou a loja precisa saber" className={`${campo} py-2.5`} />
          <label className={`${rotulo} mt-3`} htmlFor="balcao-papel">Número da OS de papel</label>
          <input id="balcao-papel" value={r.numero_papel} onChange={(e) => mudar({ numero_papel: e.target.value.slice(0, 30) })} inputMode="numeric" placeholder="Se tiver" className={`${campo} numeros`} />
        </Secao>
      </div>

      {/* A barra de salvar fica sempre à vista, acima da barra de baixo do celular. */}
      <div className="sticky bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-4">
        <div className="glass rounded-[18px] px-3 py-2.5 shadow-lg">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted">Total <strong className="numeros text-ink">{total ? dinheiro(total) : "R$ 0,00"}</strong></span>
            {!editando && total ? (
              <span className="text-muted">
                {pagoAgora > 0 ? <>Falta <strong className="numeros text-ink">{dinheiro(Math.max(0, total - pagoAgora))}</strong></> : "Nada pago agora"}
              </span>
            ) : null}
          </div>
          {erro ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-[#b01919]">{erro}</p>
          ) : falta.length && tentouSalvar ? (
            <p className="mt-2 text-sm font-semibold text-[#9a4a07]">Falta {emPortugues(falta)}.</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={Boolean(salvando) || Boolean(pendente)} onClick={() => void salvar(false)} className={`painel-toque inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold disabled:opacity-60 ${editando?.naFabrica ? "painel-aba-ativa flex-1 border-transparent" : "shrink-0 border-ink/15 bg-white text-ink"}`}>
              {salvando === "so" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {editando ? "Salvar" : "Só salvar"}
            </button>
            {!editando?.naFabrica ? (
              <button type="button" disabled={Boolean(salvando) || Boolean(pendente)} onClick={() => void salvar(true)} aria-label="Salvar e mandar para a fábrica" className="painel-toque painel-aba-ativa inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-60">
                {salvando === "fabrica" ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" /> : <Factory size={16} className="shrink-0" aria-hidden="true" />}
                <span className="truncate">Mandar à fábrica</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children, alerta = false }: { titulo: string; children: React.ReactNode; alerta?: boolean }) {
  return (
    <section className={`glass min-w-0 rounded-[18px] p-4 ${alerta ? "ring-2 ring-[#9a4a07]/60" : ""}`}>
      <h2 className="mb-2 text-sm font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

function QuemAtendeu({ vendedores, escolhido, escolher, loja, aoCriar }: {
  vendedores: VendedorDaLoja[];
  escolhido: string;
  escolher: (id: string) => void;
  loja: string;
  aoCriar: (v: VendedorDaLoja) => void;
}) {
  const [novo, setNovo] = useState<string | null>(vendedores.length ? null : "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const criar = async () => {
    if (!novo || novo.trim().length < 2) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await salvarVendedor(null, loja, novo, true);
      if (r.ok) {
        aoCriar({ id: r.id, loja, nome: novo.trim().replace(/\s+/g, " "), ativo: true });
        setNovo(null);
      } else setErro(r.erro);
    } catch {
      setErro("Sem internet agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quem atendeu">
        {vendedores.map((v) => (
          <button key={v.id} type="button" role="radio" aria-checked={escolhido === v.id} onClick={() => escolher(v.id)} className={chip(escolhido === v.id)}>
            <UserRound size={15} aria-hidden="true" /> {v.nome}
          </button>
        ))}
        {novo === null ? (
          <button type="button" onClick={() => setNovo("")} className={chip(false)}>
            <Plus size={15} aria-hidden="true" /> Vendedor
          </button>
        ) : null}
      </div>
      {novo !== null ? (
        <div className="mt-2 flex gap-2">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value.slice(0, 60))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void criar();
              }
            }}
            placeholder="Nome de quem atende"
            aria-label="Nome do vendedor novo"
            autoFocus={vendedores.length > 0}
            className={campo}
          />
          <button type="button" onClick={() => void criar()} disabled={ocupado || (novo ?? "").trim().length < 2} className="painel-toque painel-aba-ativa inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-sm font-semibold disabled:opacity-60">
            {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : "Pôr"}
          </button>
        </div>
      ) : null}
      {erro ? <p role="alert" className="mt-2 text-sm font-semibold text-[#b01919]">{erro}</p> : null}
    </div>
  );
}

function FotoDoPapel({ fotos, transcricao, aoGuardar, aoLer, tirar }: {
  fotos: string[];
  transcricao: string;
  aoGuardar: (caminho: string) => void;
  aoLer: (s: SugestaoDaFoto) => void;
  tirar: (caminho: string) => void;
}) {
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const escolher = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setLendo(true);
    setAviso(null);
    try {
      const novas = [...lista].slice(0, 4 - fotos.length);
      for (let k = 0; k < novas.length; k++) {
        const ler = fotos.length === 0 && k === 0;
        const res = await lerFotoDoPapel(await fotoEmDataUrl(novas[k]), ler);
        if (!res.ok) {
          setAviso({ tom: "ruim", texto: res.erro });
          break;
        }
        aoGuardar(res.caminho);
        if (res.aviso) setAviso({ tom: "ruim", texto: res.aviso });
        if (res.sugestao) {
          aoLer(res.sugestao);
          setAviso({ tom: "bom", texto: "A IA preencheu o que conseguiu ler. Confira cada campo antes de salvar." });
        }
      }
    } catch {
      setAviso({ tom: "ruim", texto: "Não deu para mandar a foto. Confira a internet e tente de novo, ou preencha à mão." });
    } finally {
      setLendo(false);
    }
  };
  return (
    <section className="min-w-0 rounded-[18px] border border-dashed border-ink/20 bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Anotou no papel?</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">Tire a foto do pedido escrito: a IA preenche o que der, e a foto vai junto para a fábrica.</p>
        </div>
        <label className={`painel-toque inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm font-semibold text-ink ${lendo || fotos.length >= 4 ? "pointer-events-none opacity-60" : ""}`}>
          {lendo ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
          {lendo ? "Lendo..." : fotos.length ? "Mais uma" : "Foto"}
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { void escolher(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {fotos.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <li key={f} className="inline-flex items-center gap-1 rounded-full bg-[#e3f4ec] px-3 py-1 text-xs font-semibold text-[#046c4e]">
              <Check size={12} aria-hidden="true" /> Foto {i + 1}
              <button type="button" onClick={() => tirar(f)} className="ml-1 rounded-full p-1" aria-label={`Tirar a foto ${i + 1}`}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {aviso ? <p role="status" className={`mt-2 text-xs font-semibold ${aviso.tom === "bom" ? "text-[#046c4e]" : "text-[#9a4a07]"}`}>{aviso.texto}</p> : null}
      {transcricao ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold text-muted">O que a IA leu</summary>
          <p className="mt-1 whitespace-pre-line text-ink [overflow-wrap:anywhere]">{transcricao}</p>
        </details>
      ) : null}
    </section>
  );
}

function Cliente({ r, mudar, hoje, alertar }: { r: RascunhoDoBalcao; mudar: (m: Partial<RascunhoDoBalcao>) => void; hoje: string; alertar: boolean }) {
  const [conhecido, setConhecido] = useState<ClienteConhecido>(null);
  const [procurando, setProcurando] = useState(false);
  const tel = telefoneParaLink(r.cliente_telefone);
  const ultimoTel = useRef<string | null>(null);
  const nomeRef = useRef(r.cliente_nome);
  nomeRef.current = r.cliente_nome;

  useEffect(() => {
    if (!tel || tel === ultimoTel.current) return;
    ultimoTel.current = tel;
    let vivo = true;
    setProcurando(true);
    buscarCliente(tel)
      .then((c) => {
        if (!vivo) return;
        setConhecido(c && (c.nome || c.pedidos.length || c.compras_no_site) ? c : null);
        if (c?.nome && !nomeRef.current.trim()) mudar({ cliente_nome: c.nome, ...(c.email ? { cliente_email: c.email } : {}) });
      })
      .catch(() => {})
      .finally(() => vivo && setProcurando(false));
    return () => {
      vivo = false;
    };
  }, [tel, mudar]);

  const motivo = MOTIVOS.find((m) => m.chave === r.motivo);
  return (
    <Secao titulo="Cliente" alerta={alertar && (!tel || r.cliente_nome.trim().length < 2)}>
      <label className={rotulo} htmlFor="balcao-tel">WhatsApp</label>
      <div className="relative">
        <input
          id="balcao-tel"
          value={r.cliente_telefone}
          onChange={(e) => mudar({ cliente_telefone: e.target.value.replace(/[^\d()\s+-]/g, "").slice(0, 20) })}
          onBlur={() => tel && mudar({ cliente_telefone: telefoneNaTela(tel) })}
          inputMode="tel"
          autoComplete="off"
          placeholder="(11) 99999-9999"
          className={`${campo} numeros`}
        />
        {procurando ? <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-hidden="true" /> : null}
      </div>
      {conhecido ? (
        <p role="status" className="mt-2 rounded-[10px] bg-[#e3f4ec] px-3 py-2 text-xs leading-relaxed text-[#046c4e]">
          <strong>Cliente conhecido.</strong>{" "}
          {conhecido.pedidos.length ? `${conhecido.pedidos.length === 1 ? "1 pedido" : `${conhecido.pedidos.length} pedidos`} nas lojas, o último ${numeroDoPedido(conhecido.pedidos[0].numero)} em ${conhecido.pedidos[0].loja}. ` : ""}
          {conhecido.compras_no_site ? `${conhecido.compras_no_site === 1 ? "1 compra" : `${conhecido.compras_no_site} compras`} no site.` : ""}
        </p>
      ) : null}

      <label className={`${rotulo} mt-3`} htmlFor="balcao-nome">Nome</label>
      <input id="balcao-nome" value={r.cliente_nome} onChange={(e) => mudar({ cliente_nome: e.target.value.slice(0, 120) })} autoComplete="off" autoCapitalize="words" placeholder="Nome e sobrenome" className={campo} />

      <span className={`${rotulo} mt-3`}>Para quê</span>
      <div className="flex flex-wrap gap-2">
        {MOTIVOS.map((m) => (
          <button key={m.chave} type="button" onClick={() => mudar({ motivo: r.motivo === m.chave ? "" : (m.chave as Motivo) })} className={chip(r.motivo === m.chave)} aria-pressed={r.motivo === m.chave}>
            {m.nome}
          </button>
        ))}
      </div>
      {motivo?.data ? (
        <>
          <label className={`${rotulo} mt-3`} htmlFor="balcao-data">{motivo.data}</label>
          <input id="balcao-data" type="date" value={r.data_especial} onChange={(e) => mudar({ data_especial: e.target.value })} className={`${campo} numeros`} />
          {r.data_especial && r.data_especial >= hoje ? <p className="mt-1 text-xs text-muted">Vira oportunidade de chamar o cliente perto da data.</p> : null}
        </>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-muted">E-mail (se o cliente quiser)</summary>
        <input value={r.cliente_email} onChange={(e) => mudar({ cliente_email: e.target.value.trim().slice(0, 160) })} type="email" inputMode="email" autoComplete="off" placeholder="nome@email.com" className={`${campo} mt-2`} aria-label="E-mail do cliente" />
      </details>
    </Secao>
  );
}

function PagoAgora({ r, mudar, total }: { r: RascunhoDoBalcao; mudar: (m: Partial<RascunhoDoBalcao>) => void; total: number | null }) {
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const p = r.pagamento;
  const modo = !p ? "nada" : total && lerValor(p.valor) === total ? "tudo" : "sinal";
  const base = (valor: string) => ({ chave: p?.chave ?? novoId(), valor, forma: p?.forma ?? ("pix" as FormaDePagamento), parcelas: p?.parcelas ?? 1, comprovante: p?.comprovante ?? null });
  const sugerido = sinalSugerido(total);

  const comprovante = async (lista: FileList | null) => {
    const arq = lista?.[0];
    if (!arq || !p) return;
    setSubindo(true);
    setErro(null);
    try {
      const res = await subirArquivo(r.id, arq);
      if (res.ok) mudar({ pagamento: { ...p, comprovante: res.caminho } });
      else setErro(res.erro);
    } catch {
      setErro("A internet falhou no envio. Tente de novo.");
    } finally {
      setSubindo(false);
    }
  };

  return (
    <div className="mt-3">
      <span className={rotulo}>Pagou agora?</span>
      <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-ink/[0.05] p-1" role="radiogroup" aria-label="Pagou agora">
        {([
          ["nada", "Nada"],
          ["sinal", "Sinal"],
          ["tudo", "Tudo"],
        ] as const).map(([k, nome]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={modo === k}
            onClick={() => {
              if (k === "nada") mudar({ pagamento: null });
              else if (k === "tudo") mudar({ pagamento: base(total ? String(total).replace(".", ",") : "") });
              else mudar({ pagamento: base(modo === "sinal" && p ? p.valor : sugerido ? String(sugerido) : "") });
            }}
            className={`min-h-11 rounded-[9px] text-sm font-semibold ${modo === k ? "bg-white text-ink shadow-sm" : "text-ink/60"}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {p ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className={rotulo} htmlFor="balcao-pago">Valor pago agora</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted">R$</span>
              <input id="balcao-pago" value={p.valor} onChange={(e) => mudar({ pagamento: { ...p, valor: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) } })} inputMode="decimal" placeholder="0,00" className={`${campo} numeros pl-10 font-semibold`} />
            </div>
            {modo === "sinal" && sugerido ? <p className="mt-1 text-xs text-muted">Metade do total: {dinheiro(sugerido)}.</p> : null}
          </div>
          <div>
            <span className={rotulo}>Forma</span>
            <div className="flex flex-wrap gap-2">
              {FORMAS.map((f) => (
                <button key={f.chave} type="button" onClick={() => mudar({ pagamento: { ...p, forma: f.chave, parcelas: f.chave === "credito" ? p.parcelas : 1 } })} className={chip(p.forma === f.chave)} aria-pressed={p.forma === f.chave}>
                  {f.curto}
                </button>
              ))}
            </div>
          </div>
          {p.forma === "credito" ? (
            <div>
              <label className={rotulo} htmlFor="balcao-parcelas">Parcelas</label>
              <select id="balcao-parcelas" value={p.parcelas} onChange={(e) => mudar({ pagamento: { ...p, parcelas: Number(e.target.value) } })} className={campo}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <label className={`painel-toque inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm font-semibold text-ink ${subindo ? "pointer-events-none opacity-60" : ""}`}>
              {subindo ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}
              {p.comprovante ? "Trocar comprovante" : "Foto do comprovante"}
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { void comprovante(e.target.files); e.target.value = ""; }} />
            </label>
            {p.comprovante ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#046c4e]">
                <Check size={13} aria-hidden="true" /> Comprovante guardado
              </span>
            ) : null}
          </div>
          {erro ? <p role="alert" className="text-sm font-semibold text-[#b01919]">{erro}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Anexos({ pedido, anexos, mudar }: { pedido: string; anexos: AnexoDoRascunho[]; mudar: (a: AnexoDoRascunho[]) => void }) {
  const [subindo, setSubindo] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const atuais = useRef(anexos);
  atuais.current = anexos;
  const escolher = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setErro(null);
    const arquivos = [...lista].slice(0, 10);
    setSubindo(arquivos.length);
    for (const arq of arquivos) {
      try {
        const res = await subirArquivo(pedido, arq);
        if (res.ok) mudar([...atuais.current, { caminho: res.caminho, tipo: arq.type.startsWith("image/") ? "foto" : "documento", nome: res.nome }]);
        else setErro(res.erro);
      } catch {
        setErro("A internet falhou no envio. Tente de novo.");
      }
      setSubindo((n) => n - 1);
    }
  };
  const lista = useMemo(() => anexos, [anexos]);
  return (
    <Secao titulo="Anexos">
      <p className="text-xs leading-relaxed text-muted">Foto da peça do cliente, documento, o que precisar ficar junto do pedido.</p>
      {lista.length ? (
        <ul className="mt-2 space-y-1.5">
          {lista.map((a) => (
            <li key={a.caminho} className="flex items-center gap-2 rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm">
              {a.tipo === "foto" ? <Camera size={15} className="shrink-0 text-muted" aria-hidden="true" /> : <FileText size={15} className="shrink-0 text-muted" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate">{a.nome}</span>
              <button type="button" onClick={() => mudar(lista.filter((x) => x.caminho !== a.caminho))} className="rounded-full p-2 text-muted hover:text-[#b01919]" aria-label={`Tirar ${a.nome}`}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className={`painel-toque mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm font-semibold text-ink ${subindo ? "pointer-events-none opacity-60" : ""}`}>
        {subindo ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Paperclip size={15} aria-hidden="true" />}
        {subindo ? `Enviando ${subindo}...` : "Anexar foto ou PDF"}
        <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => { void escolher(e.target.files); e.target.value = ""; }} />
      </label>
      {erro ? <p role="alert" className="mt-2 text-sm font-semibold text-[#b01919]">{erro}</p> : null}
    </Secao>
  );
}
