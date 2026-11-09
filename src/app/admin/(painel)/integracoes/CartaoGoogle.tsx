"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle, RefreshCw } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import type { EstadoDoGoogle } from "@/lib/google-perfil/oauth";
import {
  desconectarGoogle,
  salvarClienteGoogle,
  sincronizarGoogleAgora,
  type IntegracaoState,
} from "./actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function Botao({ rotulo, ocupado, claro }: { rotulo: string; ocupado: string; claro?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        claro
          ? "inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-60"
          : "rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
      }
    >
      {pending ? ocupado : rotulo}
    </button>
  );
}

/**
 * Cartão do Google (Perfil da Empresa): o cliente OAuth, o botão de conectar
 * com a conta que administra as lojas e a última leitura das avaliações.
 *
 * Três estados, nesta ordem: falta o cliente, falta conectar, conectado. O
 * segredo do cliente é só de escrita, como as chaves do grupo de ofertas.
 */
export function CartaoGoogle({
  estado,
  retorno,
  aviso,
}: {
  estado: EstadoDoGoogle;
  retorno: string;
  aviso: string | null;
}) {
  const [cliente, salvar] = useActionState<IntegracaoState, FormData>(salvarClienteGoogle, {});
  const [leitura, sincronizar] = useActionState<IntegracaoState, FormData>(sincronizarGoogleAgora, {});
  const [saida, desconectar] = useActionState<IntegracaoState, FormData>(desconectarGoogle, {});

  const conectado = estado.conta.conectada;
  const ultima = estado.ultima;

  return (
    <div className="glass rounded-[18px] p-5 lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Google, avaliações das lojas</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Lê as avaliações das lojas no Perfil da Empresa todo dia de manhã e entrega as de 4 e 5 estrelas para a
            vitrine da loja, com a nota e o total que o Google mostra. Pela política do Google, o portal guarda essas
            avaliações por no máximo 25 dias, sempre renovadas.
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
            conectado ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"
          }`}
        >
          {conectado ? <Check size={11} /> : <Circle size={9} />}
          {conectado ? "Conectado" : estado.cliente.configurado ? "Falta conectar" : "Falta o cliente"}
        </span>
      </div>

      {aviso ? <p className="mt-3 rounded-[10px] bg-ink/5 px-3 py-2 text-xs text-ink">{aviso}</p> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form action={salvar} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">1. Cliente OAuth</p>
          <label className="block">
            <span className="text-xs font-semibold text-ink">ID do cliente</span>
            <input
              name="client_id"
              defaultValue={estado.cliente.id ?? ""}
              autoComplete="off"
              placeholder="000000000000-xxxx.apps.googleusercontent.com"
              className={`${campo} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">Chave secreta do cliente</span>
            <input
              name="client_secret"
              type="password"
              autoComplete="off"
              placeholder={estado.cliente.configurado ? "Salva. Deixe em branco para manter." : "GOCSPX-..."}
              className={`${campo} mt-1`}
            />
            <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
              No Google Cloud, projeto jk-portal: Google Auth Platform, Clientes. Endereço de retorno cadastrado no
              cliente: <code className="break-all">{retorno}</code>
            </span>
          </label>
          {cliente.erro ? <p className="text-xs text-wine">{cliente.erro}</p> : null}
          {cliente.ok ? <p className="text-xs text-brand-strong">{cliente.ok}</p> : null}
          <Botao rotulo="Salvar cliente" ocupado="Salvando…" />
        </form>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">2. Conta do Google</p>
          {conectado ? (
            <p className="text-sm text-ink">
              Conectado{estado.conta.email ? ` como ${estado.conta.email}` : ""}
              {estado.conta.conectadaEm ? ` em ${quando(estado.conta.conectadaEm)}` : ""}.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Entre com a conta que administra as lojas no Perfil da Empresa (jkaliancasmkt) e permita o acesso.
            </p>
          )}

          {estado.cliente.configurado ? (
            <a
              href={comBasePath("/api/google/conectar")}
              className="inline-flex rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {conectado ? "Conectar de novo" : "Conectar com o Google"}
            </a>
          ) : (
            <p className="text-xs text-muted">Salve o cliente primeiro.</p>
          )}

          {ultima ? (
            <p className={`text-xs ${ultima.ok ? "text-muted" : "text-wine"}`}>
              Última leitura em {quando(ultima.em)}:{" "}
              {ultima.ok ? `${ultima.lojas} lojas, ${ultima.avaliacoes} avaliações.` : ultima.erro}
            </p>
          ) : null}

          {conectado ? (
            <div className="flex flex-wrap gap-2">
              <form action={sincronizar}>
                <Botao rotulo="Ler o Google agora" ocupado="Lendo…" claro />
              </form>
              <form action={desconectar}>
                <button
                  type="submit"
                  className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine"
                >
                  Desconectar
                </button>
              </form>
            </div>
          ) : null}
          {leitura.erro ? <p className="text-xs text-wine">{leitura.erro}</p> : null}
          {leitura.ok ? (
            <p className="flex items-center gap-1.5 text-xs text-brand-strong">
              <RefreshCw size={11} aria-hidden /> {leitura.ok}
            </p>
          ) : null}
          {saida.ok ? <p className="text-xs text-brand-strong">{saida.ok}</p> : null}
        </div>
      </div>
    </div>
  );
}
