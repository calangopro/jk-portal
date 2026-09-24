import { comBasePath } from "@/lib/seo/base-path";

/**
 * Moldura das telas de acesso ao painel: entrar, criar senha e recuperar.
 *
 * As três ficam fora do grupo (painel) porque quem chega nelas ainda não tem
 * sessão, ou tem sessão e ainda não tem senha. Por isso a moldura mora aqui, e
 * não no layout do painel, que exige perfil ativo.
 */
export function MolduraDeAcesso({
  rotulo,
  titulo,
  children,
}: {
  rotulo: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="glass w-full max-w-md rounded-[28px] p-8 text-center sm:p-10">
        {/* `img` cru não recebe o basePath; ver comBasePath. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={comBasePath("/logo.svg")}
          alt="JK Alianças"
          width={150}
          height={50}
          className="mx-auto h-9 w-auto"
        />
        <p className="eyebrow mt-7">{rotulo}</p>
        <h1 className="font-display mt-2 text-3xl text-ink">{titulo}</h1>
        {children}
      </div>
    </main>
  );
}

/** Classe dos campos das telas de acesso, a mesma do login desde o início. */
export const CAMPO_DE_ACESSO =
  "mt-1.5 w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

/** Caixa de erro das telas de acesso. */
export function AvisoDeErro({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-5 rounded-[12px] border border-wine/25 bg-wine/5 px-4 py-3 text-left text-sm text-wine"
    >
      {children}
    </p>
  );
}
