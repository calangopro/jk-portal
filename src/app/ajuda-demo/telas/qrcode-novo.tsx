import { FormularioDoQrcode } from "@/app/admin/(painel)/qrcode/FormularioDoQrcode";
import type { Demo } from "../tipos";

const demo: Demo = {
  caminho: "/admin/qrcode",
  desenho: () => (
    <>
      <header className="mt-4">
        <p className="eyebrow">QR codes</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Novo QR code</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Um para cada lugar onde vai adesivo. Depois de criar, a arte fica pronta para baixar e mandar para a gráfica.
        </p>
      </header>
      <div className="mt-8 max-w-2xl">
        <FormularioDoQrcode nome="" destino={{ modo: "whatsapp", whatsapp: "11900000000", mensagem: "Oi! Vi o QR code da JK e quero saber mais.", link: "" }} />
      </div>
    </>
  ),
};
export default demo;
