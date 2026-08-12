import type { Metadata } from "next";

/**
 * Layout raiz do /admin: apenas metadata. NÃO exige sessão, porque a página de
 * login vive aqui dentro. A proteção fica no grupo (painel).
 */
export const metadata: Metadata = {
  title: { default: "Painel JK", template: "%s | Painel JK" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
