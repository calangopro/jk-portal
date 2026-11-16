import { LinkRapido } from "@/components/ui/LinkRapido";
import { Plus } from "lucide-react";
import { requireArea } from "@/lib/auth/session";
import { diaEmSaoPaulo, diasDaGrade, intervaloDaGrade, lerMes, mesEmSaoPaulo, mesVizinho } from "@/lib/redes/calendario";
import { lerCalendario } from "@/lib/redes/calendario-dados";
import { lerConteudos } from "@/lib/redes/conteudos-dados";
import { melhoresHorarios } from "@/lib/redes/horarios";
import { createAdminClient } from "@/lib/supabase/admin";
import { Calendario } from "./Calendario";

export const metadata = { title: "Calendário" };

/**
 * O calendário do Social Media: o que saiu em cada rede (inclusive o que foi
 * postado fora do painel) e o que está marcado para sair. Só lê o banco. A
 * sugestão de horário sai do histórico da própria conta (`lib/redes/horarios.ts`).
 */
export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireArea("redes");
  const agora = Date.now();
  const mes = lerMes((await searchParams).mes) ?? mesEmSaoPaulo(agora);
  const hoje = diaEmSaoPaulo(agora);
  const dias = diasDaGrade(mes, hoje);
  const { de, ate } = intervaloDaGrade(dias);
  const admin = createAdminClient();
  const [itens, conteudos] = await Promise.all([lerCalendario(admin, de, ate), lerConteudos(admin, 90)]);

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Social Media</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Calendário</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">O que saiu em cada rede e o que está marcado para sair. Toque num dia para ver o que tem nele e criar um post ou story já com a data.</p>
        </div>
        <LinkRapido href="/admin/redes/publicar/novo" className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">
          <Plus size={16} aria-hidden="true" /> Novo post
        </LinkRapido>
      </header>
      {itens === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler o calendário agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <Calendario mes={mes} anterior={mesVizinho(mes, -1)} seguinte={mesVizinho(mes, 1)} dias={dias} itens={itens} hojeData={hoje} agora={agora} horarios={melhoresHorarios(conteudos?.conteudos ?? [])} />
      )}
    </div>
  );
}
