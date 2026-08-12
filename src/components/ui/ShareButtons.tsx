"use client";

import { useEffect, useState } from "react";

/**
 * Compartilhamento — amplia alcance social (sinal útil para SEO/GEO).
 * A URL da página só é resolvida DEPOIS de montar (useEffect), para o HTML do
 * servidor e a hidratação do cliente baterem (sem mismatch). WhatsApp é
 * prioridade no Brasil.
 */
export function ShareButtons({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => setUrl(window.location.href), []);

  const shareNative = async () => {
    const target = url || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: target });
      } catch {
        /* usuário cancelou — ignorar */
      }
    } else {
      copyLink();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  const whatsappHref = () =>
    `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`.trim())}`;

  const pill =
    "inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/50 px-4 py-2 text-sm font-medium text-ink backdrop-blur-sm transition-colors hover:border-brand/50 hover:text-brand-nav";

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      <span className="eyebrow mr-1">Compartilhar</span>

      <a
        href={whatsappHref()}
        target="_blank"
        rel="noopener noreferrer"
        className={pill}
        aria-label="Compartilhar no WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="currentColor"
          aria-hidden
        >
          <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.44 9.44 0 01-4.8-1.32l-.35-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 01-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 012.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm5.52-14.99A11.34 11.34 0 0012.05.02C5.8.02.72 5.1.72 11.34c0 2 .52 3.95 1.52 5.67L.62 23.4l6.53-1.71a11.3 11.3 0 005.4 1.38h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01z" />
        </svg>
        WhatsApp
      </a>

      <button type="button" onClick={copyLink} className={pill}>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5" />
        </svg>
        {copied ? "Copiado!" : "Copiar link"}
      </button>

      <button
        type="button"
        onClick={shareNative}
        className={pill}
        aria-label="Mais opções de compartilhamento"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
        Compartilhar
      </button>
    </div>
  );
}
