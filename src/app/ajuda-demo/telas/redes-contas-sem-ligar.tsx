import { TelaDeContas } from "@/app/admin/(painel)/redes/contas/Tela";
import { INFO_DA_LIGACAO } from "@/lib/redes/ligacao";
import type { ContaNaTela, LigacaoDaRede } from "@/lib/redes/painel";
import { REDES } from "@/lib/redes/redes";
import { AGORA } from "../redes-exemplo";
import type { Demo } from "../tipos";

const conta = (id: string, nome: string, extra: Partial<ContaNaTela> = {}): ContaNaTela => ({
  id, nome, usuario: nome, fotoUrl: null, link: null, status: "ativa", via: "token", expiraEm: null, ultimoErro: null, conectadaEm: "2026-11-02T12:00:00Z", lidaEm: "2026-11-19T17:40:00Z",
  libera: ["ler números", "publicar", "ler comentários"], falta: [], ...extra,
});

const COM_CONTA: Record<string, ContaNaTela[]> = {
  instagram: [conta("c-ig", "@exemplo")],
  facebook: [conta("c-fb", "Página Exemplo")],
  youtube: [conta("c-yt", "Canal Exemplo", { via: "oauth", status: "expirada", ultimoErro: "O acesso foi retirado pela conta do Google." })],
};

const ligacoes: LigacaoDaRede[] = REDES.map((rede) => ({
  rede,
  info: INFO_DA_LIGACAO[rede.id] ?? null,
  pronta: rede.situacao === "pronta",
  aplicativo: null,
  contas: COM_CONTA[rede.id] ?? [],
}));

const ler = async () => {
  "use server";
  return {};
};

const demo: Demo = {
  caminho: "/admin/redes/contas",
  desenho: () => <TelaDeContas ligacoes={ligacoes} agora={AGORA} podeLigar={false} retornoBase="https://exemplo.com.br/guias" lerAgora={ler} />,
};
export default demo;
