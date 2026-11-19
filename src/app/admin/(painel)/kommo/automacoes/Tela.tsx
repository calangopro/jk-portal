"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CircleCheck, CircleSlash, CircleX, ExternalLink, Hourglass, Power, PowerOff, Undo2 } from "lucide-react";
import { AUTOMACOES, MARCOS, NOME_DA_AUTOMACAO, NOME_DO_MARCO, conferirConfig, type IdDaAutomacao, type Marco } from "@/lib/kommo/automacoes-regra";
import type { ResultadoDaAutomacao } from "./actions";

/** O que `kommo_automacoes_lista` (0173) devolve. */
export type DadosDasAutomacoes = {
  tem_chave: boolean;
  automacoes: {
    id: IdDaAutomacao;
    ativa: boolean;
    funil_id: number | null;
    etapa_id: number | null;
    etapas: Partial<Record<Marco, number | null>>;
    responsavel_id: number | null;
    espera_min: number;
    limite_por_hora: number;
    ativada_em: string | null;
    ativada_por: string | null;
    editada_em: string | null;
    editada_por: string | null;
    problema: string | null;
    feitas_30d: number;
    falhas_30d: number;
  }[];
  funis: { id: number; nome: string; etapas: { id: number; nome: string; ordem: number; tipo: string }[] }[];
  usuarios: { id: number; nome: string }[];
  escritas: {
    id: number;
    automacao: IdDaAutomacao;
    acao: "criar_negocio" | "mover_negocio" | "criar_tarefa";
    estado: "enviando" | "ok" | "recusada" | "erro" | "desistiu";
    referencia: string | null;
    rotulo: string | null;
    negocio_id: number | null;
    http: number | null;
    erro: string | null;
    criado_em: string;
    feita_por: string | null;
  }[];
};

type Props = {
  dados: DadosDasAutomacoes | null;
  aoSalvar: (id: string, config: Record<string, unknown>) => Promise<ResultadoDaAutomacao>;
  aoLigar: (id: string, conferiu: boolean) => Promise<ResultadoDaAutomacao>;
  aoDesligar: (id: string) => Promise<ResultadoDaAutomacao>;
};

const campo = "w-full min-w-0 rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand disabled:opacity-60";
const rotulo = "text-xs font-semibold text-ink";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const ACAO: Record<DadosDasAutomacoes["escritas"][number]["acao"], string> = {
  criar_negocio: "Criou negócio",
  mover_negocio: "Moveu negócio",
  criar_tarefa: "Criou tarefa",
};

const ESTADO: Record<DadosDasAutomacoes["escritas"][number]["estado"], { nome: string; cor: string; Icone: typeof CircleCheck }> = {
  ok: { nome: "Feito", cor: "text-emerald-800", Icone: CircleCheck },
  desistiu: { nome: "Não escreveu", cor: "text-muted", Icone: Undo2 },
  recusada: { nome: "Recusado pela Kommo", cor: "text-red-800", Icone: CircleX },
  erro: { nome: "Erro", cor: "text-red-800", Icone: AlertTriangle },
  enviando: { nome: "Sem resposta", cor: "text-amber-800", Icone: Hourglass },
};

type Automacao = DadosDasAutomacoes["automacoes"][number];
type Funil = DadosDasAutomacoes["funis"][number];

const abertas = (f: Funil | undefined) => (f?.etapas ?? []).filter((e) => e.tipo === "entrada" || e.tipo === "aberta");

function Cartao({ a, dados, aoSalvar, aoLigar, aoDesligar }: { a: Automacao; dados: DadosDasAutomacoes } & Omit<Props, "dados">) {
  const info = AUTOMACOES.find((x) => x.id === a.id)!;
  const [funil, setFunil] = useState<string>(a.funil_id ? String(a.funil_id) : "");
  const [etapa, setEtapa] = useState<string>(a.etapa_id ? String(a.etapa_id) : "");
  const [etapas, setEtapas] = useState<Record<Marco, string>>({
    pago: a.etapas?.pago ? String(a.etapas.pago) : "",
    enviado: a.etapas?.enviado ? String(a.etapas.enviado) : "",
    entregue: a.etapas?.entregue ? String(a.etapas.entregue) : "",
  });
  const [resp, setResp] = useState<string>(a.responsavel_id ? String(a.responsavel_id) : "");
  const [espera, setEspera] = useState(String(a.espera_min));
  const [limite, setLimite] = useState(String(a.limite_por_hora));
  const [conferiu, setConferiu] = useState(false);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, comecar] = useTransition();

  const f = dados.funis.find((x) => String(x.id) === funil);
  const opcoes = abertas(f);
  const mudou =
    funil !== (a.funil_id ? String(a.funil_id) : "") ||
    etapa !== (a.etapa_id ? String(a.etapa_id) : "") ||
    resp !== (a.responsavel_id ? String(a.responsavel_id) : "") ||
    espera !== String(a.espera_min) ||
    limite !== String(a.limite_por_hora) ||
    MARCOS.some((m) => etapas[m] !== (a.etapas?.[m] ? String(a.etapas[m]) : ""));

  const problema = conferirConfig(
    {
      id: a.id,
      funilId: funil ? Number(funil) : null,
      etapaId: etapa ? Number(etapa) : null,
      etapas: Object.fromEntries(MARCOS.map((m) => [m, etapas[m] ? Number(etapas[m]) : null])),
      responsavelId: resp ? Number(resp) : null,
      esperaMin: Number(espera),
      limitePorHora: Number(limite),
    },
    dados.funis,
  );

  const nomeDaEtapa = (id: number | null | undefined) => dados.funis.find((x) => x.id === a.funil_id)?.etapas.find((e) => e.id === id)?.nome ?? "?";
  const funilSalvo = dados.funis.find((x) => x.id === a.funil_id)?.nome ?? null;
  const ondeSalvo =
    a.id === "pos_venda"
      ? MARCOS.filter((m) => a.etapas?.[m]).map((m) => `${NOME_DO_MARCO[m]} vai para "${nomeDaEtapa(a.etapas[m])}"`).join("; ")
      : a.id === "tarefas"
        ? funilSalvo ? `só em negócio aberto no funil ${funilSalvo}` : "no negócio aberto mais recente do cliente, em qualquer funil"
        : a.etapa_id ? `na etapa "${nomeDaEtapa(a.etapa_id)}"` : "";

  const rodar = (fn: () => Promise<ResultadoDaAutomacao>) => {
    setRecado(null);
    comecar(async () => {
      const r = await fn();
      setRecado({ ok: r.ok, texto: r.ok ? r.aviso ?? "Feito." : r.erro ?? "Não deu certo." });
      if (r.ok) setConferiu(false);
    });
  };

  const salvar = () =>
    rodar(() =>
      aoSalvar(a.id, {
        funil_id: funil ? Number(funil) : null,
        etapa_id: etapa ? Number(etapa) : null,
        etapas: Object.fromEntries(MARCOS.filter((m) => etapas[m]).map((m) => [m, Number(etapas[m])])),
        responsavel_id: resp ? Number(resp) : null,
        espera_min: Number(espera),
        limite_por_hora: Number(limite),
      }),
    );

  const id = (s: string) => `${a.id}-${s}`;

  return (
    <li className="glass min-w-0 rounded-[16px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 break-words text-lg font-semibold text-ink">{info.nome}</h2>
        {a.ativa ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <Power size={12} aria-hidden /> Ligada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-muted">
            <PowerOff size={12} aria-hidden /> Desligada
          </span>
        )}
      </div>
      {a.ativa ? (
        <p className="mt-1 text-xs text-muted">
          Ligada por {a.ativada_por ?? "alguém"} em {quando(a.ativada_em)}. As escritas saem no nome dessa pessoa.
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
        <div className="min-w-0">
          <dt className={rotulo}>Quando</dt>
          <dd className="text-muted">{info.quando}</dd>
        </div>
        <div className="min-w-0">
          <dt className={rotulo}>O que faz na Kommo</dt>
          <dd className="text-muted">{info.efeito}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">
        Nos últimos 30 dias: {a.feitas_30d} {a.feitas_30d === 1 ? "escrita feita" : "escritas feitas"}
        {a.falhas_30d ? `, ${a.falhas_30d} com erro ou recusa` : ""}.
      </p>

      <fieldset className="mt-4 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-2" disabled={ocupado}>
        <legend className="sr-only">Configuração de {info.nome}</legend>
        <div className="min-w-0 sm:col-span-2">
          <label className={rotulo} htmlFor={id("funil")}>{a.id === "tarefas" ? "Funil (opcional)" : "Funil"}</label>
          <select id={id("funil")} className={`${campo} mt-1`} value={funil} onChange={(e) => { setFunil(e.target.value); setEtapa(""); setEtapas({ pago: "", enviado: "", entregue: "" }); }}>
            <option value="">{a.id === "tarefas" ? "Qualquer funil" : "Escolha o funil"}</option>
            {dados.funis.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>

        {a.id === "recuperacao" || a.id === "sac" ? (
          <>
            <div className="min-w-0">
              <label className={rotulo} htmlFor={id("etapa")}>Etapa onde o negócio nasce</label>
              <select id={id("etapa")} className={`${campo} mt-1`} value={etapa} onChange={(e) => setEtapa(e.target.value)} disabled={!f}>
                <option value="">{f ? "Escolha a etapa" : "Escolha o funil antes"}</option>
                {opcoes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className={rotulo} htmlFor={id("resp")}>Responsável do negócio criado</label>
              <select id={id("resp")} className={`${campo} mt-1`} value={resp} onChange={(e) => setResp(e.target.value)}>
                <option value="">O que a Kommo escolher</option>
                {dados.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {a.id === "pos_venda"
          ? MARCOS.map((m) => (
              <div key={m} className="min-w-0">
                <label className={rotulo} htmlFor={id(m)}>{NOME_DO_MARCO[m]}: mover para</label>
                <select id={id(m)} className={`${campo} mt-1`} value={etapas[m]} onChange={(e) => setEtapas((x) => ({ ...x, [m]: e.target.value }))} disabled={!f}>
                  <option value="">Não mover</option>
                  {opcoes.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            ))
          : null}

        {a.id !== "tarefas" ? (
          <div className="min-w-0">
            <label className={rotulo} htmlFor={id("espera")}>Espera depois do evento (minutos)</label>
            <input id={id("espera")} type="number" inputMode="numeric" min={0} max={1440} className={`${campo} mt-1`} value={espera} onChange={(e) => setEspera(e.target.value)} />
          </div>
        ) : null}
        <div className="min-w-0">
          <label className={rotulo} htmlFor={id("limite")}>Teto por hora</label>
          <input id={id("limite")} type="number" inputMode="numeric" min={1} max={60} className={`${campo} mt-1`} value={limite} onChange={(e) => setLimite(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={salvar}
            disabled={ocupado || !mudou}
            className="rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand disabled:opacity-50"
          >
            {ocupado ? "Salvando..." : "Salvar"}
          </button>
          {mudou && a.ativa ? <p className="text-xs text-amber-800">Salvar desliga a automação: a configuração nova precisa ser conferida e ligada de novo.</p> : null}
          {mudou && problema ? <p className="text-xs text-muted">Para ligar depois: {problema}</p> : null}
        </div>
      </fieldset>

      <div className="mt-4 border-t border-border/60 pt-4">
        {a.ativa ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => rodar(() => aoDesligar(a.id))}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <PowerOff size={14} aria-hidden /> Desligar agora
          </button>
        ) : !dados.tem_chave ? (
          <p className="text-sm text-muted">
            Para ligar, a chave da Kommo precisa estar colada em{" "}
            <Link href="/admin/integracoes" className="font-semibold underline underline-offset-2">Integrações</Link>.
          </p>
        ) : a.problema || mudou ? (
          <p className="text-sm text-muted">{mudou ? "Salve a configuração antes de ligar." : `Para ligar: ${problema ?? "confira a configuração."}`}</p>
        ) : (
          <div className="rounded-[12px] border border-amber-300 bg-amber-50/80 p-3">
            <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>Antes de ligar, confira o que vai acontecer</span>
            </p>
            <p className="mt-2 text-sm text-ink">
              Ligada, a partir de agora o painel vai: {info.efeito.charAt(0).toLowerCase() + info.efeito.slice(1)}
              {funilSalvo ? ` Funil: ${funilSalvo}${ondeSalvo ? `, ${ondeSalvo}` : ""}.` : ondeSalvo ? ` Onde: ${ondeSalvo}.` : ""}
            </p>
            {info.mandaMensagem ? (
              <p className="mt-2 text-sm text-ink">
                <strong>Criar ou mover negócio pode disparar o Salesbot da etapa e mandar WhatsApp para cliente de verdade.</strong> Abra o
                funil na Kommo e veja o que o Salesbot e as automações de cada etapa escolhida fazem. O texto que vai ao cliente é o que
                está na Kommo, não no painel.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Vale só para o que acontecer depois de ligar. Uma escrita por evento, no máximo {a.limite_por_hora} por hora. O que falhar
              fica no registro e não é tentado de novo sozinho. Quem ligar vira o autor de cada escrita.
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={conferiu} onChange={(e) => setConferiu(e.target.checked)} />
              <span>
                {info.mandaMensagem
                  ? "Conferi na Kommo o funil, as etapas e o que o Salesbot delas faz."
                  : "Conferi na Kommo em quais negócios e para quem as tarefas vão cair."}
              </span>
            </label>
            <button
              type="button"
              disabled={ocupado || !conferiu}
              onClick={() => rodar(() => aoLigar(a.id, conferiu))}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-50"
            >
              <Power size={14} aria-hidden /> {ocupado ? "Ligando..." : "Ligar"}
            </button>
          </div>
        )}
        {recado ? (
          <p role={recado.ok ? "status" : "alert"} className={`mt-2 text-xs ${recado.ok ? "text-emerald-800" : "text-red-800"}`}>{recado.texto}</p>
        ) : null}
      </div>
    </li>
  );
}

function Registro({ escritas }: { escritas: DadosDasAutomacoes["escritas"] }) {
  const [filtro, setFiltro] = useState<"todas" | "problemas">("todas");
  const lista = useMemo(() => (filtro === "todas" ? escritas : escritas.filter((e) => e.estado !== "ok" && e.estado !== "desistiu")), [escritas, filtro]);
  const problemas = escritas.filter((e) => e.estado !== "ok" && e.estado !== "desistiu").length;

  return (
    <section className="mt-8" aria-labelledby="registro">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="registro" className="text-lg font-semibold text-ink">O que o painel fez na Kommo</h2>
        <div className="flex gap-1" role="group" aria-label="Filtro do registro">
          {(["todas", "problemas"] as const).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={filtro === x}
              onClick={() => setFiltro(x)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === x ? "bg-ink text-white" : "bg-white/70 text-ink"}`}
            >
              {x === "todas" ? "Tudo" : `Recusas e erros (${problemas})`}
            </button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <p className="glass mt-3 rounded-[16px] p-4 text-sm text-muted">
          {escritas.length === 0 ? "Nenhuma escrita ainda. Enquanto as automações estiverem desligadas, o painel não escreve nada na Kommo." : "Nenhuma recusa nem erro."}
        </p>
      ) : (
        <ul className="glass mt-3 divide-y divide-border/60 rounded-[16px] px-4">
          {lista.map((e) => {
            const est = ESTADO[e.estado];
            return (
              <li key={e.id} className="grid min-w-0 grid-cols-1 gap-1 py-3">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className={`inline-flex items-center gap-1 font-semibold ${est.cor}`}>
                    <est.Icone size={12} aria-hidden /> {est.nome}
                  </span>
                  <span className="text-muted">{NOME_DA_AUTOMACAO[e.automacao]}</span>
                  <span className="text-muted">{quando(e.criado_em)}</span>
                  {e.feita_por ? <span className="text-muted">em nome de {e.feita_por}</span> : null}
                </p>
                <p className="min-w-0 break-words text-sm text-ink [overflow-wrap:anywhere]">
                  {ACAO[e.acao]}: {e.rotulo ?? e.referencia ?? ""}
                </p>
                {e.erro ? (
                  <p className="min-w-0 break-words text-xs text-muted [overflow-wrap:anywhere]">
                    {e.http ? `(${e.http}) ` : ""}
                    {e.erro}
                  </p>
                ) : null}
                {e.negocio_id ? (
                  <a
                    href={`https://kathleengfz.kommo.com/leads/detail/${e.negocio_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs font-semibold underline underline-offset-2"
                  >
                    Abrir o negócio na Kommo <ExternalLink size={12} aria-hidden />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function TelaDasAutomacoes({ dados, aoSalvar, aoLigar, aoDesligar }: Props) {
  const ligadas = dados?.automacoes.filter((a) => a.ativa).length ?? 0;
  return (
    <>
      <header>
        <p className="eyebrow">Sistema</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Automações da Kommo</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          O que o painel cria e move na Kommo sozinho, a partir do que acontece na loja e no painel. Todas nascem desligadas, e só a
          diretoria escolhe o funil, a etapa e liga. Desligar para tudo na hora.
        </p>
      </header>

      {!dados ? (
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-muted">Não deu para ler as automações agora.</p>
      ) : (
        <>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink">
            {ligadas ? <Power size={14} aria-hidden /> : <CircleSlash size={14} aria-hidden />}
            {ligadas === 0 ? "Nenhuma automação ligada: o painel não escreve nada na Kommo." : `${ligadas} de 4 ${ligadas === 1 ? "ligada" : "ligadas"}.`}
          </p>
          {dados.funis.length === 0 ? (
            <p className="glass mt-3 rounded-[16px] p-4 text-sm text-ink">
              Os funis chegam na primeira leitura da Kommo, depois que a chave estiver colada em{" "}
              <Link href="/admin/integracoes" className="font-semibold underline underline-offset-2">Integrações</Link>.
            </p>
          ) : null}
          <ul className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {dados.automacoes.map((a) => (
              <Cartao key={a.id} a={a} dados={dados} aoSalvar={aoSalvar} aoLigar={aoLigar} aoDesligar={aoDesligar} />
            ))}
          </ul>
          <Registro escritas={dados.escritas} />
        </>
      )}
    </>
  );
}
