"use client";

import { useState, useTransition } from "react";
import { CircleAlert, LoaderCircle, Pencil, Plus, Power, PowerOff, Trash2, TriangleAlert } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import type { AutomacaoNaTela, EntradaDaRegra } from "@/lib/redes/automacoes";
import { conferirRegra, lerPalavras } from "@/lib/redes/automacoes-regra";
import { nomeDaRede, type RedeId } from "@/lib/redes/redes";
import { SeloDeTom } from "../../Pecas";
import type { RespostaDaRegra } from "./actions";

/**
 * As automações das redes, só o desenho. Cada regra mostra o texto EXATO que
 * vai sair, e ligar pede um segundo toque com esse texto repetido e o aviso do
 * ManyChat. Quem não é administrador monta e desliga, mas não liga.
 */

export type AcoesDeAutomacao = {
  salvar: (id: string | null, entrada: EntradaDaRegra) => Promise<RespostaDaRegra>;
  ligar: (id: string) => Promise<RespostaDaRegra>;
  desligar: (id: string) => Promise<RespostaDaRegra>;
  apagar: (id: string) => Promise<RespostaDaRegra>;
};

type ContaDaTela = { id: string; rede: RedeId; nome: string; ativa: boolean };
type PublicacaoDaTela = { id: string; contaId: string; legenda: string; quando: string | null };

const campo = "w-full rounded-[12px] border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-[var(--setor)]";
const rotulo = "text-xs font-semibold text-ink";
const ESPERAS = [
  { min: 30, nome: "30 minutos" },
  { min: 60, nome: "1 hora" },
  { min: 120, nome: "2 horas" },
  { min: 360, nome: "6 horas" },
];

const dia = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Formulario({
  regra, contas, publicacoes, acoes, aoFechar,
}: {
  regra: AutomacaoNaTela | null;
  contas: ContaDaTela[];
  publicacoes: PublicacaoDaTela[];
  acoes: AcoesDeAutomacao;
  aoFechar: (aviso?: string) => void;
}) {
  const [nome, setNome] = useState(regra?.nome ?? "");
  const [contaId, setContaId] = useState(regra?.contaId ?? contas[0]?.id ?? "");
  const [publicacaoId, setPublicacaoId] = useState(regra?.publicacaoId ?? "");
  const [palavras, setPalavras] = useState((regra?.palavras ?? []).join(", "));
  const [resposta, setResposta] = useState(regra?.resposta ?? "");
  const [esperaMin, setEsperaMin] = useState(regra?.esperaMin ?? 30);
  const [limitePorHora, setLimitePorHora] = useState(regra?.limitePorHora ?? 20);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, iniciar] = useTransition();

  const lidas = lerPalavras(palavras);
  const problema = conferirRegra({ nome, palavras: lidas, resposta, esperaMin, limitePorHora });
  const doConta = publicacoes.filter((p) => p.contaId === contaId);

  const enviar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await acoes.salvar(regra?.id ?? null, { nome, contaId, publicacaoId: publicacaoId || null, palavras: lidas, resposta, esperaMin, limitePorHora });
      if (r.ok) aoFechar(r.aviso);
      else setErro(r.erro);
    });

  return (
    <div className="glass rounded-[18px] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink">{regra ? "Editar a regra" : "Nova regra"}</h2>
      {regra?.ativa ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-[10px] px-3 py-2 text-xs leading-relaxed" style={{ color: "#9a4a07", background: "#fcefd9" }}>
          <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> Esta regra está ligada. Salvar uma mudança desliga: quem ligou aprovou o texto de antes.
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={rotulo}>Nome da regra</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Para achar depois: Preço, Catálogo…" className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className={rotulo}>Conta</span>
          <select value={contaId} onChange={(e) => { setContaId(e.target.value); setPublicacaoId(""); }} className={`${campo} mt-1`}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeDaRede(c.rede)} {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={rotulo}>Palavras que disparam a resposta</span>
          <input value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder="Separadas por vírgula: preço, valor, quanto custa" className={`${campo} mt-1`} />
          <span className="mt-1 block text-[0.7rem] leading-relaxed text-muted">
            Basta uma aparecer no comentário, como palavra inteira. Acento e maiúscula não importam: &quot;preco&quot; casa com &quot;Preço?&quot; e não casa com &quot;apreço&quot;.
            {lidas.length ? ` Lidas: ${lidas.join(" · ")}.` : ""}
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className={rotulo}>Resposta, exatamente como vai sair</span>
          <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} maxLength={520} placeholder="O texto que a JK responde embaixo do comentário, em público" className={`${campo} mt-1 resize-y leading-relaxed`} />
          <span className="mt-1 flex justify-between gap-3 text-[0.7rem] text-muted">
            <span>Não ponha preço, prazo nem promoção que possa mudar: a regra repete o mesmo texto até alguém trocar.</span>
            <span className="shrink-0">{resposta.length} de 500</span>
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className={rotulo}>Onde vale</span>
          <select value={publicacaoId} onChange={(e) => setPublicacaoId(e.target.value)} className={`${campo} mt-1`}>
            <option value="">Em qualquer publicação desta conta</option>
            {doConta.map((p) => (
              <option key={p.id} value={p.id}>
                Só nesta: {p.legenda}
                {p.quando ? ` (${new Date(p.quando).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={rotulo}>Esperar antes de responder</span>
          <select value={esperaMin} onChange={(e) => setEsperaMin(Number(e.target.value))} className={`${campo} mt-1`}>
            {ESPERAS.map((e) => (
              <option key={e.min} value={e.min}>
                {e.nome}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[0.7rem] leading-relaxed text-muted">É a vez de uma pessoa ou de outra ferramenta responder primeiro. Se alguém da conta responder nesse tempo, a regra não responde.</span>
        </label>
        <label className="block">
          <span className={rotulo}>No máximo por hora</span>
          <input type="number" min={1} max={60} value={limitePorHora} onChange={(e) => setLimitePorHora(Number(e.target.value))} className={`${campo} mt-1`} />
          <span className="mt-1 block text-[0.7rem] leading-relaxed text-muted">Se um post viralizar, a regra para nesse número e continua na hora seguinte.</span>
        </label>
      </div>

      {erro ?? problema ? (
        <p role={erro ? "alert" : undefined} className="mt-3 flex items-start gap-1.5 text-xs leading-snug" style={{ color: erro ? "#b01919" : "#9a4a07" }}>
          <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {erro ?? problema}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={enviar} disabled={Boolean(problema) || !contaId || rodando} className="painel-toque inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          {rodando ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : null}
          {rodando ? "Salvando…" : regra ? "Salvar" : "Criar, desligada"}
        </button>
        <button type="button" onClick={() => aoFechar()} disabled={rodando} className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Regra({ r, podeLigar, acoes, aoEditar }: { r: AutomacaoNaTela; podeLigar: boolean; acoes: AcoesDeAutomacao; aoEditar: () => void }) {
  const [pedindo, setPedindo] = useState<null | "ligar" | "apagar">(null);
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const [rodando, iniciar] = useTransition();
  const fazer = (f: () => Promise<RespostaDaRegra>) =>
    iniciar(async () => {
      const x = await f();
      setPedindo(null);
      setAviso(x.ok ? { tom: "bom", texto: x.aviso } : { tom: "ruim", texto: x.erro });
    });

  return (
    <li className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <SeloDaRede id={r.rede} tamanho={30} />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-ink">{r.nome}</p>
            <p className="truncate text-xs text-muted">
              {nomeDaRede(r.rede)} {r.conta}
            </p>
          </div>
        </div>
        {r.ativa ? <SeloDeTom tom="bom">Ligada</SeloDeTom> : <SeloDeTom tom="neutro">Desligada</SeloDeTom>}
      </div>

      <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Quando comentarem</p>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {r.palavras.map((p) => (
          <span key={p} className="break-all rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-semibold text-ink">
            {p}
          </span>
        ))}
      </p>
      <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-wide text-muted">A JK responde, em público</p>
      <p className="mt-1 whitespace-pre-line rounded-[10px] border-l-2 border-[var(--setor)] bg-white/70 px-3 py-2 text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{r.resposta}</p>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {r.publicacao ? <>Só na publicação &quot;{r.publicacao}&quot;. </> : "Em qualquer publicação da conta. "}
        Espera {r.esperaMin >= 60 ? `${r.esperaMin / 60} ${r.esperaMin === 60 ? "hora" : "horas"}` : `${r.esperaMin} minutos`} antes de responder, até {r.limitePorHora} por hora.
        {r.ativa && r.ativadaEm ? ` Ligada em ${dia(r.ativadaEm)}${r.ativadaPor ? `, por ${r.ativadaPor}` : ""}: só responde comentário escrito depois disso.` : ""}
        {r.respondidas || r.falhas ? ` Em 30 dias: ${r.respondidas} ${r.respondidas === 1 ? "resposta" : "respostas"}${r.falhas ? ` e ${r.falhas} que ${r.falhas === 1 ? "falhou" : "falharam"}` : ""}.` : ""}
      </p>
      {!r.contaPronta ? (
        <p className="mt-2 text-xs" style={{ color: "#b01919" }}>
          A conta desta regra precisa ser ligada de novo. Enquanto isso a regra não responde.
        </p>
      ) : null}

      {aviso ? (
        <p role={aviso.tom === "ruim" ? "alert" : "status"} className="mt-3 break-words rounded-[10px] px-3 py-2 text-xs font-semibold leading-relaxed" style={aviso.tom === "ruim" ? { color: "#b01919", background: "#fde8e8" } : { color: "#046c4e", background: "#e3f4ec" }}>
          {aviso.texto}
        </p>
      ) : null}

      {pedindo === "ligar" ? (
        <div className="mt-3 rounded-[12px] bg-ink/[0.04] p-3">
          <p className="text-xs leading-relaxed text-ink">
            A partir de agora, todo comentário novo com {r.palavras.length === 1 ? "esta palavra" : "uma destas palavras"} recebe esta resposta, em público, no nome da JK, sem ninguém conferir na hora:
          </p>
          <p className="mt-2 whitespace-pre-line rounded-[10px] bg-white px-3 py-2 text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{r.resposta}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: "#9a4a07" }}>
            <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            Se o ManyChat já responde esta palavra, não ligue aqui: a pessoa receberia duas respostas. O painel só enxerga a resposta pública do ManyChat, não a que ele manda por direct.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.ligar(r.id))} className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {rodando ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Power size={13} aria-hidden="true" />}
              Sim, ligar a regra
            </button>
            <button type="button" disabled={rodando} onClick={() => setPedindo(null)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
              Voltar
            </button>
          </div>
        </div>
      ) : pedindo === "apagar" ? (
        <div className="mt-3 rounded-[12px] bg-ink/[0.04] p-3">
          <p className="text-xs leading-relaxed text-ink">A regra é apagada, com o registro das respostas que ela deu. As respostas que já saíram continuam na rede.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.apagar(r.id))} className="painel-toque rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              Sim, apagar
            </button>
            <button type="button" disabled={rodando} onClick={() => setPedindo(null)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {r.ativa ? (
            <button type="button" disabled={rodando} onClick={() => fazer(() => acoes.desligar(r.id))} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-50">
              <PowerOff size={13} aria-hidden="true" /> Desligar
            </button>
          ) : podeLigar ? (
            <button type="button" disabled={!r.contaPronta} onClick={() => setPedindo("ligar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-40">
              <Power size={13} aria-hidden="true" /> Ligar
            </button>
          ) : (
            <span className="text-xs text-muted">Ligar é de administrador, dono ou GM.</span>
          )}
          <button type="button" onClick={aoEditar} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
            <Pencil size={13} aria-hidden="true" /> Editar
          </button>
          {!r.ativa ? (
            <button type="button" onClick={() => setPedindo("apagar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-wine">
              <Trash2 size={13} aria-hidden="true" /> Apagar
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function TelaDeAutomacoes({
  regras, contas, publicacoes, podeLigar, acoes,
}: {
  regras: AutomacaoNaTela[];
  contas: ContaDaTela[];
  publicacoes: PublicacaoDaTela[];
  podeLigar: boolean;
  acoes: AcoesDeAutomacao;
}) {
  const [editando, setEditando] = useState<string | "nova" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const fechar = (texto?: string) => {
    setEditando(null);
    setAviso(texto ?? null);
  };

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Social Media</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Automações</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Resposta pronta a comentário: quando alguém comenta uma palavra, a JK responde embaixo com um texto escolhido antes. Toda regra nasce desligada.
          </p>
        </div>
        {contas.length && editando === null ? (
          <button type="button" onClick={() => { setEditando("nova"); setAviso(null); }} className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} aria-hidden="true" /> Nova regra
          </button>
        ) : null}
      </header>

      <p className="mt-5 flex items-start gap-2 rounded-[14px] px-3.5 py-3 text-sm leading-relaxed" style={{ color: "#9a4a07", background: "#fcefd9" }}>
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>A JK já usa o ManyChat.</strong> Uma palavra que o ManyChat responde não deve ter regra ligada aqui, senão a pessoa recebe duas respostas. Esta tela só responde em público, embaixo do comentário: mandar direct para quem comentou ainda depende de a Meta aprovar o aplicativo.
        </span>
      </p>

      {aviso ? (
        <p role="status" className="mt-4 rounded-[12px] px-3.5 py-2.5 text-sm font-semibold" style={{ color: "#046c4e", background: "#e3f4ec" }}>
          {aviso}
        </p>
      ) : null}

      {editando === "nova" ? (
        <div className="mt-5">
          <Formulario regra={null} contas={contas} publicacoes={publicacoes} acoes={acoes} aoFechar={fechar} />
        </div>
      ) : null}

      {contas.length === 0 ? (
        <div className="glass mt-5 rounded-[20px] px-5 py-10 text-center sm:py-14">
          <p className="font-display text-xl text-ink">Nenhuma rede ligada ainda</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">As regras valem para uma conta ligada que deixe responder comentário (Instagram, Facebook ou YouTube).</p>
        </div>
      ) : regras.length === 0 && editando === null ? (
        <div className="glass mt-5 rounded-[20px] px-5 py-10 text-center sm:py-14">
          <p className="font-display text-xl text-ink">Nenhuma regra criada</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Uma regra junta as palavras que disparam, o texto da resposta e a conta. Ela fica desligada até um administrador ligar.</p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {regras.map((r) =>
            editando === r.id ? (
              <li key={r.id} className="min-w-0 xl:col-span-2">
                <Formulario regra={r} contas={contas} publicacoes={publicacoes} acoes={acoes} aoFechar={fechar} />
              </li>
            ) : (
              <Regra key={r.id} r={r} podeLigar={podeLigar} acoes={acoes} aoEditar={() => { setEditando(r.id); setAviso(null); }} />
            ),
          )}
        </ul>
      )}

      <p className="mt-5 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
        Cada comentário recebe no máximo uma resposta automática. A regra só responde comentário de primeiro nível, escrito depois de ela ser ligada, e que ninguém da conta respondeu durante a espera. Resposta que falhou não é tentada de novo. Os comentários respondidos aparecem em Comentários, aba Respondidos.
      </p>
    </div>
  );
}
