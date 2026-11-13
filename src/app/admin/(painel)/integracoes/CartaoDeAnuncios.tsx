"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle } from "lucide-react";
import type { IntegracaoState } from "./actions";
import { salvarTokenDoMetaAds } from "./anuncios-actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

function Selo({ ligado, texto }: { ligado: boolean; texto: string }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
        ligado ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"
      }`}
    >
      {ligado ? <Check size={11} /> : <Circle size={9} />}
      {texto}
    </span>
  );
}

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Conferindo no Meta…" : "Salvar"}
    </button>
  );
}

type Estado = { configurada: boolean; lendo: boolean; problema: string | null };

/**
 * Token do Meta que lê o gasto de anúncio. O CAMPO é só de escrita: nasce vazio
 * mesmo com token salvo, e o token nunca volta para a tela.
 *
 * O painel hoje só LÊ com ele. O token pode vir com permissão de gerenciar
 * anúncios também (decisão do Filipe em 13/11/2026, para o que vier depois), e
 * por isso o texto não promete "só leitura": diz o que o painel faz, não o que
 * o token alcança.
 */
export function CartaoMetaAds({ estado, conta }: { estado: Estado; conta: string }) {
  const [resposta, salvar] = useActionState<IntegracaoState, FormData>(salvarTokenDoMetaAds, {});
  return (
    <form action={salvar} className="glass rounded-[18px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Meta, gasto de anúncio</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Lê de hora em hora quanto a conta de anúncios {conta} gastou, para a tela de Tráfego calcular a volta por
            real gasto. Hoje o painel só lê: não cria, não pausa e não edita campanha, mesmo que o token permita.
          </p>
        </div>
        <Selo ligado={estado.lendo} texto={estado.lendo ? "Lendo" : estado.configurada ? "Com token" : "Sem token"} />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold text-ink">Token do usuário do sistema</span>
        <input
          name="valor"
          type="password"
          autoComplete="off"
          placeholder={estado.configurada ? "Salvo. Cole outro para trocar." : "EAA..."}
          className={`${campo} mt-1`}
        />
        <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
          Nas Configurações do negócio do Meta: Usuários, Usuários do sistema. Atribua a conta de anúncios ao usuário,
          clique em Gerar token, escolha um app e marque ads_read e ads_management (e business_management, se
          aparecer), sem data de validade. Para ler o gasto, ads_read sozinho já basta.
        </span>
      </label>

      {estado.problema ? <p className="mt-3 text-xs text-wine">Última leitura: {estado.problema}</p> : null}
      {resposta.erro ? <p className="mt-3 text-xs text-wine">{resposta.erro}</p> : null}
      {resposta.ok ? <p className="mt-3 text-xs text-brand-strong">{resposta.ok}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <BotaoSalvar />
        {estado.configurada ? (
          <button
            type="submit"
            name="remover"
            value="1"
            className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine"
          >
            Remover token
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** O Google Ads não tem chave para colar: usa a conta de serviço do portal. Este cartão só diz o estado e o que falta. */
export function CartaoGoogleAds({ estado, contaDeServico, cliente }: { estado: Estado; contaDeServico: string | null; cliente: string }) {
  return (
    <div className="glass rounded-[18px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Google Ads, gasto de anúncio</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Lê de hora em hora o custo da conta {cliente}, com a mesma conta de serviço do Search Console e do GA4. Não
            há chave para colar aqui.
          </p>
        </div>
        <Selo ligado={estado.lendo} texto={estado.lendo ? "Lendo" : "Falta acesso"} />
      </div>
      {estado.lendo ? null : (
        <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
          <li>No Google Cloud, projeto jk-portal-509621: ativar a Google Ads API e pedir o acesso Explorer.</li>
          <li>
            No Google Ads: Administrador, Acesso e segurança, Usuários. Adicionar{" "}
            <span className="break-all font-semibold text-ink">{contaDeServico ?? "a conta de serviço do portal"}</span> com acesso
            Somente leitura.
          </li>
        </ol>
      )}
      {estado.problema ? <p className="mt-3 text-xs text-wine">Última leitura: {estado.problema}</p> : null}
      <p className="mt-3 text-[0.68rem] text-muted">O botão de ler na hora fica na tela de Tráfego.</p>
    </div>
  );
}
