import Link from "next/link";
import { MapPin, AlertTriangle, ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { criarLoja, mudarStatusLoja } from "./actions";

export const metadata = { title: "Lojas" };

type Linha = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  address_locality: string | null;
  phone: string | null;
  latitude: number | null;
  status: "draft" | "in_review" | "published" | "archived";
  updated_at: string;
};

const COR: Record<string, string> = {
  published: "bg-brand/15 text-brand-strong",
  draft: "bg-ink/10 text-ink/70",
  archived: "bg-muted/15 text-muted",
  in_review: "bg-wine/10 text-wine",
};

const ROTULO: Record<string, string> = {
  published: "No ar",
  draft: "Rascunho",
  archived: "Arquivada",
  in_review: "Em revisão",
};

/** O que falta para a loja poder ir ao ar sem emitir sinal local errado. */
function pendencias(l: Linha): string[] {
  const faltas: string[] = [];
  if (!l.address?.trim()) faltas.push("endereço");
  if (!l.address_locality?.trim()) faltas.push("cidade");
  if (!l.phone?.trim()) faltas.push("telefone");
  if (l.latitude === null) faltas.push("mapa");
  return faltas;
}

export default async function LojasPage() {
  await requireStaff();
  const supabase = await createClient();

  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, address, address_locality, phone, latitude, status, updated_at")
    .order("name");

  const itens = (data ?? []) as Linha[];
  const botao =
    "rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Unidades</p>
          <h1 className="font-display mt-2 text-4xl text-ink">Lojas</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Cada loja publicada vira uma página com dados estruturados de negócio
            local. Endereço e telefone precisam ser idênticos aos do Google Meu
            Negócio, porque é essa coincidência que sustenta o SEO local.
          </p>
        </div>
        <form action={criarLoja}>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light"
          >
            Nova loja
          </button>
        </form>
      </header>

      {itens.length === 0 ? (
        <div className="glass mt-8 rounded-[20px] px-6 py-16 text-center">
          <MapPin className="mx-auto text-brand-nav" size={24} />
          <p className="font-display mt-3 text-2xl text-ink">Nenhuma loja cadastrada</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Enquanto não houver loja publicada, a página de lojas do site mostra
            estado vazio, o que é melhor do que publicar endereço incompleto.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {itens.map((l) => {
            const faltas = pendencias(l);
            return (
              <li key={l.id} className="glass rounded-[18px] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/lojas/${l.id}`}
                      className="font-display text-2xl text-ink hover:text-brand-nav"
                    >
                      JK Alianças {l.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {l.address?.trim() ? l.address : "sem endereço"}
                      {l.address_locality ? `, ${l.address_locality}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">/lojas/{l.slug}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${COR[l.status]}`}>
                    {ROTULO[l.status]}
                  </span>
                </div>

                {faltas.length > 0 ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-[#8a6d1f]">
                    <AlertTriangle size={12} />
                    Falta {faltas.join(", ")}
                    {faltas.some((f) => f === "endereço" || f === "cidade")
                      ? ". Sem isso a loja não pode ir ao ar."
                      : "."}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/admin/lojas/${l.id}`} className={botao}>Editar</Link>

                  {l.status === "published" ? (
                    <>
                      <Link href={`/lojas/${l.slug}`} target="_blank" className={botao}>
                        Ver <ExternalLink size={11} className="ml-1 inline" />
                      </Link>
                      <form action={mudarStatusLoja}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value="draft" />
                        <button type="submit" className={botao}>Tirar do ar</button>
                      </form>
                    </>
                  ) : (
                    <form action={mudarStatusLoja}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value="published" />
                      <button type="submit" className={botao}>Publicar</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
