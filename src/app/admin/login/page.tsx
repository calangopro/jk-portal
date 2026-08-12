import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

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
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-md rounded-[28px] p-8 text-center sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="JK Alianças"
          width={150}
          height={50}
          className="mx-auto h-9 w-auto"
        />
        <p className="eyebrow mt-7">Painel editorial</p>
        <h1 className="font-display mt-2 text-3xl text-ink">
          Entrar no painel
        </h1>
        <p className="mt-3 text-sm text-muted">
          Acesso restrito à equipe. Não há cadastro público.
        </p>

        <LoginForm next={next} />
      </div>
    </main>
  );
}
