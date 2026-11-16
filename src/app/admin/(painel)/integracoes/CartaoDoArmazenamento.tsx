"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle } from "lucide-react";
import type { EstadoDoArmazenamento } from "@/lib/redes/armazenamento";
import type { IntegracaoState } from "./actions";
import { salvarArmazenamentoR2 } from "./redes-actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

function Botao({ rotulo, ocupado }: { rotulo: string; ocupado: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60">
      {pending ? ocupado : rotulo}
    </button>
  );
}

/**
 * Onde moram as fotos e os vídeos dos posts das redes.
 *
 * Sem nada configurado, é o Storage do Supabase, com 50 MB por arquivo. Com as
 * chaves do R2 da Cloudflare coladas aqui, passa a ser o R2: sem teto prático,
 * sem cobrança de saída, e no endereço da JK.
 *
 * As chaves são só de escrita: o campo nasce vazio mesmo com valor guardado, e
 * o painel PROVA que elas funcionam (sobe um arquivo de teste, lê pelo endereço
 * público e apaga) antes de guardar.
 */
export function CartaoDoArmazenamento({ estado }: { estado: EstadoDoArmazenamento }) {
  const [resposta, salvar] = useActionState<IntegracaoState, FormData>(salvarArmazenamentoR2, {});
  const noR2 = estado.onde === "r2";
  const megas = Math.round(estado.limite / 1024 / 1024);
  return (
    <form action={salvar} className="glass rounded-[18px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Armazenamento de foto e vídeo dos posts</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            {noR2
              ? `As mídias dos posts sobem para o R2 da Cloudflare, no endereço ${estado.r2.publico}. Aceita arquivo de até ${megas} MB.`
              : `Hoje as mídias sobem para o Storage do Supabase, que aceita até ${megas} MB por arquivo: vídeo curto cabe, vídeo longo não. Com as chaves do R2 da Cloudflare, o limite passa a 1 GB.`}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${noR2 ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"}`}>
          {noR2 ? <Check size={11} /> : <Circle size={9} />}
          {noR2 ? "R2 ligado" : "Supabase, 50 MB"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">ID da conta da Cloudflare</span>
          <input name="conta" defaultValue={estado.r2.conta ?? ""} autoComplete="off" placeholder="32 letras e números" className={`${campo} mt-1`} />
          <span className="mt-1 block text-[0.68rem] leading-snug text-muted">Na página do R2, à direita, em Detalhes da conta. Pode colar o endereço S3 inteiro: o painel tira o ID de lá.</span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Balde</span>
          <input name="balde" defaultValue={estado.r2.balde ?? "jk-redes"} autoComplete="off" className={`${campo} mt-1`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-ink">Endereço público do balde</span>
          <input name="publico" defaultValue={estado.r2.publico ?? "https://midia.jkaliancas.com.br"} autoComplete="off" className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">ID da chave de acesso</span>
          <input name="chave_id" type="password" autoComplete="off" placeholder={noR2 ? "Guardada. Cole outra para trocar." : "Cole aqui"} className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Chave de acesso secreta</span>
          <input name="chave_segredo" type="password" autoComplete="off" placeholder={noR2 ? "Guardada. Cole outra para trocar." : "Cole aqui"} className={`${campo} mt-1`} />
        </label>
      </div>
      <p className="mt-2 text-[0.68rem] leading-snug text-muted">
        No painel da Cloudflare: R2, Gerenciar tokens de API, Criar token de API. Permissão de leitura e escrita de objetos, só no balde jk-redes. As duas chaves aparecem uma vez só, no fim.
      </p>

      {resposta.erro ? <p role="alert" className="mt-3 break-words text-xs text-wine">{resposta.erro}</p> : null}
      {resposta.ok ? <p role="status" className="mt-3 text-xs text-brand-strong">{resposta.ok}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Botao rotulo={noR2 ? "Conferir e trocar" : "Conferir e ligar o R2"} ocupado="Conferindo no R2…" />
        {noR2 ? (
          <button type="submit" name="remover" value="1" className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine">
            Voltar ao Supabase
          </button>
        ) : null}
      </div>
    </form>
  );
}
