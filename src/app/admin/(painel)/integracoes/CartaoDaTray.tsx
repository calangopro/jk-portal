import { Check, Circle } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import type { EstadoDaApiDePedidos } from "@/lib/vendas/pedidos-da-api";

/**
 * Pedidos da Tray pela API: o estado da ligação e o botão que leva a loja à
 * tela de autorizar o aplicativo.
 *
 * O botão é um `<a>` comum com o prefixo na mão, e não `next/link`: o destino
 * é uma rota que responde redirecionando para fora do site, e o Link tentaria
 * buscá-la antes do clique.
 *
 * O texto diz o que o painel FAZ (só lê), não o que a permissão alcança: o
 * aplicativo foi cadastrado na Tray com permissão de incluir e alterar produto
 * e pedido.
 */

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function CartaoDaTray({ estado }: { estado: EstadoDaApiDePedidos }) {
  const lendo = Boolean(estado.lidaEm) && !estado.problema;
  const selo = lendo ? "Lendo" : estado.autorizadaEm ? "Autorizada" : "Não autorizada";
  return (
    <div className="glass rounded-[18px] p-5">
      {/* Só o título divide a linha com o selo. Com o texto junto, no celular ele ficava espremido em meia largura. */}
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink">Tray, pedidos pela API</p>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
            estado.autorizadaEm ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"
          }`}
        >
          {estado.autorizadaEm ? <Check size={11} aria-hidden /> : <Circle size={9} aria-hidden />}
          {selo}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Lê os pedidos direto da loja, sem ninguém precisar exportar arquivo: pedido novo e pedido que mudou de situação.
        O painel só lê. Ele não cria nem altera pedido ou produto, mesmo que a permissão do aplicativo na Tray permita.
      </p>

      {estado.autorizadaEm ? (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Autorizada em {quando(estado.autorizadaEm)}.{" "}
          {estado.lidaEm
            ? `Última leitura em ${quando(estado.lidaEm)}.`
            : "A leitura automática ainda não foi ligada: antes dela vem uma conferência, que compara o que a API devolve com o que as exportações já gravaram."}
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            O aplicativo ainda não foi autorizado na loja da JK. A Tray libera a instalação na loja de verdade depois de
            homologar o aplicativo. Até lá, os pedidos continuam entrando pela exportação de hora em hora.
          </p>
          {estado.aplicativo ? (
            <a
              href={comBasePath("/api/tray/conectar?loja=jk")}
              className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light"
            >
              Autorizar na loja da JK
            </a>
          ) : (
            <p className="mt-3 text-xs text-wine">Faltam as chaves do aplicativo da Tray no servidor.</p>
          )}
          <p className="mt-2 text-[0.68rem] leading-snug text-muted">
            Abre a tela da Tray. É preciso estar logado no painel da loja com um usuário administrador.
          </p>
        </>
      )}

      {estado.problema ? <p className="mt-3 text-xs text-wine">A última tentativa falhou: {estado.problema}</p> : null}
      <p className="mt-3 text-[0.68rem] leading-snug text-muted">
        A API da Tray não informa de onde veio o pedido (anúncio, busca, Instagram). Essa parte continua vindo da
        exportação.
      </p>
    </div>
  );
}
