import { TelaDeUtms } from "@/app/admin/(painel)/trafego/utms/Tela";
import type { Demo } from "../tipos";

// A tela não lê banco: o padrão e o montador moram em `lib/trafego/utms.ts`.
const demo: Demo = {
  caminho: "/admin/trafego/utms",
  desenho: () => <TelaDeUtms />,
};

export default demo;
