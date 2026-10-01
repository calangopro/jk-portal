"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import { medirCapturaEnviada, medirGrupoClique } from "@/lib/bio/medicao";
import { EMAIL_VALIDO, mascara, soDigitos, telefoneValido } from "@/lib/leads/telefone";
import type { BlocoDe } from "@/lib/bio/tipos";
import { IconeWhatsapp } from "./Icones";

/**
 * O formulário do grupo de ofertas e a tela de "pronto", sem a moldura.
 *
 * O mesmo formulário mora em dois lugares: dentro da folha que abre no link da
 * bio (`Captura`) e aberto na página /grupo do anúncio (`CapturaNaPagina`).
 * Mesmos campos, mesma validação de telefone do pop-up da loja e mesmos nomes
 * de evento, então o relatório soma as três portas.
 *
 * O contato vai para o servidor do portal (`/api/leads`), que grava na base da
 * JK e repassa para Kommo, RD Station, webhook do grupo e Meta. No navegador
 * não fica token nenhum.
 *
 * LGPD: o aceite é caixa DESMARCADA e obrigatória, e o texto aceito e a hora
 * vão junto no envio.
 */

export type OrigemDaCaptura = "bio" | "grupo";

type Erros = Partial<Record<"nome" | "whatsapp" | "email" | "aceite" | "envio", string>>;

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const LEMBRETE = "jk_captura_ok";

const MOMENTOS = [
  ["namoro", "Namoro"],
  ["noivado", "Noivado"],
  ["casamento", "Casamento"],
  ["presente", "Presente"],
] as const;

/** O cadastro já feito neste navegador: `{ id }`, ou `{}` para o lembrete antigo, que guardava só a hora. */
export function cadastroAnterior(): { id?: string } | null {
  try {
    const bruto = window.localStorage.getItem(LEMBRETE);
    if (!bruto) return null;
    const lido = JSON.parse(bruto) as unknown;
    return lido && typeof lido === "object" ? (lido as { id?: string }) : {};
  } catch {
    return null;
  }
}

function lembrar(id: string | null) {
  try {
    window.localStorage.setItem(LEMBRETE, JSON.stringify({ em: Date.now(), id }));
  } catch {
    // Sem memória, a pessoa só vê o formulário de novo da próxima vez.
  }
}

function cookie(nome: string): string {
  const achado = document.cookie.split("; ").find((c) => c.startsWith(`${nome}=`));
  return achado ? decodeURIComponent(achado.slice(nome.length + 1)) : "";
}

function novoEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Para onde o botão do grupo leva.
 *
 * O link fixo do portal (jkaliancas.com.br/grupo/entrar) sai pelo caminho do
 * portal com o id do contato, para o clique ficar gravado nele. Qualquer outro
 * link (um convite colado direto na bio) segue como está.
 */
export function linkDoGrupo(grupoLink: string, leadId: string | null | undefined): string {
  try {
    const u = new URL(grupoLink, "https://www.jkaliancas.com.br");
    if (/\/grupo\/entrar\/?$/.test(u.pathname)) {
      return `${comBasePath("/grupo/entrar")}${leadId ? `?l=${encodeURIComponent(leadId)}` : ""}`;
    }
  } catch {
    // Link torto no painel: devolve como veio.
  }
  return grupoLink;
}

export function FormularioDeCaptura({
  bloco,
  campanha,
  origem,
  idTitulo,
  comCabecalho = true,
  aoEnviar,
}: {
  bloco: BlocoDe<"captura">;
  campanha: string;
  origem: OrigemDaCaptura;
  idTitulo: string;
  /** Na folha da bio o formulário traz o próprio título; na página, o título é o da página. */
  comCabecalho?: boolean;
  aoEnviar: (leadId: string | null) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const prefixo = `captura-${origem}`;

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
    if ((bloco.email === "obrigatorio" || email) && !EMAIL_VALIDO.test(email)) {
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
    // A origem já descoberta por `OrigemDaBio` (Instagram, TikTok, anúncio)
    // vale mais que a URL, que no link divulgado não tem etiqueta.
    const descoberta = window.jkOrigemDaBio;
    const utm =
      descoberta?.utm ??
      Object.fromEntries(UTM.map((k) => [k, busca.get(k)?.slice(0, 120) ?? ""]).filter(([, v]) => v));
    const eventId = novoEventId();

    setEnviando(true);
    let leadId: string | null = null;
    try {
      const resp = await fetch(comBasePath("/api/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origem,
          nome,
          whatsapp: tel,
          email,
          momento,
          campanha,
          pagina: window.location.pathname,
          referencia: document.referrer || "",
          rede: descoberta?.rede ?? "",
          // Os dois cliques de anúncio. O `fbclid` sozinho NÃO quer dizer
          // anúncio (o Instagram põe em todo clique para fora).
          gclid: busca.get("gclid") ?? "",
          fbclid: busca.get("fbclid") ?? "",
          // Os cookies do pixel, que o Meta usa para casar o Lead do servidor
          // com quem clicou no anúncio.
          fbc: cookie("_fbc"),
          fbp: cookie("_fbp"),
          ...utm,
          aceite: "sim",
          aceite_texto: bloco.aceite,
          aceite_em: new Date().toISOString(),
          event_id: eventId,
          // Campo isca: gente não vê, robô preenche.
          empresa: String(dados.get("empresa") ?? ""),
        }),
      });
      if (!resp.ok) throw new Error(String(resp.status));
      leadId = ((await resp.json()) as { id?: string | null }).id ?? null;
    } catch {
      setEnviando(false);
      setErros({ envio: "Não deu para enviar agora. Confira a conexão e tente de novo." });
      return;
    }

    lembrar(leadId);
    medirCapturaEnviada({ campanha, origem, momento, comEmail: Boolean(email), eventId });
    setEnviando(false);
    aoEnviar(leadId);
  }

  const limpar = (campo: keyof Erros) =>
    setErros((e) => (e[campo] || e.envio ? { ...e, [campo]: undefined, envio: undefined } : e));

  return (
    <form onSubmit={enviar} noValidate className="pt-1">
      {comCabecalho ? (
        <>
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
        </>
      ) : null}

      <div className={`${comCabecalho ? "mt-5" : ""} space-y-3.5`}>
        <Campo
          prefixo={prefixo}
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
          prefixo={prefixo}
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
            prefixo={prefixo}
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
              aria-describedby={erros.aceite ? `${prefixo}-erro-aceite` : undefined}
              onChange={() => limpar("aceite")}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--bio-acento)]"
            />
            <span>{bloco.aceite}</span>
          </label>
          {erros.aceite ? (
            <p id={`${prefixo}-erro-aceite`} className="mt-1.5 text-[0.78rem] font-medium text-[var(--bio-erro)]">
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
        disabled={enviando}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--bio-acao)] px-5 text-[0.92rem] font-semibold text-[var(--bio-acao-texto)] transition-colors hover:bg-[var(--bio-acao-realce)] disabled:opacity-70"
      >
        {enviando ? <LoaderCircle size={18} aria-hidden className="animate-spin" /> : null}
        {enviando ? "Enviando" : bloco.botaoEnviar}
      </button>

      {bloco.nota ? (
        <p className="mt-3 text-center text-[0.75rem] leading-snug text-[var(--bio-apoio)]">{bloco.nota}</p>
      ) : null}
    </form>
  );
}

/**
 * A tela de "pronto", com o botão do grupo.
 *
 * `automatico` (página /grupo) leva sozinho ao grupo depois de um instante, que
 * é o tempo de a tag de Lead sair. O botão continua na tela para quem estiver
 * num navegador que segura o redirecionamento.
 */
export function SucessoDaCaptura({
  bloco,
  campanha,
  origem,
  href,
  idTitulo,
  automatico = false,
  outroNumero,
}: {
  bloco: BlocoDe<"captura">;
  campanha: string;
  origem: OrigemDaCaptura;
  href: string;
  idTitulo: string;
  automatico?: boolean;
  /** Mostra "cadastrar outro número", para quem volta à página já cadastrado. */
  outroNumero?: () => void;
}) {
  const titulo = useRef<HTMLParagraphElement>(null);
  const medido = useRef(false);

  const medir = () => {
    if (medido.current) return;
    medido.current = true;
    medirGrupoClique({ campanha, origem });
  };

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  useEffect(() => {
    if (!automatico || !href) return;
    const t = window.setTimeout(() => {
      medir();
      window.location.assign(href);
    }, 1500);
    return () => window.clearTimeout(t);
    // `medir` é estável na prática (ref); a dependência real é o destino.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatico, href]);

  return (
    <div className="py-4 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bio-acao)] text-[var(--bio-acao-texto)]">
        <Check size={28} aria-hidden strokeWidth={2.2} />
      </span>
      <p ref={titulo} id={idTitulo} tabIndex={-1} className="mt-4 text-[1.3rem] font-medium leading-tight outline-none">
        {bloco.sucessoTitulo}
      </p>
      {bloco.sucessoTexto ? <p className="mt-2 text-[0.9rem] text-[var(--bio-apoio)]">{bloco.sucessoTexto}</p> : null}
      {href ? (
        <a
          href={href}
          onClick={medir}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--bio-acao)] px-5 text-[0.92rem] font-semibold text-[var(--bio-acao-texto)] hover:bg-[var(--bio-acao-realce)]"
        >
          <IconeWhatsapp size={18} />
          {bloco.grupoRotulo}
        </a>
      ) : null}
      {automatico && href ? (
        <p role="status" className="mt-3 text-[0.75rem] text-[var(--bio-apoio)]">
          Abrindo o WhatsApp...
        </p>
      ) : null}
      {outroNumero ? (
        <button
          type="button"
          onClick={outroNumero}
          className="mt-4 text-[0.8rem] font-medium text-[var(--bio-acento)] underline-offset-4 hover:underline"
        >
          Cadastrar outro número
        </button>
      ) : null}
    </div>
  );
}

/**
 * Rótulo, campo e erro amarrados. O erro entra no `aria-describedby`, então o
 * leitor de tela lê o motivo junto com o campo quando o foco volta para ele.
 */
function Campo({
  prefixo,
  rotulo,
  extra,
  erro,
  name,
  ...campo
}: React.InputHTMLAttributes<HTMLInputElement> & {
  prefixo: string;
  rotulo: string;
  extra?: string;
  erro?: string;
  name: string;
}) {
  const id = `${prefixo}-${name}`;
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
