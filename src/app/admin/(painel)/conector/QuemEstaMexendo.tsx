import { UsersRound } from "lucide-react";

/**
 * A regra da casa na tela do Conector: o Filipe e o Erick dividem o mesmo
 * Claude, e toda conversa começa perguntando quem está mexendo. A mesma regra
 * mora no topo do CLAUDE.md, no gatilho `.claude/hooks/quem-esta-mexendo.sh`
 * e nas instruções do conector (`lib/conector/guias.ts`): mudou uma, muda as
 * outras.
 */

/**
 * O nome do conector diz de quem ele é: "JK Filipe" no claude.ai e `jk-filipe`
 * no Claude Code. É por esse nome que o Claude escolhe o conector certo depois
 * de perguntar quem está mexendo.
 */
export function nomesDoConector(nomeCompleto: string | null) {
  const primeiro = (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
  const slug = primeiro.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    noApp: primeiro ? `JK ${primeiro}` : "JK e o seu nome",
    noTerminal: slug ? `jk-${slug}` : "jk",
  };
}

export function QuemEstaMexendo({ quem, nomes }: { quem: string; nomes: ReturnType<typeof nomesDoConector> }) {
  return (
    <section aria-labelledby="regra-quem" className="glass mt-8 rounded-[18px] p-5">
      <h2 id="regra-quem" className="flex items-center gap-2 font-medium text-ink">
        <UsersRound size={16} aria-hidden className="text-brand-nav" />
        Regra da casa: quem está mexendo
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-ink/85">
        O Filipe e o Erick dividem o mesmo Claude. Toda conversa começa com a pergunta{" "}
        <strong>“Quem está mexendo? (Erick | Filipe)”</strong>, e o Claude usa só o conector ligado na conta de quem
        respondeu. Tudo o que um conector faz fica registrado no nome da conta dele.
      </p>
      <ul className="mt-3 max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-ink/85">
        <li>
          Cada um liga o próprio conector, com a própria conta da JK, e dá a ele um nome que diga de quem é:{" "}
          <strong>{nomes.noApp}</strong> no claude.ai e <code className="rounded bg-ink/5 px-1">{nomes.noTerminal}</code> no
          Claude Code.
        </li>
        <li>
          Na hora de clicar em Permitir, confira que este painel está aberto na sua conta. Se outra pessoa estiver logada
          neste navegador, use uma janela anônima: a autorização sai no nome de quem estiver logado.
        </li>
        <li>
          No Claude Code do projeto a pergunta vem sozinha, em toda sessão nova. No claude.ai, o próprio conector pede
          quando a conta dele é da diretoria ou quando há mais de um conector da JK na conversa.
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        Você está nesta tela como <strong className="text-ink/80">{quem}</strong>.
      </p>
    </section>
  );
}
