"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { MapPin, Clock, Wrench, Search, Building2, Star, Navigation, HelpCircle, Plus, Trash2 } from "lucide-react";
import { salvarLoja, type LojaState } from "../actions";
import { DIAS } from "../dias";

type Horario = { dayOfWeek: string[]; opens: string; closes: string };
type Faq = { question: string; answer: string };

export type LojaDados = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  address_locality: string | null;
  address_region: string | null;
  postal_code: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  gbp_url: string | null;
  gbp_place_id: string | null;
  opening_hours: Horario[] | null;
  services: string[] | null;
  status: string;
  mall_name: string | null;
  unit_label: string | null;
  opened_at: string | null;
  about: string | null;
  highlights: string[] | null;
  maps_url: string | null;
  waze_url: string | null;
  whatsapp: string | null;
  hours_source: string | null;
  hours_note: string | null;
  faqs: Faq[] | null;
  rating: number | null;
  reviews_count: number | null;
  reviews_source: string | null;
  reviews_checked_at: string | null;
  sort_order: number | null;
};

const campo =
  "mt-1.5 w-full rounded-[12px] border border-border bg-white/80 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/50 hover:border-brand/40 focus:border-brand";

function Secao({
  Icone, titulo, ajuda, children,
}: {
  Icone: typeof MapPin;
  titulo: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[20px] p-6 sm:p-7">
      <div className="mb-5 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
          <Icone size={14} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">{titulo}</p>
          {ajuda ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{ajuda}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar loja"}
    </button>
  );
}

export function Form({ loja }: { loja: LojaDados }) {
  const [estado, acao] = useActionState<LojaState, FormData>(salvarLoja, {});
  const [faqs, setFaqs] = useState<Faq[]>(loja.faqs ?? []);

  /** Descobre o horário já salvo para um dia. */
  const horarioDoDia = (dia: string) => {
    const h = (loja.opening_hours ?? []).find((x) => x.dayOfWeek?.includes(dia));
    return { aberto: !!h, opens: h?.opens ?? "09:00", closes: h?.closes ?? "18:00" };
  };

  return (
    <form action={acao} className="space-y-5">
      <input type="hidden" name="id" value={loja.id} />

      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-3">
        <Link href="/admin/lojas" className="text-xs text-muted hover:text-brand-nav">
          ← Lojas
        </Link>
        <div className="flex items-center gap-3">
          {estado.erro ? <span className="text-xs text-wine">{estado.erro}</span> : null}
          {estado.ok ? <span className="text-xs text-brand-strong">{estado.ok}</span> : null}
          <Salvar />
        </div>
      </div>

      <Secao
        Icone={MapPin}
        titulo="Identificação e endereço"
        ajuda="Escreva exatamente como está no Google Meu Negócio. Qualquer diferença de abreviação enfraquece o sinal local."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Nome da unidade</span>
            <input name="name" defaultValue={loja.name} required placeholder="Guarulhos" className={campo} />
            <span className="mt-1 block text-xs text-muted">No site aparece como &ldquo;JK Alianças + nome&rdquo;.</span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Endereço da página</span>
            <input name="slug" defaultValue={loja.slug} placeholder="guarulhos-centro" className={campo} />
            <span className="mt-1 block text-xs text-muted">Fica em /lojas/{loja.slug}</span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Logradouro, número e complemento</span>
            <input name="address" defaultValue={loja.address ?? ""} placeholder="Rua Exemplo, 123, Loja 4" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Cidade</span>
            <input name="address_locality" defaultValue={loja.address_locality ?? ""} placeholder="Guarulhos" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Estado</span>
            <input name="address_region" defaultValue={loja.address_region ?? ""} placeholder="SP" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">CEP</span>
            <input name="postal_code" defaultValue={loja.postal_code ?? ""} placeholder="07000-000" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Telefone</span>
            <input name="phone" defaultValue={loja.phone ?? ""} placeholder="(11) 90000-0000" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">WhatsApp</span>
            <input name="whatsapp" defaultValue={loja.whatsapp ?? ""} placeholder="(11) 90000-0000" className={campo} />
            <span className="mt-1 block text-xs text-muted">Vira o botão &ldquo;Falar no WhatsApp&rdquo;, com mensagem pronta.</span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Shopping</span>
            <input name="mall_name" defaultValue={loja.mall_name ?? ""} placeholder="Santana Parque Shopping" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Onde fica dentro do shopping</span>
            <input name="unit_label" defaultValue={loja.unit_label ?? ""} placeholder="1º piso, loja 1022" className={campo} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Ordem na listagem</span>
            <input name="sort_order" type="number" defaultValue={loja.sort_order ?? 0} className={campo} />
            <span className="mt-1 block text-xs text-muted">Menor aparece primeiro.</span>
          </label>
        </div>
      </Secao>

      <Secao
        Icone={Building2}
        titulo="História da unidade"
        ajuda="O que esta loja tem de próprio. Fica na página, acima dos serviços. Deixe vazio se ainda não houver nada verificado para contar."
      >
        <div className="grid gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Inaugurada em</span>
            <input
              name="opened_at"
              type="date"
              defaultValue={loja.opened_at ?? ""}
              className={campo}
            />
            <span className="mt-1 block text-xs text-muted">
              Só preencha com a data confirmada pela JK. Vazio não mostra nada na página.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Apresentação</span>
            <textarea
              name="about"
              rows={5}
              defaultValue={loja.about ?? ""}
              placeholder="Como é a loja, o que ela tem de diferente, quem atende. Separe parágrafos com uma linha em branco."
              className={`${campo} resize-y`}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Destaques</span>
            <textarea
              name="highlights"
              rows={3}
              defaultValue={(loja.highlights ?? []).join("\n")}
              placeholder={"Um destaque por linha\nEstacionamento coberto\nAtendimento em Libras"}
              className={`${campo} resize-y`}
            />
          </label>
        </div>
      </Secao>

      <Secao
        Icone={Search}
        titulo="Google Meu Negócio e mapa"
        ajuda="A latitude e a longitude alimentam os dados estruturados e, mais adiante, o mapa na página."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Link do perfil no Google</span>
            <input name="gbp_url" defaultValue={loja.gbp_url ?? ""} placeholder="https://maps.app.goo.gl/..." className={campo} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">Latitude</span>
            <input name="latitude" defaultValue={loja.latitude ?? ""} placeholder="-23.4628" className={campo} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">Longitude</span>
            <input name="longitude" defaultValue={loja.longitude ?? ""} placeholder="-46.5333" className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Place ID</span>
            <input name="gbp_place_id" defaultValue={loja.gbp_place_id ?? ""} className={campo} />
          </label>

          <label className="block sm:col-span-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <MapPin size={12} className="text-brand-nav" /> Link curto do Google Maps
            </span>
            <input name="maps_url" defaultValue={loja.maps_url ?? ""} placeholder="https://maps.app.goo.gl/..." className={campo} />
            <span className="mt-1 block text-xs text-muted">
              É o link do botão &ldquo;Como chegar&rdquo;. Sem ele, o site monta a rota pela coordenada.
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Navigation size={12} className="text-brand-nav" /> Link do Waze
            </span>
            <input name="waze_url" defaultValue={loja.waze_url ?? ""} placeholder="Deixe vazio para o site montar pela coordenada" className={campo} />
          </label>
        </div>
      </Secao>

      <Secao
        Icone={Clock}
        titulo="Horário de funcionamento"
        ajuda="Dias com o mesmo horário são agrupados sozinhos ao salvar, do jeito que o Google espera."
      >
        <div className="space-y-2.5">
          {DIAS.map((d) => {
            const h = horarioDoDia(d.chave);
            return (
              <div key={d.chave} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border/60 bg-white/50 px-4 py-2.5">
                <label className="flex w-28 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name={`aberto_${d.chave}`}
                    value="1"
                    defaultChecked={h.aberto}
                    className="accent-brand"
                  />
                  {d.nome}
                </label>
                <span className="text-xs text-muted">das</span>
                <input type="time" name={`abre_${d.chave}`} defaultValue={h.opens} className="rounded-[8px] border border-border bg-white px-2 py-1 text-sm text-ink outline-none focus:border-brand" />
                <span className="text-xs text-muted">às</span>
                <input type="time" name={`fecha_${d.chave}`} defaultValue={h.closes} className="rounded-[8px] border border-border bg-white px-2 py-1 text-sm text-ink outline-none focus:border-brand" />
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink">De onde veio este horário</span>
            <input
              name="hours_source"
              defaultValue={loja.hours_source ?? ""}
              placeholder="Site do shopping, consultado em 12/08/2026"
              className={campo}
            />
            <span className="mt-1 block text-xs text-muted">
              Sem fonte, a página avisa que o horário não foi confirmado e manda a
              pessoa conferir no Google. É melhor do que publicar um palpite.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Observação sobre o horário</span>
            <input
              name="hours_note"
              defaultValue={loja.hours_note ?? ""}
              placeholder="Em feriado o shopping abre das 14h às 20h"
              className={campo}
            />
          </label>
        </div>
      </Secao>

      <Secao
        Icone={Star}
        titulo="Avaliações"
        ajuda="Só preencha com número real do Google Meu Negócio. Nota sem origem é recusada ao salvar, e o banco também barra."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Nota (0 a 5)</span>
            <input
              name="rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              defaultValue={loja.rating ?? ""}
              placeholder="4,8"
              className={campo}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Quantidade de avaliações</span>
            <input
              name="reviews_count"
              type="number"
              min="0"
              defaultValue={loja.reviews_count ?? ""}
              placeholder="1240"
              className={campo}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Origem</span>
            <input
              name="reviews_source"
              defaultValue={loja.reviews_source ?? ""}
              placeholder="Google Meu Negócio da unidade"
              className={campo}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Conferido em</span>
            <input
              name="reviews_checked_at"
              type="date"
              defaultValue={loja.reviews_checked_at ?? ""}
              className={campo}
            />
          </label>
        </div>
      </Secao>

      <Secao
        Icone={HelpCircle}
        titulo="Perguntas sobre esta loja"
        ajuda="Entram no FAQPage da página, junto com as que o site monta sozinho (horário, endereço e aro de prova). Escreva só o que for específico desta unidade."
      >
        {/* Vai como JSON num campo escondido: é o formato que a action grava,
            e evita inventar um esquema de nomes por índice no formulário. */}
        <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />

        {faqs.length === 0 ? (
          <p className="mb-4 text-xs text-muted">
            Nenhuma pergunta própria. A página já responde horário, endereço e
            aro de prova sozinha, com os dados desta loja.
          </p>
        ) : null}

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-[12px] border border-border/70 bg-white/50 p-3">
              <div className="flex items-start gap-2">
                <input
                  value={f.question}
                  onChange={(e) =>
                    setFaqs((a) => a.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))
                  }
                  placeholder="Tem estacionamento?"
                  className="w-full rounded-[8px] border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => setFaqs((a) => a.filter((_, j) => j !== i))}
                  aria-label="Remover pergunta"
                  className="shrink-0 rounded-[8px] p-2 text-muted transition-colors hover:bg-wine/10 hover:text-wine"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                value={f.answer}
                onChange={(e) =>
                  setFaqs((a) => a.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))
                }
                rows={2}
                placeholder="Resposta curta e direta, sem enrolação."
                className="mt-2 w-full resize-y rounded-[8px] border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFaqs((a) => [...a, { question: "", answer: "" }])}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/8 px-3.5 py-2 text-xs font-semibold text-brand-nav transition-colors hover:bg-brand/16"
        >
          <Plus size={13} /> Adicionar pergunta
        </button>
      </Secao>

      <Secao
        Icone={Wrench}
        titulo="Serviços da unidade"
        ajuda="O que esta loja faz e as outras talvez não. Separe por vírgula."
      >
        <input
          name="services"
          defaultValue={(loja.services ?? []).join(", ")}
          placeholder="Gravação na hora, Ajuste de aro, Aro de prova"
          className={campo}
        />
      </Secao>

      <div className="flex justify-end pb-4">
        <Salvar />
      </div>
    </form>
  );
}
