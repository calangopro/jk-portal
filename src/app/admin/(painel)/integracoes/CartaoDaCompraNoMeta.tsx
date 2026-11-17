"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle, FlaskConical } from "lucide-react";
import type { IntegracaoState } from "./actions";
import { salvarCompraNoMeta, simularCompraNoMeta } from "./meta-loja-actions";

/**
 * A compra da loja mandada ao Meta pelo servidor (0120). Liga em 01/12/2026,
 * quando a medição sai da Tray (docs/medicao-pelo-painel.md).
 *
 * Três modos, com o caminho que se espera: desligado, teste (o Meta mostra em
 * Eventos de teste e não usa nas campanhas), ligado. Ligar pede a caixa de
 * "conferi em Eventos de teste".
 */

export type ResumoDaCompraNoMeta = {
  modo: "desligado" | "teste" | "ligado";
  desde: string | null;
  temCodigoDeTeste: boolean;
  porEstado: Record<string, number>;
  ultimoEnvio: string | null;
  erros: { pedido: number; evento: string; motivo: string | null; em: string }[];
  sinais7Dias: number;
  temToken: boolean;
};

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const NOME_DO_MODO = { desligado: "Desligado", teste: "Em teste", ligado: "Ligado" } as const;

function Botao({ texto, enviando, secundario = false }: { texto: string; enviando: string; secundario?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        secundario
          ? "rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand disabled:opacity-60"
          : "rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      }
    >
      {pending ? enviando : texto}
    </button>
  );
}

function Recado({ estado }: { estado: IntegracaoState }) {
  if (estado.erro) return <p className="mt-3 text-xs leading-relaxed text-wine" role="alert">{estado.erro}</p>;
  if (estado.ok) return <p className="mt-3 text-xs leading-relaxed text-ink" role="status">{estado.ok}</p>;
  return null;
}

export function CartaoDaCompraNoMeta({ resumo }: { resumo: ResumoDaCompraNoMeta }) {
  const [estado, salvar] = useActionState(salvarCompraNoMeta, {});
  const [simulacao, simular] = useActionState(simularCompraNoMeta, {});
  const [modo, setModo] = useState(resumo.modo);
  const n = (chave: string) => resumo.porEstado[chave] ?? 0;
  const ligado = resumo.modo !== "desligado";

  return (
    <div className="glass rounded-[18px] p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink">Meta, compra da loja pelo servidor</p>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
            resumo.modo === "ligado" ? "bg-brand/15 text-brand-strong" : resumo.modo === "teste" ? "bg-ink/8 text-ink" : "bg-ink/8 text-muted"
          }`}
        >
          {resumo.modo === "ligado" ? <Check size={11} aria-hidden /> : resumo.modo === "teste" ? <FlaskConical size={11} aria-hidden /> : <Circle size={9} aria-hidden />}
          {NOME_DO_MODO[resumo.modo]}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Manda ao Meta a compra de cada pedido da loja, lida pela API da Tray, com e-mail e telefone em SHA-256 e o mesmo
        número de evento do pixel do navegador, para o Meta contar uma vez só. Quando o pedido é pago, manda também a
        Compra paga. Substitui o envio da integração da Tray, que parou em 15/11. Liga em 01/12.
      </p>

      {ligado ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <div><dt className="text-muted">Compras</dt><dd className="font-semibold text-ink">{n("Purchase:enviado") + n("Purchase:teste")}</dd></div>
          <div><dt className="text-muted">Compras pagas</dt><dd className="font-semibold text-ink">{n("CompraPaga:enviado") + n("CompraPaga:teste")}</dd></div>
          <div><dt className="text-muted">Deixadas ao pixel</dt><dd className="font-semibold text-ink">{n("Purchase:ignorado") + n("CompraPaga:ignorado")}</dd></div>
          <div><dt className="text-muted">Com erro</dt><dd className={`font-semibold ${n("Purchase:erro") + n("CompraPaga:erro") ? "text-wine" : "text-ink"}`}>{n("Purchase:erro") + n("CompraPaga:erro")}</dd></div>
        </dl>
      ) : null}
      {ligado ? (
        <p className="mt-2 text-[0.68rem] leading-snug text-muted">
          Últimos 7 dias. {resumo.ultimoEnvio ? `Último envio em ${quando(resumo.ultimoEnvio)}.` : "Nada enviado ainda."}{" "}
          {resumo.desde ? `Entram os pedidos feitos desde ${quando(resumo.desde)}.` : ""} Sinais do navegador guardados em 7 dias: {resumo.sinais7Dias}.
        </p>
      ) : null}
      {resumo.erros.length ? (
        <ul className="mt-3 space-y-1 text-[0.68rem] leading-snug text-wine">
          {resumo.erros.map((e) => (
            <li key={`${e.pedido}-${e.evento}`}>Pedido {e.pedido}, {e.evento === "Purchase" ? "compra" : "compra paga"}: {e.motivo ?? "erro"}</li>
          ))}
        </ul>
      ) : null}

      {!resumo.temToken ? (
        <p className="mt-4 text-xs leading-relaxed text-wine">
          Falta o token da API de Conversões. Ele é colado no cartão "Meta, API de Conversões", em Grupo de ofertas, e
          vale para o Lead e para a compra.
        </p>
      ) : null}

      <form action={salvar} className="mt-4 space-y-3">
        <fieldset>
          <legend className="text-xs font-semibold text-ink">Modo</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["desligado", "teste", "ligado"] as const).map((m) => (
              <label key={m} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${modo === m ? "border-brand bg-brand/10 font-semibold text-ink" : "border-border text-muted"}`}>
                <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => setModo(m)} className="sr-only" />
                {NOME_DO_MODO[m]}
              </label>
            ))}
          </div>
        </fieldset>

        {modo !== "desligado" ? (
          <>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Código de Eventos de teste{modo === "teste" ? "" : " (só em teste)"}</span>
              <input name="codigo_de_teste" defaultValue="" placeholder={resumo.temCodigoDeTeste ? "Já guardado. Cole outro para trocar." : "TEST12345"} className={`mt-1 ${campo}`} />
              <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
                É deste cartão, separado do código do Lead: testar a compra não põe o Lead em teste.
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Quais pedidos entram</span>
              <select name="corte" defaultValue="manter" className={`mt-1 ${campo}`}>
                <option value="manter">{resumo.desde ? "Manter o corte de agora" : "Só os pedidos de agora em diante"}</option>
                <option value="agora">Só os pedidos de agora em diante</option>
                <option value="sete">Também os dos últimos 7 dias, que o Meta ainda aceita</option>
              </select>
              <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
                Não inclua dias em que a Tray ainda mandava ao Meta: a compra contaria duas vezes.
              </span>
            </label>
          </>
        ) : null}

        {modo === "ligado" && resumo.modo !== "ligado" ? (
          <label className="flex items-start gap-2 text-xs text-ink">
            <input type="checkbox" name="conferido" value="1" className="mt-0.5" />
            <span>Conferi em Eventos de teste que a compra chega do servidor e do navegador com o mesmo número.</span>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Botao texto="Salvar" enviando="Salvando…" />
        </div>
        <Recado estado={estado} />
      </form>

      <form action={simular} className="mt-4 border-t border-border/60 pt-4">
        <p className="text-xs leading-relaxed text-muted">
          Simular monta o que iria agora, sem mandar nada e sem gravar, e diz quantos eventos e quais campos de cliente.
        </p>
        <div className="mt-2">
          <Botao texto="Simular agora" enviando="Montando…" secundario />
        </div>
        <Recado estado={simulacao} />
      </form>
    </div>
  );
}
