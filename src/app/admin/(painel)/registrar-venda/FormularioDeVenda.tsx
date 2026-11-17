"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Loader2, UserCheck } from "lucide-react";
import { marcarPedidoDaLoja, registrarVenda, type EstadoDaVenda } from "./actions";
import { ProducaoDaVenda, type ProdutoDoFormulario } from "./ProducaoDaVenda";

type Opcao = { chave: string; nome: string };

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";

/**
 * Formulário de registrar venda. É de cliente por causa do aviso de
 * duplicidade: quando o banco diz que a venda parece repetida, os campos
 * continuam preenchidos e aparece o botão de lançar mesmo assim.
 *
 * O ENVIO É FEITO À MÃO (`onSubmit`), e não pelo `action` do formulário, de
 * propósito. Com `action`, o React 19 devolve todos os campos ao valor
 * inicial quando a ação termina, mesmo quando ela só voltou com um aviso: o
 * vendedor recebia "parece repetida" com o formulário já vazio e o dia de
 * volta em hoje, e o "lançar mesmo assim" ia sem valor ou com a data errada.
 * Enviando por aqui, só se limpa o que foi gravado.
 *
 * Quando o aviso é de pedido já pago na loja, o caminho certo não é lançar de
 * novo (o dinheiro contaria duas vezes): é marcar o pedido como venda da
 * pessoa, e o botão para isso aparece junto do aviso.
 */
export function FormularioDeVenda({
  formas, canais, vendedores, hoje, maisAntigo, produtos, lojas, aoRegistrar = registrarVenda, aoMarcarPedido = marcarPedidoDaLoja,
}: {
  /** Só para a prévia de desenvolvimento, que não tem sessão: as duas ações de mentira. No painel valem as de verdade. */
  aoRegistrar?: typeof registrarVenda;
  aoMarcarPedido?: typeof marcarPedidoDaLoja;
  /** O dia mais antigo que o banco aceita para a venda. */
  maisAntigo?: string;
  formas: Opcao[];
  canais: Opcao[];
  /** O catálogo, para escolher a peça que vai para a fábrica. Sem ele, a parte da fábrica não aparece. */
  produtos?: ProdutoDoFormulario[];
  /** As lojas de retirada, pelo nome. */
  lojas?: string[];
  /** Só chega para quem pode lançar em nome de outra pessoa. */
  vendedores?: { id: string; nome: string }[];
  hoje: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoDaVenda, FormData>(aoRegistrar, {});
  const formulario = useRef<HTMLFormElement>(null);
  const [, iniciar] = useTransition();

  // Marcar o pedido da loja como venda da pessoa, no lugar de lançar a venda de novo.
  const [marcando, setMarcando] = useState(false);
  const [marcacao, setMarcacao] = useState<{ ok: boolean; mensagem: string } | null>(null);
  // O aviso que já foi resolvido marcando o pedido sai da tela na hora, sem esperar outro envio.
  const [resolvido, setResolvido] = useState<EstadoDaVenda | null>(null);
  const aviso: EstadoDaVenda = estado === resolvido ? {} : estado;

  // A parte da fábrica guarda o próprio estado. Trocar a chave é o jeito de ela recomeçar vazia depois de uma venda gravada.
  const [rodada, setRodada] = useState(0);

  // Venda gravada: limpa os campos para a próxima. Se parece repetida, mantém tudo.
  useEffect(() => {
    if (estado.ok) {
      formulario.current?.reset();
      setRodada((n) => n + 1);
    }
  }, [estado]);

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    // O botão que enviou não entra sozinho nos dados: é ele que diz "lançar mesmo assim".
    const botao = (e.nativeEvent as SubmitEvent).submitter;
    if (botao instanceof HTMLButtonElement && botao.name) dados.set(botao.name, botao.value);
    setMarcacao(null);
    iniciar(() => enviar(dados));
  };

  const marcarPedido = async () => {
    const numero = aviso.pedidoDaLoja;
    if (!numero || marcando) return;
    setMarcando(true);
    // Quem lança em nome de outra pessoa marca o pedido para ela também.
    const vendedor = formulario.current ? String(new FormData(formulario.current).get("vendedor") ?? "") || null : null;
    const r = await aoMarcarPedido(numero, vendedor).catch(() => ({ ok: false, mensagem: "Não deu para marcar agora. Tente de novo em alguns segundos." }));
    setMarcando(false);
    setMarcacao(r);
    if (r.ok) {
      setResolvido(estado);
      formulario.current?.reset();
      setRodada((n) => n + 1);
    }
  };

  const ocupado = enviando || marcando;
  return (
    <form ref={formulario} onSubmit={aoEnviar} className="mt-4 grid gap-3 sm:grid-cols-2">
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
        <input id="venda-dia" name="dia" type="date" defaultValue={hoje} min={maisAntigo} max={hoje} className={`${campo} numeros`} />
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

      {produtos && lojas ? <ProducaoDaVenda key={rodada} produtos={produtos} lojas={lojas} /> : null}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={ocupado}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink/85 disabled:opacity-60"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          Registrar venda
        </button>
        {aviso.pedidoDaLoja ? (
          <button
            type="button"
            onClick={() => void marcarPedido()}
            disabled={ocupado}
            className="inline-flex items-center gap-2 rounded-full border border-ink bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] disabled:opacity-60"
          >
            {marcando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />}
            Foi o pedido {aviso.pedidoDaLoja}: {vendedores && vendedores.length > 0 ? "marcar quem vendeu" : "marcar como venda minha"}
          </button>
        ) : null}
        {aviso.podeInsistir ? (
          <button
            type="submit"
            name="insistir"
            value="sim"
            disabled={ocupado}
            className="rounded-full border border-ink/20 bg-white/70 px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand/60 disabled:opacity-60"
          >
            {aviso.rotuloDeInsistir ?? "É outra venda, lançar mesmo assim"}
          </button>
        ) : null}
      </div>

      {aviso.mensagem ? (
        <p
          role={aviso.ok ? "status" : "alert"}
          className="flex items-start gap-2 text-sm sm:col-span-2"
          style={{ color: aviso.ok ? "#047857" : "#b91c1c" }}
        >
          {aviso.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> : <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />}
          <span>{aviso.mensagem}</span>
        </p>
      ) : null}
      {marcacao ? (
        <p role={marcacao.ok ? "status" : "alert"} className="flex items-start gap-2 text-sm sm:col-span-2" style={{ color: marcacao.ok ? "#047857" : "#b91c1c" }}>
          {marcacao.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> : <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />}
          <span>{marcacao.mensagem}</span>
        </p>
      ) : null}
    </form>
  );
}
