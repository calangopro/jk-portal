import { BadgePercent, BookOpen, Gift, Link2, Ruler, Store } from "lucide-react";
import { IconeAlianca } from "@/components/home/IconeAlianca";
import type { ItemDeLink } from "@/lib/bio/tipos";

/**
 * Ícones de marca das redes.
 *
 * O lucide tirou os ícones de marca na versão 1, então eles moram aqui. Os de
 * rede social são desenhados em traço, como o resto do lucide, para a linha
 * não mudar de peso no meio da página. O do WhatsApp é o mesmo desenho cheio do
 * tema da loja, porque é o símbolo que a pessoa procura no botão, e em traço
 * ele deixa de ser reconhecido.
 */

type Props = { size?: number; className?: string };

export function IconeWhatsapp({ size = 18, className }: Props) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden className={className}>
      <path d="M13.6 2.3A7.9 7.9 0 0 0 8 0C3.6 0 .1 3.6.1 7.9c0 1.4.4 2.8 1 4L0 16l4.2-1.1a7.9 7.9 0 0 0 3.8 1c4.4 0 7.9-3.6 7.9-7.9 0-2.1-.8-4.1-2.3-5.6zM8 14.5a6.6 6.6 0 0 1-3.4-.9l-.2-.1-2.5.6.7-2.4-.2-.3a6.6 6.6 0 0 1-1-3.5C1.4 4.3 4.3 1.3 8 1.3c1.8 0 3.4.7 4.7 1.9a6.6 6.6 0 0 1 1.9 4.7c0 3.6-3 6.6-6.6 6.6zm3.6-4.9c-.2-.1-1.2-.6-1.4-.6-.2-.1-.3-.1-.4.1l-.6.8c-.1.1-.2.1-.4 0-.2-.1-.8-.3-1.6-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.3-.3.2-.3v-.3l-.6-1.5c-.2-.4-.3-.3-.4-.3h-.4a.7.7 0 0 0-.5.2c-.2.2-.7.7-.7 1.7s.7 1.9.8 2c.1.1 1.4 2.1 3.4 3 .5.2.8.3 1.1.4.5.2.9.1 1.2.1.4-.1 1.2-.5 1.3-.9.2-.5.2-.9.1-.9l-.4-.4z" />
    </svg>
  );
}

function Traco({ size = 18, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconeInstagram(p: Props) {
  return (
    <Traco {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
    </Traco>
  );
}

export function IconeTiktok(p: Props) {
  return (
    <Traco {...p}>
      <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3c.4 2.6 2.3 4.5 5 4.8" />
    </Traco>
  );
}

export function IconeYoutube(p: Props) {
  return (
    <Traco {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.2 9.3 4.6 2.7-4.6 2.7z" />
    </Traco>
  );
}

export function IconeFacebook(p: Props) {
  return (
    <Traco {...p}>
      <path d="M15 3.5h-2a3.5 3.5 0 0 0-3.5 3.5v2.5H7v3.5h2.5V21H13v-8h2.6l.5-3.5H13V7.5a1 1 0 0 1 1-1h1z" />
    </Traco>
  );
}

/** Ícone de cada link, pelo nome que o painel grava. */
export function IconeDoLink({ icone, size = 18 }: { icone: ItemDeLink["icone"]; size?: number }) {
  switch (icone) {
    case "medidor":
      return <Ruler size={size} aria-hidden strokeWidth={1.6} />;
    case "alianca":
      return <IconeAlianca size={size} />;
    case "loja":
      return <Store size={size} aria-hidden strokeWidth={1.6} />;
    case "dicas":
      return <BookOpen size={size} aria-hidden strokeWidth={1.6} />;
    case "presente":
      return <Gift size={size} aria-hidden strokeWidth={1.6} />;
    case "whatsapp":
      return <IconeWhatsapp size={size} />;
    case "oferta":
      return <BadgePercent size={size} aria-hidden strokeWidth={1.6} />;
    default:
      return <Link2 size={size} aria-hidden strokeWidth={1.6} />;
  }
}

/** Rede social a partir do endereço do perfil. */
export function IconeDaRede({ url, size = 20 }: { url: string; size?: number }) {
  if (url.includes("instagram.com")) return <IconeInstagram size={size} />;
  if (url.includes("tiktok.com")) return <IconeTiktok size={size} />;
  if (url.includes("youtube.com")) return <IconeYoutube size={size} />;
  if (url.includes("facebook.com")) return <IconeFacebook size={size} />;
  return <Link2 size={size} aria-hidden strokeWidth={1.6} />;
}

export function nomeDaRede(url: string): string {
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("youtube.com")) return "YouTube";
  if (url.includes("facebook.com")) return "Facebook";
  return "Perfil";
}
