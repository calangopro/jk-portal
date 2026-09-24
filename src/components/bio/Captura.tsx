"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight, LoaderCircle, X } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import { medirCapturaAberta, medirCapturaEnviada, medirGrupoClique } from "@/lib/bio/medicao";
import type { BlocoDe } from "@/lib/bio/tipos";
import { IconeWhatsapp } from "./Icones";

/**
 * Grupo de ofertas no WhatsApp: o botão da bio e a folha com o formulário.
 *
 * É a mesma captura do tema Esquenta da loja (`campanha-captura.html`), com os
 * mesmos campos, a mesma validação de telefone e os mesmos nomes de evento. A
 * diferença é para onde o contato vai: aqui ele passa pelo servidor do portal,
 * que grava na base da JK e repassa para o RD Station e para o webhook do
 * grupo. No navegador não fica token nenhum.
 *
 * A folha é um `<dialog>` nativo: prende o foco, fecha no Esc e devolve o foco
 * ao botão sem uma linha de código para isso. No celular ela sobe de baixo,
 * que é onde está o polegar.
 *
 * LGPD: o aceite é caixa DESMARCADA e obrigatória, e o texto aceito e a hora
 * vão junto no envio.
 */

type Props = { bloco: BlocoDe<"captura">; campanha: string };

type Passo = "form" | "enviando" | "ok";

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const LEMBRETE = "jk_captura_ok";

function soDigitos(v: string): string {
  let d = v.replace(/\D/g, "");
  // Quem digita +55 na frente.
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

function mascara(d: string): string {
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function telefoneValido(d: string): boolean {
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Celular com 11 dígitos começa em 9 depois do DDD.
  return d.length === 10 || d.charAt(2) === "9";
}

function jaEnviou(): boolean {
  try {
    return Boolean(window.localStorage.getItem(LEMBRETE));
  } catch {
    return false;
  }
}

const MOMENTOS = [
  ["namoro", "Namoro"],
  ["noivado", "Noivado"],
  ["casamento", "Casamento"],
  ["presente", "Presente"],
] as const;

type Erros = Partial<Record<"nome" | "whatsapp" | "email" | "aceite" | "envio", string>>;

export function Captura({ bloco, campanha }: Props) {
  const folha = useRef<HTMLDialogElement>(null);
  const tituloOk = useRef<HTMLParagraphElement>(null);
  const idTitulo = useId();
  const [passo, setPasso] = useState<Passo>("form");
  const [telefone, setTelefone] = useState("");
  const [erros, setErros] = useState<Erros>({});

  useEffect(() => {
    if (passo === "ok") tituloOk.current?.focus();
  }, [passo]);

  function abrir() {
    // Quem já se cadastrou vai direto para o botão do grupo.
    if (jaEnviou()) setPasso("ok");
    folha.current?.showModal();
    medirCapturaAberta({ campanha });
  }

  function fechar() {
    folha.current?.close();
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const dados = new FormData(form);

    const nome = String(dados.get("nome") ?? "").replace(/\s+/g, " ").trim();
    const tel = soDigitos(telefone);
    const email = String(dados.get("email") ?? "").trim();
    const momento = String(dados.get("momento") ?? "");
    const aceite = dados.get("aceite") === "sim";

    const novos: Erros = {};
    if (nome.length < 2) novos.nome = "Conte como podemos te chamar.";
    if (!telefoneValido(tel)) novos.whatsapp = "Confira o WhatsApp com DDD, só números.";
    if ((bloco.email === "obrigatorio" || email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      novos.email = "Confira o e-mail.";
    }
    if (!aceite) novos.aceite = "Marque o aceite para receber as ofertas.";

    setErros(novos);
    const primeiro = (["nome", "whatsapp", "email", "aceite"] as const).find((c) => novos[c]);
    if (primeiro) {
      form.querySelector<HTMLInputElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }

    const busca = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(
      UTM.map((k) => [k, busca.get(k)?.slice(0, 120) ?? ""]).filter(([, v]) => v),
    );

    setPasso("enviando");
    try {
      const resp = await fetch(comBasePath("/api/bio/lead"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp: tel,
          email,
          momento,
          campanha,
          pagina: window.location.pathname,
          referencia: document.referrer || "",
          // Os dois cliques de anúncio. O `fbclid` sozinho NÃO quer dizer
          // anúncio (o Instagram põe em todo clique para fora), então quem
          // decide pago ou orgânico é o servidor, olhando o conjunto.
          gclid: busca.get("gclid") ?? "",
          fbclid: busca.get("fbclid") ?? "",
          ...utm,
          aceite: "sim",
          aceite_texto: bloco.aceite,
          aceite_em: new Date().toISOString(),
          // Campo isca: gente não vê, robô preenche.
          empresa: String(dados.get("empresa") ?? ""),
        }),
      });
      if (!resp.ok) throw new Error(String(resp.status));
    } catch {
      setPasso("form");
      setErros({ envio: "Não deu para enviar agora. Confira a conexão e tente de novo." });
      return;
    }

    try {
      window.localStorage.setItem(LEMBRETE, String(Date.now()));
    } catch {
      // Sem memória, a pessoa só vê o formulário de novo da próxima vez.
    }
    medirCapturaEnviada({ campanha, momento, comEmail: Boolean(email) });
    setPasso("ok");
  }

  const limpar = (campo: keyof Erros) =>
    setErros((e) => (e[campo] || e.envio ? { ...e, [campo]: undefined, envio: undefined } : e));

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        className="group flex w-full items-center gap-3 rounded-[20px] bg-[var(--bio-acao)] px-4 py-3.5 text-left text-[var(--bio-acao-texto)] shadow-[0_14px_30px_-16px_rgb(0_0_0/0.55)] transition-colors hover:bg-[var(--bio-acao-realce)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bio-acao-texto)]/10">
          <IconeWhatsapp size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold leading-tight">{bloco.rotulo}</span>
          {bloco.detalhe ? (
            <span className="mt-0.5 block text-[0.75rem] leading-snug opacity-85">{bloco.detalhe}</span>
          ) : null}
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5" />
      </button>

      <dialog
        ref={folha}
        aria-labelledby={idTitulo}
        onClick={(e) => {
          // Toque no fundo escuro fecha, como em qualquer folha de celular.
          if (e.target === e.currentTarget) fechar();
        }}
        className="m-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-y-auto rounded-t-[26px] border-0 bg-[var(--bio-superficie)] p-0 text-[var(--bio-texto)] backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-[26px]"
      >
        <div className="relative px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--bio-linha-forte)] sm:hidden" />
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-[var(--bio-apoio)] hover:bg-[var(--bio-superficie-alta)] hover:text-[var(--bio-texto)]"
          >
            <X size={20} aria-hidden />
          </button>

          {passo === "ok" ? (
            <div className="py-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bio-acao)] text-[var(--bio-acao-texto)]">
                <Check size={28} aria-hidden strokeWidth={2.2} />
              </span>
              <p
                ref={tituloOk}
                id={idTitulo}
                tabIndex={-1}
                className="mt-4 text-[1.3rem] font-medium leading-tight outline-none"
              >
                {bloco.sucessoTitulo}
              </p>
              {bloco.sucessoTexto ? (
                <p className="mt-2 text-[0.9rem] text-[var(--bio-apoio)]">{bloco.sucessoTexto}</p>
              ) : null}
              {bloco.grupoLink ? (
                <a
                  href={bloco.grupoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => medirGrupoClique({ campanha })}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--bio-acao)] px-5 text-[0.92rem] font-semibold text-[var(--bio-acao-texto)] hover:bg-[var(--bio-acao-realce)]"
                >
                  <IconeWhatsapp size={18} />
                  {bloco.grupoRotulo}
                </a>
              ) : null}
            </div>
          ) : (
            <form onSubmit={enviar} noValidate className="pt-1">
              {bloco.eyebrow ? (
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--bio-acento)]">
                  {bloco.eyebrow}
                </p>
              ) : null}
              <h2 id={idTitulo} className="mt-2 pr-10 text-[1.35rem] font-medium leading-tight">
                {bloco.titulo}
              </h2>
              {bloco.descricao ? (
                <p className="mt-2 text-[0.88rem] leading-relaxed text-[var(--bio-apoio)]">{bloco.descricao}</p>
              ) : null}

              <div className="mt-5 space-y-3.5">
                <Campo
                  rotulo="Nome"
                  erro={erros.nome}
                  name="nome"
                  type="text"
                  autoComplete="given-name"
                  maxLength={60}
                  required
                  onInput={() => limpar("nome")}
                />

                <Campo
                  rotulo="WhatsApp com DDD"
                  erro={erros.whatsapp}
                  name="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  required
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(mascara(soDigitos(e.target.value)));
                    limpar("whatsapp");
                  }}
                />

                {bloco.email !== "nao" ? (
                  <Campo
                    rotulo="E-mail"
                    extra={bloco.email === "opcional" ? "(opcional)" : undefined}
                    erro={erros.email}
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={120}
                    required={bloco.email === "obrigatorio"}
                    onInput={() => limpar("email")}
                  />
                ) : null}

                {bloco.momento ? (
                  <fieldset>
                    <legend className="text-[0.8rem] font-medium">
                      Momento do casal <span className="font-normal text-[var(--bio-apoio)]">(opcional)</span>
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {MOMENTOS.map(([valor, rotulo]) => (
                        <label key={valor} className="relative">
                          <input type="radio" name="momento" value={valor} className="peer sr-only" />
                          <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--bio-linha)] bg-[var(--bio-superficie-alta)] text-[0.85rem] transition-colors peer-checked:border-[var(--bio-acento)] peer-checked:text-[var(--bio-acento)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--bio-acento)]">
                            {rotulo}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {/* Isca para robô: fora da tela e fora do Tab, nunca visível. */}
                <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label>
                    Empresa
                    <input name="empresa" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-[0.82rem] leading-snug">
                    <input
                      name="aceite"
                      type="checkbox"
                      value="sim"
                      required
                      aria-invalid={Boolean(erros.aceite)}
                      aria-describedby={erros.aceite ? "erro-aceite" : undefined}
                      onChange={() => limpar("aceite")}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--bio-acento)]"
                    />
                    <span>{bloco.aceite}</span>
                  </label>
                  {erros.aceite ? (
                    <p id="erro-aceite" className="mt-1.5 text-[0.78rem] font-medium text-[var(--bio-erro)]">
                      {erros.aceite}
                    </p>
                  ) : null}
                </div>
              </div>

              {erros.envio ? (
                <p role="alert" className="mt-4 text-[0.82rem] font-medium text-[var(--bio-erro)]">
                  {erros.envio}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={passo === "enviando"}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--bio-acao)] px-5 text-[0.92rem] font-semibold text-[var(--bio-acao-texto)] transition-colors hover:bg-[var(--bio-acao-realce)] disabled:opacity-70"
              >
                {passo === "enviando" ? <LoaderCircle size={18} aria-hidden className="animate-spin" /> : null}
                {passo === "enviando" ? "Enviando" : bloco.botaoEnviar}
              </button>

              {bloco.nota ? (
                <p className="mt-3 text-center text-[0.75rem] leading-snug text-[var(--bio-apoio)]">{bloco.nota}</p>
              ) : null}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

/**
 * Rótulo, campo e erro amarrados. O erro entra no `aria-describedby`, então o
 * leitor de tela lê o motivo junto com o campo quando o foco volta para ele.
 */
function Campo({
  rotulo,
  extra,
  erro,
  name,
  ...campo
}: React.InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  extra?: string;
  erro?: string;
  name: string;
}) {
  const id = `bio-${name}`;
  const idErro = `${id}-erro`;
  return (
    <div>
      <label htmlFor={id} className="text-[0.8rem] font-medium">
        {rotulo} {extra ? <span className="font-normal text-[var(--bio-apoio)]">{extra}</span> : null}
      </label>
      <input
        {...campo}
        id={id}
        name={name}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? idErro : undefined}
        className="mt-1.5 block min-h-12 w-full rounded-xl border border-[var(--bio-linha-forte)] bg-[var(--bio-superficie-alta)] px-3.5 text-[1rem] text-[var(--bio-texto)] placeholder:text-[var(--bio-apoio)] focus:border-[var(--bio-acento)] aria-[invalid=true]:border-[var(--bio-erro)]"
      />
      {erro ? (
        <p id={idErro} className="mt-1.5 text-[0.78rem] font-medium text-[var(--bio-erro)]">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
