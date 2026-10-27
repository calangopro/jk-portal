"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink } from "lucide-react";
import { mascara, soDigitos, telefoneValido } from "@/lib/leads/telefone";
import {
  enderecoCurto,
  linkAceito,
  linkDoWhatsappDoQrcode,
  paraSlug,
  type DestinoDoQrcode,
  type ModoDoQrcode,
} from "@/lib/qrcode/tipos";
import { criarQrcode, salvarQrcode, type EstadoDoQrcode } from "./actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

function Enviar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : rotulo}
    </button>
  );
}

function OpcaoDeModo({
  valor,
  atual,
  titulo,
  texto,
  onEscolher,
}: {
  valor: ModoDoQrcode;
  atual: ModoDoQrcode;
  titulo: string;
  texto: string;
  onEscolher: (m: ModoDoQrcode) => void;
}) {
  const marcado = valor === atual;
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-3 transition-colors ${
        marcado ? "border-brand bg-white/80" : "border-border hover:border-brand/40"
      }`}
    >
      <input
        type="radio"
        name="modo"
        value={valor}
        checked={marcado}
        onChange={() => onEscolher(valor)}
        className="mt-0.5 accent-brand"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{titulo}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted">{texto}</span>
      </span>
    </label>
  );
}

/**
 * Criar um QR ou mudar um que já existe. O endereço só se escolhe ao criar:
 * depois ele está impresso, e a tela de edição nem mostra o campo.
 */
export function FormularioDoQrcode({
  id,
  nome: nomeInicial,
  destino,
}: {
  /** Sem id, cria. Com id, salva aquele QR. */
  id?: string;
  nome: string;
  destino: DestinoDoQrcode;
}) {
  const criando = !id;
  const [estado, acao] = useActionState<EstadoDoQrcode, FormData>(criando ? criarQrcode : salvarQrcode, {});
  const [nome, setNome] = useState(nomeInicial);
  // O endereço acompanha o nome até a pessoa mexer nele.
  const [slug, setSlug] = useState(paraSlug(nomeInicial));
  const [slugMexido, setSlugMexido] = useState(false);
  const [modo, setModo] = useState<ModoDoQrcode>(destino.modo);
  const [numero, setNumero] = useState(mascara(destino.whatsapp));
  const [mensagem, setMensagem] = useState(destino.mensagem);
  const [link, setLink] = useState(destino.link);

  // O teste abre o que está na tela, antes de salvar, para conferir o número
  // e a mensagem no próprio WhatsApp.
  const digitos = soDigitos(numero);
  const teste =
    modo === "whatsapp"
      ? telefoneValido(digitos)
        ? linkDoWhatsappDoQrcode(digitos, mensagem)
        : null
      : linkAceito(link.trim())
        ? link.trim()
        : null;

  return (
    <form action={acao} className="glass rounded-[18px] p-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <label className="block">
        <span className="text-xs font-semibold text-ink">Nome do lugar</span>
        <input
          name="nome"
          required
          maxLength={80}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            if (!slugMexido) setSlug(paraSlug(e.target.value));
          }}
          placeholder="Banheiros do Shopping Osasco"
          className={`${campo} mt-1`}
        />
        <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
          Só para o painel. Quem lê o QR não vê este nome.
        </span>
      </label>

      {criando ? (
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Endereço do QR</span>
          <span className="mt-1 flex items-center rounded-[10px] border border-border bg-white/80 transition-colors focus-within:border-brand hover:border-brand/40">
            <span className="shrink-0 pl-3 text-sm text-muted">{enderecoCurto("")}/</span>
            <input
              name="slug"
              required
              maxLength={40}
              value={slug}
              onChange={(e) => {
                setSlugMexido(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              placeholder="shopping-osasco"
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm text-ink outline-none"
            />
          </span>
          <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
            É o que vai dentro do QR. Depois de criado não muda mais, porque vai impresso. Curto é melhor: o desenho fica
            menos denso.
          </span>
        </label>
      ) : null}

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-ink">Para onde leva</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          <OpcaoDeModo
            valor="whatsapp"
            atual={modo}
            titulo="WhatsApp"
            texto="Abre a conversa com a mensagem já escrita."
            onEscolher={setModo}
          />
          <OpcaoDeModo
            valor="link"
            atual={modo}
            titulo="Outro link"
            texto="A bio, um produto, uma página de campanha."
            onEscolher={setModo}
          />
        </div>
      </fieldset>

      <div hidden={modo !== "whatsapp"}>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Número do WhatsApp</span>
          <input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={numero}
            onChange={(e) => setNumero(mascara(soDigitos(e.target.value)))}
            placeholder="(11) 99999-9999"
            className={`${campo} mt-1`}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Mensagem pronta</span>
          <textarea
            name="mensagem"
            rows={3}
            maxLength={300}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${campo} mt-1 resize-y`}
          />
          <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
            Chega escrita na conversa, e a pessoa só toca em enviar. Cite o lugar (&quot;vi o QR da JK no Shopping
            Osasco&quot;): é por ela que o atendimento sabe de onde veio o contato.
          </span>
        </label>
      </div>

      <div hidden={modo !== "link"}>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Link</span>
          <input
            name="link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.jkaliancas.com.br/..."
            className={`${campo} mt-1`}
          />
        </label>
      </div>

      {teste ? (
        <a
          href={teste}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-brand-nav hover:underline"
        >
          Testar este destino
          <ExternalLink size={11} aria-hidden />
        </a>
      ) : null}

      {estado.erro ? <p className="mt-3 text-xs text-wine">{estado.erro}</p> : null}
      {estado.ok ? <p className="mt-3 text-xs text-brand-strong">{estado.ok}</p> : null}

      <div className="mt-4">
        <Enviar rotulo={criando ? "Criar QR code" : "Salvar"} />
      </div>
    </form>
  );
}
