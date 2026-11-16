"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpRight, Check, ChevronDown, CircleAlert, CircleSlash, Clock, Plug } from "lucide-react";
import type { IntegracaoState } from "@/app/admin/(painel)/integracoes/actions";
import type { ContaNaTela, LigacaoDaRede } from "@/lib/redes/painel";
import { haQuanto } from "@/lib/redes/resumo";
import { comBasePath } from "@/lib/seo/base-path";
import { SeloDaRede } from "./Selo";

/**
 * As ligações das redes sociais: o que está ligado, o que venceu e o que falta
 * para ligar cada rede.
 *
 * O MESMO componente serve a dois lugares. Em Integrações (`acoes` presente) o
 * administrador cola o aplicativo ou o token, liga e desliga. Em Redes, Contas
 * ligadas (`acoes` ausente) a equipe só VÊ o estado: nenhum campo, nenhum botão
 * que mexa em credencial.
 *
 * Campo de segredo é só de escrita: nasce vazio mesmo com valor salvo, e o que
 * foi colado nunca volta para a tela.
 */

type Acao = (anterior: IntegracaoState, dados: FormData) => Promise<IntegracaoState>;

export type AcoesDeLigacao = {
  salvarAplicativo: Acao;
  ligarComToken: Acao;
  desligar: Acao;
};

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

const COR = {
  bom: { texto: "#046c4e", fundo: "#e3f4ec" },
  atencao: { texto: "#9a4a07", fundo: "#fcefd9" },
  ruim: { texto: "#b01919", fundo: "#fde8e8" },
  neutro: { texto: "#55606e", fundo: "#eef0f3" },
};

function Estado({ ligacao }: { ligacao: LigacaoDaRede }) {
  const ativas = ligacao.contas.filter((c) => c.status === "ativa").length;
  const vencidas = ligacao.contas.filter((c) => c.status === "expirada").length;
  const [cor, Icone, texto] =
    ligacao.rede.situacao === "sem_api"
      ? ([COR.neutro, CircleSlash, "Sem API"] as const)
      : vencidas > 0
        ? ([COR.ruim, CircleAlert, "Ligar de novo"] as const)
        : ativas > 0
          ? ([COR.bom, Check, ativas === 1 ? "Ligada" : `${ativas} contas ligadas`] as const)
          : ligacao.pronta
            ? ([COR.atencao, Plug, "Falta ligar"] as const)
            : ([COR.neutro, Clock, "Ainda não ligável"] as const);
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold" style={{ color: cor.texto, background: cor.fundo }}>
      <Icone size={12} aria-hidden="true" /> {texto}
    </span>
  );
}

function BotaoDeEnvio({ rotulo, ocupado, claro }: { rotulo: string; ocupado: string; claro?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        claro
          ? "rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine disabled:opacity-60"
          : "rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      }
    >
      {pending ? ocupado : rotulo}
    </button>
  );
}

function Resposta({ r }: { r: IntegracaoState }) {
  if (r.erro) return <p role="alert" className="break-words text-xs text-wine">{r.erro}</p>;
  if (r.ok) return <p role="status" className="break-words text-xs font-semibold" style={{ color: COR.bom.texto }}>{r.ok}</p>;
  return null;
}

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

function LinhaDaConta({ c, agora, desligar }: { c: ContaNaTela; agora: number; desligar?: Acao }) {
  const [resposta, acao] = useActionState<IntegracaoState, FormData>(desligar ?? (async () => ({})), {});
  const [confirmando, setConfirmando] = useState(false);
  const lida = haQuanto(c.lidaEm, agora);
  const vencida = c.status === "expirada";
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink/[0.06] text-xs font-bold text-muted">
          {c.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.fotoUrl} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            (c.nome || "?").replace(/^@/, "").slice(0, 2).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-ink">
            <span className="min-w-0 break-words">{c.nome}</span>
            {c.usuario && c.usuario !== c.nome ? <span className="text-xs font-normal text-muted">{c.usuario}</span> : null}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Ligada em {dia(c.conectadaEm)}
            {c.via === "token" ? ", por token" : ", pelo login da rede"}
            {vencida ? "" : lida ? `. Lida ${lida}` : ". Primeira leitura a caminho"}.
          </p>
          {vencida ? (
            <p className="mt-1.5 break-words rounded-[8px] px-2.5 py-1.5 text-xs leading-relaxed" style={{ color: COR.ruim.texto, background: COR.ruim.fundo }}>
              O acesso venceu ou foi retirado. {c.ultimoErro}
            </p>
          ) : c.ultimoErro ? (
            <p className="mt-1.5 break-words rounded-[8px] px-2.5 py-1.5 text-xs leading-relaxed" style={{ color: COR.atencao.texto, background: COR.atencao.fundo }}>
              Última leitura incompleta: {c.ultimoErro}
            </p>
          ) : null}
          {c.libera.length ? (
            <p className="mt-1.5 text-xs text-muted">
              <span className="font-semibold text-ink">Liberado:</span> {c.libera.join(", ")}.
            </p>
          ) : null}
          {c.falta.length ? (
            <p className="mt-0.5 text-xs text-muted">
              <span className="font-semibold text-ink">Ainda sem permissão para:</span> {c.falta.join(", ")}. Ligar de novo, com todas as permissões marcadas, resolve.
            </p>
          ) : null}
          {c.link ? (
            <a href={c.link} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--setor,#24339e)]">
              Abrir o perfil <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
      {desligar ? (
        <form action={acao} className="mt-2 flex flex-wrap items-center gap-2 pl-[3.25rem]">
          <input type="hidden" name="conta" value={c.id} />
          {confirmando ? (
            <>
              <span className="text-xs text-ink">Desligar apaga a credencial. Os números já lidos ficam.</span>
              <BotaoDeEnvio rotulo="Sim, desligar" ocupado="Desligando…" claro />
              <button type="button" onClick={() => setConfirmando(false)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className="rounded-full border border-ink/15 px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine">
              Desligar
            </button>
          )}
          <Resposta r={resposta} />
        </form>
      ) : null}
    </li>
  );
}

function FormularioDoAplicativo({ ligacao, salvar }: { ligacao: LigacaoDaRede; salvar: Acao }) {
  const [resposta, acao] = useActionState<IntegracaoState, FormData>(salvar, {});
  const a = ligacao.info?.aplicativo;
  if (!a) return null;
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="rede" value={ligacao.rede.id} />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">1. Aplicativo</p>
      <label className="block">
        <span className="text-xs font-semibold text-ink">{a.rotuloDoId}</span>
        <input name="app_id" defaultValue={ligacao.aplicativo?.id ?? ""} autoComplete="off" placeholder={a.exemploDoId} className={`${campo} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-ink">{a.rotuloDoSegredo}</span>
        <input name="app_segredo" type="password" autoComplete="off" placeholder={ligacao.aplicativo?.configurado ? "Salva. Deixe em branco para manter." : "Cole aqui"} className={`${campo} mt-1`} />
        <span className="mt-1 block text-[0.68rem] leading-snug text-muted">{a.ondeAchar}</span>
      </label>
      <Resposta r={resposta} />
      <BotaoDeEnvio rotulo="Salvar aplicativo" ocupado="Salvando…" />
    </form>
  );
}

function FormularioDoToken({ ligacao, ligar }: { ligacao: LigacaoDaRede; ligar: Acao }) {
  const [resposta, acao] = useActionState<IntegracaoState, FormData>(ligar, {});
  const t = ligacao.info?.token;
  if (!t) return null;
  const jaLigada = ligacao.contas.some((c) => c.status !== "desligada");
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="rede" value={ligacao.rede.id} />
      <label className="block">
        <span className="text-xs font-semibold text-ink">{t.rotulo}</span>
        <input name="valor" type="password" autoComplete="off" placeholder={jaLigada ? "Guardado. Cole outro para trocar." : t.exemplo} className={`${campo} mt-1`} />
        <span className="mt-1 block text-[0.68rem] leading-snug text-muted">{t.ondeAchar}</span>
      </label>
      <Resposta r={resposta} />
      <BotaoDeEnvio rotulo={jaLigada ? "Conferir e trocar" : "Conferir e ligar"} ocupado="Conferindo na rede…" />
    </form>
  );
}

function CartaoDaRede({ ligacao, agora, acoes, retornoBase }: { ligacao: LigacaoDaRede; agora: number; acoes?: AcoesDeLigacao; retornoBase: string }) {
  const { rede, info } = ligacao;
  const temConta = ligacao.contas.length > 0;
  const precisaDeAplicativo = Boolean(info?.aplicativo);
  const aplicativoOk = !ligacao.aplicativo || ligacao.aplicativo.configurado;
  const retorno = `${retornoBase}/api/redes/retorno/${rede.id}`;

  return (
    <li className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <SeloDaRede id={rede.id} tamanho={34} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{rede.nome}</p>
            <p className="text-xs leading-snug text-muted">{rede.descricao}</p>
          </div>
        </div>
        <Estado ligacao={ligacao} />
      </div>

      {temConta ? (
        <ul className="mt-2 divide-y divide-ink/[0.07]">
          {ligacao.contas.map((c) => (
            <LinhaDaConta key={c.id} c={c} agora={agora} desligar={acoes?.desligar} />
          ))}
        </ul>
      ) : null}

      {!ligacao.pronta ? (
        <p className="mt-3 break-words text-xs leading-relaxed text-muted">
          {rede.motivo}
          {rede.perfil ? (
            <>
              {" "}
              <a href={rede.perfil} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-[var(--setor,#24339e)]">
                Abrir o perfil <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {ligacao.pronta && info ? (
        <>
          {acoes ? (
            <div className="mt-4 grid gap-5 border-t border-ink/[0.07] pt-4 lg:grid-cols-2">
              {info.por === "token" && info.tokenNoCartaoDe ? (
                <p className="text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-ink">Liga pelo mesmo token do {info.tokenNoCartaoDe}.</span> O campo fica no cartão do {info.tokenNoCartaoDe}: um token só
                  liga as duas contas de uma vez.
                </p>
              ) : info.por === "token" ? (
                <FormularioDoToken ligacao={ligacao} ligar={acoes.ligarComToken} />
              ) : (
                <>
                  {precisaDeAplicativo ? (
                    <FormularioDoAplicativo ligacao={ligacao} salvar={acoes.salvarAplicativo} />
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">1. Aplicativo</p>
                      <p className="text-xs leading-relaxed text-muted">
                        {aplicativoOk ? info.aplicativoPronto ?? "O aplicativo já está salvo." : info.aplicativoFalta ?? "Falta salvar o aplicativo."}
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">2. Conta</p>
                    <p className="text-xs leading-relaxed text-muted">{info.comQuem}</p>
                    {aplicativoOk ? (
                      <a href={comBasePath(`/api/redes/conectar/${rede.id}`)} className="inline-flex rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90">
                        {temConta ? "Ligar de novo" : info.botao}
                      </a>
                    ) : (
                      <p className="text-xs text-muted">Salve o aplicativo primeiro.</p>
                    )}
                    <p className="text-[0.68rem] leading-snug text-muted">
                      Endereço de volta que precisa estar cadastrado no aplicativo: <code className="break-all">{retorno}</code>
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : !temConta ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">Ligar e desligar conta é de administrador, dono ou GM, na tela de Integrações.</p>
          ) : null}

          <details className="group mt-4 border-t border-ink/[0.07] pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
              O que precisa existir antes, e o que a rede não deixa fazer
            </summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
              {info.passos.map((p) => (
                <li key={p} className="break-words">{p}</li>
              ))}
            </ol>
            {info.limites.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
                {info.limites.map((l) => (
                  <li key={l} className="break-words">{l}</li>
                ))}
              </ul>
            ) : null}
          </details>
        </>
      ) : null}
    </li>
  );
}

export function LigacoesDasRedes({ ligacoes, agora, acoes, retornoBase }: { ligacoes: LigacaoDaRede[]; agora: number; acoes?: AcoesDeLigacao; retornoBase: string }) {
  const prontas = ligacoes.filter((l) => l.pronta);
  const outras = ligacoes.filter((l) => !l.pronta);
  return (
    <div>
      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {prontas.map((l) => (
          <CartaoDaRede key={l.rede.id} ligacao={l} agora={agora} acoes={acoes} retornoBase={retornoBase} />
        ))}
      </ul>
      {outras.length ? (
        <>
          <h3 className="mt-8 text-sm font-semibold text-ink">As outras redes da JK</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            O perfil existe, mas a rede exige uma aprovação antes de abrir a API, ou não tem API. Cada cartão diz o que falta.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {outras.map((l) => (
              <CartaoDaRede key={l.rede.id} ligacao={l} agora={agora} retornoBase={retornoBase} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
