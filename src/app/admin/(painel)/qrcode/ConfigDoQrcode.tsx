"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink } from "lucide-react";
import { mascara, soDigitos, telefoneValido } from "@/lib/leads/telefone";
import {
  LINK_DO_QRCODE,
  linkAceito,
  linkDoWhatsappDoQrcode,
  type ConfigDoQrcode,
  type ModoDoQrcode,
} from "@/lib/qrcode/tipos";
import { BotaoCopiar } from "../bio/LinksParaDivulgar";
import { salvarQrcode, type EstadoDoQrcode } from "./actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

const curto = (url: string) => url.replace(/^https:\/\/www\./, "");

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
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

export function ConfigDoQrcode({ inicial }: { inicial: ConfigDoQrcode }) {
  const [estado, acao] = useActionState<EstadoDoQrcode, FormData>(salvarQrcode, {});
  const [modo, setModo] = useState<ModoDoQrcode>(inicial.modo);
  const [numero, setNumero] = useState(mascara(inicial.whatsapp));
  const [mensagem, setMensagem] = useState(inicial.mensagem);
  const [link, setLink] = useState(inicial.link);

  // O teste abre o que está na tela, antes de salvar, para a pessoa conferir o
  // número e a mensagem no próprio WhatsApp.
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
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={acao} className="glass rounded-[18px] p-5">
        <h2 className="font-medium text-ink">Para onde o QR leva</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          O endereço impresso nunca muda. Trocou o número ou quer mandar para outro lugar, troque aqui: a próxima
          leitura já vai para o destino novo.
        </p>

        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Destino</legend>
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
              Chega escrita na conversa, e a pessoa só toca em enviar. É por ela que o atendimento sabe que o contato
              veio do QR.
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
          <Salvar />
        </div>
      </form>

      <section className="glass rounded-[18px] p-5">
        <h2 className="font-medium text-ink">Endereço impresso</h2>
        <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-border bg-white/70 p-3">
          <code className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{curto(LINK_DO_QRCODE)}</code>
          <BotaoCopiar valor={LINK_DO_QRCODE} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          É o que está nos adesivos dos banheiros do Shopping Tamboré (espelhos e portas). Cada leitura entra na
          contagem abaixo.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Para separar um impresso novo na contagem, gere o QR com uma etiqueta no fim, como{" "}
          <code className="rounded bg-ink/5 px-1 text-ink">{curto(LINK_DO_QRCODE)}?o=vitrine</code>. Vai para o mesmo
          destino e aparece com o nome próprio em &quot;De qual impresso&quot;.
        </p>
      </section>
    </div>
  );
}
