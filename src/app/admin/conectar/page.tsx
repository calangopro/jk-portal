import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, ROLE_LABEL } from "@/lib/auth/session";
import { lerPedido, quemPede } from "@/lib/conector/oauth";
import { MolduraDeAcesso, AvisoDeErro } from "../_acesso/Moldura";
import { BotaoDeAcesso } from "../_acesso/BotaoDeAcesso";
import { decidirConexao } from "./actions";

export const metadata: Metadata = {
  title: { absolute: "Conectar ao Painel JK" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A tela para onde o app do Claude manda a pessoa no login do conector. Mostra
 * QUEM está pedindo (pelo endereço de volta, que não dá para falsificar) e o
 * que o app vai poder fazer, e só segue com o "Permitir" de alguém logado.
 */
export default async function ConectarPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string; vencido?: string }>;
}) {
  const { pedido: bruto, vencido } = await searchParams;
  const pedido = bruto ? lerPedido(bruto) : null;

  if (!pedido) {
    return (
      <MolduraDeAcesso rotulo="Conector do Claude" titulo="Pedido vencido">
        <AvisoDeErro>
          {vencido
            ? "O pedido venceu enquanto a tela estava aberta (vale 15 minutos)."
            : "Este pedido de conexão venceu ou não é válido."}{" "}
          Volte ao app do Claude e clique em conectar de novo.
        </AvisoDeErro>
      </MolduraDeAcesso>
    );
  }

  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/conectar?pedido=${bruto}`)}`);
  }

  const app = quemPede(pedido);

  return (
    <MolduraDeAcesso rotulo="Conector do Claude" titulo={`Conectar ${app.app}?`}>
      <p className="mt-3 text-sm text-muted">
        {app.conferido ? (
          <>
            O pedido veio de <strong className="text-ink">{app.volta}</strong>
            {app.conhecido ? ", o app oficial." : "."}
          </>
        ) : (
          <>
            Este app se registrou sozinho
            {app.declarado ? (
              <>
                {" "}e diz se chamar <strong className="text-ink">“{app.declarado}”</strong>
              </>
            ) : null}
            . Ele volta para <strong className="text-ink">{app.volta}</strong> e só vai poder ler.
          </>
        )}
      </p>

      <form action={decidirConexao} className="mt-7 text-left">
        <input type="hidden" name="pedido" value={bruto} />

        <p className="text-sm text-ink">
          Vai entrar como <strong>{perfil.fullName ?? perfil.email}</strong> ({ROLE_LABEL[perfil.role]}), com o que o seu
          perfil pode fazer no painel.
        </p>

        <fieldset className="mt-5 space-y-2">
          <legend className="text-sm font-medium text-ink">O que o Claude vai poder fazer</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border bg-white/60 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/8">
            <input
              type="radio"
              name="escopo"
              value="completo"
              defaultChecked={app.conferido}
              disabled={!app.conferido}
              className="mt-1 accent-[var(--color-brand)]"
            />
            <span>
              <span className="block font-medium text-ink">Completo</span>
              <span className="block text-muted">
                Ler tudo, escrever rascunhos e, quando você pedir na conversa, publicar e mudar o site.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border bg-white/60 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/8">
            <input
              type="radio"
              name="escopo"
              value="leitura"
              defaultChecked={!app.conferido}
              className="mt-1 accent-[var(--color-brand)]"
            />
            <span>
              <span className="block font-medium text-ink">Só leitura</span>
              <span className="block text-muted">Ver e analisar tudo, sem mudar nada.</span>
            </span>
          </label>
        </fieldset>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Tudo o que o Claude fizer fica registrado em Conector do Claude, no painel, e a conexão se desliga ali a
          qualquer hora. Chaves de integração e papel de administrador nunca passam pelo conector.
        </p>

        <div className="mt-6 space-y-2">
          <BotaoPermitir />
          <button
            type="submit"
            name="decisao"
            value="recusar"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Recusar
          </button>
        </div>
      </form>
    </MolduraDeAcesso>
  );
}

function BotaoPermitir() {
  return (
    <div className="[&>button]:mt-0">
      <BotaoDeAcesso texto="Permitir" esperando="Conectando…" nome="decisao" valor="permitir" />
    </div>
  );
}
