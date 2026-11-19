import { TelaDaSaude } from "@/app/admin/(painel)/saude/Tela";
import type { Ligacao } from "@/lib/painel/saude";
import type { Demo } from "../tipos";

/** Ligações de exemplo: um destino recusando, um sem chave, e rotinas boas, uma em atenção e uma parada. */
const ligacoes: Ligacao[] = [
  { chave: "d1", grupo: "destino", nome: "Destino Exemplo A", paraQue: "Recebe o contato captado nos formulários.", estado: "ruim", frase: "Recusando há 2 dias. 10 contatos esperando.", oQueFazer: "Cole uma chave nova em Integrações." },
  { chave: "d2", grupo: "destino", nome: "Destino Exemplo B", paraQue: "Recebe o contato captado nos formulários.", estado: "desligada", frase: "Nunca foi ligado. 20 contatos esperando.", oQueFazer: "Cole a chave em Integrações para começar a enviar." },
  { chave: "d3", grupo: "destino", nome: "Destino Exemplo C", paraQue: "Recebe o contato captado nos formulários.", estado: "ok", frase: "Funcionando. Último envio há 1 hora.", oQueFazer: null },
  { chave: "r1", grupo: "rotina", nome: "Rotina Exemplo de pedidos", paraQue: "Lê os pedidos novos da loja.", estado: "ok", frase: "Rodou bem há 5 minutos.", oQueFazer: null },
  { chave: "r2", grupo: "rotina", nome: "Rotina Exemplo de gasto", paraQue: "Lê o gasto dos anúncios.", estado: "atencao", frase: "Última rodada boa há 3 horas.", oQueFazer: "Aguarde a próxima rodada e volte aqui." },
  { chave: "r3", grupo: "rotina", nome: "Rotina Exemplo das redes", paraQue: "Lê as métricas das redes sociais.", estado: "ruim", frase: "Sem rodada boa há 1 dia.", oQueFazer: "Abra Integrações e ligue a conta de novo." },
  { chave: "r4", grupo: "rotina", nome: "Rotina Exemplo de avaliações", paraQue: "Lê as avaliações das lojas.", estado: "sem_registro", frase: "Ainda sem registro.", oQueFazer: null },
];

const demo: Demo = {
  caminho: "/admin/saude",
  desenho: () => <TelaDaSaude ligacoes={ligacoes} />,
};
export default demo;
