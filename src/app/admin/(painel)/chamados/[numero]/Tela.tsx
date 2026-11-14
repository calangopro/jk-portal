"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookCheck, BookPlus, CalendarClock, Check, ExternalLink, Loader2, Send, TriangleAlert } from "lucide-react";
import { ROLE_LABEL, type AppRole } from "@/lib/auth/acessos";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { RascunhoDeResposta } from "@/lib/time/biblioteca";
import { NOME_DO_TIPO, esperaDoChamado, paraQuem, rascunhoDaResposta, type ChamadoInteiro, type Imagem } from "@/lib/time/chamados";
import { SeloDeTom } from "../../Pecas";
import { FormularioDeResposta } from "../../biblioteca/FormularioDeResposta";
import { botaoCheio, botaoClaro, campo, diaEHora, useAgora, useAtualizarSozinho, type Feito } from "../../biblioteca/pecas";
import { CampoDeImagens, enviarImagens, useImagens, type Enviar, type ImagemEnviada } from "../Imagens";

/**
 * Um chamado aberto na tela: o pedido, a conversa em ordem, a resposta e as
 * duas saídas (resolvido, e virar resposta da biblioteca).
 *
 * "VIRAR RESPOSTA DA BIBLIOTECA" É O LAÇO QUE FAZ A BIBLIOTECA CRESCER. A
 * pergunta respondida uma vez não devia ser respondida de novo, e quem acabou
 * de responder é quem tem o texto na mão. O formulário vem preenchido com o
 * pedido e com o que os OUTROS responderam, e a pessoa enxuga antes de salvar:
 * chamado tem nome de cliente e a biblioteca não pode ter.
 *
 * As ações vêm de fora, como propriedade, para a tela poder ser vista sem
 * sessão durante o desenvolvimento.
 */

export type Responder = (chamado: string, mensagem: string, imagens: ImagemEnviada[]) => Promise<Feito>;
export type Resolver = (chamado: string) => Promise<Feito>;
export type Virar = (chamado: string, r: RascunhoDeResposta) => Promise<{ ok: true; id: string } | { ok: false; erro: string }>;

const papel = (p: string | null) => (p ? (ROLE_LABEL[p as AppRole] ?? p) : null);

/** Por quanto tempo a tela segura o mesmo link de uma imagem. O link assinado vale uma hora. */
const SEGURAR_O_LINK_MS = 45 * 60_000;

/**
 * O link assinado muda a cada leitura do chamado, e a tela lê de novo a cada
 * 45 segundos. Sem segurar o primeiro link, toda imagem seria baixada outra
 * vez e piscaria a cada volta. O link fica o mesmo por 45 minutos e só então
 * troca pelo mais novo, antes de o primeiro vencer.
 */
function useLinksFirmes() {
  const guardados = useRef(new Map<string, { link: string; desde: number }>());
  return (i: Imagem): string | null => {
    if (!i.link) return guardados.current.get(i.id)?.link ?? null;
    const antes = guardados.current.get(i.id);
    if (antes && Date.now() - antes.desde < SEGURAR_O_LINK_MS) return antes.link;
    guardados.current.set(i.id, { link: i.link, desde: Date.now() });
    return i.link;
  };
}

function Imagens({ lista, linkDe }: { lista: Imagem[]; linkDe: (i: Imagem) => string | null }) {
  if (lista.length === 0) return null;
  return (
    <ul className="mt-2.5 flex flex-wrap gap-2">
      {lista.map((i, n) => {
        const link = linkDe(i);
        return (
        <li key={i.id}>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" aria-label={`Abrir a imagem ${n + 1} em tamanho inteiro`} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={link} alt={`Imagem ${n + 1} do chamado`} loading="lazy" className="h-28 w-28 rounded-[10px] border border-ink/15 bg-white object-cover sm:h-36 sm:w-36" />
            </a>
          ) : (
            <span className="grid h-28 w-28 place-items-center rounded-[10px] border border-dashed border-ink/20 p-2 text-center text-[0.68rem] text-muted">
              Imagem indisponível agora
            </span>
          )}
        </li>
        );
      })}
    </ul>
  );
}

function Fala({
  nome, cargo, quando, texto, imagens, linkDe, minha, pedido,
}: {
  nome: string;
  cargo: string | null;
  quando: string;
  texto: string;
  imagens: Imagem[];
  linkDe: (i: Imagem) => string | null;
  minha: boolean;
  /** A primeira fala é o pedido: ganha a borda do setor. */
  pedido?: boolean;
}) {
  return (
    <li className={`glass rounded-[16px] p-4 ${pedido ? "border-l-[3px] border-l-[var(--setor)]" : ""} ${minha && !pedido ? "sm:ml-10" : ""} ${!minha && !pedido ? "sm:mr-10" : ""}`}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-bold text-ink">{minha ? "Você" : nome}</span>
        {cargo && !minha ? <span className="text-muted">{cargo}</span> : null}
        <span className="numeros text-muted">{quando}</span>
      </p>
      {texto ? <p className="mt-1.5 whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-ink">{texto}</p> : null}
      <Imagens lista={imagens} linkDe={linkDe} />
    </li>
  );
}

export function TelaDoChamado({
  chamado: c, meuId, agora: agoraDoServidor, responder, resolver, virar, enviar = enviarImagens,
}: {
  chamado: ChamadoInteiro;
  meuId: string;
  agora: string;
  responder: Responder;
  resolver: Resolver;
  virar: Virar;
  /** Só a prévia de desenvolvimento troca: lá não há sessão para subir imagem. */
  enviar?: Enviar;
}) {
  const router = useRouter();
  const agora = useAgora(agoraDoServidor);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [virando, setVirando] = useState(false);
  const [ocupado, comecar] = useTransition();
  const [resolvendo, comecarAResolver] = useTransition();
  const imagens = useImagens();
  const linkDe = useLinksFirmes();
  useAtualizarSozinho(45_000, virando);

  const espera = esperaDoChamado(c, agora);
  const souQuemAbriu = c.abertoPor === meuId;
  const temResposta = c.mensagens.some((m) => m.autor !== c.abertoPor);

  const enviarMensagem = () => {
    if (!mensagem.trim() && imagens.lista.length === 0) return setErro("Escreva a mensagem ou mande uma imagem.");
    setErro(null);
    comecar(async () => {
      const subidas = imagens.lista.length > 0 ? await enviar(meuId, imagens.lista) : { ok: true as const, imagens: [] };
      if (!subidas.ok) return setErro(subidas.erro);
      const feito = await responder(c.id, mensagem, subidas.imagens);
      if (!feito.ok) return setErro(feito.erro);
      setMensagem("");
      imagens.limpar();
      router.refresh();
    });
  };

  const marcarResolvido = () =>
    comecarAResolver(async () => {
      setErro(null);
      const feito = await resolver(c.id);
      if (feito.ok) router.refresh();
      else setErro(feito.erro);
    });

  return (
    <div>
      <Link href="/admin/chamados" className={botaoClaro}>
        <ArrowLeft size={14} aria-hidden="true" /> Todos os chamados
      </Link>

      <header className="mt-4">
        <p className="eyebrow">
          Chamado {c.numero} · {NOME_DO_TIPO[c.tipo]}
        </p>
        <h1 className="font-display mt-2 text-2xl leading-tight text-ink sm:text-3xl">Para {paraQuem(c)}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <SeloDeTom tom={espera.tom}>{espera.palavra}</SeloDeTom>
          {c.precisoAte && c.estado !== "resolvido" ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <CalendarClock size={12} aria-hidden="true" /> Preciso até {diaEHora(c.precisoAte)}
            </span>
          ) : null}
          {c.estado === "resolvido" && c.resolvidoEm ? (
            <span className="text-xs text-muted">
              Resolvido{c.resolvidoPorNome ? ` por ${c.resolvidoPorNome}` : ""} em {diaEHora(c.resolvidoEm)}
            </span>
          ) : null}
        </div>
      </header>

      <ol className="mt-4 space-y-3" aria-label="A conversa do chamado">
        <Fala
          pedido
          nome={c.abertoPorNome ?? "Alguém do time"}
          cargo={papel(c.abertoPorPapel)}
          quando={diaEHora(c.criadoEm)}
          texto={c.texto}
          imagens={c.imagens}
          linkDe={linkDe}
          minha={souQuemAbriu}
        />
        {c.produto ? (
          <li className="rounded-[12px] border border-ink/10 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-ink">
            <span className="font-semibold">Peça do chamado:</span> {c.produto.nome}
            {c.produto.codigo ? <span className="text-muted"> (cód. {c.produto.codigo})</span> : null}
            {c.produto.url ? (
              <a href={c.produto.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold underline decoration-ink/25 underline-offset-2">
                Abrir na loja <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : null}
          </li>
        ) : null}
        {c.mensagens.map((m) => (
          <Fala
            key={m.id}
            nome={m.autorNome ?? "Alguém do time"}
            cargo={papel(m.autorPapel)}
            quando={diaEHora(m.em)}
            texto={m.texto}
            imagens={m.imagens}
            linkDe={linkDe}
            minha={m.autor === meuId}
          />
        ))}
      </ol>

      {c.mensagens.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Ninguém respondeu ainda.</p>
      ) : null}

      <section className="glass mt-4 rounded-[18px] p-4 sm:p-5" aria-label="Escrever no chamado">
        <label className="block">
          <span className="text-xs font-semibold text-ink">{souQuemAbriu ? "Escrever de novo" : "Responder"}</span>
          <span className="block text-[0.7rem] text-muted">
            {c.estado === "resolvido"
              ? "O chamado está resolvido. Escrever abre ele de novo."
              : souQuemAbriu
                ? temResposta
                  ? "Se a resposta não resolveu, pergunte de novo: o chamado volta a esperar o destino."
                  : "Faltou algum dado? Complete aqui."
                : "A sua resposta marca o chamado como respondido."}
          </span>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            onPaste={imagens.aoColar}
            maxLength={4000}
            rows={3}
            className={campo}
          />
        </label>
        <div className="mt-2.5">
          <CampoDeImagens imagens={imagens} ocupado={ocupado} />
        </div>
        {erro ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-[#b01919]">
            {erro}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={ocupado || resolvendo} onClick={enviarMensagem} className={botaoCheio}>
            {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            {ocupado ? "Enviando" : "Enviar"}
          </button>
          {c.podeResolver && c.estado !== "resolvido" ? (
            <button type="button" disabled={ocupado || resolvendo} onClick={marcarResolvido} className={botaoClaro}>
              {resolvendo ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Marcar como resolvido
            </button>
          ) : null}
        </div>
      </section>

      {c.respostaDaBiblioteca ? (
        <p className="mt-4 flex items-start gap-2 rounded-[14px] p-3.5 text-sm" style={{ background: COR_DO_TOM.bom.fundo, color: COR_DO_TOM.bom.texto }}>
          <BookCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Este chamado virou resposta da biblioteca.</span>{" "}
            <Link href={`/admin/biblioteca?r=${c.respostaDaBiblioteca}`} className="font-semibold underline underline-offset-2">
              Ver a resposta
            </Link>
          </span>
        </p>
      ) : c.estado !== "aberto" && temResposta ? (
        <section className="glass mt-4 rounded-[18px] p-4 sm:p-5" aria-label="Virar resposta da biblioteca">
          {virando ? (
            <>
              <p className="text-sm font-semibold text-ink">Virar resposta da biblioteca</p>
              <div className="mt-3">
                <FormularioDeResposta
                  comOrigem={false}
                  inicial={rascunhoDaResposta(c)}
                  rotuloDoBotao="Salvar na biblioteca"
                  aviso={
                    <p className="flex items-start gap-1.5 rounded-[10px] p-2.5 text-xs font-semibold leading-relaxed" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        Tire nome, telefone e qualquer dado de cliente, e escreva a pergunta do jeito que serve para o próximo caso. A resposta
                        entra como &quot;a confirmar&quot;, e a origem (este chamado) é escrita sozinha.
                      </span>
                    </p>
                  }
                  onSalvar={async (r) => {
                    const feito = await virar(c.id, r);
                    if (!feito.ok) return feito;
                    setVirando(false);
                    router.refresh();
                    return { ok: true };
                  }}
                  onCancelar={() => setVirando(false)}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-semibold text-ink">Essa pergunta vai aparecer de novo?</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Guarde a resposta na biblioteca. A próxima pessoa encontra na busca e ninguém precisa responder outra vez.
                </p>
              </div>
              <button type="button" onClick={() => setVirando(true)} className={botaoCheio}>
                <BookPlus size={14} aria-hidden="true" /> Virar resposta da biblioteca
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
