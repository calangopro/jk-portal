"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bike, Check, CircleAlert, Clock, Copy, ExternalLink, Loader2, MapPin, MessageCircle, PackageSearch, Phone, Search, Store,
  TriangleAlert, Truck, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Aviso, LojaDaConsulta, ProdutoDaConsulta } from "@/lib/consulta/dados";
import {
  DIAS_PARA_ENVELHECER, NOME_DO_CAMINHO, diasDesde, quandoFica, type Caminho, type RegrasDeEntrega,
} from "@/lib/vendas/prazos";

/**
 * A consulta do vendedor: achar o produto, ver preço e link, saber onde tem a
 * pronta entrega e fazer a conta do prazo.
 *
 * DESENHADA PARA RESPONDER O CLIENTE COM O CELULAR NA MÃO. Tudo o que o
 * vendedor copia para a conversa (link, preço, a frase do prazo) tem botão de
 * copiar. O catálogo inteiro vem de uma vez e a busca roda no navegador, para
 * responder a cada letra sem ir ao servidor.
 *
 * DUAS REGRAS QUE NÃO SÃO ÓBVIAS:
 *
 * 1. Pronta entrega é AVISO, não estoque contado. Cada linha diz quem informou
 *    e há quantos dias, e a partir de sete dias ela aparece como velha. Tela
 *    que mostra "tem" sem dizer de quando leva o vendedor a prometer o que a
 *    loja já vendeu.
 *
 * 2. O prazo mostra a CONTA além da resposta. Quem promete uma data precisa
 *    conseguir conferir de onde ela saiu, e o que a conta não sabe (feriado,
 *    prazo dos Correios) está escrito ao lado.
 *
 * As ações vêm de fora, como propriedade, para a tela poder ser vista sem
 * sessão durante o desenvolvimento.
 */

type Informar = (
  loja: string,
  produto: string,
  tem: boolean,
  extras?: { numeracoes?: string; observacao?: string },
) => Promise<{ ok: true } | { ok: false; erro: string }>;
type SalvarRegras = (a: { diasDoMalote: number[]; horaDoMalote: number }) => Promise<{ ok: true } | { ok: false; erro: string }>;

type Aba = "produto" | "prazo" | "lojas";

const ABAS: { chave: Aba; nome: string; Icone: LucideIcon }[] = [
  { chave: "produto", nome: "Produto", Icone: PackageSearch },
  { chave: "prazo", nome: "Prazo", Icone: Clock },
  { chave: "lojas", nome: "Lojas", Icone: Store },
];

const ICONE_DO_CAMINHO: Record<Caminho, LucideIcon> = { retirada: Store, correios: Truck, moto: Bike };
const CAMINHOS: Caminho[] = ["retirada", "correios", "moto"];
const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Quantos produtos a lista desenha. A busca afunila; mais que isso é rolagem sem fim no celular. */
const TETO_DA_LISTA = 40;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
const haQuanto = (d: number) => (d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`);

const botaoClaro = "painel-toque inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60";
const botaoCheio = "painel-toque painel-aba-ativa inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold disabled:opacity-60";

function linkDoWhatsApp(l: LojaDaConsulta): string | null {
  const n = (l.whatsapp ?? "").replace(/\D/g, "");
  return n ? `https://wa.me/${n}` : null;
}

/** Botão que copia um texto e diz que copiou. */
function Copiar({ texto, children, cheio }: { texto: string; children: React.ReactNode; cheio?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className={cheio ? botaoCheio : botaoClaro}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          // Navegador sem permissão de copiar: a pessoa ainda pode selecionar o texto na tela.
        }
      }}
    >
      {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copiado ? "Copiado" : children}</span>
    </button>
  );
}

function Preco({ p, grande }: { p: ProdutoDaConsulta; grande?: boolean }) {
  if (p.preco === null) return <span className="text-xs text-muted">Sem preço na loja</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {p.precoCheio ? <s className={`numeros text-muted ${grande ? "text-sm" : "text-xs"}`}>{reais(p.precoCheio)}</s> : null}
      <span className={`numeros font-bold text-ink ${grande ? "text-2xl" : "text-sm"}`}>{reais(p.preco)}</span>
      {p.desconto ? <span className="numeros rounded-full bg-[#e3f4ec] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#046c4e]">{p.desconto}% off</span> : null}
    </span>
  );
}

/** As três respostas de prazo, com a conta de cada uma. */
function Prazos({ hoje, diasUteis, regras }: { hoje: string; diasUteis: number; regras: RegrasDeEntrega }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {CAMINHOS.map((c) => {
        const r = quandoFica({ hoje, diasUteis, caminho: c, regras });
        const Icone = ICONE_DO_CAMINHO[c];
        return (
          <li key={c} className="flex flex-col rounded-[12px] border border-ink/10 bg-white p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--setor)]">
              <Icone size={14} aria-hidden="true" /> {NOME_DO_CAMINHO[c]}
            </p>
            <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">{r.frase}</p>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer font-semibold text-ink/70">Ver a conta</summary>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-relaxed">
                {r.conta.map((linha, i) => (
                  <li key={i}>{linha}</li>
                ))}
              </ol>
            </details>
            <div className="mt-auto pt-2.5">
              <Copiar texto={r.frase}>Copiar a frase</Copiar>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AvisoDasRegras({ regras }: { regras: RegrasDeEntrega }) {
  return (
    <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
      A conta não conhece feriado e não soma urgência combinada com a fábrica, que costuma conseguir antes.{" "}
      {regras.confirmadas
        ? "Os dias de malote foram confirmados pela JK."
        : "Os dias de malote são os ditos no grupo do time em novembro, e ainda falta a JK confirmar."}
    </p>
  );
}

/** Uma loja dentro do produto: o que se sabe e os botões para informar. */
function LinhaDaLoja({
  loja, aviso, produto, hoje, informar,
}: {
  loja: LojaDaConsulta;
  aviso: Aviso | undefined;
  produto: ProdutoDaConsulta;
  hoje: string;
  informar: Informar;
}) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [numeracoes, setNumeracoes] = useState(aviso?.tem ? (aviso.numeracoes ?? "") : "");
  const [observacao, setObservacao] = useState(aviso?.tem ? (aviso.observacao ?? "") : "");
  const [erro, setErro] = useState<string | null>(null);

  const idade = aviso ? diasDesde(aviso.em, hoje) : 0;
  const velho = aviso ? idade >= DIAS_PARA_ENVELHECER : false;
  const zap = linkDoWhatsApp(loja);

  const gravar = (tem: boolean) =>
    comecar(async () => {
      setErro(null);
      const r = await informar(loja.id, produto.id, tem, tem ? { numeracoes, observacao } : {});
      if (r.ok) {
        setAberto(false);
        router.refresh();
      } else setErro(r.erro);
    });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{loja.nome}</p>
          {!aviso ? (
            <p className="mt-0.5 text-xs text-muted">Ninguém informou ainda.</p>
          ) : aviso.tem ? (
            <>
              <p className={`mt-0.5 flex items-start gap-1 text-xs font-semibold ${velho ? "text-[#9a4a07]" : "text-[#046c4e]"}`}>
                {velho ? <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={12} className="mt-0.5 shrink-0" aria-hidden="true" />}
                {/* Um bloco só de texto: como itens soltos de flex, a vírgula da numeração ganhava um espaço antes. */}
                <span>
                  {velho ? "Tinha, mas a informação está velha" : "Tem a pronta entrega"}
                  {aviso.numeracoes ? <span className="font-normal text-ink">, numeração {aviso.numeracoes}</span> : null}
                </span>
              </p>
              {aviso.observacao ? <p className="mt-0.5 break-words text-xs text-ink">{aviso.observacao}</p> : null}
              <p className="mt-0.5 text-[0.7rem] text-muted">
                Informado {haQuanto(idade)}
                {aviso.por ? `, por ${aviso.por}` : ""}.{velho ? " Confirme com a loja antes de prometer." : ""}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted">
              Não tem. Visto {haQuanto(idade)}
              {aviso.por ? `, por ${aviso.por}` : ""}.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {zap ? (
            <a href={zap} target="_blank" rel="noreferrer" className={botaoClaro} aria-label={`Chamar a loja ${loja.nome} no WhatsApp`}>
              <MessageCircle size={14} aria-hidden="true" /> Loja
            </a>
          ) : loja.telefone ? (
            <a href={`tel:${loja.telefone}`} className={botaoClaro} aria-label={`Ligar para a loja ${loja.nome}`}>
              <Phone size={14} aria-hidden="true" /> Ligar
            </a>
          ) : null}
          {!aberto ? (
            <>
              <button type="button" disabled={ocupado} onClick={() => setAberto(true)} className={aviso?.tem ? botaoClaro : botaoCheio}>
                {aviso?.tem ? "Atualizar" : "Tem"}
              </button>
              {aviso?.tem ? (
                <button type="button" disabled={ocupado} onClick={() => gravar(false)} className={botaoClaro}>
                  {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} Acabou
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {aberto ? (
        <div className="mt-2.5 space-y-2 rounded-[12px] bg-ink/[0.03] p-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Numerações que a loja tem</span>
            <input
              value={numeracoes}
              onChange={(e) => setNumeracoes(e.target.value)}
              maxLength={120}
              autoFocus
              placeholder="Ex.: 16, 17 e 22"
              className="numeros mt-1 h-11 w-full rounded-[10px] border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-[var(--setor)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">Observação</span>
            <span className="block text-[0.7rem] text-muted">Pode ficar vazia.</span>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={200}
              placeholder="Ex.: está no expositor, sem caixinha"
              className="mt-1 h-11 w-full rounded-[10px] border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-[var(--setor)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} onClick={() => gravar(true)} className={botaoCheio}>
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Gravar que tem
            </button>
            <button type="button" disabled={ocupado} onClick={() => setAberto(false)} className={botaoClaro}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {erro ? <p className="mt-2 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </li>
  );
}

function Detalhe({
  p, lojas, avisos, regras, hoje, informar, onVoltar,
}: {
  p: ProdutoDaConsulta;
  lojas: LojaDaConsulta[];
  avisos: Aviso[];
  regras: RegrasDeEntrega;
  hoje: string;
  informar: Informar;
  onVoltar: () => void;
}) {
  // Peça sem prazo declarado: a pessoa escolhe os dias, partindo de 2, que é o prazo de quase metade do catálogo.
  const [diasEscolhidos, setDiasEscolhidos] = useState(2);
  const diasUteis = p.diasUteis ?? diasEscolhidos;
  const porLoja = new Map(avisos.map((a) => [a.loja, a]));
  const precoEmTexto = p.preco === null ? "" : p.precoCheio ? `De ${reais(p.precoCheio)} por ${reais(p.preco)}` : reais(p.preco);
  const paraOCliente = [p.nome, precoEmTexto, p.url ?? ""].filter(Boolean).join("\n");

  return (
    <div className="mt-4">
      <button type="button" onClick={onVoltar} className={botaoClaro}>
        <ArrowLeft size={14} aria-hidden="true" /> Voltar à busca
      </button>

      <section className="glass mt-3 rounded-[18px] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {p.foto ? (
            <a href={p.foto} target="_blank" rel="noreferrer" className="shrink-0 self-center sm:self-start" aria-label={`Abrir a foto de ${p.nome} em tamanho inteiro`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.foto} alt={p.nome} width={176} height={176} className="h-44 w-44 rounded-[14px] border border-ink/10 bg-white object-contain" />
            </a>
          ) : (
            <span className="h-44 w-44 shrink-0 self-center rounded-[14px] bg-ink/[0.05] sm:self-start" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              {[p.categoria, `Cód. ${p.codigo}`, p.vendidos > 0 ? `${p.vendidos.toLocaleString("pt-BR")} vendidos` : null].filter(Boolean).join(" · ")}
            </p>
            <h2 className="font-display mt-1 break-words text-xl leading-tight text-ink sm:text-2xl">{p.nome}</h2>
            <p className="mt-2">
              <Preco p={p} grande />
            </p>
            {p.disponivel ? (
              p.disponibilidade ? <p className="mt-1 text-xs text-muted">Na loja online: {p.disponibilidade.toLowerCase()}.</p> : null
            ) : (
              <p className="mt-2 inline-flex items-start gap-1.5 rounded-[10px] bg-[#fde8e8] p-2 text-xs font-semibold text-[#b01919]">
                <CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" /> A loja online está sem esta peça. Confirme com a fábrica antes de oferecer.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {p.url ? <Copiar texto={paraOCliente} cheio>Copiar preço e link</Copiar> : null}
              {p.url ? <Copiar texto={p.url}>Copiar só o link</Copiar> : null}
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer" className={botaoClaro}>
                  <ExternalLink size={14} aria-hidden="true" /> Abrir na loja
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="glass mt-3 rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-prazo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="titulo-prazo" className="text-sm font-semibold text-ink">Se fechar hoje, quando chega</h3>
          {p.diasUteis === null ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              A loja não diz o prazo desta peça. Dias úteis de produção:
              <input
                type="number"
                min={0}
                max={15}
                value={diasEscolhidos}
                onChange={(e) => setDiasEscolhidos(Math.max(0, Math.min(15, Number(e.target.value) || 0)))}
                className="numeros h-9 w-16 rounded-[8px] border border-ink/15 bg-white px-2 text-sm text-ink"
              />
            </label>
          ) : (
            <p className="text-xs text-muted">Produção de {plural(diasUteis, "dia útil", "dias úteis")}, como a loja declara.</p>
          )}
        </div>
        <div className="mt-3">
          <Prazos hoje={hoje} diasUteis={diasUteis} regras={regras} />
        </div>
        <AvisoDasRegras regras={regras} />
      </section>

      <section className="glass mt-3 rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-pronta">
        <h3 id="titulo-pronta" className="text-sm font-semibold text-ink">Pronta entrega nas lojas</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          É um quadro de avisos, não estoque contado: vale o que alguém do time viu e informou. Soube que uma loja tem ou que acabou? Marque
          aqui, e o próximo que perguntar já encontra a resposta.
        </p>
        <ul className="mt-2 divide-y divide-ink/[0.07]">
          {lojas.map((l) => (
            // A chave leva a data do aviso: quando ele muda, os campos do formulário recomeçam com o valor novo.
            <LinhaDaLoja key={`${l.id}:${porLoja.get(l.id)?.em ?? ""}`} loja={l} aviso={porLoja.get(l.id)} produto={p} hoje={hoje} informar={informar} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function RegrasDoMalote({ regras, salvar }: { regras: RegrasDeEntrega; salvar: SalvarRegras }) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [dias, setDias] = useState<number[]>(regras.diasDoMalote);
  const [hora, setHora] = useState(regras.horaDoMalote);
  const [msg, setMsg] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);

  return (
    <section className="glass mt-3 rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-regras">
      <h3 id="titulo-regras" className="text-sm font-semibold text-ink">Regras de entrega</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Só administrador, dono e GM veem este bloco. São os dias em que o malote sai da fábrica para as lojas e a hora em que as peças
        costumam chegar. Gravar aqui marca as regras como confirmadas pela JK.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Dias de malote">
        {DIAS_DA_SEMANA.map((nome, d) => {
          const ligado = dias.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={ligado}
              onClick={() => setDias(ligado ? dias.filter((x) => x !== d) : [...dias, d].sort((a, b) => a - b))}
              className={`painel-toque h-10 w-12 rounded-[10px] text-xs font-semibold ${ligado ? "painel-aba-ativa" : "border border-ink/12 bg-white text-ink"}`}
            >
              {nome}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink">
        As peças chegam na loja depois das
        <input
          type="number"
          min={0}
          max={23}
          value={hora}
          onChange={(e) => setHora(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
          className="numeros h-10 w-16 rounded-[8px] border border-ink/15 bg-white px-2 text-sm"
        />
        horas
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={ocupado}
          className={botaoCheio}
          onClick={() =>
            comecar(async () => {
              setMsg(null);
              const r = await salvar({ diasDoMalote: dias, horaDoMalote: hora });
              if (r.ok) {
                setMsg({ tom: "bom", texto: "Regras gravadas e confirmadas." });
                router.refresh();
              } else setMsg({ tom: "ruim", texto: r.erro });
            })
          }
        >
          {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Gravar e confirmar
        </button>
        {msg ? <p role="status" className={`text-xs font-semibold ${msg.tom === "bom" ? "text-[#046c4e]" : "text-[#b01919]"}`}>{msg.texto}</p> : null}
      </div>
    </section>
  );
}

export function TelaDaConsulta({
  produtos, lojas, quadro, regras, hoje, informar, salvarRegras,
}: {
  produtos: ProdutoDaConsulta[] | null;
  lojas: LojaDaConsulta[];
  quadro: Aviso[];
  regras: RegrasDeEntrega;
  hoje: string;
  informar: Informar;
  /** Só chega para administrador, dono e GM. */
  salvarRegras?: SalvarRegras;
}) {
  const [aba, setAba] = useState<Aba>("produto");
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [diasDaConta, setDiasDaConta] = useState(2);
  const [diaDaConta, setDiaDaConta] = useState(hoje);

  const lista = useMemo(() => produtos ?? [], [produtos]);
  const porId = useMemo(() => new Map(lista.map((p) => [p.id, p])), [lista]);
  // O texto de busca de cada produto, montado uma vez: nome, modelo, categoria e código.
  const indice = useMemo(() => lista.map((p) => ({ p, texto: semAcento(`${p.nome} ${p.modelo ?? ""} ${p.categoria ?? ""} ${p.codigo}`) })), [lista]);

  // Quantas lojas têm cada produto, só com informação que ainda vale.
  const lojasComPeca = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of quadro) if (a.tem && diasDesde(a.em, hoje) < DIAS_PARA_ENVELHECER) m.set(a.produto, (m.get(a.produto) ?? 0) + 1);
    return m;
  }, [quadro, hoje]);

  const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
  const achados = palavras.length === 0 ? lista : indice.filter((x) => palavras.every((w) => x.texto.includes(w))).map((x) => x.p);
  const visiveis = achados.slice(0, TETO_DA_LISTA);
  const aberto = abertoId ? porId.get(abertoId) : undefined;

  const abrir = (id: string) => {
    setAbertoId(id);
    setAba("produto");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Consulta</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Para responder o cliente na hora: o produto com o preço de hoje e o link, onde tem a pronta entrega e quando chega.
        </p>
      </header>

      <div role="tablist" aria-label="Partes da consulta" className="mt-5 grid grid-cols-3 gap-1 rounded-[14px] bg-ink/[0.05] p-1">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            id={`aba-${a.chave}`}
            aria-selected={aba === a.chave}
            aria-controls={`painel-${a.chave}`}
            onClick={() => setAba(a.chave)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold transition-colors ${
              aba === a.chave ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
            }`}
          >
            <a.Icone size={15} aria-hidden="true" /> {a.nome}
          </button>
        ))}
      </div>

      {aba === "produto" ? (
        <div role="tabpanel" id="painel-produto" aria-labelledby="aba-produto">
          {produtos === null ? (
            <p className="glass mt-4 rounded-[18px] p-5 text-sm text-muted">
              <span className="font-semibold text-ink">Não deu para ler os produtos agora.</span> Recarregue a página em alguns segundos.
            </p>
          ) : aberto ? (
            <Detalhe
              key={aberto.id}
              p={aberto}
              lojas={lojas}
              avisos={quadro.filter((a) => a.produto === aberto.id)}
              regras={regras}
              hoje={hoje}
              informar={informar}
              onVoltar={() => setAbertoId(null)}
            />
          ) : (
            <>
              <label className="relative mt-4 block">
                <span className="sr-only">Buscar produto</span>
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, modelo ou código do produto"
                  className="h-12 w-full rounded-full border border-ink/12 bg-white pl-11 pr-11 text-base text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
                />
                {busca ? (
                  <button type="button" onClick={() => setBusca("")} aria-label="Limpar a busca" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink">
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </label>
              <p className="mt-2.5 text-xs text-muted" aria-live="polite">
                {palavras.length === 0
                  ? `Os mais vendidos primeiro. São ${lista.length.toLocaleString("pt-BR")} produtos: digite para achar.`
                  : achados.length === 0
                    ? "Nenhum produto com esse nome."
                    : achados.length > TETO_DA_LISTA
                      ? `${achados.length} produtos. Mostrando os ${TETO_DA_LISTA} mais vendidos: digite mais uma palavra para afunilar.`
                      : plural(achados.length, "produto", "produtos") + "."}
              </p>
              <ul className="mt-2.5 space-y-2">
                {visiveis.map((p) => {
                  const emLojas = lojasComPeca.get(p.id) ?? 0;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => abrir(p.id)} className="painel-toque glass flex w-full items-center gap-3 rounded-[14px] p-3 text-left">
                        {p.miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.miniatura} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-[10px] border border-ink/10 bg-white object-contain" />
                        ) : (
                          <span className="h-14 w-14 shrink-0 rounded-[10px] bg-ink/[0.05]" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 break-words text-sm font-semibold leading-snug text-ink">{p.nome}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <Preco p={p} />
                            {!p.disponivel ? (
                              <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-[#b01919]">
                                <CircleAlert size={11} aria-hidden="true" /> Sem estoque na loja online
                              </span>
                            ) : p.diasUteis !== null ? (
                              <span className="text-[0.7rem] text-muted">{plural(p.diasUteis, "dia útil", "dias úteis")}</span>
                            ) : null}
                            {emLojas > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-[#046c4e]">
                                <Check size={11} aria-hidden="true" /> Pronta entrega em {plural(emLojas, "loja", "lojas")}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {aba === "prazo" ? (
        <div role="tabpanel" id="painel-prazo" aria-labelledby="aba-prazo">
          <section className="glass mt-4 rounded-[18px] p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-ink">Quando chega</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Para a peça que não está no catálogo ou para simular outro dia. Dentro de cada produto a conta já vem com o prazo que a loja declara.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-xs font-semibold text-ink">
                Dias úteis de produção
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={diasDaConta}
                  onChange={(e) => setDiasDaConta(Math.max(0, Math.min(15, Number(e.target.value) || 0)))}
                  className="numeros mt-1 block h-11 w-24 rounded-[10px] border border-ink/15 bg-white px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-ink">
                Fechando no dia
                <input
                  type="date"
                  value={diaDaConta}
                  onChange={(e) => setDiaDaConta(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : hoje)}
                  className="numeros mt-1 block h-11 rounded-[10px] border border-ink/15 bg-white px-3 text-sm"
                />
              </label>
            </div>
            <div className="mt-3">
              <Prazos hoje={diaDaConta} diasUteis={diasDaConta} regras={regras} />
            </div>
            <AvisoDasRegras regras={regras} />
          </section>
          {salvarRegras ? <RegrasDoMalote regras={regras} salvar={salvarRegras} /> : null}
        </div>
      ) : null}

      {aba === "lojas" ? (
        <div role="tabpanel" id="painel-lojas" aria-labelledby="aba-lojas">
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {lojas.map((l) => {
              const zap = linkDoWhatsApp(l);
              const daLoja = quadro.filter((a) => a.loja === l.id && a.tem && porId.has(a.produto));
              return (
                <li key={l.id} className="glass rounded-[16px] p-4">
                  <p className="text-base font-bold leading-tight text-ink">{l.nome}</p>
                  <p className="mt-0.5 break-words text-xs text-muted">{[l.endereco, l.cidade].filter(Boolean).join(", ")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {zap ? (
                      <a href={zap} target="_blank" rel="noreferrer" className={botaoCheio}>
                        <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                      </a>
                    ) : null}
                    {l.telefone ? (
                      <a href={`tel:${l.telefone}`} className={zap ? botaoClaro : botaoCheio}>
                        <Phone size={14} aria-hidden="true" /> Ligar
                      </a>
                    ) : null}
                    {l.mapa ? (
                      <a href={l.mapa} target="_blank" rel="noreferrer" className={botaoClaro}>
                        <MapPin size={14} aria-hidden="true" /> Mapa
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3 border-t border-ink/[0.07] pt-3">
                    <p className="text-xs font-semibold text-ink">
                      {daLoja.length === 0 ? "Nenhuma pronta entrega informada" : `Pronta entrega informada: ${plural(daLoja.length, "peça", "peças")}`}
                    </p>
                    {daLoja.length > 0 ? (
                      <ul className="mt-1.5 space-y-1.5">
                        {daLoja.map((a) => {
                          const p = porId.get(a.produto)!;
                          const idade = diasDesde(a.em, hoje);
                          const velho = idade >= DIAS_PARA_ENVELHECER;
                          return (
                            <li key={a.produto}>
                              <button type="button" onClick={() => abrir(p.id)} className="w-full text-left text-xs leading-snug">
                                <span className="font-semibold text-ink underline decoration-ink/25 underline-offset-2">{p.nome}</span>
                                {a.numeracoes ? <span className="text-ink">, numeração {a.numeracoes}</span> : null}
                                <span className={velho ? "font-semibold text-[#9a4a07]" : "text-muted"}> ({haQuanto(idade)}{velho ? ", confirme" : ""})</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-[0.7rem] text-muted">Abra um produto e marque que esta loja tem.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
