"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, Factory, FileText, HandCoins, Loader2, MessageCircle, Package, Paperclip, Pencil,
  Store, Undo2, X,
} from "lucide-react";
import { SeloDeTom } from "../../Pecas";
import {
  FORMAS, MOTIVOS, atrasado, avisoDeChegada, dataCurta, dinheiro, lerValor, linkDoWhatsapp, nomeDaForma, numeroDoPedido, pagamento,
  pecaEmTexto, resumoParaOCliente, situacao, telefoneNaTela,
  type FormaDePagamento, type PedidoDoBalcao,
} from "@/lib/balcao/regras";
import { anexarAoPedido, estornarPagamento, mandarParaFabrica, marcarPedido, pedirAlteracao, receberPagamento, tirarAnexo, verArquivo } from "../actions";
import { novoId, subirArquivo } from "../arquivos";

const campo = "w-full rounded-[12px] border border-border bg-white px-3 text-base text-ink min-h-12";
const rotulo = "block pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted";
const botao = (forte = false) =>
  `painel-toque inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold disabled:opacity-60 ${forte ? "painel-aba-ativa" : "border border-ink/15 bg-white text-ink"}`;
const chip = (ativo: boolean) =>
  `painel-toque inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold ${ativo ? "border-transparent painel-aba-ativa" : "border-ink/12 bg-white text-ink"}`;

type Resposta = { ok: true; dados: PedidoDoBalcao } | { ok: false; erro: string };

/**
 * Um pedido do balcão (cartão 71). Em cima, o que a loja precisa fazer AGORA
 * (mandar para a fábrica, marcar que chegou, entregar recebendo o saldo); no
 * meio, a linha do pedido; embaixo, peças, dinheiro e anexos. Cada botão chama
 * o banco e a tela troca pelo pedido que ele devolve.
 */
export function PedidoDoBalcaoNaTela({ inicial, hoje, salvo, aviso }: { inicial: PedidoDoBalcao; hoje: string; salvo: "so" | "fabrica" | null; aviso: string | null }) {
  const router = useRouter();
  const [p, setP] = useState(inicial);
  const [erro, setErro] = useState<string | null>(aviso);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [painel, setPainel] = useState<null | "receber" | "entregar" | "cancelar" | "alterar" | "fabrica">(null);
  useEffect(() => setP(inicial), [inicial]);

  const s = situacao(p);
  const g = pagamento(p);
  const tarde = atrasado(p, hoje);
  const motivo = MOTIVOS.find((m) => m.chave === p.motivo);

  const agir = async (chave: string, f: () => Promise<Resposta>, depois?: () => void) => {
    setOcupado(chave);
    setErro(null);
    try {
      const r = await f();
      if (r.ok) {
        setP(r.dados);
        depois?.();
        router.refresh();
      } else setErro(r.erro);
    } catch {
      setErro("Sem internet agora. Nada foi mudado: tente de novo.");
    } finally {
      setOcupado(null);
    }
  };

  const zap = (texto: string) => linkDoWhatsapp(p.cliente_telefone, texto);

  return (
    <div className="mx-auto w-full max-w-2xl pb-8">
      <Link href="/admin/balcao" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> Balcão
      </Link>

      {salvo ? (
        <p role="status" className="mt-2 flex items-center gap-2 rounded-[12px] bg-[#e3f4ec] px-3 py-2 text-sm font-semibold text-[#046c4e]">
          <CheckCircle2 size={16} aria-hidden="true" /> {salvo === "fabrica" ? `Pedido salvo e na fábrica${p.os ? ` (OS ${p.os})` : ""}.` : "Pedido salvo."}
        </p>
      ) : null}

      <header className="mt-2">
        <p className="eyebrow">{p.loja} · {numeroDoPedido(p.numero)}</p>
        <h1 className="text-2xl font-semibold text-ink [overflow-wrap:anywhere]">{p.cliente_nome}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SeloDeTom tom={s.tom}>{s.nome}</SeloDeTom>
          {!p.cancelado_em ? <SeloDeTom tom={g.chave === "pago" ? "bom" : g.chave === "nada" ? "ruim" : "atencao"}>{g.chave === "sinal" ? `Falta ${dinheiro(g.falta)}` : g.nome}</SeloDeTom> : null}
          {tarde ? <SeloDeTom tom="ruim"><AlertTriangle size={11} aria-hidden="true" /> Prazo era {dataCurta(p.prazo, hoje)}</SeloDeTom> : null}
        </div>
        <p className="mt-2 text-sm text-muted">{s.frase}</p>
      </header>

      {erro ? <p role="alert" className="mt-3 rounded-[12px] bg-[#fde8e8] px-3 py-2 text-sm font-semibold text-[#b01919]">{erro}</p> : null}

      {/* O que fazer agora */}
      {!p.cancelado_em ? (
        <section className="glass mt-4 rounded-[18px] p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {s.chave === "anotado" ? (
              <button type="button" className={`${botao(true)} sm:col-span-2`} onClick={() => setPainel(painel === "fabrica" ? null : "fabrica")}>
                <Factory size={18} aria-hidden="true" /> Mandar para a fábrica
              </button>
            ) : null}
            {s.chave === "na_fabrica" || s.chave === "saiu_da_fabrica" ? (
              p.entrega === "retirada" ? (
                <button type="button" className={`${botao(s.chave === "saiu_da_fabrica")} sm:col-span-2`} disabled={Boolean(ocupado)} onClick={() => void agir("recebido", () => marcarPedido(p.id, "recebido"))}>
                  {ocupado === "recebido" ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Store size={18} aria-hidden="true" />} Chegou na loja
                </button>
              ) : (
                <button type="button" className={`${botao(s.chave === "saiu_da_fabrica")} sm:col-span-2`} onClick={() => setPainel("entregar")}>
                  <Package size={18} aria-hidden="true" /> O cliente recebeu
                </button>
              )
            ) : null}
            {s.chave === "na_loja" ? (
              <>
                {zap(avisoDeChegada(p)) ? (
                  <a href={zap(avisoDeChegada(p))!} target="_blank" rel="noopener noreferrer" className={botao(false)}>
                    <MessageCircle size={18} aria-hidden="true" /> Avisar que chegou
                  </a>
                ) : null}
                <button type="button" className={botao(true)} onClick={() => setPainel("entregar")}>
                  <Check size={18} aria-hidden="true" /> Entregar ao cliente
                </button>
              </>
            ) : null}
            {s.chave === "entregue" ? (
              <button type="button" className={`${botao(false)} sm:col-span-2`} disabled={Boolean(ocupado)} onClick={() => void agir("desfazer", () => marcarPedido(p.id, "desfazer"))}>
                {ocupado === "desfazer" ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Undo2 size={18} aria-hidden="true" />} Desfazer a entrega
              </button>
            ) : null}
          </div>

          {painel === "fabrica" ? (
            <MandarParaFabrica ocupado={ocupado === "fabrica"} fechar={() => setPainel(null)} mandar={(pri) => void agir("fabrica", () => mandarParaFabrica(p.id, pri), () => setPainel(null))} />
          ) : null}
          {painel === "entregar" ? (
            <Entregar
              p={p}
              ocupado={ocupado}
              fechar={() => setPainel(null)}
              receber={(pag) => agir("receber", () => receberPagamento(p.id, pag))}
              entregar={(motivo) => void agir("entregue", () => marcarPedido(p.id, "entregue", motivo), () => setPainel(null))}
            />
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            {zap(resumoParaOCliente(p, hoje)) ? (
              <a href={zap(resumoParaOCliente(p, hoje))!} target="_blank" rel="noopener noreferrer" className={chip(false)}>
                <MessageCircle size={15} aria-hidden="true" className="mr-1.5" /> Mandar o resumo ao cliente
              </a>
            ) : null}
            {g.falta > 0 && painel !== "entregar" ? (
              <button type="button" className={chip(painel === "receber")} onClick={() => setPainel(painel === "receber" ? null : "receber")}>
                <HandCoins size={15} aria-hidden="true" className="mr-1.5" /> Receber pagamento
              </button>
            ) : null}
          </div>
          {painel === "receber" ? <Receber falta={g.falta} pedido={p.id} ocupado={ocupado === "receber"} fechar={() => setPainel(null)} receber={(pag) => void agir("receber", () => receberPagamento(p.id, pag), () => setPainel(null))} /> : null}
        </section>
      ) : (
        <p className="mt-4 rounded-[12px] bg-ink/[0.05] px-3 py-2 text-sm text-ink">Cancelado{p.cancelado_motivo ? `: ${p.cancelado_motivo}` : "."}</p>
      )}

      <Linha p={p} hoje={hoje} />

      <Bloco titulo="Cliente">
        <p className="text-base font-semibold text-ink">{p.cliente_nome}</p>
        <a href={`https://wa.me/${p.cliente_telefone}`} target="_blank" rel="noopener noreferrer" className="numeros mt-0.5 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[var(--setor)]">
          <MessageCircle size={15} aria-hidden="true" /> {telefoneNaTela(p.cliente_telefone)}
        </a>
        {p.cliente_email ? <p className="text-sm text-muted [overflow-wrap:anywhere]">{p.cliente_email}</p> : null}
        {motivo ? <p className="mt-1 text-sm text-ink">{motivo.nome}{p.data_especial && motivo.data ? ` · ${motivo.data.toLowerCase()}: ${dataCurta(p.data_especial, hoje)}` : ""}</p> : null}
        <p className="mt-2 text-xs text-muted">Atendido por <strong className="text-ink">{p.vendedor_nome}</strong>{p.criado_por_nome ? `, lançado por ${p.criado_por_nome}` : ""}.</p>
      </Bloco>

      <Bloco titulo="Pedido">
        <ul className="space-y-2">
          {p.pecas.map((x, i) => (
            <li key={i} className="rounded-[12px] bg-ink/[0.04] px-3 py-2 text-sm text-ink [overflow-wrap:anywhere]">{pecaEmTexto(x)}</li>
          ))}
        </ul>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Entrega</dt>
          <dd className="text-ink">{p.entrega_texto ?? p.entrega}{p.endereco ? ` · ${p.endereco}${p.cidade ? `, ${p.cidade}` : ""}${p.uf ? `/${p.uf}` : ""}` : ""}</dd>
          <dt className="text-muted">Prazo prometido</dt>
          <dd className="numeros text-ink">{p.prazo ? dataCurta(p.prazo, hoje) : "Sem prazo"}</dd>
          {p.os ? (
            <>
              <dt className="text-muted">OS da fábrica</dt>
              <dd className="numeros text-ink">{p.os}</dd>
            </>
          ) : null}
          {p.numero_papel ? (
            <>
              <dt className="text-muted">OS de papel</dt>
              <dd className="numeros text-ink">{p.numero_papel}</dd>
            </>
          ) : null}
        </dl>
        {p.observacao ? <p className="mt-3 whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{p.observacao}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {!p.cancelado_em && !p.entregue_em ? (
            <Link href={`/admin/balcao/${p.id}/editar`} className={chip(false)}>
              <Pencil size={14} aria-hidden="true" className="mr-1.5" /> Editar
            </Link>
          ) : null}
          {p.fabrica_em && !p.entregue_em && !p.cancelado_em ? (
            <button type="button" className={chip(painel === "alterar")} onClick={() => setPainel(painel === "alterar" ? null : "alterar")}>
              <Factory size={14} aria-hidden="true" className="mr-1.5" /> Pedir alteração à fábrica
            </button>
          ) : null}
        </div>
        {painel === "alterar" ? <PedirAlteracao ocupado={ocupado === "alterar"} fechar={() => setPainel(null)} pedir={(t) => void agir("alterar", () => pedirAlteracao(p.id, t), () => setPainel(null))} /> : null}
        {p.alteracoes?.length ? (
          <ul className="mt-3 space-y-1.5">
            {p.alteracoes.map((a) => (
              <li key={a.id} className="rounded-[10px] border border-ink/10 px-3 py-2 text-sm">
                <p className="text-ink [overflow-wrap:anywhere]">{a.texto}</p>
                <p className={`mt-0.5 text-xs font-semibold ${a.ciente_em ? "text-[#046c4e]" : "text-[#9a4a07]"}`}>{a.ciente_em ? "A fábrica viu" : "Esperando a fábrica ver"}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </Bloco>

      <Dinheiro p={p} ocupado={ocupado} estornar={(id, motivo) => void agir(`estornar-${id}`, () => estornarPagamento(id, motivo))} />

      <Arquivos p={p} anexar={(caminho, tipo, nome) => agir("anexar", () => anexarAoPedido(p.id, caminho, tipo, nome))} tirar={(id) => void agir(`tirar-${id}`, () => tirarAnexo(id))} />

      {!p.cancelado_em && !p.entregue_em ? (
        <div className="mt-6 text-center">
          {painel === "cancelar" ? (
            <Cancelar ocupado={ocupado === "cancelar"} fechar={() => setPainel(null)} cancelar={(m) => void agir("cancelar", () => marcarPedido(p.id, "cancelar", m), () => setPainel(null))} temFabrica={Boolean(p.fabrica_em)} />
          ) : (
            <button type="button" onClick={() => setPainel("cancelar")} className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted hover:text-[#b01919]">
              Cancelar o pedido
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="glass mt-3 min-w-0 rounded-[18px] p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({ p, hoje }: { p: PedidoDoBalcao; hoje: string }) {
  const hora = (iso: string | null) => (iso ? dataCurta(iso.slice(0, 10), hoje) : null);
  const passos = [
    { nome: "Anotado", quando: hora(p.criado_em), feito: true },
    { nome: p.etapa_nome && !p.recebido_em && !p.entregue_em ? `Fábrica: ${p.etapa_nome}` : "Na fábrica", quando: hora(p.fabrica_em), feito: Boolean(p.fabrica_em) },
    ...(p.entrega === "retirada" ? [{ nome: "Chegou na loja", quando: hora(p.recebido_em), feito: Boolean(p.recebido_em) }] : []),
    { nome: "Entregue", quando: hora(p.entregue_em), feito: Boolean(p.entregue_em) },
  ];
  return (
    <ol className="mt-3 grid min-w-0 gap-2 px-1" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }} aria-label="Andamento do pedido">
      {passos.map((x, i) => (
        <li key={i} className="min-w-0 text-center">
          <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${x.feito ? "painel-aba-ativa" : "bg-ink/[0.07] text-muted"}`}>
            {x.feito ? <Check size={14} aria-hidden="true" /> : i + 1}
          </span>
          <span className="mt-1 block text-[0.7rem] font-semibold leading-tight text-ink">{x.nome}</span>
          {x.quando ? <span className="numeros block text-[0.68rem] text-muted">{x.quando}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function MandarParaFabrica({ ocupado, fechar, mandar }: { ocupado: boolean; fechar: () => void; mandar: (p: "normal" | "urgente" | "motoboy") => void }) {
  const [pri, setPri] = useState<"normal" | "urgente" | "motoboy">("normal");
  return (
    <div className="mt-3 rounded-[14px] border border-ink/10 bg-white/70 p-3">
      <p className="text-sm text-ink">A fábrica recebe as peças, a entrega, o prazo e a foto do papel. Valor não vai.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["normal", "urgente", "motoboy"] as const).map((x) => (
          <button key={x} type="button" onClick={() => setPri(x)} className={chip(pri === x)} aria-pressed={pri === x}>
            {x === "normal" ? "Normal" : x === "urgente" ? "Urgente" : "Motoboy"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ocupado} onClick={() => mandar(pri)} className={botao(true)}>
          {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Factory size={17} aria-hidden="true" />} Mandar agora
        </button>
        <button type="button" onClick={fechar} className={botao(false)}>Voltar</button>
      </div>
    </div>
  );
}

function CamposDePagamento({ valor, setValor, forma, setForma, parcelas, setParcelas, comprovante, setComprovante, pedido }: {
  valor: string; setValor: (v: string) => void;
  forma: FormaDePagamento; setForma: (f: FormaDePagamento) => void;
  parcelas: number; setParcelas: (n: number) => void;
  comprovante: string | null; setComprovante: (c: string | null) => void;
  pedido: string;
}) {
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div>
        <label className={rotulo} htmlFor="receber-valor">Valor</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted">R$</span>
          <input id="receber-valor" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, "").slice(0, 12))} inputMode="decimal" className={`${campo} numeros pl-10 font-semibold`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {FORMAS.map((f) => (
          <button key={f.chave} type="button" onClick={() => setForma(f.chave)} className={chip(forma === f.chave)} aria-pressed={forma === f.chave}>{f.curto}</button>
        ))}
      </div>
      {forma === "credito" ? (
        <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className={campo} aria-label="Parcelas">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>
          ))}
        </select>
      ) : null}
      <label className={`painel-toque inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm font-semibold text-ink ${subindo ? "pointer-events-none opacity-60" : ""}`}>
        {subindo ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}
        {comprovante ? "Comprovante guardado: trocar" : "Foto do comprovante"}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={async (e) => {
            const arq = e.target.files?.[0];
            e.target.value = "";
            if (!arq) return;
            setSubindo(true);
            setErro(null);
            try {
              const r = await subirArquivo(pedido, arq);
              if (r.ok) setComprovante(r.caminho);
              else setErro(r.erro);
            } catch {
              setErro("A internet falhou no envio. Tente de novo.");
            } finally {
              setSubindo(false);
            }
          }}
        />
      </label>
      {erro ? <p role="alert" className="text-sm font-semibold text-[#b01919]">{erro}</p> : null}
    </div>
  );
}

function usePagamento(falta: number) {
  const [chave] = useState(novoId);
  const [valor, setValor] = useState(falta > 0 ? String(falta).replace(".", ",") : "");
  const [forma, setForma] = useState<FormaDePagamento>("pix");
  const [parcelas, setParcelas] = useState(1);
  const [comprovante, setComprovante] = useState<string | null>(null);
  return { chave, valor, setValor, forma, setForma, parcelas, setParcelas, comprovante, setComprovante };
}

function Receber({ falta, pedido, ocupado, fechar, receber }: { falta: number; pedido: string; ocupado: boolean; fechar: () => void; receber: (p: { chave: string; valor: string; forma: FormaDePagamento; parcelas: number; comprovante: string | null }) => void }) {
  const f = usePagamento(falta);
  const v = lerValor(f.valor);
  return (
    <div className="mt-3 rounded-[14px] border border-ink/10 bg-white/70 p-3">
      <p className="mb-2 text-sm text-ink">Falta <span className="whitespace-nowrap">{dinheiro(falta)}</span>. Quanto o cliente pagou agora?</p>
      <CamposDePagamento {...f} pedido={pedido} />
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ocupado || !v} onClick={() => receber({ chave: f.chave, valor: f.valor, forma: f.forma, parcelas: f.parcelas, comprovante: f.comprovante })} className={botao(true)}>
          {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <HandCoins size={17} aria-hidden="true" />} Registrar
        </button>
        <button type="button" onClick={fechar} className={botao(false)}>Voltar</button>
      </div>
    </div>
  );
}

function Entregar({ p, ocupado, fechar, receber, entregar }: {
  p: PedidoDoBalcao;
  ocupado: string | null;
  fechar: () => void;
  receber: (pag: { chave: string; valor: string; forma: FormaDePagamento; parcelas: number; comprovante: string | null }) => Promise<void>;
  entregar: (motivo?: string) => void;
}) {
  const g = pagamento(p);
  const f = usePagamento(g.falta);
  const [semPagar, setSemPagar] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (g.falta <= 0) {
    return (
      <div className="mt-3 rounded-[14px] border border-ink/10 bg-white/70 p-3">
        <p className="text-sm text-ink">Está tudo pago. Confirma que {p.cliente_nome.split(" ")[0]} levou a peça?</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={Boolean(ocupado)} onClick={() => entregar()} className={botao(true)}>
            {ocupado === "entregue" ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />} Entregue
          </button>
          <button type="button" onClick={fechar} className={botao(false)}>Voltar</button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-[14px] border border-ink/10 bg-white/70 p-3">
      <p className="mb-2 text-sm font-semibold text-ink">Antes de entregar: falta receber <span className="whitespace-nowrap">{dinheiro(g.falta)}</span>.</p>
      {!semPagar ? (
        <>
          <CamposDePagamento {...f} pedido={p.id} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(ocupado) || !lerValor(f.valor)}
              onClick={async () => {
                await receber({ chave: f.chave, valor: f.valor, forma: f.forma, parcelas: f.parcelas, comprovante: f.comprovante });
              }}
              className={botao(true)}
            >
              {ocupado === "receber" ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <HandCoins size={17} aria-hidden="true" />} Recebi
            </button>
            <button type="button" onClick={() => setSemPagar(true)} className={botao(false)}>Entregar sem receber</button>
          </div>
          <p className="mt-2 text-xs text-muted">Depois de registrar, o botão de entregar fica liberado.</p>
        </>
      ) : (
        <>
          <label className={rotulo} htmlFor="entregar-motivo">Por que entrega com saldo aberto</label>
          <input id="entregar-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 300))} placeholder="Ex.: paga o resto no Pix amanhã" className={campo} />
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={Boolean(ocupado) || motivo.trim().length < 3} onClick={() => entregar(motivo)} className={botao(true)}>
              {ocupado === "entregue" ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : null} Entregar assim
            </button>
            <button type="button" onClick={() => setSemPagar(false)} className={botao(false)}>Voltar</button>
          </div>
        </>
      )}
      <button type="button" onClick={fechar} className="mt-2 min-h-10 text-sm font-semibold text-muted">Fechar</button>
    </div>
  );
}

function PedirAlteracao({ ocupado, fechar, pedir }: { ocupado: boolean; fechar: () => void; pedir: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="mt-3 rounded-[14px] border border-ink/10 bg-white/70 p-3">
      <label className={rotulo} htmlFor="alterar-texto">O que mudar</label>
      <textarea id="alterar-texto" value={t} onChange={(e) => setT(e.target.value.slice(0, 500))} rows={3} placeholder="Ex.: o aro 2 é 19, não 18" className={`${campo} py-2.5`} />
      <p className="mt-1 text-xs text-muted">O cartão fica vermelho na fábrica até alguém de lá marcar que viu.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ocupado || t.trim().length < 3} onClick={() => pedir(t)} className={botao(true)}>
          {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : null} Mandar
        </button>
        <button type="button" onClick={fechar} className={botao(false)}>Voltar</button>
      </div>
    </div>
  );
}

function Cancelar({ ocupado, fechar, cancelar, temFabrica }: { ocupado: boolean; fechar: () => void; cancelar: (m: string) => void; temFabrica: boolean }) {
  const [m, setM] = useState("");
  return (
    <div className="glass rounded-[18px] p-4 text-left">
      <label className={rotulo} htmlFor="cancelar-motivo">Por que cancela</label>
      <input id="cancelar-motivo" value={m} onChange={(e) => setM(e.target.value.slice(0, 300))} placeholder="Ex.: cliente desistiu" className={campo} />
      {temFabrica ? <p className="mt-2 text-xs font-semibold text-[#9a4a07]">O pedido já está na fábrica: avise a fábrica pelo chat para parar a produção.</p> : null}
      <p className="mt-1 text-xs text-muted">Pagamento recebido não some: estorne cada um no bloco Dinheiro, se devolveu ao cliente.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ocupado || m.trim().length < 3} onClick={() => cancelar(m)} className="painel-toque inline-flex min-h-12 items-center gap-2 rounded-full bg-[#b01919] px-5 text-base font-semibold text-white disabled:opacity-60">
          {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <X size={17} aria-hidden="true" />} Cancelar pedido
        </button>
        <button type="button" onClick={fechar} className={botao(false)}>Voltar</button>
      </div>
    </div>
  );
}

function Dinheiro({ p, ocupado, estornar }: { p: PedidoDoBalcao; ocupado: string | null; estornar: (id: string, motivo: string) => void }) {
  const g = pagamento(p);
  const [estornando, setEstornando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [vendo, setVendo] = useState<string | null>(null);
  return (
    <Bloco titulo="Dinheiro">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[12px] bg-ink/[0.04] p-2"><dt className="text-[0.7rem] font-semibold text-muted">Total</dt><dd className="numeros text-sm font-bold text-ink">{dinheiro(g.total)}</dd></div>
        <div className="rounded-[12px] bg-ink/[0.04] p-2"><dt className="text-[0.7rem] font-semibold text-muted">Pago</dt><dd className="numeros text-sm font-bold text-ink">{dinheiro(g.pago)}</dd></div>
        <div className="rounded-[12px] bg-ink/[0.04] p-2"><dt className="text-[0.7rem] font-semibold text-muted">Falta</dt><dd className={`numeros text-sm font-bold ${g.falta > 0 ? "text-[#9a4a07]" : "text-ink"}`}>{dinheiro(Math.max(0, g.falta))}</dd></div>
      </dl>
      {g.chave === "a_mais" ? <p className="mt-2 text-xs font-semibold text-[#9a4a07]">Entrou {dinheiro(-g.falta)} a mais que o total. Confira se o total ou um pagamento foi digitado errado.</p> : null}
      {p.pagamentos.length ? (
        <ul className="mt-3 space-y-1.5">
          {p.pagamentos.map((x) => (
            <li key={x.id} className={`rounded-[10px] border border-ink/10 px-3 py-2 text-sm ${x.estornado_em ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`numeros font-semibold ${x.estornado_em ? "line-through" : "text-ink"}`}>{dinheiro(x.valor)}</span>
                <span className="text-xs text-muted">{nomeDaForma(x.forma)}{x.parcelas > 1 ? ` em ${x.parcelas}x` : ""} · {x.pago_em.slice(8, 10)}/{x.pago_em.slice(5, 7)}</span>
              </div>
              {x.estornado_em ? <p className="mt-0.5 text-xs text-muted">Estornado: {x.estornado_motivo}</p> : null}
              <div className="mt-1 flex flex-wrap gap-3">
                {x.comprovante ? (
                  <button
                    type="button"
                    className="min-h-9 text-xs font-semibold text-[var(--setor)]"
                    onClick={async () => {
                      setVendo(x.id);
                      const url = await verArquivo(x.comprovante!).catch(() => null);
                      setVendo(null);
                      if (url) window.open(url, "_blank", "noopener");
                    }}
                  >
                    {vendo === x.id ? "Abrindo..." : "Ver comprovante"}
                  </button>
                ) : null}
                {!x.estornado_em && estornando !== x.id ? (
                  <button type="button" className="min-h-9 text-xs font-semibold text-muted hover:text-[#b01919]" onClick={() => { setEstornando(x.id); setMotivo(""); }}>
                    Estornar
                  </button>
                ) : null}
              </div>
              {estornando === x.id ? (
                <div className="mt-2 flex gap-2">
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 300))} placeholder="Por quê (ex.: digitado errado)" aria-label="Motivo do estorno" className="min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm" />
                  <button type="button" disabled={motivo.trim().length < 3 || ocupado === `estornar-${x.id}`} onClick={() => estornar(x.id, motivo)} className="min-h-11 shrink-0 rounded-full bg-[#b01919] px-3 text-xs font-semibold text-white disabled:opacity-60">
                    Estornar
                  </button>
                  <button type="button" onClick={() => setEstornando(null)} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-muted">Não</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nenhum pagamento registrado.</p>
      )}
    </Bloco>
  );
}

function Arquivos({ p, anexar, tirar }: { p: PedidoDoBalcao; anexar: (caminho: string, tipo: "documento" | "foto", nome: string) => Promise<void>; tirar: (id: string) => void }) {
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const abrir = async (caminho: string) => {
    setAbrindo(caminho);
    const url = await verArquivo(caminho).catch(() => null);
    setAbrindo(null);
    if (url) window.open(url, "_blank", "noopener");
    else setErro("Não deu para abrir o arquivo agora.");
  };
  const itens = [
    ...p.fotos.map((c, i) => ({ chave: c, caminho: c, nome: `Pedido escrito ${i + 1}`, tipo: "papel" as const, id: null as string | null })),
    ...p.anexos.map((a) => ({ chave: a.id, caminho: a.caminho, nome: a.nome ?? (a.tipo === "comprovante" ? "Comprovante" : "Anexo"), tipo: a.tipo, id: a.tipo === "comprovante" ? null : a.id })),
  ];
  return (
    <Bloco titulo="Arquivos">
      {itens.length ? (
        <ul className="space-y-1.5">
          {itens.map((a) => (
            <li key={a.chave} className="flex items-center gap-2 rounded-[10px] bg-ink/[0.04] px-3 py-1.5 text-sm">
              {a.tipo === "documento" ? <FileText size={15} className="shrink-0 text-muted" aria-hidden="true" /> : <Camera size={15} className="shrink-0 text-muted" aria-hidden="true" />}
              <button type="button" onClick={() => void abrir(a.caminho)} className="min-h-10 min-w-0 flex-1 truncate text-left font-semibold text-ink">
                {abrindo === a.caminho ? "Abrindo..." : a.nome}
              </button>
              {a.id && !p.cancelado_em ? (
                <button type="button" onClick={() => tirar(a.id!)} className="min-h-10 shrink-0 px-2 text-xs font-semibold text-muted hover:text-[#b01919]" aria-label={`Tirar ${a.nome}`}>
                  Tirar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhum arquivo.</p>
      )}
      {!p.cancelado_em ? (
        <label className={`painel-toque mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm font-semibold text-ink ${subindo ? "pointer-events-none opacity-60" : ""}`}>
          {subindo ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Paperclip size={15} aria-hidden="true" />}
          {subindo ? "Enviando..." : "Anexar foto ou PDF"}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={async (e) => {
              const lista = [...(e.target.files ?? [])].slice(0, 10);
              e.target.value = "";
              if (!lista.length) return;
              setSubindo(true);
              setErro(null);
              for (const arq of lista) {
                try {
                  const r = await subirArquivo(p.id, arq);
                  if (r.ok) await anexar(r.caminho, arq.type.startsWith("image/") ? "foto" : "documento", r.nome);
                  else setErro(r.erro);
                } catch {
                  setErro("A internet falhou no envio. Tente de novo.");
                }
              }
              setSubindo(false);
            }}
          />
        </label>
      ) : null}
      {erro ? <p role="alert" className="mt-2 text-sm font-semibold text-[#b01919]">{erro}</p> : null}
    </Bloco>
  );
}
