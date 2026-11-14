"use client";

import { ROLE_LABEL, type AppRole } from "@/lib/auth/acessos";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { EstadoDaLigacao } from "@/lib/time/ao-vivo";
import type { Pessoa, Presenca } from "@/lib/time/chat";
import { Bolinha } from "./Conversa";

/**
 * Quem está online agora.
 *
 * "Online" é estar com o painel aberto e à vista, em qualquer tela dele, e não
 * só no chat. "Em outra aba" é o painel aberto atrás de outra janela. Quem não
 * aparece no canal está fora. A palavra vem sempre escrita: a bolinha verde
 * sozinha não diria nada a quem não distingue a cor.
 *
 * O nome e o nível vêm do banco. Do canal ao vivo vem só quem está presente.
 */

export type PessoaNaLista = Pessoa & { presenca: Presenca | "fora" };

const PALAVRA: Record<Presenca | "fora", string> = { online: "Online", ausente: "Em outra aba", fora: "Fora" };

/** A bolinha de presença: cheia e verde para online, vazada para "em outra aba", nada para quem está fora. */
export function Ponto({ presenca }: { presenca: Presenca | "fora" }) {
  if (presenca === "fora") return null;
  return (
    <span
      aria-hidden="true"
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={presenca === "online" ? { background: COR_DO_TOM.bom.texto } : { border: `2px solid ${COR_DO_TOM.bom.texto}` }}
    />
  );
}

/** A frase curta do botão do celular: "3 online", "Só você", ou o que a ligação está fazendo. Curta, para caber ao lado das salas. */
export function resumoDaPresenca(pessoas: readonly PessoaNaLista[], estado: EstadoDaLigacao): string {
  if (estado === "ligando" || estado === "desligada") return "Ligando";
  if (estado === "fora") return "Sem ao vivo";
  const online = pessoas.filter((p) => p.presenca !== "fora").length;
  return online <= 1 ? "Só você" : `${online} online`;
}

export function ListaDePessoas({ pessoas, meuId, estado }: { pessoas: readonly PessoaNaLista[]; meuId: string; estado: EstadoDaLigacao }) {
  const presentes = pessoas.filter((p) => p.presenca !== "fora");
  const fora = pessoas.filter((p) => p.presenca === "fora");
  const linha = (p: PessoaNaLista) => (
    <li key={p.id} className="flex items-center gap-2.5 py-1.5">
      <span className={p.presenca === "fora" ? "opacity-50" : ""}>
        <Bolinha nome={p.nome} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm leading-tight ${p.presenca === "fora" ? "text-muted" : "font-semibold text-ink"}`}>
          {p.id === meuId ? "Você" : p.nome}
        </span>
        {/* O estado vai escrito, na linha de baixo: a coluna é estreita, e ao lado do nome ele cortava o nome. */}
        <span className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] leading-tight text-muted">
          <Ponto presenca={p.presenca} />
          <span className="truncate">
            {p.presenca === "fora" ? null : `${PALAVRA[p.presenca]} · `}
            {ROLE_LABEL[p.papel as AppRole] ?? p.papel}
            {p.presenca === "fora" ? <span className="sr-only">, {PALAVRA.fora.toLowerCase()}</span> : null}
          </span>
        </span>
      </span>
    </li>
  );

  return (
    <div>
      {estado === "fora" ? (
        <p className="mb-2 rounded-[10px] p-2.5 text-xs leading-relaxed" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
          A ligação ao vivo não entrou. O chat continua funcionando, com as mensagens chegando de tempos em tempos, mas não dá para ver quem está online.
        </p>
      ) : null}
      {presentes.length > 0 ? (
        <>
          <p className="eyebrow">Online agora</p>
          <ul className="mt-1">{presentes.map(linha)}</ul>
        </>
      ) : estado === "ao_vivo" ? (
        <p className="text-xs text-muted">Ninguém com o painel aberto agora.</p>
      ) : null}
      {fora.length > 0 ? (
        <>
          <p className={`eyebrow ${presentes.length > 0 ? "mt-3" : ""}`}>Fora</p>
          <ul className="mt-1">{fora.map(linha)}</ul>
        </>
      ) : null}
    </div>
  );
}
