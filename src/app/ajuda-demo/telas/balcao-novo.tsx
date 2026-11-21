import { FormularioDoBalcao } from "@/app/admin/(painel)/balcao/Formulario";
import type { Demo } from "../tipos";
import { VENDEDORES_DE_EXEMPLO } from "./balcao-exemplo";

const demo: Demo = {
  caminho: "/admin/balcao",
  desenho: () => (
    <FormularioDoBalcao
      minhaLoja="JK Granja"
      lojas={["JK Granja", "JK Raposo"]}
      vendedores={VENDEDORES_DE_EXEMPLO}
      produtos={[{ codigo: "1", nome: "Par de Alianças Ouro 18k 5mm Anatômica", miniatura: null }, { codigo: "2", nome: "Anel Solitário Prata 925", miniatura: null }]}
      hoje="2026-11-20"
    />
  ),
};
export default demo;
