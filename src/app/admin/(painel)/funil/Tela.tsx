import Link from "next/link";
import { CircleAlert, Clock, ExternalLink, Hourglass, Layers, MessageCircleWarning, Percent, Timer, TriangleAlert, Wallet } from "lucide-react";
import {
  FASES_ABERTAS, NOME_DA_FASE, PRAZOS_DA_KOMMO, conversao, ehFase, tempoPorExtenso, tomDaEsperaNaKommo,
  type AlertasDaKommo, type Fase,
} from "@/lib/kommo/funil";
import { COR_DO_TOM, type Tom } from "@/lib/painel/tons";
import { Cartao, ICONE_DO_TOM, ListaComBarra } from "../Pecas";

/** O que `kommo_funil_unico` (0162) devolve. */
export type FunilUnico = {
  lido_em: string | null;
  dias: number;
  fases: { fase: string | null; abertos: number; valor: number; parado_dias: number; parados_7d: number; sem_resposta: number }[];
  etapas: {
    funil_id: number; funil: string | null; etapa_id: number; etapa: string | null; fase: string | null;
    origem_fase: "palpite" | "pessoa" | null; abertos: number; valor: number; parado_dias: number;
  }[];
  periodo: { ganhos: number; perdidos: number; valor_ganho: number; valor_perdido: number; criados: number };
  primeira_resposta: { com_resposta: number; sem_resposta: number; mediana_min: number | null };
  motivos: { motivo: string; perdidos: number; valor: number }[];
  lista: {
    id: number; nome: string | null; valor: number | null; funil: string | null; etapa: string | null; fase: string | null;
    responsavel: string | null; pessoa: string | null; loja: string | null; origem: string;
    etapa_desde: string | null; ultima_msg_cliente_em: string | null; ultima_msg_loja_em: string | null;
    sem_resposta: boolean; link: string;
  }[];
  opcoes: { lojas: { id: string; nome: string }[]; pessoas: { id: string; nome: string }[]; funis: { id: number; nome: string }[]; origens: string[] };
  sem_mapa: number;
};

export type Filtros = { dias: number; loja: string; pessoa: string; funil: string; origem: string; alerta: string };

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inteiro = (n: number) => Number(n).toLocaleString("pt-BR");
const campo = "w-full min-w-0 rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const nomeDaFase = (f: string | null) => (ehFase(f) ? NOME_DA_FASE[f] : "Sem fase");
const minutosDesde = (iso: string | null, agora: number) => (iso ? Math.max(0, (agora - Date.parse(iso)) / 60_000) : null);

const ALERTAS: Record<string, string> = {
  esperando: `Esperando vendedor há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.atencao)}`,
  sem_resposta: `Cliente sem resposta há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.atencao)}`,
  sem_fase: "Negócios em etapa sem fase",
};

function Selo({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  const Icone = ICONE_DO_TOM[tom];
  if (tom === "neutro") return <span className="text-xs text-muted">{children}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COR_DO_TOM[tom].texto }}>
      {Icone ? <Icone size={12} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Cartão de alerta no topo: o número que passou do prazo e o link que filtra a lista. */
function CartaoDeAlerta({
  Icone, titulo, x, href, ativo,
}: { Icone: typeof Clock; titulo: string; x: AlertasDaKommo["esperando"]; href: string; ativo: boolean }) {
  const tom: Tom = x.ruim > 0 ? "ruim" : x.atencao > 0 ? "atencao" : "neutro";
  const t = COR_DO_TOM[tom];
  const IconeDoTom = ICONE_DO_TOM[tom];
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={`glass block min-w-0 rounded-[16px] p-4 transition-colors hover:border-brand/50 ${ativo ? "ring-2 ring-[var(--setor)]" : ""}`}
      style={tom !== "neutro" ? { background: t.fundo, borderColor: "transparent" } : undefined}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Icone size={14} aria-hidden /> {titulo}
      </p>
      <p className="font-display numeros mt-2 text-3xl" style={{ color: t.texto }}>{inteiro(x.atencao)}</p>
      <p className="mt-1 text-xs leading-snug" style={{ color: tom === "neutro" ? undefined : t.texto }}>
        {IconeDoTom ? <IconeDoTom size={12} aria-hidden className="mr-1 inline align-[-2px]" /> : null}
        {x.atencao === 0
          ? `Nenhum há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.atencao)}`
          : `há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.atencao)}${x.ruim > 0 ? `, ${inteiro(x.ruim)} há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.ruim)}` : ""}`}
      </p>
      <p className="mt-1 text-[0.7rem] text-muted">
        {inteiro(x.total)} no total
        {x.mais_antigo_min !== null && x.total > 0 ? `, o mais antigo há ${tempoPorExtenso(x.mais_antigo_min)}` : ""}
      </p>
    </Link>
  );
}

function Filtro({ d, f }: { d: FunilUnico; f: Filtros }) {
  return (
    <form method="get" className="glass mt-6 grid grid-cols-1 gap-3 rounded-[16px] p-4 sm:grid-cols-3 xl:grid-cols-6" aria-label="Filtros do funil">
      <label className="block min-w-0">
        <span className="text-xs font-semibold text-ink">Período</span>
        <select name="dias" defaultValue={String(f.dias)} className={`${campo} mt-1`}>
          {[7, 30, 90].map((n) => (
            <option key={n} value={n}>Últimos {n} dias</option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold text-ink">Loja</span>
        <select name="loja" defaultValue={f.loja} className={`${campo} mt-1`}>
          <option value="">Todas</option>
          {d.opcoes.lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold text-ink">Vendedor</span>
        <select name="pessoa" defaultValue={f.pessoa} className={`${campo} mt-1`}>
          <option value="">Todos</option>
          {d.opcoes.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold text-ink">Funil</span>
        <select name="funil" defaultValue={f.funil} className={`${campo} mt-1`}>
          <option value="">Todos</option>
          {d.opcoes.funis.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold text-ink">Origem</span>
        <select name="origem" defaultValue={f.origem} className={`${campo} mt-1`}>
          <option value="">Todas</option>
          {d.opcoes.origens.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      {f.alerta ? <input type="hidden" name="alerta" value={f.alerta} /> : null}
      <div className="flex min-w-0 items-end gap-3">
        <button type="submit" className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light">
          Filtrar
        </button>
        <Link href="/admin/funil" className="text-xs font-semibold text-muted underline underline-offset-2">Limpar</Link>
      </div>
    </form>
  );
}

function Fases({ d }: { d: FunilUnico }) {
  const porFase = new Map(d.fases.map((x) => [x.fase ?? "", x]));
  const ordem: (Fase | null)[] = [...FASES_ABERTAS, null];
  const maior = Math.max(1, ...d.fases.map((x) => x.abertos));
  return (
    <section className="mt-8" aria-label="Abertos por fase">
      <h2 className="font-display text-2xl text-ink">Abertos por fase</h2>
      <p className="mt-1 text-sm text-muted">
        Negócios abertos agora, somados pela fase padrão da etapa em que estão. Tempo parado é desde que entraram na etapa.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3">
        {ordem.map((fase) => {
          const x = porFase.get(fase ?? "");
          if (!fase && !x) return null;
          const etapas = d.etapas.filter((e) => (e.fase ?? null) === fase);
          const abertos = x?.abertos ?? 0;
          const tomParado: Tom = x && x.parados_7d > 0 ? "atencao" : "neutro";
          return (
            <li key={fase ?? "sem"} className="glass min-w-0 rounded-[16px] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm font-semibold text-ink">
                  {nomeDaFase(fase)}
                  {!fase ? <span className="ml-2 text-xs font-normal text-muted">(etapa ainda não ligada a uma fase)</span> : null}
                </p>
                <p className="numeros text-sm text-ink">
                  <span className="font-semibold">{inteiro(abertos)}</span> {abertos === 1 ? "aberto" : "abertos"}
                  {x && x.valor > 0 ? <span className="text-muted">, {reais(x.valor)} em jogo</span> : null}
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-ink/[0.07]">
                <div className="painel-ponto h-2 rounded-full" style={{ width: `${abertos ? Math.max((abertos / maior) * 100, 0.8) : 0}%` }} />
              </div>
              {x ? (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <Selo tom="neutro">Metade está parada há {String(x.parado_dias).replace(".", ",")} dias ou menos</Selo>
                  <Selo tom={tomParado}>{inteiro(x.parados_7d)} parados há mais de 7 dias</Selo>
                  <Selo tom={x.sem_resposta > 0 ? "atencao" : "neutro"}>{inteiro(x.sem_resposta)} com o cliente sem resposta</Selo>
                </p>
              ) : null}
              {etapas.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-ink">
                    {etapas.length} {etapas.length === 1 ? "etapa" : "etapas"} nesta fase
                  </summary>
                  <ul className="mt-2 divide-y divide-border/60">
                    {etapas.map((e) => (
                      <li key={`${e.funil_id}-${e.etapa_id}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-xs">
                        <span className="min-w-0 break-words text-ink">
                          {e.funil ?? "Funil"} <span className="text-muted">·</span> {e.etapa ?? "Etapa"}
                          {e.origem_fase === "palpite" ? <span className="ml-1 text-muted">(fase por palpite)</span> : null}
                        </span>
                        <span className="numeros shrink-0 text-muted">
                          {inteiro(e.abertos)} {e.abertos === 1 ? "aberto" : "abertos"}, metade até {String(e.parado_dias).replace(".", ",")} dias
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Lista({ d, f, agora }: { d: FunilUnico; f: Filtros; agora: number }) {
  const titulo = ALERTAS[f.alerta] ?? "Parados há mais tempo";
  return (
    <section className="mt-8" aria-label={titulo}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl text-ink">{titulo}</h2>
        {f.alerta ? (
          <Link href="/admin/funil" className="text-xs font-semibold text-muted underline underline-offset-2">Ver todos os abertos</Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        {f.alerta === "sem_resposta"
          ? "Quem esperou mais aparece primeiro. A conversa continua na Kommo: o botão abre o negócio lá."
          : "Quem está há mais tempo na mesma etapa aparece primeiro, até 60 negócios. A conversa continua na Kommo: o botão abre o negócio lá."}
      </p>
      {d.lista.length === 0 ? (
        <p className="glass mt-4 rounded-[16px] p-4 text-sm text-muted">Nenhum negócio aqui com estes filtros.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {d.lista.map((n) => {
            const parado = minutosDesde(n.etapa_desde, agora);
            const espera = n.sem_resposta ? minutosDesde(n.ultima_msg_cliente_em, agora) : null;
            const tomEspera = tomDaEsperaNaKommo(espera);
            const tomEsperando = n.fase === "esperando_vendedor" ? tomDaEsperaNaKommo(parado) : "neutro";
            const dono = n.pessoa ?? n.loja;
            return (
              <li key={n.id} className="glass min-w-0 rounded-[16px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{n.nome || `Negócio ${n.id}`}</p>
                    <p className="mt-0.5 break-words text-xs text-muted">
                      {n.funil ?? "Funil"} · {n.etapa ?? "Etapa"} · {nomeDaFase(n.fase)}
                    </p>
                  </div>
                  {n.valor ? <p className="numeros shrink-0 text-sm font-semibold text-ink">{reais(Number(n.valor))}</p> : null}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <Selo tom={tomEsperando}>
                    <Hourglass size={12} aria-hidden className="mr-1 inline align-[-2px]" />
                    {parado === null ? "Sem data na etapa" : `Na etapa há ${tempoPorExtenso(parado)}`}
                  </Selo>
                  {espera !== null ? <Selo tom={tomEspera === "neutro" ? "atencao" : tomEspera}>Cliente sem resposta há {tempoPorExtenso(espera)}</Selo> : null}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {dono ? `De ${[n.pessoa, n.loja].filter(Boolean).join(", ")}` : n.responsavel ? `Com ${n.responsavel} na Kommo, sem dono no painel` : "Sem responsável na Kommo"}
                  {`, origem: ${n.origem}`}
                </p>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink underline underline-offset-2"
                >
                  Abrir na Kommo <ExternalLink size={12} aria-hidden />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function TelaDoFunil({
  dados, alertas, filtros, agora, diretoria,
}: { dados: FunilUnico | null; alertas: AlertasDaKommo | null; filtros: Filtros; agora: number; diretoria: boolean }) {
  const cabecalho = (
    <header>
      <p className="eyebrow">Vendas</p>
      <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Funil da Kommo</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
        Os 25 funis da Kommo num funil só: cada etapa ligada a uma fase padrão, de quem chegou até quem pagou. Lido do
        espelho da Kommo, que anda de dez em dez minutos.
      </p>
    </header>
  );
  if (!dados) {
    return (
      <>
        {cabecalho}
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-muted">Não deu para ler o funil agora.</p>
      </>
    );
  }
  if (!dados.lido_em) {
    return (
      <>
        {cabecalho}
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-ink">
          A Kommo ainda não foi lida pelo painel. O funil aparece depois da primeira leitura, que começa quando a chave da
          Kommo estiver colada em{" "}
          <Link href="/admin/integracoes" className="font-semibold underline underline-offset-2">Integrações</Link>.
        </p>
      </>
    );
  }

  const abertos = dados.fases.filter((x) => FASES_ABERTAS.includes(x.fase as Fase) || x.fase === null);
  const totalAbertos = abertos.reduce((s, x) => s + Number(x.abertos), 0);
  const emJogo = abertos.reduce((s, x) => s + Number(x.valor), 0);
  const p = dados.periodo;
  const conv = conversao(p.ganhos, p.perdidos);
  const pr = dados.primeira_resposta;
  const semFase = dados.fases.find((x) => x.fase === null)?.abertos ?? 0;
  const totalPerdidos = dados.motivos.reduce((s, m) => s + Number(m.perdidos), 0);

  return (
    <>
      {cabecalho}

      {alertas ? (
        <section className="mt-6" aria-label="Alertas">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CartaoDeAlerta Icone={Clock} titulo="Esperando vendedor" x={alertas.esperando} href="/admin/funil?alerta=esperando" ativo={filtros.alerta === "esperando"} />
            <CartaoDeAlerta Icone={MessageCircleWarning} titulo="Cliente sem resposta" x={alertas.sem_resposta} href="/admin/funil?alerta=sem_resposta" ativo={filtros.alerta === "sem_resposta"} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            <TriangleAlert size={12} aria-hidden className="mr-1 inline align-[-2px]" />
            Os prazos são premissa do painel, não regra da JK: {tempoPorExtenso(PRAZOS_DA_KOMMO.atencao)} é atenção e{" "}
            {tempoPorExtenso(PRAZOS_DA_KOMMO.ruim)} é atraso, de relógio corrido, os mesmos dos pedidos de resposta do chat do
            time. Mudam quando a JK disser o combinado. Esperando vendedor conta desde a entrada na etapa; sem resposta, desde a
            última mensagem do cliente que ninguém da loja respondeu. Os alertas não olham os filtros abaixo.
          </p>
        </section>
      ) : null}

      <Filtro d={dados} f={filtros} />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao Icone={Layers} rotulo="Abertos agora">{inteiro(totalAbertos)}</Cartao>
        <Cartao Icone={Wallet} rotulo="Valor em jogo" apoio="só dos negócios com valor preenchido">{reais(emJogo)}</Cartao>
        <Cartao
          Icone={Percent}
          rotulo={`Conversão em ${dados.dias} dias`}
          apoio={`${inteiro(p.ganhos)} ganhos de ${inteiro(p.ganhos + p.perdidos)} fechados${p.valor_ganho > 0 ? `, ${reais(p.valor_ganho)}` : ""}`}
        >
          {conv === null ? "Sem fechados" : `${Math.round(conv * 100)}%`}
        </Cartao>
        <Cartao
          Icone={Timer}
          rotulo="Primeira resposta"
          apoio={`mediana dos ${inteiro(pr.com_resposta)} criados no período com resposta; ${inteiro(pr.sem_resposta)} sem mensagem da loja`}
        >
          {pr.mediana_min === null ? "Sem dado" : tempoPorExtenso(Number(pr.mediana_min))}
        </Cartao>
      </div>

      {semFase > 0 || dados.sem_mapa > 0 ? (
        <div className="mt-4 space-y-2">
          {semFase > 0 ? (
            <p className="flex items-start gap-2 rounded-[14px] p-3 text-sm" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
              <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {inteiro(semFase)} {semFase === 1 ? "negócio aberto está" : "negócios abertos estão"} em etapa sem fase e ficam fora
                das fases.{" "}
                {diretoria ? (
                  <Link href="/admin/kommo/fases" className="font-semibold underline underline-offset-2">Ligar as etapas</Link>
                ) : (
                  "A diretoria liga a etapa a uma fase em Fases da Kommo."
                )}
              </span>
            </p>
          ) : null}
          {dados.sem_mapa > 0 ? (
            <p className="flex items-start gap-2 rounded-[14px] bg-white/70 p-3 text-sm text-muted">
              <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {inteiro(dados.sem_mapa)} {dados.sem_mapa === 1 ? "negócio aberto é" : "negócios abertos são"} de usuário da Kommo
                sem ligação no painel: não entram no filtro de loja nem de vendedor.
                {diretoria ? (
                  <>
                    {" "}
                    <Link href="/admin/kommo" className="font-semibold underline underline-offset-2">Quem é quem na Kommo</Link>
                  </>
                ) : null}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <Fases d={dados} />

      <section className="mt-8" aria-label="Motivos de perda">
        <h2 className="font-display text-2xl text-ink">Motivos de perda</h2>
        <p className="mt-1 text-sm text-muted">
          Negócios perdidos nos últimos {dados.dias} dias, pelo motivo marcado na Kommo. Perdido em funil de pós-venda (PDV, SAC)
          não entra.
        </p>
        {dados.motivos.length === 0 ? (
          <p className="glass mt-4 rounded-[16px] p-4 text-sm text-muted">Nenhum negócio perdido no período com estes filtros.</p>
        ) : (
          <div className="glass mt-4 rounded-[16px] p-4">
            <ListaComBarra
              total={totalPerdidos}
              linhas={dados.motivos.map((m) => ({
                chave: m.motivo,
                nome: m.motivo,
                valor: Number(m.perdidos),
                direita: `${inteiro(m.perdidos)}${totalPerdidos ? `, ${Math.round((Number(m.perdidos) / totalPerdidos) * 100)}%` : ""}`,
                apoio: Number(m.valor) > 0 ? `${reais(Number(m.valor))} em valor preenchido` : undefined,
              }))}
            />
          </div>
        )}
      </section>

      <Lista d={dados} f={filtros} agora={agora} />
    </>
  );
}
