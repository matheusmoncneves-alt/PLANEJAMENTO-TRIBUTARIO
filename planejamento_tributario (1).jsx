import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ══════════════════════════════════════════════════════════════
// TABELAS TRIBUTÁRIAS (LC 123/2006; RIR/2018; Lei 9.249/1995)
// ══════════════════════════════════════════════════════════════
const SIMPLES_ANEXO_I = [
  { max: 180000, aliq: 0.04, pd: 0 }, { max: 360000, aliq: 0.073, pd: 5940 },
  { max: 720000, aliq: 0.095, pd: 13860 }, { max: 1800000, aliq: 0.107, pd: 22500 },
  { max: 3600000, aliq: 0.143, pd: 87300 }, { max: 4800000, aliq: 0.19, pd: 378000 },
];
const SIMPLES_ANEXO_III = [
  { max: 180000, aliq: 0.06, pd: 0 }, { max: 360000, aliq: 0.112, pd: 9360 },
  { max: 720000, aliq: 0.132, pd: 17640 }, { max: 1800000, aliq: 0.16, pd: 35640 },
  { max: 3600000, aliq: 0.21, pd: 125640 }, { max: 4800000, aliq: 0.33, pd: 648000 },
];
const SIMPLES_ANEXO_V = [
  { max: 180000, aliq: 0.155, pd: 0 }, { max: 360000, aliq: 0.18, pd: 4500 },
  { max: 720000, aliq: 0.195, pd: 9900 }, { max: 1800000, aliq: 0.205, pd: 17100 },
  { max: 3600000, aliq: 0.23, pd: 62100 }, { max: 4800000, aliq: 0.305, pd: 540000 },
];
const TABELA_IRPF = [
  { max: 2259.20, aliq: 0, ded: 0 }, { max: 2826.65, aliq: 0.075, ded: 169.44 },
  { max: 3751.05, aliq: 0.15, ded: 381.44 }, { max: 4664.68, aliq: 0.225, ded: 662.77 },
  { max: Infinity, aliq: 0.275, ded: 896.00 },
];
const TABELA_INSS_EMP = [
  { max: 1412.00, aliq: 0.075 }, { max: 2666.68, aliq: 0.09 },
  { max: 4000.03, aliq: 0.12 }, { max: 7786.02, aliq: 0.14 },
];
const TETO_INSS = 7786.02;

// ══════════════════════════════════════════════════════════════
// FUNÇÕES DE CÁLCULO
// ══════════════════════════════════════════════════════════════
const calcINSS = (sal) => {
  const base = Math.min(sal, TETO_INSS); let v = 0, ant = 0;
  for (const f of TABELA_INSS_EMP) { if (base <= ant) break; v += (Math.min(base, f.max) - ant) * f.aliq; ant = f.max; if (base <= f.max) break; }
  return v;
};
const calcIRPF = (base) => { const b = Math.max(0, base); for (const f of TABELA_IRPF) if (b <= f.max) return Math.max(0, b * f.aliq - f.ded); return 0; };
const calcSimples = (rbt12, tab) => { if (rbt12 > 4800000) return null; for (const f of tab) if (rbt12 <= f.max) { const ef = (rbt12 * f.aliq - f.pd) / rbt12; return { ef, total: rbt12 * ef, aliqNominal: f.aliq }; } return null; };
const calcFatorR = (folha, rec) => rec > 0 ? (folha * 12) / rec : 0;

function calcLP(rec, ativ, aliqISS, issFixoMensal = 0) {
  const pIRPJ = ativ === "servicos" ? 0.32 : 0.08;
  const pCSLL = ativ === "servicos" ? 0.32 : 0.12;
  const baseIRPJ = rec * pIRPJ;
  const adicional = Math.max(0, baseIRPJ - 240000) * 0.10;
  const irpj = baseIRPJ * 0.15 + adicional;
  const csll = rec * pCSLL * 0.09;
  const pis = rec * 0.0065;
  const cofins = rec * 0.03;
  const iss = issFixoMensal > 0 ? issFixoMensal * 12 : (ativ === "servicos" ? rec * aliqISS : 0);
  return { irpj, csll, pis, cofins, iss, adicional, baseIRPJ, total: irpj + csll + pis + cofins + iss };
}

function calcPF(rec, aliqISS) {
  const mensal = rec / 12;
  const inssMensal = Math.min(mensal * 0.20, TETO_INSS * 0.20);
  const inssAnual = inssMensal * 12;
  const iss = rec * aliqISS;
  const irpfAnual = calcIRPF(mensal - inssMensal) * 12;
  return { inss: inssAnual, iss, irpf: irpfAnual, total: inssAnual + iss + irpfAnual };
}

function calcProLabore(pl) {
  const inss = calcINSS(pl);
  const irpf = calcIRPF(pl - inss);
  const patronal = pl * 0.20;
  return { inss, irpf, liquido: pl - inss - irpf, patronal, custoEmpresa: pl + patronal };
}

// ══════════════════════════════════════════════════════════════
// FORMATADORES
// ══════════════════════════════════════════════════════════════
const R = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const P = (v) => `${((v ?? 0) * 100).toFixed(2)}%`;
const Rk = (v) => { const n = v ?? 0; if (n >= 1e6) return `R$\u00a0${(n/1e6).toFixed(2)}M`; if (n >= 1e3) return `R$\u00a0${(n/1e3).toFixed(1)}k`; return R(n); };

// ══════════════════════════════════════════════════════════════
// TEMA
// ══════════════════════════════════════════════════════════════
const C = { bg:"#0d1b2a", card:"#152236", border:"#1e3450", teal:"#00bfa5", amber:"#f59e0b", red:"#f87171", green:"#34d399", blue:"#60a5fa", purple:"#c084fc", text:"#dde9f5", muted:"#5f82a0" };

// ══════════════════════════════════════════════════════════════
// COMPONENTES BASE
// ══════════════════════════════════════════════════════════════
const Card = ({ children, style={} }) => <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px", ...style }}>{children}</div>;
const SecTitle = ({ children, color=C.teal }) => <div style={{ fontSize:10, fontWeight:700, color, letterSpacing:2, textTransform:"uppercase", marginBottom:12, fontFamily:"monospace" }}>{children}</div>;
const Num = ({ children, color=C.text, size=13, bold=false }) => <span style={{ fontFamily:"'DM Mono',monospace", color, fontSize:size, fontWeight:bold?700:400 }}>{children}</span>;

function Inp({ label, value, onChange, prefix, step=1000, min=0, max, note }) {
  return <div style={{ marginBottom:11 }}>
    <div style={{ fontSize:9, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:3, fontFamily:"monospace" }}>{label}</div>
    <div style={{ display:"flex", alignItems:"center", background:"#0a1420", border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden" }}>
      {prefix && <span style={{ padding:"0 8px", color:C.muted, fontSize:11, borderRight:`1px solid ${C.border}` }}>{prefix}</span>}
      <input type="number" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}
        style={{ flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontSize:12, padding:"7px 8px", fontFamily:"monospace" }} />
    </div>
    {note && <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{note}</div>}
  </div>;
}

function Sel({ label, value, onChange, options }) {
  return <div style={{ marginBottom:11 }}>
    <div style={{ fontSize:9, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:3, fontFamily:"monospace" }}>{label}</div>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:"100%", background:"#0a1420", border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:12, padding:"7px 8px", outline:"none", fontFamily:"monospace" }}>
      {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>;
}

const Metric = ({ label, value, sub, color=C.teal }) =>
  <div style={{ background:"#0a1420", border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 13px", borderLeft:`3px solid ${color}` }}>
    <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{label}</div>
    <Num color={color} size={17} bold>{value}</Num>
    {sub && <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{sub}</div>}
  </div>;

const Alert = ({ children, color=C.teal }) =>
  <div style={{ background:color+"18", border:`1px solid ${color}40`, borderRadius:8, padding:"9px 13px", fontSize:11, color, marginTop:10, lineHeight:1.5 }}>{children}</div>;

const CT = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return <div style={{ background:"#0a1420", border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 13px" }}>
    <div style={{ color:C.muted, fontSize:10, marginBottom:5 }}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{ color:p.color, fontSize:12, fontFamily:"monospace" }}>{p.name}: {Rk(p.value)}</div>)}
  </div>;
};

// ══════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [aba, setAba] = useState("comparativo");
  const [ativ, setAtiv] = useState("servicos");
  const [receita, setReceita] = useState(600000);
  const [margem, setMargem] = useState(20);
  const [folha, setFolha] = useState(15000);
  const [nFunc, setNFunc] = useState(3);
  const [aliqISS, setAliqISS] = useState(5);
  const [issFixo, setIssFixo] = useState(500);
  const [usarFixo, setUsarFixo] = useState(false);
  const [prolabore, setProlabore] = useState(3000);
  const [nSocios, setNSocios] = useState(2);
  const [empresa, setEmpresa] = useState("Empresa Exemplo Ltda.");
  const [resp, setResp] = useState("Dr. João Silva");

  const lucro = useMemo(() => receita * margem / 100, [receita, margem]);
  const fr = useMemo(() => calcFatorR(folha, receita), [folha, receita]);
  const anexo = ativ === "comercio" ? "I" : fr >= 0.28 ? "III" : "V";

  const calc = useMemo(() => {
    const issAnual = aliqISS / 100;
    const pf = calcPF(receita, issAnual);
    const snI = calcSimples(receita, SIMPLES_ANEXO_I);
    const snIII = calcSimples(receita, SIMPLES_ANEXO_III);
    const snV = calcSimples(receita, SIMPLES_ANEXO_V);
    const lp = calcLP(receita, ativ, issAnual, 0);
    const lpF = calcLP(receita, ativ, issAnual, usarFixo ? issFixo : 0);
    const pl = calcProLabore(prolabore);
    const encS = folha * 12 * 0.10;  // Simples: FGTS+RAT (INSS patronal no DAS)
    const encP = folha * 12 * 0.358; // Presumido: INSS20%+RAT2%+SistS5.8%+FGTS8%
    return { pf, snI, snIII, snV, lp, lpF, pl, encS, encP };
  }, [receita, ativ, aliqISS, issFixo, usarFixo, folha, prolabore]);

  // Montar lista de regimes conforme atividade
  const regimes = useMemo(() => {
    const list = [];
    if (ativ === "comercio") {
      if (calc.snI) list.push({ key:"snI", label:"Simples Anx. I", total:calc.snI.total, ef:calc.snI.ef, cor:C.teal });
    } else {
      if (calc.snIII) list.push({ key:"snIII", label:"Simples Anx. III", total:calc.snIII.total, ef:calc.snIII.ef, cor:C.teal });
      if (calc.snV) list.push({ key:"snV", label:"Simples Anx. V", total:calc.snV.total, ef:calc.snV.ef, cor:C.blue });
    }
    list.push({ key:"lp", label:"Lucro Presumido", total:calc.lp.total, ef:calc.lp.total/receita, cor:C.amber });
    if (ativ === "servicos") list.push({ key:"lpF", label:"LP + ISS Fixo", total:calc.lpF.total, ef:calc.lpF.total/receita, cor:C.green });
    list.push({ key:"pf", label:"Pessoa Física", total:calc.pf.total, ef:calc.pf.total/receita, cor:C.purple });
    return list.sort((a,b)=>a.total-b.total);
  }, [calc, ativ, receita]);

  const melhor = regimes[0];
  const pior = regimes[regimes.length - 1];
  const economia = (pior?.total ?? 0) - (melhor?.total ?? 0);

  const dadosBar = regimes.map(r => ({ name: r.label, "Total": r.total }));
  const dadosPie = [
    { name:"IRPJ", v:calc.lp.irpj, c:C.teal },
    { name:"CSLL", v:calc.lp.csll, c:C.amber },
    { name:"PIS", v:calc.lp.pis, c:C.green },
    { name:"COFINS", v:calc.lp.cofins, c:C.blue },
    { name:"ISS", v:calc.lp.iss, c:C.purple },
  ].filter(d=>d.v>0);

  const plSugerido = 2259.20;
  const plSug = calcProLabore(plSugerido);
  const divPorSocio = Math.max(0, (lucro - (melhor?.total ?? 0))) / nSocios;

  const TABS = [
    { id:"comparativo", l:"📊 Comparativo" },
    { id:"detalhe", l:"🔍 Detalhamento" },
    { id:"funcionarios", l:"👥 Funcionários" },
    { id:"prolabore", l:"💼 Pró-labore" },
    { id:"relatorio", l:"📄 Relatório PDF" },
  ];

  // ─ Linha da tabela comparativa ─
  const TRow = ({ label, vals, hl=false }) => (
    <tr style={{ borderBottom:`1px solid ${C.border}22` }}>
      <td style={{ padding:"8px 10px", color:C.muted, fontSize:11 }}>{label}</td>
      {vals.map((v,i)=>(
        <td key={i} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"monospace", fontSize: hl?13:11, fontWeight:hl?700:400, color: hl ? regimes[i]?.cor : C.text }}>{v}</td>
      ))}
    </tr>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input[type=number]::-webkit-inner-spin-button{opacity:.3}
        select option{background:#0d1b2a}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0a1218}::-webkit-scrollbar-thumb{background:#1e3450;border-radius:4px}
        @media print{
          .no-print{display:none!important}
          body{background:white!important;color:#111!important;font-family:'DM Sans',sans-serif}
          .print-wrap{display:block!important;padding:0!important}
          *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        }
      `}</style>

      {/* HEADER */}
      <div className="no-print" style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"13px 26px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <span style={{ fontSize:16, fontWeight:800, color:C.teal }}>⬡ TributoPlanner </span>
          <span style={{ fontSize:10, color:C.muted }}>v2.0 — Planejamento Tributário Empresarial</span>
          <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>LC 123/2006 · RIR/2018 · Lei 9.249/1995 · LC 116/2003 · Lei 10.637/2002</div>
        </div>
        {melhor && <div style={{ background:melhor.cor+"20", border:`1px solid ${melhor.cor}50`, borderRadius:7, padding:"6px 14px", fontSize:11, color:melhor.cor, fontWeight:700 }}>
          ★ Melhor: {melhor.label} — {Rk(melhor.total)} | Economia: {Rk(economia)}
        </div>}
      </div>

      <div className="no-print" style={{ display:"grid", gridTemplateColumns:"260px 1fr", minHeight:"calc(100vh - 54px)" }}>
        {/* PAINEL LATERAL */}
        <div style={{ background:C.card, borderRight:`1px solid ${C.border}`, padding:"18px 14px", overflowY:"auto", fontSize:13 }}>
          <SecTitle>Identificação</SecTitle>
          {[
            { lbl:"Nome da Empresa", val:empresa, set:setEmpresa },
            { lbl:"Responsável Técnico", val:resp, set:setResp },
          ].map(({ lbl, val, set })=>(
            <div key={lbl} style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:3, fontFamily:"monospace" }}>{lbl}</div>
              <input value={val} onChange={e=>set(e.target.value)} style={{ width:"100%", background:"#0a1420", border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:11, padding:"6px 8px", outline:"none" }} />
            </div>
          ))}

          <div style={{ borderTop:`1px solid ${C.border}`, margin:"13px 0" }} />
          <SecTitle color={C.amber}>Dados da Empresa</SecTitle>
          <Sel label="Atividade Principal" value={ativ} onChange={setAtiv} options={[{v:"servicos",l:"Prestação de Serviços"},{v:"comercio",l:"Comércio / Indústria"}]} />
          <Inp label="Receita Bruta Anual (RBT12)" value={receita} onChange={setReceita} prefix="R$" step={10000} max={4800000} note={`Limite Simples Nacional: R$ 4,8M/ano`} />
          <Inp label="Margem de Lucro Estimada" value={margem} onChange={setMargem} step={1} min={0} max={100} prefix="%" note={`Lucro: ${Rk(lucro)}`} />

          <div style={{ borderTop:`1px solid ${C.border}`, margin:"13px 0" }} />
          <SecTitle color={C.blue}>Funcionários (CLT)</SecTitle>
          <Inp label="Folha de Salários Mensal" value={folha} onChange={setFolha} prefix="R$" step={500} note={`Fator r = ${P(fr)} → Enquadramento SN: Anx. ${anexo}`} />
          <Inp label="Nº de Funcionários" value={nFunc} onChange={setNFunc} step={1} min={0} />

          <div style={{ borderTop:`1px solid ${C.border}`, margin:"13px 0" }} />
          <SecTitle color={C.purple}>ISS Municipal</SecTitle>
          <Inp label="Alíquota ISS (%)" value={aliqISS} onChange={setAliqISS} step={0.5} min={2} max={5} prefix="%" />
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            <input type="checkbox" id="fix" checked={usarFixo} onChange={e=>setUsarFixo(e.target.checked)} style={{ accentColor:C.green, width:13, height:13 }} />
            <label htmlFor="fix" style={{ fontSize:10, color:C.muted, cursor:"pointer" }}>Usar ISS Fixo Mensal (LC 116/2003)</label>
          </div>
          {usarFixo && <Inp label="ISS Fixo Mensal (R$)" value={issFixo} onChange={setIssFixo} prefix="R$" step={50} />}

          <div style={{ borderTop:`1px solid ${C.border}`, margin:"13px 0" }} />
          <SecTitle color={C.green}>Sócios</SecTitle>
          <Inp label="Pró-labore por Sócio/Mês" value={prolabore} onChange={setProlabore} prefix="R$" step={500} />
          <Inp label="Número de Sócios" value={nSocios} onChange={setNSocios} step={1} min={1} max={20} />

          <div style={{ borderTop:`1px solid ${C.border}`, margin:"13px 0" }} />
          <SecTitle>Ranking</SecTitle>
          {regimes.map((r,i)=>(
            <div key={r.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, padding:"5px 8px", background:i===0?r.cor+"18":"transparent", borderRadius:6, border:i===0?`1px solid ${r.cor}40`:"none" }}>
              <span style={{ fontSize:10, color:i===0?r.cor:C.muted }}>{i+1}º {r.label}</span>
              <Num color={i===0?r.cor:C.text} size={11} bold={i===0}>{Rk(r.total)}</Num>
            </div>
          ))}
        </div>

        {/* ÁREA PRINCIPAL */}
        <div style={{ padding:"18px 22px", overflowY:"auto" }}>
          {/* TABS */}
          <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}`, marginBottom:18 }}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setAba(t.id)} style={{
                background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
                color:aba===t.id?C.teal:C.muted, fontSize:12, fontWeight:aba===t.id?600:400,
                padding:"8px 13px", borderBottom:aba===t.id?`2px solid ${C.teal}`:"2px solid transparent",
                marginBottom:-1, transition:"all .15s",
              }}>{t.l}</button>
            ))}
          </div>

          {/* ── COMPARATIVO ── */}
          {aba==="comparativo" && (<>
            {ativ==="servicos" && (
              <Alert color={fr>=0.28?C.teal:C.amber}>
                {fr>=0.28
                  ? `✔ Fator r = ${P(fr)} ≥ 28% → Enquadramento no Simples Anexo III (alíquotas menores). LC 123/2006, art. 18, §5º-J.`
                  : `⚠ Fator r = ${P(fr)} < 28% → Enquadramento no Simples Anexo V (carga maior). Para migrar ao Anexo III a folha precisa ser ≥ R$ ${Rk(receita*0.28/12)}/mês. Economia potencial: ${R((calc.snV?.total??0)-(calc.snIII?.total??0))}/ano. LC 123/2006, art. 18, §5º-M.`}
              </Alert>
            )}
            <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
              <Metric label="Receita Bruta Anual" value={Rk(receita)} color={C.text} />
              <Metric label="Lucro Estimado" value={Rk(lucro)} sub={`${margem}% de margem`} color={C.blue} />
              <Metric label="★ Melhor Regime" value={melhor?.label??"-"} sub={Rk(melhor?.total??0)} color={melhor?.cor??C.teal} />
              <Metric label="Economia Máxima" value={Rk(economia)} sub="vs. pior cenário" color={C.green} />
            </div>

            <Card style={{ marginBottom:14 }}>
              <SecTitle>Comparativo Visual — Total de Impostos (R$)</SecTitle>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={dadosBar} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={Rk} tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip content={<CT />} />
                  <Bar dataKey="Total" radius={[5,5,0,0]}>
                    {dadosBar.map((_,i)=><Cell key={i} fill={regimes[i]?.cor??C.teal} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <SecTitle>Tabela Comparativa Completa</SecTitle>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                      <th style={{ padding:"7px 10px", textAlign:"left", color:C.muted, fontSize:10 }}>Indicador</th>
                      {regimes.map(r=><th key={r.key} style={{ padding:"7px 10px", textAlign:"right", color:r.cor, fontSize:10 }}>{r.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <TRow label="Total de Impostos" vals={regimes.map(r=>Rk(r.total))} hl />
                    <TRow label="Alíquota Efetiva s/ Receita" vals={regimes.map(r=>P(r.ef))} />
                    <TRow label="Lucro Líquido após Impostos" vals={regimes.map(r=>Rk(lucro-r.total))} />
                    <TRow label="Impostos + Encargos Funcionários" vals={regimes.map(r=>Rk(r.total+(r.key.includes("sn")||r.key.includes("I")?calc.encS:calc.encP)))} />
                    <TRow label="Carga por R$ 100 de receita" vals={regimes.map(r=>`R$ ${(r.ef*100).toFixed(2)}`)} />
                    <TRow label="Base Legal" vals={regimes.map(r=>r.key.includes("sn")||r.key==="snI"?"LC 123/2006":r.key==="pf"?"Lei 7.713/88":"RIR/2018")} />
                  </tbody>
                </table>
              </div>
            </Card>
          </>)}

          {/* ── DETALHAMENTO ── */}
          {aba==="detalhe" && (<>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <Card>
                <SecTitle color={C.amber}>Lucro Presumido — Breakdown Completo</SecTitle>
                {[
                  { l:"Base de Presunção IRPJ", v:R(calc.lp.baseIRPJ), c:C.muted },
                  { l:`IRPJ 15%`, v:R(calc.lp.irpj-calc.lp.adicional), c:C.text },
                  { l:"Adicional IRPJ 10%*", v:R(calc.lp.adicional), c:C.red },
                  { l:"CSLL 9%", v:R(calc.lp.csll), c:C.text },
                  { l:"PIS 0,65%", v:R(calc.lp.pis), c:C.text },
                  { l:"COFINS 3%", v:R(calc.lp.cofins), c:C.text },
                  { l:`ISS ${P(aliqISS/100)}`, v:R(calc.lp.iss), c:C.text },
                  { l:"TOTAL", v:R(calc.lp.total), c:C.amber, bold:true },
                  { l:"Carga Efetiva", v:P(calc.lp.total/receita), c:C.amber, isMoney:false },
                ].map((row,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<8?`1px solid ${C.border}22`:"none" }}>
                    <span style={{ fontSize:11, color:C.muted }}>{row.l}</span>
                    <Num color={row.c} size={12} bold={row.bold}>{row.isMoney===false?row.v:row.v}</Num>
                  </div>
                ))}
                <div style={{ fontSize:9, color:C.muted, marginTop:6 }}>*Base  R$ 240k/ano. RIR/2018, art. 225.</div>
              </Card>

              <Card>
                <SecTitle color={C.amber}>Composição — Lucro Presumido</SecTitle>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dadosPie} cx="50%" cy="50%" outerRadius={80} dataKey="v" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {dadosPie.map((d,i)=><Cell key={i} fill={d.c} />)}
                    </Pie>
                    <Tooltip formatter={v=>R(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Pessoa Física */}
            <Card style={{ marginBottom:14 }}>
              <SecTitle color={C.purple}>Pessoa Física (Autônomo) — Tributação Completa</SecTitle>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { l:"INSS Contribuinte Individual (20%)", v:calc.pf.inss, c:C.blue, legal:"Lei 8.212/1991, art. 21" },
                  { l:`ISS ${P(aliqISS/100)} sobre receita`, v:calc.pf.iss, c:C.purple, legal:"LC 116/2003" },
                  { l:"IRPF — Carnê-leão (Tabela Prog.)", v:calc.pf.irpf, c:C.red, legal:"Lei 7.713/1988" },
                ].map((item,i)=>(
                  <div key={i} style={{ background:"#0a1420", borderRadius:9, padding:13, borderLeft:`3px solid ${item.c}` }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:5 }}>{item.l}</div>
                    <Num color={item.c} size={17} bold>{R(item.v)}</Num>
                    <div style={{ fontSize:9, color:C.muted, marginTop:5 }}>{item.legal}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, padding:"11px 13px", background:C.purple+"18", borderRadius:8, border:`1px solid ${C.purple}40` }}>
                <span style={{ color:C.purple, fontWeight:600 }}>Total PF</span>
                <Num color={C.purple} size={15} bold>{R(calc.pf.total)}</Num>
              </div>
              <Alert color={C.purple}>⚠ PF (autônomo) não distribui lucros isentos. Todo rendimento é tributado via IRPF. A abertura de PJ frequentemente reduz a carga em 20–30 pontos percentuais.</Alert>
            </Card>

            {/* Simples Anexo III vs V */}
            {ativ==="servicos" && (
              <Card>
                <SecTitle color={C.teal}>Simples Nacional — Anexo III vs. Anexo V</SecTitle>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  {[
                    { label:"Anexo III — fator r ≥ 28%", data:calc.snIII, cor:C.teal, req:"Folha ≥ 28% da receita" },
                    { label:"Anexo V — fator r < 28%", data:calc.snV, cor:C.blue, req:"Folha < 28% da receita" },
                  ].map((item,i)=>(
                    <div key={i} style={{ background:"#0a1420", borderRadius:9, padding:14, borderLeft:`3px solid ${item.cor}`, opacity:!item.data?.total?0.5:1 }}>
                      <div style={{ fontSize:11, color:item.cor, fontWeight:600, marginBottom:8 }}>{item.label}</div>
                      {item.data ? <>
                        <div style={{ marginBottom:5 }}><span style={{ fontSize:10, color:C.muted }}>DAS Anual: </span><Num color={item.cor} size={16} bold>{R(item.data.total)}</Num></div>
                        <div style={{ fontSize:10, color:C.muted }}>Alíquota efetiva: <Num color={item.cor} size={11}>{P(item.data.ef)}</Num></div>
                        <div style={{ fontSize:10, color:C.muted }}>Alíquota nominal: <Num color={C.text} size={11}>{P(item.data.aliqNominal)}</Num></div>
                      </> : <div style={{ fontSize:11, color:C.red }}>Receita acima do limite (R$ 4,8M)</div>}
                      <div style={{ fontSize:9, color:C.muted, marginTop:8, padding:"4px 7px", background:item.cor+"15", borderRadius:4 }}>{item.req} — LC 123/2006, art. 18</div>
                      {anexo===(i===0?"III":"V") && <div style={{ marginTop:5, fontSize:10, color:item.cor, fontWeight:700 }}>◉ Regime atual da empresa</div>}
                    </div>
                  ))}
                </div>
                {calc.snIII && calc.snV && (
                  <Alert color={C.teal}>
                    {fr<0.28
                      ? `💡 Aumentar a folha para R$ ${Rk(receita*0.28/12)}/mês migra ao Anexo III → economia de ${R(calc.snV.total-calc.snIII.total)}/ano. Fator r atual: ${P(fr)}.`
                      : `✔ Empresa já está no Anexo III. Mantenha folha ≥ 28% da receita (${R(receita*0.28/12)}/mês).`}
                  </Alert>
                )}
              </Card>
            )}
          </>)}

          {/* ── FUNCIONÁRIOS ── */}
          {aba==="funcionarios" && (<>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
              <Metric label="Folha Bruta Anual" value={Rk(folha*12)} sub={`${nFunc} funcionário(s)`} color={C.text} />
              <Metric label="Encargos — Simples" value={Rk(calc.encS)} sub="FGTS 8% + RAT 2% (INSS no DAS)" color={C.teal} />
              <Metric label="Encargos — Presumido" value={Rk(calc.encP)} sub="INSS+RAT+Sist.S+FGTS" color={C.amber} />
            </div>

            <Card style={{ marginBottom:14 }}>
              <SecTitle>Composição dos Encargos por Regime (Anual)</SecTitle>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {["Componente","Simples Nacional","Lucro Presumido","Base Legal"].map((h,i)=>(
                      <th key={i} style={{ padding:"7px 10px", textAlign:i===0?"left":"right", color:[C.muted,C.teal,C.amber,C.muted][i], fontSize:10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { comp:"Folha Bruta", sn:R(folha*12), lp:R(folha*12), legal:"CLT" },
                    { comp:"FGTS (8%)", sn:R(folha*12*0.08), lp:R(folha*12*0.08), legal:"Lei 8.036/1990" },
                    { comp:"RAT (2%)", sn:R(folha*12*0.02), lp:R(folha*12*0.02), legal:"Lei 8.212/1991" },
                    { comp:"INSS Patronal (20%)", sn:"✓ Incluído no DAS", lp:R(folha*12*0.20), legal:"Lei 8.212/1991, art. 22" },
                    { comp:"Sistema S (~5,8%)", sn:"✓ Incluído no DAS", lp:R(folha*12*0.058), legal:"Decreto 2.618/1998" },
                    { comp:"Total Encargos Extras", sn:R(calc.encS), lp:R(calc.encP), legal:"—", hl:true },
                    { comp:"Custo Total Empresa", sn:R(folha*12+calc.encS), lp:R(folha*12+calc.encP), legal:"—", hl:true },
                  ].map((row,i)=>(
                    <tr key={i} style={{ background:i%2===0?"transparent":"#0a1420", borderBottom:`1px solid ${C.border}22` }}>
                      <td style={{ padding:"8px 10px", color:row.hl?C.text:C.muted, fontWeight:row.hl?600:400 }}>{row.comp}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"monospace", color:row.hl?C.teal:C.text, fontWeight:row.hl?700:400 }}>{row.sn}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"monospace", color:row.hl?C.amber:C.text, fontWeight:row.hl?700:400 }}>{row.lp}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:C.muted, fontSize:9 }}>{row.legal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Alert color={C.teal}>
                💡 No Simples Nacional, INSS patronal e Sistema S estão embutidos no DAS. A economia anual em encargos é de <strong>{R(calc.encP-calc.encS)}</strong> em relação ao Lucro Presumido.
              </Alert>
            </Card>

            <Card>
              <SecTitle>Custo Médio por Funcionário (Mensal)</SecTitle>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[
                  { label:"Simples Nacional", pct:0.10, cor:C.teal, desc:"FGTS + RAT" },
                  { label:"Lucro Presumido", pct:0.358, cor:C.amber, desc:"INSS + RAT + Sist.S + FGTS" },
                ].map((item,i)=>{
                  const salMedio = nFunc>0 ? folha/nFunc : folha;
                  return (
                    <div key={i} style={{ background:"#0a1420", borderRadius:9, padding:14, borderLeft:`3px solid ${item.cor}` }}>
                      <div style={{ fontSize:11, color:item.cor, fontWeight:600, marginBottom:8 }}>{item.label}</div>
                      {[
                        ["Salário médio", R(salMedio)],
                        [`Encargos (${P(item.pct)})`, R(salMedio*item.pct)],
                        ["Custo total/funcionário", R(salMedio*(1+item.pct))],
                      ].map(([l,v],j)=>(
                        <div key={j} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:5, borderBottom:j<2?`1px solid ${C.border}22`:"none", paddingBottom:j<2?5:0 }}>
                          <span style={{ color:C.muted }}>{l}</span>
                          <Num color={j===2?item.cor:C.text} size={12} bold={j===2}>{v}</Num>
                        </div>
                      ))}
                      <div style={{ fontSize:9, color:C.muted, marginTop:4 }}>{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>)}

          {/* ── PRÓ-LABORE ── */}
          {aba==="prolabore" && (<>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
              <Metric label="Pró-labore Bruto/Sócio" value={R(prolabore)} sub="Mensal" color={C.text} />
              <Metric label="INSS/Sócio" value={R(calc.pl.inss)} sub="Tabela progressiva 2024" color={C.red} />
              <Metric label="IRPF/Sócio" value={R(calc.pl.irpf)} sub={`Base: ${R(prolabore-calc.pl.inss)}`} color={C.amber} />
              <Metric label="Líquido/Sócio" value={R(calc.pl.liquido)} sub="Recebido no banco" color={C.green} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <Card>
                <SecTitle>Detalhamento do Pró-labore Atual</SecTitle>
                {[
                  ["Pró-labore Bruto", R(prolabore), C.text],
                  ["(-) INSS Empregado (prog.)", `(${R(calc.pl.inss)})`, C.red],
                  ["= Base de cálculo IRPF", R(prolabore-calc.pl.inss), C.muted],
                  ["(-) IRPF (Tabela Progressiva)", `(${R(calc.pl.irpf)})`, C.red],
                  ["= LÍQUIDO RECEBIDO", R(calc.pl.liquido), C.green],
                  ["──", "", C.muted],
                  ["INSS Patronal (empresa — 20%)", R(calc.pl.patronal), C.amber],
                  ["Custo total p/ empresa/sócio", R(calc.pl.custoEmpresa), C.amber],
                  ["Custo total todos os sócios/mês", R(calc.pl.custoEmpresa*nSocios), C.amber],
                ].map(([l,v,c],i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<8?`1px solid ${C.border}22`:"none" }}>
                    <span style={{ fontSize:10, color:C.muted }}>{l}</span>
                    <Num color={c} size={11} bold={i===4||i===8}>{v}</Num>
                  </div>
                ))}
              </Card>

              <Card>
                <SecTitle color={C.green}>★ Pró-labore Sugerido (Otimizado)</SecTitle>
                <div style={{ background:C.green+"15", border:`1px solid ${C.green}40`, borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
                  <div style={{ fontSize:12, color:C.green, fontWeight:600, marginBottom:3 }}>Sugestão: {R(plSugerido)}/mês</div>
                  <div style={{ fontSize:9, color:C.muted }}>Até o limite de isenção do IRPF 2024 (IN RFB 2.121/2022). Zero IRPF + INSS mínimo.</div>
                </div>
                {[
                  ["Pró-labore sugerido", R(plSugerido), C.green],
                  ["INSS s/ sugerido", R(calcINSS(plSugerido)), C.red],
                  ["IRPF s/ sugerido", "R$ 0,00 (Isento)", C.teal],
                  ["Líquido sugerido", R(plSugerido-calcINSS(plSugerido)), C.green],
                  ["Restante c/ dividendos/sócio", R(divPorSocio), C.teal],
                  ["IR sobre dividendos", "R$ 0,00 (Isento)*", C.teal],
                ].map(([l,v,c],i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<5?`1px solid ${C.border}22`:"none" }}>
                    <span style={{ fontSize:10, color:C.muted }}>{l}</span>
                    <Num color={c} size={11} bold={i===3||i===5}>{v}</Num>
                  </div>
                ))}
                <div style={{ fontSize:9, color:C.muted, marginTop:7 }}>*Lei 9.249/1995, art. 10. Acompanhe projetos de reforma tributária.</div>
              </Card>
            </div>

            <Card>
              <SecTitle>Eficiência Tributária: Pró-labore vs. Dividendos (por R$ 1.000)</SecTitle>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[
                  { label:"Via Pró-labore", cor:C.amber, rows:[
                    ["INSS Empregado (~9%)", `-${R(calcINSS(1000))}`],
                    ["IRPF (7,5–27,5%)", "variável"],
                    ["INSS Patronal (empresa)", `-${R(200)}`],
                    ["Custo total para empresa", R(1200)],
                    ["Líquido estimado sócio", R(1000-calcINSS(1000)-calcIRPF(1000-calcINSS(1000)))],
                  ]},
                  { label:"Via Dividendos", cor:C.green, rows:[
                    ["INSS", "R$ 0,00"],
                    ["IRPF na Fonte", "R$ 0,00"],
                    ["IR na Declaração", "R$ 0,00 (Isento)"],
                    ["Custo total para empresa", R(1000)],
                    ["Líquido sócio", R(1000)],
                  ]},
                ].map((col,ci)=>(
                  <div key={ci} style={{ background:"#0a1420", borderRadius:9, padding:14, borderLeft:`3px solid ${col.cor}` }}>
                    <div style={{ fontSize:12, color:col.cor, fontWeight:600, marginBottom:10 }}>{col.label}</div>
                    {col.rows.map(([l,v],i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:5 }}>
                        <span style={{ color:C.muted }}>{l}</span>
                        <Num color={i>=3?col.cor:C.red} size={11}>{v}</Num>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </>)}

          {/* ── RELATÓRIO PDF ── */}
          {aba==="relatorio" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>Relatório para Apresentação ao Cliente</div>
                  <div style={{ fontSize:11, color:C.muted }}>Clique em "Gerar PDF" → no diálogo de impressão escolha "Salvar como PDF"</div>
                </div>
                <button onClick={()=>window.print()} style={{
                  background:C.teal, border:"none", borderRadius:8, color:"#0d1b2a", fontSize:13, fontWeight:800,
                  padding:"10px 22px", cursor:"pointer", fontFamily:"inherit",
                }}>📄 Gerar PDF</button>
              </div>

              {/* Preview branco */}
              <div id="relatorio-pdf" style={{ background:"white", borderRadius:12, padding:"36px 44px", color:"#111", fontSize:12, boxShadow:"0 4px 40px rgba(0,0,0,.5)" }}>
                {/* Cabeçalho */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:"3px solid #0d1b2a", paddingBottom:18, marginBottom:22 }}>
                  <div>
                    <div style={{ fontSize:20, fontWeight:800, color:"#0d1b2a", letterSpacing:.5 }}>PLANEJAMENTO TRIBUTÁRIO</div>
                    <div style={{ fontSize:13, color:"#444", marginTop:3 }}>{empresa}</div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:10, color:"#888" }}>
                    <div>Responsável: {resp}</div>
                    <div>Data: {new Date().toLocaleDateString("pt-BR")}</div>
                    <div>Exercício: 2024/2025</div>
                  </div>
                </div>

                {/* Dados */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#0d1b2a", borderLeft:"4px solid #00bfa5", paddingLeft:10, marginBottom:10 }}>1. DADOS DA EMPRESA</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                    <tbody>
                      {[
                        ["Receita Bruta Anual (RBT12)", R(receita)],
                        ["Atividade", ativ==="servicos"?"Prestação de Serviços":"Comércio / Indústria"],
                        ["Lucro Estimado", `${R(lucro)} (${margem}% de margem)`],
                        ["Folha de Salários Mensal", `${R(folha)} | ${nFunc} funcionário(s)`],
                        ["Fator r (Simples Nacional)", `${P(fr)} → Enquadramento: Anexo ${anexo}`],
                        ["Alíquota ISS Municipal", P(aliqISS/100)],
                        ["ISS Fixo", usarFixo?`Sim — ${R(issFixo)}/mês`:"Não (% sobre receita)"],
                        ["Pró-labore por Sócio", `${R(prolabore)}/mês`],
                        ["Número de Sócios", nSocios],
                      ].map(([l,v],i)=>(
                        <tr key={i} style={{ background:i%2===0?"#f7f9fa":"white" }}>
                          <td style={{ padding:"5px 9px", color:"#666", width:"44%" }}>{l}</td>
                          <td style={{ padding:"5px 9px", fontFamily:"monospace", fontWeight:500 }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Comparativo */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#0d1b2a", borderLeft:"4px solid #f59e0b", paddingLeft:10, marginBottom:10 }}>2. COMPARATIVO DE REGIMES TRIBUTÁRIOS</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                    <thead>
                      <tr style={{ background:"#0d1b2a", color:"white" }}>
                        <th style={{ padding:"7px 9px", textAlign:"left" }}>Regime Tributário</th>
                        <th style={{ padding:"7px 9px", textAlign:"right" }}>Total Impostos</th>
                        <th style={{ padding:"7px 9px", textAlign:"right" }}>Alíq. Efetiva</th>
                        <th style={{ padding:"7px 9px", textAlign:"right" }}>Lucro Líquido</th>
                        <th style={{ padding:"7px 9px", textAlign:"right" }}>Posição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regimes.map((r,i)=>(
                        <tr key={r.key} style={{ background:i===0?"#e6fff8":i%2===0?"#f7f9fa":"white" }}>
                          <td style={{ padding:"7px 9px", fontWeight:i===0?700:400 }}>{r.label}{i===0?" ★":"" }</td>
                          <td style={{ padding:"7px 9px", textAlign:"right", fontFamily:"monospace", fontWeight:i===0?700:400 }}>{R(r.total)}</td>
                          <td style={{ padding:"7px 9px", textAlign:"right", fontFamily:"monospace" }}>{P(r.ef)}</td>
                          <td style={{ padding:"7px 9px", textAlign:"right", fontFamily:"monospace" }}>{R(lucro-r.total)}</td>
                          <td style={{ padding:"7px 9px", textAlign:"right", fontWeight:700, color:i===0?"#00bfa5":"#888" }}>{i+1}º</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Recomendação */}
                <div style={{ marginBottom:22, background:"#e6fff8", border:"2px solid #00bfa5", borderRadius:9, padding:"14px 18px" }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#0d1b2a", marginBottom:7 }}>★ RECOMENDAÇÃO TÉCNICA</div>
                  <div style={{ fontSize:10, color:"#333", lineHeight:1.8 }}>
                    O regime tributário mais vantajoso para o exercício 2024/2025 é o <strong>{melhor?.label}</strong>, com carga tributária de <strong>{R(melhor?.total)}</strong> ({P(melhor?.ef)} de alíquota efetiva).{" "}
                    Isso representa uma economia de <strong>{R(economia)}</strong> em relação ao regime menos vantajoso.{" "}
                    {ativ==="servicos" && fr<0.28 && `O Fator r atual (${P(fr)}) enquadra a empresa no Anexo V. Recomenda-se avaliar aumento de folha para atingir 28% da receita e migrar ao Anexo III.`}
                  </div>
                </div>

                {/* Pró-labore */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#0d1b2a", borderLeft:"4px solid #34d399", paddingLeft:10, marginBottom:10 }}>3. PRÓ-LABORE & DISTRIBUIÇÃO DE LUCROS</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                    <tbody>
                      {[
                        ["Pró-labore informado", `${R(prolabore)}/mês`],
                        ["Líquido recebido por sócio", R(calc.pl.liquido)+"/mês"],
                        ["Pró-labore sugerido (otimizado)", `${R(plSugerido)}/mês — Até limite isenção IRPF`],
                        ["Dividendos estimados por sócio", `${R(divPorSocio)}/ano`],
                        ["IR sobre dividendos", "Isento — Lei 9.249/1995, art. 10"],
                      ].map(([l,v],i)=>(
                        <tr key={i} style={{ background:i%2===0?"#f7f9fa":"white" }}>
                          <td style={{ padding:"5px 9px", color:"#666", width:"44%" }}>{l}</td>
                          <td style={{ padding:"5px 9px", fontFamily:"monospace", fontWeight:500 }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Funcionários */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#0d1b2a", borderLeft:"4px solid #60a5fa", paddingLeft:10, marginBottom:10 }}>4. ENCARGOS COM FUNCIONÁRIOS</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                    <tbody>
                      {[
                        ["Folha Bruta Anual", R(folha*12)],
                        ["Encargos — Simples Nacional (10%)", R(calc.encS)+" (FGTS+RAT; INSS patronal no DAS)"],
                        ["Encargos — Lucro Presumido (35,8%)", R(calc.encP)+" (INSS+RAT+SistS+FGTS)"],
                        ["Economia nos encargos (Simples vs. Presumido)", R(calc.encP-calc.encS)+"/ano"],
                      ].map(([l,v],i)=>(
                        <tr key={i} style={{ background:i%2===0?"#f7f9fa":"white" }}>
                          <td style={{ padding:"5px 9px", color:"#666", width:"44%" }}>{l}</td>
                          <td style={{ padding:"5px 9px", fontFamily:"monospace", fontWeight:500 }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé */}
                <div style={{ borderTop:"1px solid #ddd", paddingTop:14, fontSize:8, color:"#999", lineHeight:1.7 }}>
                  <strong>BASE LEGAL:</strong> LC 123/2006 (Simples Nacional) · RIR/2018 — Decreto 9.580/2018 (Lucro Presumido) · Lei 9.249/1995, art. 10 (Dividendos) · Lei 8.212/1991 (INSS) · LC 116/2003 (ISS) · Lei 10.637/2002 (PIS) · Lei 10.833/2003 (COFINS) · Lei 7.713/1988 (IRPF/PF) | <strong>AVISO:</strong> Este relatório é estimativo e informativo. Não substitui análise contábil individualizada. A opção pelo regime tributário deve ser realizada com escrituração completa e assessoria de contador habilitado (CFC).
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
