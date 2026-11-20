"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, LockKeyhole } from "lucide-react";
import type { GarantiaAberta } from "@/lib/garantia/dados";
import { dataParaLer } from "@/lib/garantia/garantia";
import { lerEspecificacoes } from "@/lib/fabrica/etapas";

/**
 * O que é pessoal na garantia: abre com os 4 últimos números do telefone do
 * pedido. Depois de aberta, mostra o nome e o texto da gravação, e o registro
 * do casal (nome do par e as datas) para a JK lembrar as datas.
 *
 * Os dígitos ficam só na memória desta página e vão de novo no registro: não
 * existe sessão do cliente, e o banco confere de novo a cada pedido.
 */
type Abrir = (codigo: string, digitos: string) => Promise<GarantiaAberta>;
type Registrar = (
  codigo: string,
  digitos: string,
  f: { par_nome: string; aniversario: string; aniversario_par: string; data_namoro: string; data_casamento: string; aceite: boolean },
) => Promise<{ ok: true } | { ok: false; motivo: string }>;

const FRASE: Record<string, string> = {
  errado: "Esses números não conferem com o telefone do pedido.",
  travada: "Muitas tentativas. Tente de novo daqui a uma hora, ou fale com a loja.",
  nao_existe: "Esta garantia não existe.",
  sem_aceite: "Para guardar, marque que você concorda com o uso dos dados.",
  falhou: "Não deu agora. Tente de novo em alguns segundos.",
};

const campo = "mt-1 h-11 w-full rounded-[10px] border border-[#1a1815]/15 bg-white px-3 text-base outline-none focus:border-[#84663c]";

export function AbrirGarantia({ codigo, registrada, travada, abrir, registrar }: { codigo: string; registrada: boolean; travada: boolean; abrir: Abrir; registrar: Registrar }) {
  const [digitos, setDigitos] = useState("");
  const [aberta, setAberta] = useState<Extract<GarantiaAberta, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(travada ? FRASE.travada : null);
  const [ocupado, comecar] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const [f, setF] = useState({ par_nome: "", aniversario: "", aniversario_par: "", data_namoro: "", data_casamento: "", aceite: false });

  const entrar = (e: React.FormEvent) => {
    e.preventDefault();
    comecar(async () => {
      setErro(null);
      const r = await abrir(codigo, digitos);
      if (r.ok) {
        setAberta(r);
        const g = r.registro ?? {};
        setF({
          par_nome: g.par_nome ?? "",
          aniversario: dataParaLer(g.aniversario),
          aniversario_par: dataParaLer(g.aniversario_par),
          data_namoro: dataParaLer(g.data_namoro),
          data_casamento: dataParaLer(g.data_casamento),
          aceite: false,
        });
      } else setErro(FRASE[r.motivo] ?? FRASE.falhou);
    });
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    comecar(async () => {
      setErro(null);
      const r = await registrar(codigo, digitos, f);
      if (r.ok) setGuardado(true);
      else setErro(FRASE[r.motivo] ?? FRASE.falhou);
    });
  };

  if (!aberta) {
    return (
      <form onSubmit={entrar} className="mt-4 rounded-[22px] bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LockKeyhole size={18} aria-hidden="true" /> {registrada ? "Ver e atualizar o seu registro" : "Registrar a sua garantia"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[#5d5850]">
          Digite os 4 últimos números do telefone que está no pedido. É o que protege o seu nome e a sua gravação.
        </p>
        <label className="mt-3 block text-sm font-semibold">
          Últimos 4 números
          <input
            value={digitos}
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className={`${campo} numeros tracking-[0.3em]`}
          />
        </label>
        <button type="submit" disabled={ocupado || digitos.length !== 4} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a1815] px-5 text-base font-semibold text-white disabled:opacity-50">
          {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : null} Abrir
        </button>
        {erro ? <p role="alert" className="mt-2 text-sm font-semibold text-[#9b1c1c]">{erro}</p> : null}
      </form>
    );
  }

  const gravacoes = aberta.pecas.flatMap((p) => lerEspecificacoes(p.info).filter((e) => e.tipo === "gravar"));

  return (
    <section className="mt-4 rounded-[22px] bg-white p-5">
      <h2 className="text-lg font-semibold">{aberta.nome ? `Olá, ${aberta.nome.split(/\s+/)[0]}` : "Sua garantia"}</h2>
      {gravacoes.length ? (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#5d5850]">Gravação</p>
          <ul className="mt-1 space-y-1">
            {gravacoes.map((g, i) => (
              <li key={i} className="text-sm font-semibold [overflow-wrap:anywhere]">{g.valor}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {guardado ? (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#e3f4ec] p-3 text-sm font-semibold text-[#046c4e]">
          <Check size={16} aria-hidden="true" /> Guardado. Obrigado!
        </p>
      ) : (
        <form onSubmit={guardar} className="mt-4 space-y-3 border-t border-[#1a1815]/10 pt-4">
          <p className="text-sm leading-relaxed text-[#5d5850]">Conte as suas datas para a gente lembrar delas com você. Datas no formato dia/mês, com o ano se quiser.</p>
          <label className="block text-sm font-semibold">
            Nome de quem divide a aliança com você
            <input value={f.par_nome} onChange={(e) => setF({ ...f, par_nome: e.target.value })} maxLength={120} className={campo} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["aniversario", "Seu aniversário"],
              ["aniversario_par", "Aniversário do par"],
              ["data_namoro", "Começo do namoro"],
              ["data_casamento", "Casamento"],
            ] as const).map(([k, r]) => (
              <label key={k} className="block text-sm font-semibold">
                {r}
                <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode="numeric" placeholder="15/03" maxLength={10} className={`${campo} numeros`} />
              </label>
            ))}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={f.aceite} onChange={(e) => setF({ ...f, aceite: e.target.checked })} className="mt-1 h-5 w-5 shrink-0" />
            <span>Concordo que a JK Alianças guarde esses dados para lembrar as minhas datas e me atender melhor.</span>
          </label>
          <button type="submit" disabled={ocupado || !f.aceite} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a1815] px-5 text-base font-semibold text-white disabled:opacity-50">
            {ocupado ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : null} Guardar
          </button>
        </form>
      )}
      {erro ? <p role="alert" className="mt-2 text-sm font-semibold text-[#9b1c1c]">{erro}</p> : null}
    </section>
  );
}
