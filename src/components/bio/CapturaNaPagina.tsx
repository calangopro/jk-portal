"use client";

import { useEffect, useId, useState } from "react";
import { medirCapturaAberta } from "@/lib/bio/medicao";
import type { BlocoDe } from "@/lib/bio/tipos";
import { cadastroAnterior, FormularioDeCaptura, linkDoGrupo, SucessoDaCaptura } from "./FormularioDeCaptura";

/**
 * O formulário aberto na página /grupo, sem folha nem botão antes.
 *
 * Quem chega do anúncio já decidiu: um toque a mais para abrir o formulário só
 * perde gente. Depois do envio a página leva sozinha ao grupo, pelo link fixo
 * com o id do contato, e o clique fica gravado.
 *
 * Quem volta à página já cadastrado vê direto o botão do grupo, com a opção de
 * cadastrar outro número (o casal que divide o celular).
 */
export function CapturaNaPagina({ bloco, campanha }: { bloco: BlocoDe<"captura">; campanha: string }) {
  const idTitulo = useId();
  // `undefined` é formulário; string ou null é a tela de pronto.
  const [leadId, setLeadId] = useState<string | null | undefined>(undefined);
  const [automatico, setAutomatico] = useState(false);

  useEffect(() => {
    const anterior = cadastroAnterior();
    if (anterior) setLeadId(anterior.id ?? null);
    // Na página o formulário já nasce aberto: a visita é a abertura.
    medirCapturaAberta({ campanha, origem: "grupo" });
  }, [campanha]);

  if (leadId !== undefined) {
    return (
      <SucessoDaCaptura
        bloco={bloco}
        campanha={campanha}
        origem="grupo"
        href={linkDoGrupo("/grupo/entrar", leadId)}
        idTitulo={idTitulo}
        automatico={automatico}
        outroNumero={
          automatico
            ? undefined
            : () => {
                setLeadId(undefined);
              }
        }
      />
    );
  }

  return (
    <FormularioDeCaptura
      bloco={bloco}
      campanha={campanha}
      origem="grupo"
      idTitulo={idTitulo}
      comCabecalho={false}
      aoEnviar={(id) => {
        setAutomatico(true);
        setLeadId(id);
      }}
    />
  );
}
