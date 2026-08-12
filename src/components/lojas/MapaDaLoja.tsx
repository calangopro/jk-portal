"use client";

import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import type { Location } from "@/lib/content/types";
import { enderecoCompleto } from "@/lib/data/rotas";

/**
 * Mapa da unidade.
 *
 * Usa o OpenStreetMap, que não exige chave de API nem cobra por carregamento.
 * O mapa do Google passou a exigir chave para embutir, e uma chave de mapa no
 * cliente é chave exposta que alguém acaba usando por você.
 *
 * O iframe só carrega depois do clique. É conteúdo de terceiro com rastreio
 * próprio, pesa alguns cem kB e quase nunca é o que a pessoa veio buscar: a
 * maioria quer o botão de rota, que está logo ao lado e não depende disto.
 */
export function MapaDaLoja({ loja }: { loja: Location }) {
  const [carregar, setCarregar] = useState(false);

  if (loja.latitude == null || loja.longitude == null) return null;

  const { latitude: lat, longitude: lon } = loja;
  const caixa = [lon - 0.006, lat - 0.003, lon + 0.006, lat + 0.003].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${caixa}&layer=mapnik&marker=${lat},${lon}`;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-media">
      <div className="aspect-[16/10] sm:aspect-[2/1]">
        {carregar ? (
          <iframe
            src={src}
            title={`Mapa da loja JK Alianças ${loja.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setCarregar(true)}
            className="group flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-sand to-media px-6 text-center transition-colors hover:from-brand/10"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-white/70 text-brand-nav transition-transform duration-500 group-hover:scale-110">
              <MapPin size={20} aria-hidden />
            </span>
            <span className="text-apoio font-semibold text-ink">Ver no mapa</span>
            <span className="max-w-xs text-nota leading-relaxed text-muted">
              {enderecoCompleto(loja)}
            </span>
          </button>
        )}
      </div>

      {carregar ? (
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`}
          target="_blank"
          rel="noopener"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-nota font-semibold text-ink shadow-[0_6px_16px_-6px_rgb(75_53_23/0.6)] backdrop-blur-sm transition-colors hover:text-brand-nav"
        >
          <Navigation size={12} aria-hidden /> Abrir mapa maior
        </a>
      ) : null}
    </div>
  );
}
