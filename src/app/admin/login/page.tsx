import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { MolduraDeAcesso } from "../_acesso/Moldura";

// A área administrativa nunca deve ser indexada.
export const metadata: Metadata = {
  title: { absolute: "Entrar no Painel JK" },
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = (await searchParams).next ?? "/admin";

  return (
    <MolduraDeAcesso rotulo="Painel editorial" titulo="Entrar no painel">
      <p className="mt-3 text-sm text-muted">
        Acesso restrito à equipe. Não há cadastro público.
      </p>

      <LoginForm next={next} />

      <p className="mt-6 text-sm text-muted">
        <Link
          href="/admin/recuperar-senha"
          className="font-medium text-ink underline decoration-brand/50 underline-offset-4 hover:decoration-brand"
        >
          Esqueci minha senha
        </Link>
      </p>
    </MolduraDeAcesso>
  );
}
