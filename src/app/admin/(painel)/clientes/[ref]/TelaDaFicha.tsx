import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarHeart, HandCoins, MessageCircle, Phone, RotateCcw, Search, ShoppingBag, Store, Truck, UsersRound, Wallet,
} from "lucide-react";
import type { CamposDaFicha, CasoDaFicha, FichaDoCliente, PedidoDaFicha, VendaDaFicha, CadastroDaFicha } from "@/lib/clientes/dados";
import { NOME_DA_FASE, NOME_DO_TIPO, dataPorExtenso, type Oportunidade, type Sugestao } from "@/lib/clientes/oportunidades";
import { lerEntrega, lerEspecificacoes, type Especificacao } from "@/lib/fabrica/etapas";
import { SUBDOMINIO_KOMMO } from "@/lib/leads/chaves";
import { legivel } from "@/lib/leads/telefone";
import type { Tom } from "@/lib/painel/tons";
import { nomeLimpo } from "@/lib/vendas/origem";
import { NOME_DA_FORMA, NOME_DO_CANAL_DE_VENDA } from "@/lib/vendas/por-fora";
import { Cartao, Dinheiro, SeloDeTom } from "../../Pecas";
import type { Marcar } from "../CartaoDaOportunidade";
import { comprasEmPalavra } from "../LinhaDoCliente";
import { EditarFicha } from "./EditarFicha";
import { OportunidadesDaFicha } from "./OportunidadesDaFicha";

/**
 * A ficha do cliente, só o desenho. A leitura fica em `page.tsx`, para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 *
 * DESENHADA PARA O CELULAR DO VENDEDOR, na ordem em que ele precisa das coisas
 * com o cliente na conversa: quem é e como chamar, o que há para oferecer
 * agora, o que a equipe sabe (e pode corrigir ali mesmo), e por fim tudo o que
 * a pessoa já comprou ou tentou comprar, do mais novo para o mais antigo.
 *
 * A ficha mostra o que ESTE cliente comprou e quanto pagou em cada pedido. Não
 * há custo de peça, margem nem soma da empresa aqui.
 */

type Salvar = (ref: string, campos: CamposDaFicha) => Promise<{ ok: true } | { ok: false; erro: string }>;

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaInteiro = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const diaEHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
/** "&#10084;" que a loja manda no texto da gravação vira o caractere. */
const semEntidades = (s: string) => s.replace(/&#(\d{2,7});/g, (_, n) => String.fromCodePoint(Number(n)));
const rotuloCurto = (rotulo: string) => rotulo.replace(/^(?:Numeração|Gravação)\s*-?\s*/i, "").trim() || rotulo;

const SITUACAO: Record<PedidoDaFicha["situacao"], { tom: Tom; nome: string }> = {
  pago: { tom: "bom", nome: "Pago" },
  aguardando: { tom: "atencao", nome: "Esperando pagamento" },
  cancelado: { tom: "neutro", nome: "Não pago" },
};

const ESTADO_DA_RECUPERACAO: Record<string, string> = {
  a_recuperar: "voltou para a fila",
  em_contato: "em contato",
  pago_por_fora: "pagou por fora da loja",
  descartado: "tirado da fila",
};

const ORIGEM_DO_CADASTRO: Record<string, string> = { bio: "pelo link da bio", grupo: "pela página do grupo", loja: "pelo site da loja" };

const CAMPO_EM_PALAVRA: Record<string, string> = {
  fase: "fase",
  par_nome: "nome do par",
  aniversario: "aniversário do cliente",
  aniversario_par: "aniversário do par",
  data_namoro: "começo do namoro",
  data_casamento: "casamento",
  anotacoes: "anotações",
  responsavel_id: "quem cuida",
  datas_recusadas: "data da gravação recusada",
};

function OQuePede({ lista }: { lista: Especificacao[] }) {
  const aros = lista.filter((e) => e.tipo === "aro");
  const gravar = lista.filter((e) => e.tipo === "gravar");
  const outros = lista.filter((e) => e.tipo === "outro");
  if (lista.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {aros.length > 0 ? (
        <dl className="flex flex-wrap gap-1.5">
          {aros.map((e, i) => (
            <div key={i} className="painel-selo flex items-baseline gap-1.5 rounded-[9px] px-2 py-0.5">
              <dt className="text-[0.66rem] font-semibold">{rotuloCurto(e.rotulo)}</dt>
              <dd className="numeros text-sm font-bold leading-none text-ink">{e.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {gravar.length > 0 ? (
        <dl className="space-y-0.5 text-xs">
          {gravar.map((e, i) => (
            <div key={i} className="flex flex-wrap gap-x-1.5">
              <dt className="shrink-0 text-muted">Gravado, {rotuloCurto(e.rotulo).toLowerCase()}:</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words font-semibold text-ink">{semEntidades(e.valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {outros.length > 0 ? (
        <dl className="space-y-0.5 text-xs">
          {outros.map((e, i) => (
            <div key={i} className="flex min-w-0 flex-wrap gap-x-1.5">
              <dt className="shrink-0 text-muted">{e.rotulo}:</dt>
              <dd className="min-w-0 break-words text-ink">{e.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function Evento({ Icone, quando, children }: { Icone: typeof Store; quando: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-9">
      <span className="painel-selo absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full">
        <Icone size={14} aria-hidden="true" />
      </span>
      <p className="numeros text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{quando}</p>
      <div className="mt-1">{children}</div>
    </li>
  );
}

function EventoDoPedido({ p }: { p: PedidoDaFicha }) {
  const s = SITUACAO[p.situacao];
  const entrega = lerEntrega(p.frete);
  const pagos = p.itens?.filter((i) => (i.preco ?? 0) > 0) ?? [];
  const brindes = p.itens?.filter((i) => (i.preco ?? 0) <= 0) ?? [];
  return (
    <Evento Icone={p.situacao === "pago" ? ShoppingBag : Store} quando={diaInteiro(p.dia)}>
      <div className="glass rounded-[14px] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-sm font-semibold text-ink">
            Pedido <span className="numeros">{p.pedido}</span> na loja
          </p>
          <SeloDeTom tom={s.tom}>{s.nome}</SeloDeTom>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className="numeros text-sm font-bold text-ink">{reais(p.total)}</span>
          {p.pagamento ? <span>{p.pagamento}</span> : null}
          {p.status ? <span>na loja: {p.status.toLowerCase()}</span> : null}
        </p>

        {p.itens === null ? (
          <p className="mt-2 text-xs text-muted">Os itens deste pedido não foram trazidos para o painel. Veja o pedido na loja.</p>
        ) : (
          <ul className="mt-2.5 space-y-2.5 border-t border-ink/[0.07] pt-2.5">
            {pagos.map((i, n) => (
              <li key={n}>
                <p className="break-words text-sm leading-snug text-ink">
                  <span className="numeros font-semibold">{i.quantidade}×</span> {nomeLimpo(i.nome)}
                  {i.preco !== null ? <span className="numeros ml-1.5 text-xs text-muted">{reais(i.preco)}</span> : null}
                </p>
                <OQuePede lista={lerEspecificacoes(i.info)} />
              </li>
            ))}
            {brindes.length > 0 ? (
              <li className="text-xs text-muted">Brinde: {brindes.map((i) => nomeLimpo(i.nome)).join(", ")}</li>
            ) : null}
          </ul>
        )}

        {entrega || p.rastreio ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {entrega ? (
              <span className="inline-flex items-center gap-1">
                <Truck size={12} aria-hidden="true" /> {entrega.nome}
              </span>
            ) : null}
            {p.rastreio ? <span className="numeros">Rastreio: {p.rastreio}</span> : null}
          </p>
        ) : null}
      </div>
    </Evento>
  );
}

function EventoDaVenda({ v }: { v: VendaDaFicha }) {
  return (
    <Evento Icone={HandCoins} quando={diaInteiro(v.dia)}>
      <div className="glass rounded-[14px] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-sm font-semibold text-ink">Venda por fora da loja</p>
          {v.estornada ? <SeloDeTom tom="neutro">Estornada</SeloDeTom> : <SeloDeTom tom="bom">Paga</SeloDeTom>}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className={`numeros text-sm font-bold text-ink ${v.estornada ? "line-through" : ""}`}>{reais(v.valor)}</span>
          <span>{NOME_DA_FORMA[v.forma] ?? v.forma}</span>
          <span>{NOME_DO_CANAL_DE_VENDA[v.canal] ?? v.canal}</span>
          {v.vendedor ? <span>com {v.vendedor}</span> : null}
        </p>
        {v.produto ? <p className="mt-1.5 break-words text-sm text-ink">{v.produto}</p> : null}
      </div>
    </Evento>
  );
}

function EventoDoCadastro({ c }: { c: CadastroDaFicha }) {
  return (
    <Evento Icone={UsersRound} quando={diaInteiro(diaDe(c.criadoEm))}>
      <p className="text-sm text-ink">
        <span className="font-semibold">Deixou o contato para o grupo de ofertas</span>
        {c.origem && ORIGEM_DO_CADASTRO[c.origem] ? `, ${ORIGEM_DO_CADASTRO[c.origem]}` : ""}.
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {[
          c.momento ? `Disse que procura: ${c.momento}` : null,
          c.campanha ? `campanha ${c.campanha}` : null,
          c.entrouNoGrupoEm ? `entrou no grupo em ${diaInteiro(diaDe(c.entrouNoGrupoEm))}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Evento>
  );
}

function EventoDaRecuperacao({ c }: { c: CasoDaFicha }) {
  return (
    <Evento Icone={RotateCcw} quando={diaInteiro(diaDe(c.atualizadoEm))}>
      <p className="text-sm text-ink">
        <span className="font-semibold">Fila de recuperação: {ESTADO_DA_RECUPERACAO[c.estado] ?? c.estado}</span>
        {c.quem ? `, por ${c.quem}` : ""}.
      </p>
      <p className="mt-0.5 text-xs text-muted">{[`Pedido ${c.pedido}`, c.nota].filter(Boolean).join(" · ")}</p>
    </Evento>
  );
}

export function TelaDaFicha({
  f, sugestoes, oportunidades, hoje, podeVerRecuperacao, salvar, marcar,
}: {
  f: FichaDoCliente;
  /** Datas lidas da gravação que ninguém confirmou nem recusou. */
  sugestoes: Sugestao[];
  /** O que vence para este cliente nos próximos 90 dias. */
  oportunidades: Oportunidade[];
  hoje: string;
  podeVerRecuperacao: boolean;
  salvar: Salvar;
  marcar: Marcar;
}) {
  const lugar = [f.cidade, f.uf].filter(Boolean).join(", ");
  const fase = f.ficha?.fase ?? "nao_sei";
  const pagos = f.pedidos.filter((p) => p.situacao === "pago");
  const porFora = f.porFora.filter((v) => !v.estornada);
  const totalPago = pagos.reduce((s, p) => s + p.total, 0) + porFora.reduce((s, v) => s + v.valor, 0);
  const compras = pagos.length + porFora.length;

  // A linha do tempo: tudo o que aconteceu, do mais novo para o mais antigo.
  const eventos: { quando: string; chave: string; no: React.ReactNode }[] = [
    ...f.pedidos.map((p) => ({ quando: p.feitoEm, chave: `p${p.pedido}`, no: <EventoDoPedido p={p} /> })),
    ...f.porFora.map((v) => ({ quando: `${v.dia}T12:00:00-03:00`, chave: `v${v.id}`, no: <EventoDaVenda v={v} /> })),
    ...f.cadastros.map((c, i) => ({ quando: c.criadoEm, chave: `l${i}`, no: <EventoDoCadastro c={c} /> })),
    ...f.recuperacao.map((c) => ({ quando: c.atualizadoEm, chave: `r${c.pedido}`, no: <EventoDaRecuperacao c={c} /> })),
  ].sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
  const primeiro = eventos.length ? eventos[eventos.length - 1].quando : null;

  const contato = "painel-toque inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold";
  const marcadas = f.marcadas.filter((m) => m.decisao !== "reaberta");

  return (
    <div data-painel-largo>
      <Link href="/admin/clientes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" /> Clientes
      </Link>

      <header className="mt-3">
        <p className="eyebrow">Ficha do cliente</p>
        <h1 className="font-display mt-2 break-words text-3xl text-ink sm:text-4xl">{f.nome ?? "Cliente sem nome"}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
          {fase !== "nao_sei" ? <span className="painel-selo rounded-full px-2.5 py-0.5 text-xs font-bold">{NOME_DA_FASE[fase]}</span> : null}
          {f.ficha?.parNome ? <span>com {f.ficha.parNome}</span> : null}
          {lugar ? <span>{lugar}</span> : null}
          <span>{comprasEmPalavra(f)}</span>
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {f.telefone ? (
          <>
            <a href={`https://wa.me/${f.telefone}`} target="_blank" rel="noreferrer" className={`${contato} painel-aba-ativa basis-full sm:basis-auto`}>
              <MessageCircle size={16} aria-hidden="true" /> Abrir no WhatsApp
            </a>
            <a href={`tel:+${f.telefone}`} className={`${contato} flex-1 border border-ink/12 bg-white text-ink sm:flex-none`}>
              <Phone size={15} aria-hidden="true" /> Ligar
            </a>
            <a
              // Os oito últimos dígitos acham o contato em qualquer formato gravado na Kommo.
              href={`https://${SUBDOMINIO_KOMMO}.kommo.com/contacts/list/contacts/?term=${f.telefone.slice(-8)}`}
              target="_blank"
              rel="noreferrer"
              className={`${contato} flex-1 border border-ink/12 bg-white text-ink sm:flex-none`}
            >
              <Search size={15} aria-hidden="true" /> Kommo
            </a>
          </>
        ) : (
          <p className="text-sm text-muted">Sem telefone nos pedidos deste cliente.</p>
        )}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
        {f.telefone ? <span className="numeros text-ink">{legivel(f.telefone)}</span> : null}
        {f.email ? <span className="break-all">{f.email}</span> : null}
        {f.noGrupo ? <span>está no cadastro do grupo de ofertas</span> : null}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cartao Icone={ShoppingBag} rotulo="Compras pagas" apoio={f.pedidosNaoPagos > 0 ? `mais ${f.pedidosNaoPagos} ${f.pedidosNaoPagos === 1 ? "pedido não pago" : "pedidos não pagos"}` : "na loja e por fora"}>
          <span className="numeros">{compras}</span>
        </Cartao>
        <Cartao Icone={Wallet} rotulo="Quanto já pagou" apoio="soma das compras deste cliente">
          <Dinheiro valor={totalPago} />
        </Cartao>
        {/* No celular os cartões andam de dois em dois: o terceiro ocupa a linha inteira, para não sobrar um buraco. */}
        <div className="col-span-2 grid sm:col-span-1">
          <Cartao Icone={CalendarHeart} rotulo="Primeiro contato" apoio={f.ultimaCompra ? `última compra em ${diaInteiro(f.ultimaCompra)}` : "ainda sem compra paga"}>
            <span className="numeros">{primeiro ? diaInteiro(diaDe(primeiro)) : "sem data"}</span>
          </Cartao>
        </div>
      </div>

      <OportunidadesDaFicha oportunidades={oportunidades.map((o) => ({ ...o, ref: f.ref, telefone: f.telefone }))} marcar={marcar} />

      <section className="glass mt-9 rounded-[18px] p-4 sm:p-6" aria-labelledby="o-que-sabemos">
        <h2 id="o-que-sabemos" className="font-display text-2xl text-ink">O que sabemos</h2>
        <p className="mt-1 text-xs text-muted">
          O que a equipe sabe e nenhum sistema guarda. Preencha o que souber: é daqui que saem os avisos de aniversário e de casamento.
        </p>
        <div className="mt-5">
          <EditarFicha
            refDoCliente={f.ref}
            inicial={f.ficha}
            equipe={f.equipe}
            eu={f.eu}
            sugestoes={sugestoes}
            anoDeHoje={Number(hoje.slice(0, 4))}
            salvar={salvar}
          />
        </div>
        {f.ficha?.atualizadoEm && f.historico.length > 0 ? (
          <details className="mt-5 border-t border-ink/[0.07] pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">
              Última alteração em {diaEHora(f.ficha.atualizadoEm)}{f.ficha.atualizadoPor ? `, por ${f.ficha.atualizadoPor}` : ""}
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {f.historico.map((h, i) => (
                <li key={i}>
                  <span className="numeros text-ink">{diaEHora(h.em)}</span>
                  {h.por ? `, ${h.por}` : ""}: {h.campos.map((c) => CAMPO_EM_PALAVRA[c] ?? c).join(", ")}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="mt-9" aria-labelledby="linha-do-tempo">
        <h2 id="linha-do-tempo" className="font-display text-2xl text-ink">Linha do tempo</h2>
        <p className="mt-1 text-xs text-muted">
          Pedidos da loja (pagos e não pagos), vendas por fora, cadastro no grupo e a fila de recuperação, do mais novo para o mais antigo.
          {podeVerRecuperacao && f.pedidosNaoPagos > 0 ? (
            <>
              {" "}
              <Link href="/admin/recuperacao" className="font-semibold text-ink underline underline-offset-2">Abrir a fila de recuperação</Link>
            </>
          ) : null}
        </p>
        {eventos.length > 0 ? (
          <ol className="mt-4 space-y-5">
            {eventos.map((e) => (
              <Fragment key={e.chave}>{e.no}</Fragment>
            ))}
          </ol>
        ) : (
          <p className="glass mt-4 rounded-[16px] p-5 text-sm text-muted">Nada registrado para este cliente ainda.</p>
        )}
      </section>

      {marcadas.length > 0 ? (
        <details className="glass mt-9 rounded-[16px] p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Oportunidades já marcadas <span className="numeros font-normal text-muted">({marcadas.length})</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-xs text-muted">
            {marcadas.map((m) => (
              <li key={`${m.tipo}|${m.ocorrencia}`}>
                <span className="font-semibold text-ink">{NOME_DO_TIPO[m.tipo]}</span> de {dataPorExtenso(m.ocorrencia)}:{" "}
                {m.decisao === "falei" ? "já falei" : "não vale"}
                {m.por ? `, por ${m.por}` : ""}
                {m.em ? `, em ${diaInteiro(diaDe(m.em))}` : ""}.
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
