"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleCheck, CircleSlash, Power, PowerOff, Store } from "lucide-react";
import { sugerirLigacao, type LigacaoDaLoja } from "@/lib/kommo/balcao-regra";
import type { ResultadoDaAutomacao } from "./actions";

/** O que `balcao_kommo_config` (0201) devolve. */
export type ConfigDoBalcao = {
  lojas: (LigacaoDaLoja & { completa_pedido: boolean; completa_lead: boolean; editado_em: string })[];
  automacoes: { id: "balcao_pedido" | "balcao_lead"; ativa: boolean; ativada_em: string | null; ativada_por: string | null; problema: string | null; feitas_30d: number; falhas_30d: number; limite_por_hora: number }[];
  pedidos_30d: number;
  leads_30d: number;
};

type Funil = { id: number; nome: string; etapas: { id: number; nome: string; ordem: number; tipo: string }[] };

const campo = "w-full min-w-0 rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand disabled:opacity-60";
const rotulo = "text-xs font-semibold text-ink";

const NOME = { balcao_pedido: "Pedido do balcão", balcao_lead: "Lead do balcão" } as const;
const EFEITO = {
  balcao_pedido:
    "Cada pedido salvo no Balcão da loja vira um negócio no funil e na etapa escolhidos para aquela loja (o LOJA | PDV, Lançamento), com o contato do cliente, os campos que a loja preenchia à mão, uma nota com o resumo e as tags loja-fisica, a da loja e o nome do vendedor. Cada compra é um negócio novo.",
  balcao_lead:
    "Cada lead salvo no Balcão (quem visitou e não comprou) vira um negócio no funil e na etapa escolhidos para lead daquela loja (o LOJA | WHATS, Entrada), com as mesmas tags e a tag lead-balcao. Não cria se o cliente já tem negócio aberto nesse funil.",
} as const;

const abertas = (f: Funil | undefined) => (f?.etapas ?? []).filter((e) => e.tipo === "entrada" || e.tipo === "aberta");

export function BalcaoNaKommo({
  config, funis, usuarios, lojas, opcoesDeLoja, aoSalvar, aoLigar, aoDesligar,
}: {
  config: ConfigDoBalcao | null;
  funis: Funil[];
  usuarios: { id: number; nome: string }[];
  lojas: string[];
  opcoesDeLoja: string[];
  aoSalvar: (loja: string, ligacao: Record<string, unknown>) => Promise<ResultadoDaAutomacao>;
  aoLigar: (id: string, conferiu: boolean) => Promise<ResultadoDaAutomacao>;
  aoDesligar: (id: string) => Promise<ResultadoDaAutomacao>;
}) {
  if (!config) return <p className="glass mt-6 rounded-[16px] p-4 text-sm text-muted">Não deu para ler o balcão da loja agora.</p>;
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <Store size={18} aria-hidden /> Balcão da loja
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        O que as lojas salvam no Balcão vai para a Kommo com a tag da loja. Primeiro ligue cada loja (funil, etapa e responsável), depois ligue as automações.
        Mudar a ligação de uma loja desliga as duas. Nos últimos 30 dias: {config.pedidos_30d} pedidos e {config.leads_30d} leads no Balcão.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {config.automacoes.map((a) => (
          <Interruptor key={a.id} a={a} aoLigar={aoLigar} aoDesligar={aoDesligar} />
        ))}
      </ul>
      <h3 className="mt-6 text-sm font-semibold text-ink">A ligação de cada loja</h3>
      <p className="mt-1 text-xs text-muted">Responsável precisa ser usuário ATIVO na Kommo. A sugestão sai pelo nome da loja: confira antes de salvar.</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {lojas.map((loja) => (
          <Ligacao key={loja} loja={loja} salva={config.lojas.find((l) => l.loja === loja)} funis={funis} usuarios={usuarios} opcoesDeLoja={opcoesDeLoja} aoSalvar={aoSalvar} />
        ))}
      </ul>
    </section>
  );
}

function Interruptor({ a, aoLigar, aoDesligar }: { a: ConfigDoBalcao["automacoes"][number]; aoLigar: (id: string, conferiu: boolean) => Promise<ResultadoDaAutomacao>; aoDesligar: (id: string) => Promise<ResultadoDaAutomacao> }) {
  const [conferiu, setConferiu] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, comecar] = useTransition();
  const agir = (f: () => Promise<ResultadoDaAutomacao>) =>
    comecar(async () => {
      const r = await f();
      setMsg({ ok: r.ok, texto: r.ok ? r.aviso ?? "Feito." : r.erro ?? "Não deu." });
    });
  return (
    <li className="glass min-w-0 rounded-[18px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-ink">{NOME[a.id]}</p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${a.ativa ? "text-emerald-800" : "text-muted"}`}>
          {a.ativa ? <CircleCheck size={13} aria-hidden /> : <CircleSlash size={13} aria-hidden />} {a.ativa ? "Ligada" : "Desligada"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{EFEITO[a.id]}</p>
      <p className="mt-2 text-xs font-semibold text-[#9a4a07]">Criar negócio na etapa pode disparar o Salesbot dela e mandar WhatsApp ao cliente.</p>
      {a.ativa ? (
        <p className="mt-2 text-xs text-muted">Ligada por {a.ativada_por ?? "alguém da diretoria"}. Em 30 dias: {a.feitas_30d} feitas, {a.falhas_30d} com problema.</p>
      ) : a.problema === "lojas" ? (
        <p className="mt-2 text-xs text-muted">Para ligar, falta pelo menos uma loja com {a.id === "balcao_pedido" ? "funil e etapa do pedido" : "funil e etapa do lead"} e responsável.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {a.ativa ? (
          <button type="button" disabled={ocupado} onClick={() => agir(() => aoDesligar(a.id))} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">
            <PowerOff size={14} aria-hidden /> Desligar
          </button>
        ) : (
          <>
            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="checkbox" checked={conferiu} onChange={(e) => setConferiu(e.target.checked)} /> Conferi o Salesbot das etapas escolhidas
            </label>
            <button type="button" disabled={ocupado || !conferiu || Boolean(a.problema)} onClick={() => agir(() => aoLigar(a.id, conferiu))} className="painel-aba-ativa inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60">
              <Power size={14} aria-hidden /> Ligar
            </button>
          </>
        )}
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-xs font-semibold ${msg.ok ? "text-emerald-800" : "text-red-800"}`}>{msg.texto}</p> : null}
    </li>
  );
}

function Ligacao({ loja, salva, funis, usuarios, opcoesDeLoja, aoSalvar }: {
  loja: string;
  salva: ConfigDoBalcao["lojas"][number] | undefined;
  funis: Funil[];
  usuarios: { id: number; nome: string }[];
  opcoesDeLoja: string[];
  aoSalvar: (loja: string, ligacao: Record<string, unknown>) => Promise<ResultadoDaAutomacao>;
}) {
  const sugestao = useMemo(() => (salva ? null : sugerirLigacao(loja, funis, opcoesDeLoja)), [salva, loja, funis, opcoesDeLoja]);
  const ini = salva ?? sugestao ?? {};
  const txt = (v: number | null | undefined) => (v ? String(v) : "");
  const [lk, setLk] = useState(ini.loja_kommo ?? "");
  const [tag, setTag] = useState(salva?.tag ?? "");
  const [fp, setFp] = useState(txt(ini.funil_pedido));
  const [ep, setEp] = useState(txt(ini.etapa_pedido));
  const [fl, setFl] = useState(txt(ini.funil_lead));
  const [el, setEl] = useState(txt(ini.etapa_lead));
  const [resp, setResp] = useState(txt(salva?.responsavel_id));
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, comecar] = useTransition();
  const funilP = funis.find((f) => String(f.id) === fp);
  const funilL = funis.find((f) => String(f.id) === fl);
  const estado = salva ? (salva.completa_pedido && salva.completa_lead ? "Ligada" : salva.completa_pedido ? "Só o pedido" : salva.completa_lead ? "Só o lead" : "Incompleta") : sugestao?.funil_pedido ? "Sugestão, não salva" : "Não ligada";

  const salvar = () =>
    comecar(async () => {
      const r = await aoSalvar(loja, { loja_kommo: lk, tag, funil_pedido: fp, etapa_pedido: ep, funil_lead: fl, etapa_lead: el, responsavel_id: resp });
      setMsg({ ok: r.ok, texto: r.ok ? r.aviso ?? "Salvo." : r.erro ?? "Não deu." });
    });

  return (
    <li className="glass min-w-0 rounded-[16px]">
      <details open={!salva}>
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
          <span className="text-sm font-semibold text-ink">{loja}</span>
          <span className={`text-xs font-semibold ${salva?.completa_pedido ? "text-emerald-800" : "text-muted"}`}>{estado}</span>
        </summary>
        <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1">
            <span className={rotulo}>Funil do pedido</span>
            <select value={fp} onChange={(e) => { setFp(e.target.value); setEp(""); }} className={campo}>
              <option value="">Nenhum</option>
              {funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className={rotulo}>Etapa do pedido</span>
            <select value={ep} onChange={(e) => setEp(e.target.value)} className={campo} disabled={!funilP}>
              <option value="">Escolha</option>
              {abertas(funilP).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className={rotulo}>Funil do lead</span>
            <select value={fl} onChange={(e) => { setFl(e.target.value); setEl(""); }} className={campo}>
              <option value="">Nenhum</option>
              {funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className={rotulo}>Etapa do lead</span>
            <select value={el} onChange={(e) => setEl(e.target.value)} className={campo} disabled={!funilL}>
              <option value="">Escolha</option>
              {abertas(funilL).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className={rotulo}>Responsável na Kommo</span>
            <select value={resp} onChange={(e) => setResp(e.target.value)} className={campo}>
              <option value="">Escolha</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className={rotulo}>Campo &ldquo;Loja&rdquo; da Kommo</span>
            <select value={lk} onChange={(e) => setLk(e.target.value)} className={campo}>
              <option value="">Deixar vazio</option>
              {opcoesDeLoja.map((o) => <option key={o} value={o}>{o}</option>)}
              {lk && !opcoesDeLoja.includes(lk) ? <option value={lk}>{lk}</option> : null}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 sm:col-span-2">
            <span className={rotulo}>Tag da loja</span>
            <input value={tag} onChange={(e) => setTag(e.target.value.slice(0, 60))} placeholder={`LOJA ${(lk || loja.replace(/^JK\s+/i, "")).toUpperCase()}`} className={campo} />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="button" disabled={ocupado} onClick={salvar} className="painel-aba-ativa inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60">
              Salvar a ligação
            </button>
            {msg ? <span role={msg.ok ? "status" : "alert"} className={`text-xs font-semibold ${msg.ok ? "text-emerald-800" : "text-red-800"}`}>{msg.texto}</span> : null}
          </div>
        </div>
      </details>
    </li>
  );
}
