"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { lerAKommoAgora, ligarWebhookDaKommo, type IntegracaoState } from "./actions";

export type EstadoDoEspelho = {
  negocios: number;
  contatos: number;
  eventos: number;
  usuarios: number;
  pendentes: number;
  semMapa: number;
  cargaDesde: string | null;
  cargaConcluidaEm: string | null;
  ultimaLeituraEm: string | null;
  ultimaLeitura: string | null;
  ultimoWebhookEm: string | null;
  webhooksRecebidos: number;
  webhook: "ausente" | "ligado" | "desligado";
  webhookErro: string | null;
};

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "nunca";
const n = (v: number) => v.toLocaleString("pt-BR");

function Botao({ rotulo, ocupado, claro }: { rotulo: string; ocupado: string; claro?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        claro
          ? "rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-60"
          : "rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      }
    >
      {pending ? ocupado : rotulo}
    </button>
  );
}

function Recado({ estado }: { estado: IntegracaoState }) {
  if (estado.erro) return <p role="alert" className="text-xs text-red-800">{estado.erro}</p>;
  if (estado.ok) return <p role="status" className="text-xs text-emerald-800">{estado.ok}</p>;
  return null;
}

/**
 * O espelho da Kommo dentro do cartão dela: o webhook (com o botão de ligar ou
 * religar), a última leitura e o tamanho do que já está copiado no painel.
 */
export function EspelhoDaKommo({ e }: { e: EstadoDoEspelho }) {
  const [webhook, ligar] = useActionState<IntegracaoState, FormData>(ligarWebhookDaKommo, {});
  const [leitura, ler] = useActionState<IntegracaoState, FormData>(lerAKommoAgora, {});

  const SeloWebhook =
    e.webhook === "ligado"
      ? { Icone: CircleCheck, cor: "text-emerald-800", texto: "Webhook ligado" }
      : e.webhook === "desligado"
        ? { Icone: CircleAlert, cor: "text-red-800", texto: "A Kommo desligou o webhook" }
        : { Icone: CircleDashed, cor: "text-amber-800", texto: "Webhook ainda não ligado" };

  return (
    <div className="space-y-3 rounded-[12px] border border-border bg-white/60 p-3 text-xs text-ink">
      <p className="font-semibold">Espelho da Kommo</p>

      <p className={`flex items-center gap-1.5 font-semibold ${SeloWebhook.cor}`}>
        <SeloWebhook.Icone aria-hidden className="h-4 w-4 shrink-0" />
        {SeloWebhook.texto}
      </p>
      <p className="leading-snug text-muted">
        {e.webhook === "ligado"
          ? `Último aviso recebido: ${quando(e.ultimoWebhookEm)} (${n(e.webhooksRecebidos)} no total).`
          : e.webhook === "desligado"
            ? "A Kommo desliga o webhook depois de várias falhas seguidas. A leitura de dez em dez minutos continua; religar devolve o tempo real."
            : "Sem webhook o painel continua em dia pela leitura de dez em dez minutos, só que com esse atraso."}
        {e.webhookErro ? ` Último erro: ${e.webhookErro.slice(0, 120)}.` : ""}
      </p>
      {e.webhook !== "ligado" ? (
        <form action={ligar} className="space-y-2">
          <Botao rotulo={e.webhook === "desligado" ? "Religar o webhook" : "Ligar o webhook"} ocupado="Ligando..." />
          <p className="text-[0.68rem] leading-snug text-muted">É a única coisa que o painel grava na Kommo: o endereço para onde ela avisa as mudanças.</p>
          <Recado estado={webhook} />
        </form>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
        <div><dt className="text-muted">Negócios</dt><dd className="font-semibold">{n(e.negocios)}</dd></div>
        <div><dt className="text-muted">Contatos</dt><dd className="font-semibold">{n(e.contatos)}</dd></div>
        <div><dt className="text-muted">Eventos</dt><dd className="font-semibold">{n(e.eventos)}</dd></div>
      </dl>
      <p className="leading-snug text-muted">
        Última leitura: {quando(e.ultimaLeituraEm)}
        {e.ultimaLeitura ? `, ${e.ultimaLeitura}` : ""}.
        {e.cargaDesde && !e.cargaConcluidaEm ? " A carga dos últimos 90 dias ainda está andando, algumas rodadas por hora." : ""}
        {e.pendentes > 0 ? ` ${n(e.pendentes)} ${e.pendentes === 1 ? "aviso espera" : "avisos esperam"} releitura.` : ""}
      </p>
      <form action={ler} className="space-y-2">
        <Botao rotulo="Ler a Kommo agora" ocupado="Lendo..." claro />
        <Recado estado={leitura} />
      </form>

      {e.usuarios > 0 ? (
        <p className="leading-snug">
          <Link href="/admin/kommo" className="font-semibold underline underline-offset-2">
            Quem é quem na Kommo
          </Link>
          {e.semMapa > 0 ? `: ${e.semMapa} ${e.semMapa === 1 ? "usuário ativo ainda sem" : "usuários ativos ainda sem"} pessoa ou loja do painel.` : ": todos os usuários ativos ligados."}
        </p>
      ) : null}
    </div>
  );
}
