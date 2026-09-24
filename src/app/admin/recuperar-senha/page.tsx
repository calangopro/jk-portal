import type { Metadata } from "next";
import Link from "next/link";
import { FormRecuperar } from "./FormRecuperar";
import { MolduraDeAcesso } from "../_acesso/Moldura";

export const metadata: Metadata = {
  title: { absolute: "Recuperar senha | Painel JK" },
  robots: { index: false, follow: false },
};

export default function RecuperarSenhaPage() {
  return (
    <MolduraDeAcesso rotulo="Recuperar acesso" titulo="Esqueci minha senha">
      <p className="mt-3 text-sm text-muted">
        Digite o e-mail que você usa para entrar. Mandamos um link para você
        criar uma senha nova.
      </p>

      <FormRecuperar />

      <p className="mt-6 text-sm">
        <Link
          href="/admin/login"
          className="font-medium text-ink underline decoration-brand/50 underline-offset-4 hover:decoration-brand"
        >
          Voltar para a entrada
        </Link>
      </p>
    </MolduraDeAcesso>
  );
}
