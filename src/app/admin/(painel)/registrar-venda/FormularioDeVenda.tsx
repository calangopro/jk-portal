"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { registrarVenda, type EstadoDaVenda } from "./actions";

type Opcao = { chave: string; nome: string };

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";

/**
 * Formulário de registrar venda. É de cliente por causa do aviso de
 * duplicidade: quando o banco diz que a venda parece repetida, os campos
 * continuam preenchidos e aparece o botão de lançar mesmo assim.
 */
export function FormularioDeVenda({
  formas, canais, vendedores, hoje,
}: {
  formas: Opcao[];
  canais: Opcao[];
  /** Só chega para quem pode lançar em nome de outra pessoa. */
  vendedores?: { id: string; nome: string }[];
  hoje: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoDaVenda, FormData>(registrarVenda, {});
  const formulario = useRef<HTMLFormElement>(null);

  // Venda gravada: limpa os campos para a próxima. Se parece repetida, mantém tudo.
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={enviar} className="mt-4 grid gap-3 sm:grid-cols-2">
      <div>
        <label className={rotulo} htmlFor="venda-valor">Valor recebido</label>
        <input id="venda-valor" name="valor" required inputMode="decimal" pattern="[0-9.,]+" placeholder="0,00" className={`${campo} numeros`} />
      </div>
      <div>
        <label className={rotulo} htmlFor="venda-forma">Como pagou</label>
        <select id="venda-forma" name="forma" defaultValue="pix" className={campo}>
          {formas.map((f) => <option key={f.chave} value={f.chave}>{f.nome}</option>)}
        </select>
      </div>
      <div>
        <label className={rotulo} htmlFor="venda-cliente">Nome do cliente</label>
        <input id="venda-cliente" name="cliente" maxLength={160} className={campo} />
      </div>
      <div>
        <label className={rotulo} htmlFor="venda-telefone">WhatsApp do cliente</label>
        <input id="venda-telefone" name="telefone" inputMode="tel" placeholder="(11) 98888-7777" className={`${campo} numeros`} />
      </div>
      <div className="sm:col-span-2">
        <label className={rotulo} htmlFor="venda-produto">O que vendeu</label>
        <input id="venda-produto" name="produto" maxLength={300} placeholder="Par de alianças Eternal Love 3 mm, aros 18 e 22" className={campo} />
      </div>
      <div>
        <label className={rotulo} htmlFor="venda-canal">Por onde veio</label>
        <select id="venda-canal" name="canal" defaultValue="whatsapp" className={campo}>
          {canais.map((c) => <option key={c.chave} value={c.chave}>{c.nome}</option>)}
        </select>
      </div>
      <div>
        <label className={rotulo} htmlFor="venda-dia">Dia da venda</label>
        <input id="venda-dia" name="dia" type="date" defaultValue={hoje} max={hoje} className={`${campo} numeros`} />
      </div>
      {vendedores && vendedores.length > 0 ? (
        <div className="sm:col-span-2">
          <label className={rotulo} htmlFor="venda-vendedor">Quem vendeu</label>
          <select id="venda-vendedor" name="vendedor" defaultValue="" className={campo}>
            <option value="">Eu</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <label className={rotulo} htmlFor="venda-obs">Observação</label>
        <input id="venda-obs" name="observacao" maxLength={500} className={campo} />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink/85 disabled:opacity-60"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          Registrar venda
        </button>
        {estado.podeInsistir ? (
          <button
            type="submit"
            name="insistir"
            value="sim"
            disabled={enviando}
            className="rounded-full border border-ink/20 bg-white/70 px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand/60 disabled:opacity-60"
          >
            É outra venda, lançar mesmo assim
          </button>
        ) : null}
      </div>

      {estado.mensagem ? (
        <p
          role={estado.ok ? "status" : "alert"}
          className="flex items-start gap-2 text-sm sm:col-span-2"
          style={{ color: estado.ok ? "#047857" : "#b91c1c" }}
        >
          {estado.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> : <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />}
          <span>{estado.mensagem}</span>
        </p>
      ) : null}
    </form>
  );
}
