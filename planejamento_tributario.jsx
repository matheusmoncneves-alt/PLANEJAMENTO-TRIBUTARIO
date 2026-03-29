import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

// ─── PALETA ───────────────────────────────────────────────────────────────────
const C = {
  navy: "#0d1b2a",
  navyMid: "#1b2e42",
  navyLight: "#243b55",
  teal: "#00b4d8",
  tealLight: "#90e0ef",
  gold: "#f4a261",
  green: "#2ec4b6",
  red: "#e63946",
  text: "#e0e8f0",
  textMuted: "#8ba3be",
  border: "#1e3450",
};

// ─── TABELAS TRIBUTÁRIAS ──────────────────────────────────────────────────────

// Simples Nacional - Anexo I (Comércio) - LC 123/2006
const SIMPLES_COMERCIO = [
  { max: 180000, aliq: 0.04, pd: 0 },
  { max: 360000, aliq: 0.073, pd: 5940 },
  { max: 720000, aliq: 0.095, pd: 13860 },
  { max: 1800000, aliq: 0.107, pd: 22500 },
  { max: 3600000, aliq: 0.143, pd: 87300 },
  { max: 4800000, aliq: 0.19, pd: 378000 },
];

// Simples Nacional - Anexo III (Serviços)
const SIMPLES_SERVICOS = [
  { max: 180000, aliq: 0.06, pd: 0 },
  { max: 360000, aliq: 0.112, pd: 9360 },
  { max: 720000, aliq: 0.132, pd: 17640 },
  { max: 1800000, aliq: 0.16, pd: 35640 },
  { max: 3600000, aliq: 0.21, pd: 125640 },
  { max: 4800000, aliq: 0.33, pd: 648000 },
];

// IRPF mensal 2024
const TABELA_IRPF = [
  { max: 2259.20, aliq: 0, ded: 0 },
  { max: 2826.65, aliq: 0.075, ded: 169.44 },
  { max: 3751.05, aliq: 0.15, ded: 381.44 },
  { max: 4664.68, aliq: 0.225, ded: 662.77 },
  { max: Infinity, aliq: 0.275, ded: 896.00 },
];

// INSS (tabela progressiva 2024)
const TABELA_INSS = [
  { max: 1412.00, aliq: 0.075 },
  { max: 2666.68, aliq: 0.09 },
  { max: 4000.03, aliq: 0.12 },
  { max: 7786.02, aliq: 0.14 },
];
const TETO_INSS = 7786.02;

// ─── FUNÇÕES DE CÁLCULO ───────────────────────────────────────────────────────

function calcINSS(salario) {
  const base = Math.min(salario, TETO_INSS);
  let inss = 0, ant = 0;
  for (const faixa of TABELA_INSS) {
    if (base <= ant) break;
    const trib = Math.min(base, faixa.max) - ant;
    inss += trib * faixa.aliq;
    ant = faixa.max;
    if (base <= faixa.max) break;
  }
  return inss;
}

function calcIRPF(baseCalculo) {
  for (const faixa of TABELA_IRPF) {
    if (baseCalculo <= faixa.max) {
      return Math.max(0, baseCalculo * faixa.aliq - faixa.ded);
    }
  }
  return 0;
}

function calcSimples(rbt12, tabela) {
  for (const faixa of tabela) {
    if (rbt12 <= faixa.max) {
      const efetiva = (rbt12 * faixa.aliq - faixa.pd) / rbt12;
      return { aliqEfetiva: efetiva, total: rbt12 * efetiva };
    }
  }
  return null; // Acima do limite
}

function calcLucroPresumido(receita, atividade, lucro) {
  const percIRPJ = atividade === "comercio" ? 0.08 : 0.32;
  const percCSLL = atividade === "comercio" ? 0.12 : 0.32;

  const baseIRPJ = receita * percIRPJ;
  const baseCSLL = receita * percCSLL;

  const irpjNormal = baseIRPJ * 0.15;
  const adicional = Math.max(0, baseIRPJ - 240000) * 0.10;
  const irpj = irpjNormal + adicional;
  const csll = baseCSLL * 0.09;
  const pis = receita * 0.0065;
  const cofins = receita * 0.03;

  return { irpj, csll, pis, cofins, total: irpj + csll + pis + cofins, adicional };
}

function calcLucroReal(receita, lucro, creditosPisCofins = 0) {
  const baseIRPJ = Math.max(0, lucro);
  const irpjNormal = baseIRPJ * 0.15;
  const adicional = Math.max(0, baseIRPJ - 240000) * 0.10;
  const irpj = irpjNormal + adicional;
  const csll = Math.max(0, lucro) * 0.09;
  const pis = Math.max(0, receita * 0.0165 - creditosPisCofins * 0.0165);
  const cofins = Math.max(0, receita * 0.076 - creditosPisCofins * 0.076);

  return { irpj, csll, pis, cofins, total: irpj + csll + pis + cofins, adicional };
}

// ─── FORMATADORES ─────────────────────────────────────────────────────────────
const fmt = (v) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—";
const fmtP = (v) => `${(v * 100).toFixed(2)}%`;
const fmtK = (v) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return fmt(v);
};

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.navyMid, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "20px 24px",
      ...style
    }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function Input({ label, value, onChange, prefix, suffix, min = 0, max, step = 1000 }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Label>{label}</Label>
      <div style={{ display: "flex", alignItems: "center", background: C.navyLight, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "0 12px", color: C.textMuted, fontSize: 13, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{prefix}</span>}
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, padding: "10px 14px", fontFamily: "'IBM Plex Mono', monospace" }}
        />
        {suffix && <span style={{ padding: "0 12px", color: C.textMuted, fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Label>{label}</Label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: C.navyLight, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, padding: "10px 14px", outline: "none", cursor: "pointer" }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Badge({ children, color = C.teal }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function MetricBox({ label, value, sub, color = C.teal, big = false }) {
  return (
    <div style={{ background: C.navyLight, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const REGIME_COLORS = { simples: C.teal, presumido: C.gold, real: C.green };
const REGIME_LABELS = { simples: "Simples Nacional", presumido: "Lucro Presumido", real: "Lucro Real" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px" }}>
      <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
          {p.name}: {fmtK(p.value)}
        </div>
      ))}
    </div>
  );
};

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [aba, setAba] = useState("regimes");

  // Dados da empresa
  const [receita, setReceita] = useState(1200000);
  const [lucro, setLucro] = useState(180000);
  const [atividade, setAtividade] = useState("comercio");
  const [creditos, setCreditos] = useState(80000);

  // Pró-labore
  const [prolabore, setProlabore] = useState(8000);
  const [numSocios, setNumSocios] = useState(2);

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const tabela = atividade === "comercio" ? SIMPLES_COMERCIO : SIMPLES_SERVICOS;
    const simples = calcSimples(receita, tabela);
    const presumido = calcLucroPresumido(receita, atividade, lucro);
    const real = calcLucroReal(receita, lucro, creditos);

    // Pró-labore total (todos os sócios)
    const prolaboreTotal = prolabore * numSocios;
    const inssEmpresa = prolaboreTotal * 0.20; // INSS patronal
    const inssEmpregado = calcINSS(prolabore) * numSocios;
    const baseIRPF = prolabore - calcINSS(prolabore);
    const irpfMensal = calcIRPF(baseIRPF) * numSocios;
    const cargaProLaboreMensal = inssEmpresa + inssEmpregado + irpfMensal;
    const cargaProLaboreAnual = cargaProLaboreMensal * 12;

    // Dividendos - isentos (Lei 9.249/1995)
    const dividendosPossiveis = Math.max(0, lucro - cargaProLaboreAnual);

    return { simples, presumido, real, prolaboreTotal, inssEmpresa, inssEmpregado, irpfMensal, cargaProLaboreMensal, cargaProLaboreAnual, dividendosPossiveis };
  }, [receita, lucro, atividade, creditos, prolabore, numSocios]);

  // Melhor regime
  const melhor = useMemo(() => {
    const vals = {
      simples: calc.simples ? calc.simples.total : Infinity,
      presumido: calc.presumido.total,
      real: calc.real.total,
    };
    return Object.entries(vals).sort((a, b) => a[1] - b[1])[0][0];
  }, [calc]);

  // Dados para gráfico comparativo
  const dadosComparativo = [
    { name: "Simples Nacional", total: calc.simples ? calc.simples.total : 0, disabled: !calc.simples },
    { name: "Lucro Presumido", total: calc.presumido.total },
    { name: "Lucro Real", total: calc.real.total },
  ];

  // Dados breakdown impostos
  const dadosImposto = [
    { name: "IRPJ", Presumido: calc.presumido.irpj, Real: calc.real.irpj },
    { name: "CSLL", Presumido: calc.presumido.csll, Real: calc.real.csll },
    { name: "PIS", Presumido: calc.presumido.pis, Real: calc.real.pis },
    { name: "COFINS", Presumido: calc.presumido.cofins, Real: calc.real.cofins },
  ];

  // Carga efetiva %
  const cargaEfetiva = {
    simples: calc.simples ? calc.simples.aliqEfetiva : null,
    presumido: calc.presumido.total / receita,
    real: calc.real.total / receita,
  };

  const dadosPie = calc.presumido ? [
    { name: "IRPJ", value: calc.presumido.irpj, color: C.teal },
    { name: "CSLL", value: calc.presumido.csll, color: C.gold },
    { name: "PIS", value: calc.presumido.pis, color: C.green },
    { name: "COFINS", value: calc.presumido.cofins, color: "#e63946" },
  ] : [];

  const tabs = [
    { id: "regimes", label: "Comparativo de Regimes" },
    { id: "impostos", label: "Detalhamento de Impostos" },
    { id: "prolabore", label: "Pró-labore & Dividendos" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.navy, color: C.text, fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif" }}>

      {/* Imports de fonte */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        select option { background: #1b2e42; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0d1b2a; } ::-webkit-scrollbar-thumb { background: #1e3450; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.navyMid, borderBottom: `1px solid ${C.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.teal, letterSpacing: 0.5 }}>
            ◈ TributoPlanner
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Planejamento Tributário Empresarial — LC 123/2006 | RIR/2018 | Lei 9.249/1995</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge color={REGIME_COLORS[melhor]}>✦ Melhor regime: {REGIME_LABELS[melhor]}</Badge>
          <Badge color={C.textMuted}>Exercício 2024</Badge>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 0, minHeight: "calc(100vh - 65px)" }}>

        {/* Painel lateral */}
        <div style={{ background: C.navyMid, borderRight: `1px solid ${C.border}`, padding: "24px 20px", overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>
            ▸ Dados da Empresa
          </div>

          <Select
            label="Atividade Principal"
            value={atividade}
            onChange={setAtividade}
            options={[
              { value: "comercio", label: "Comércio / Indústria" },
              { value: "servicos", label: "Prestação de Serviços" },
            ]}
          />
          <Input label="Receita Bruta Anual (RBT12)" value={receita} onChange={setReceita} prefix="R$" step={10000} max={4800000} />
          <Input label="Lucro Antes dos Impostos (LAIR)" value={lucro} onChange={setLucro} prefix="R$" step={5000} />
          <Input label="Créditos PIS/COFINS (Lucro Real)" value={creditos} onChange={setCreditos} prefix="R$" step={5000} />

          <div style={{ borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>
            ▸ Remuneração dos Sócios
          </div>

          <Input label="Pró-labore por Sócio (Mensal)" value={prolabore} onChange={setProlabore} prefix="R$" step={500} />
          <Input label="Número de Sócios" value={numSocios} onChange={setNumSocios} min={1} max={20} step={1} />

          <div style={{ borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />

          {/* Resumo rápido */}
          <div style={{ fontSize: 12, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Resumo Rápido</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {calc.simples ? (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: C.teal }}>Simples Nacional</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: melhor === "simples" ? C.teal : C.text }}>{fmtK(calc.simples.total)}</span>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>Simples Nacional</span>
                <span style={{ color: C.red, fontSize: 11 }}>Fora do limite</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: C.gold }}>Lucro Presumido</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: melhor === "presumido" ? C.gold : C.text }}>{fmtK(calc.presumido.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: C.green }}>Lucro Real</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: melhor === "real" ? C.green : C.text }}>{fmtK(calc.real.total)}</span>
            </div>
          </div>
        </div>

        {/* Área principal */}
        <div style={{ padding: "24px 28px", overflowY: "auto" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setAba(t.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: aba === t.id ? C.teal : C.textMuted,
                fontSize: 13, fontWeight: aba === t.id ? 600 : 400,
                padding: "10px 18px",
                borderBottom: aba === t.id ? `2px solid ${C.teal}` : "2px solid transparent",
                transition: "all 0.2s",
                fontFamily: "inherit",
                marginBottom: -1,
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── ABA: REGIMES ── */}
          {aba === "regimes" && (
            <div>
              {/* Métricas de carga efetiva */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                {calc.simples ? (
                  <MetricBox label="Carga Efetiva — Simples" value={fmtP(calc.simples.aliqEfetiva)} sub={`Total: ${fmtK(calc.simples.total)}`} color={C.teal} />
                ) : (
                  <MetricBox label="Carga Efetiva — Simples" value="Inelegível" sub="Receita acima de R$ 4,8M" color={C.red} />
                )}
                <MetricBox label="Carga Efetiva — Presumido" value={fmtP(cargaEfetiva.presumido)} sub={`Total: ${fmtK(calc.presumido.total)}`} color={C.gold} />
                <MetricBox label="Carga Efetiva — Real" value={fmtP(cargaEfetiva.real)} sub={`Total: ${fmtK(calc.real.total)}`} color={C.green} />
              </div>

              {/* Gráfico comparativo */}
              <Card style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                  Comparativo Total de Impostos por Regime
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dadosComparativo} barSize={56}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total de Impostos" radius={[6, 6, 0, 0]}>
                      {dadosComparativo.map((entry, i) => (
                        <Cell key={i} fill={i === 0 ? C.teal : i === 1 ? C.gold : C.green} opacity={entry.disabled ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Tabela comparativa */}
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                  Análise Detalhada por Regime
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {["Indicador", "Simples Nacional", "Lucro Presumido", "Lucro Real"].map((h, i) => (
                          <th key={i} style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "right", color: i === 0 ? C.textMuted : [C.textMuted, C.teal, C.gold, C.green][i], fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Total de Impostos", calc.simples ? fmt(calc.simples.total) : "Inelegível", fmt(calc.presumido.total), fmt(calc.real.total)],
                        ["Carga Efetiva s/ Receita", calc.simples ? fmtP(calc.simples.aliqEfetiva) : "—", fmtP(cargaEfetiva.presumido), fmtP(cargaEfetiva.real)],
                        ["Base: IRPJ", "Unificado", fmt(receita * (atividade === "comercio" ? 0.08 : 0.32)), fmt(Math.max(0, lucro))],
                        ["IRPJ + Adicional", "Incluído", fmt(calc.presumido.irpj), fmt(calc.real.irpj)],
                        ["CSLL (9%)", "Incluído", fmt(calc.presumido.csll), fmt(calc.real.csll)],
                        ["PIS", "Incluído", fmt(calc.presumido.pis), fmt(calc.real.pis)],
                        ["COFINS", "Incluído", fmt(calc.presumido.cofins), fmt(calc.real.cofins)],
                        ["Adicional IRPJ", "—", fmt(calc.presumido.adicional), fmt(calc.real.adicional)],
                      ].map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.navyLight, borderBottom: `1px solid ${C.border}22` }}>
                          {row.map((cell, j) => (
                            <td key={j} style={{ padding: "9px 12px", textAlign: j === 0 ? "left" : "right", color: j === 0 ? C.textMuted : C.text, fontFamily: j > 0 ? "'IBM Plex Mono', monospace" : "inherit", fontSize: j === 0 ? 12 : 12 }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 14, padding: "10px 14px", background: REGIME_COLORS[melhor] + "15", borderRadius: 8, border: `1px solid ${REGIME_COLORS[melhor]}33` }}>
                  <span style={{ color: REGIME_COLORS[melhor], fontWeight: 600, fontSize: 12 }}>
                    ✦ Recomendação: {REGIME_LABELS[melhor]} — menor carga tributária com os dados informados.
                  </span>
                  {melhor !== "simples" && calc.simples && (
                    <span style={{ color: C.textMuted, fontSize: 11, display: "block", marginTop: 4 }}>
                      Economia em relação ao Simples Nacional: {fmt(calc.simples.total - (melhor === "presumido" ? calc.presumido.total : calc.real.total))}
                    </span>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* ── ABA: IMPOSTOS ── */}
          {aba === "impostos" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

                {/* Gráfico barras agrupadas */}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                    IRPJ · CSLL · PIS · COFINS — Presumido vs Real
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dadosImposto} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="name" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: C.textMuted }} />
                      <Bar dataKey="Presumido" fill={C.gold} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Real" fill={C.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Pizza Lucro Presumido */}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    Composição — Lucro Presumido
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={dadosPie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {dadosPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Tabela detalhada */}
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                  Base de Cálculo e Alíquotas — Fundamento Legal
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Imposto", "Base (Presumido)", "Alíquota", "Valor (Presumido)", "Base (Real)", "Alíquota", "Valor (Real)", "Base Legal"].map((h, i) => (
                        <th key={i} style={{ padding: "8px 10px", textAlign: i === 0 ? "left" : "right", color: C.textMuted, fontWeight: 600, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        imposto: "IRPJ", colorImp: C.teal,
                        baseP: fmt(receita * (atividade === "comercio" ? 0.08 : 0.32)), aliqP: atividade === "comercio" ? "15%+10%" : "15%+10%", valorP: fmt(calc.presumido.irpj),
                        baseR: fmt(Math.max(0, lucro)), aliqR: "15% + 10%*", valorR: fmt(calc.real.irpj),
                        legal: "RIR/2018 art. 215",
                      },
                      {
                        imposto: "CSLL", colorImp: C.gold,
                        baseP: fmt(receita * (atividade === "comercio" ? 0.12 : 0.32)), aliqP: "9%", valorP: fmt(calc.presumido.csll),
                        baseR: fmt(Math.max(0, lucro)), aliqR: "9%", valorR: fmt(calc.real.csll),
                        legal: "Lei 7.689/1988",
                      },
                      {
                        imposto: "PIS", colorImp: C.green,
                        baseP: fmt(receita), aliqP: "0,65%", valorP: fmt(calc.presumido.pis),
                        baseR: fmt(receita), aliqR: "1,65%(-créd.)", valorR: fmt(calc.real.pis),
                        legal: "Lei 10.637/2002",
                      },
                      {
                        imposto: "COFINS", colorImp: "#e63946",
                        baseP: fmt(receita), aliqP: "3,00%", valorP: fmt(calc.presumido.cofins),
                        baseR: fmt(receita), aliqR: "7,60%(-créd.)", valorR: fmt(calc.real.cofins),
                        legal: "Lei 10.833/2003",
                      },
                    ].map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.navyLight, borderBottom: `1px solid ${C.border}22` }}>
                        <td style={{ padding: "10px", color: row.colorImp, fontWeight: 700 }}>{row.imposto}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: C.text, fontSize: 11 }}>{row.baseP}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.gold, fontSize: 11 }}>{row.aliqP}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: C.gold, fontWeight: 600 }}>{row.valorP}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: C.text, fontSize: 11 }}>{row.baseR}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.green, fontSize: 11 }}>{row.aliqR}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: C.green, fontWeight: 600 }}>{row.valorR}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.textMuted, fontSize: 10 }}>{row.legal}</td>
                      </tr>
                    ))}
                    <tr style={{ background: C.navyLight, borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "10px", color: C.text, fontWeight: 700 }}>TOTAL</td>
                      <td colSpan={2} />
                      <td style={{ padding: "10px", textAlign: "right", color: C.gold, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(calc.presumido.total)}</td>
                      <td colSpan={2} />
                      <td style={{ padding: "10px", textAlign: "right", color: C.green, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(calc.real.total)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 10, fontSize: 10, color: C.textMuted }}>
                  * Adicional IRPJ de 10% incide sobre a base que exceder R$ 240.000/ano (R$ 20.000/mês) — RIR/2018, art. 225.
                </div>
              </Card>
            </div>
          )}

          {/* ── ABA: PRÓ-LABORE ── */}
          {aba === "prolabore" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                <MetricBox label="INSS Patronal (20%)" value={fmtK(calc.inssEmpresa * 12)} sub="Anual (empresa)" color={C.red} />
                <MetricBox label="INSS Empregado" value={fmtK(calc.inssEmpregado * 12)} sub="Anual (descontado)" color={C.gold} />
                <MetricBox label="IRPF (Mensal/Sócio)" value={fmt(calc.irpfMensal / numSocios)} sub="Tabela progressiva 2024" color={C.teal} />
                <MetricBox label="Carga Total Anual" value={fmtK(calc.cargaProLaboreAnual)} sub="INSS + IRPF" color={C.green} big />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                {/* Detalhamento por sócio */}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                    Detalhamento por Sócio — Mensal
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <tbody>
                      {[
                        ["Pró-labore Bruto", fmt(prolabore), C.text],
                        ["(-) INSS Empregado", `(${fmt(calcINSS(prolabore))})`, C.red],
                        ["= Base IRPF", fmt(prolabore - calcINSS(prolabore)), C.textMuted],
                        ["(-) IRPF", `(${fmt(calc.irpfMensal / numSocios)})`, C.red],
                        ["= Líquido Recebido", fmt(prolabore - calcINSS(prolabore) - calc.irpfMensal / numSocios), C.teal],
                        ["INSS Patronal (empresa)", `(${fmt(prolabore * 0.20)})`, C.gold],
                        ["Custo Total/Sócio p/ Empresa", fmt(prolabore * 1.20), C.gold],
                      ].map(([label, val, cor], i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}22`, background: i % 2 === 0 ? "transparent" : C.navyLight }}>
                          <td style={{ padding: "9px 10px", color: C.textMuted }}>{label}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right", color: cor, fontFamily: "'IBM Plex Mono', monospace", fontWeight: i === 4 ? 700 : 400 }}>{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                {/* Dividendos */}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                    Planejamento de Dividendos
                  </div>
                  <div style={{ padding: "12px 14px", background: C.green + "15", border: `1px solid ${C.green}33`, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginBottom: 4 }}>✦ Isenção — Lei 9.249/1995, art. 10</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Dividendos distribuídos por pessoa jurídica tributada pelo Lucro Real, Presumido ou Simples são isentos de IR na fonte e na declaração do sócio.</div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <tbody>
                      {[
                        ["Lucro Antes dos Impostos", fmt(lucro), C.text],
                        ["(-) Total de Impostos (" + REGIME_LABELS[melhor].split(" ")[0] + ")", `(${fmt(melhor === "simples" && calc.simples ? calc.simples.total : melhor === "presumido" ? calc.presumido.total : calc.real.total)})`, C.red],
                        ["= Lucro Líquido Distribuível", fmt(Math.max(0, lucro - (melhor === "simples" && calc.simples ? calc.simples.total : melhor === "presumido" ? calc.presumido.total : calc.real.total))), C.green],
                        ["IR s/ Dividendos", "R$ 0,00 (Isento)", C.teal],
                        ["Por Sócio (" + numSocios + " sócios)", fmt(Math.max(0, lucro - (melhor === "simples" && calc.simples ? calc.simples.total : melhor === "presumido" ? calc.presumido.total : calc.real.total)) / numSocios), C.teal],
                      ].map(([label, val, cor], i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}22`, background: i % 2 === 0 ? "transparent" : C.navyLight }}>
                          <td style={{ padding: "9px 10px", color: C.textMuted }}>{label}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right", color: cor, fontFamily: "'IBM Plex Mono', monospace", fontWeight: i === 2 ? 700 : 400 }}>{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: 14, padding: "10px 14px", background: C.teal + "10", borderRadius: 8, border: `1px solid ${C.teal}22` }}>
                    <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, marginBottom: 2 }}>⚠ Atenção</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>
                      A isenção de dividendos está vigente (Lei 9.249/1995, art. 10). Acompanhe eventuais projetos de reforma tributária que podem alterar este tratamento. O pró-labore deve refletir o trabalho efetivo do sócio (RFB/Cosit 6/2021).
                    </div>
                  </div>
                </Card>
              </div>

              {/* Comparativo remuneração */}
              <Card style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                  Eficiência Tributária: Pró-labore vs. Dividendos (por R$ 1.000 distribuídos)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: C.navyLight, borderRadius: 10, padding: 16, borderLeft: `3px solid ${C.gold}` }}>
                    <div style={{ fontSize: 12, color: C.gold, fontWeight: 600, marginBottom: 10 }}>Via Pró-labore (R$ 1.000)</div>
                    {[
                      ["INSS Empregado (~9%)", `-${fmt(calcINSS(1000))}`],
                      ["IRPF (7,5%–27,5%)", `-(variável)`],
                      ["INSS Patronal (empresa)", `-${fmt(200)}`],
                      ["Custo total para empresa", fmt(1200)],
                    ].map(([l, v], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6, color: i === 3 ? C.gold : C.textMuted }}>
                        <span>{l}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: i === 3 ? C.gold : C.red }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: C.navyLight, borderRadius: 10, padding: 16, borderLeft: `3px solid ${C.green}` }}>
                    <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 10 }}>Via Dividendos (R$ 1.000)</div>
                    {[
                      ["INSS", "R$ 0,00"],
                      ["IRPF na fonte", "R$ 0,00"],
                      ["IR na Declaração", "R$ 0,00 (Isento)"],
                      ["Custo total para empresa", fmt(1000)],
                    ].map(([l, v], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6, color: i === 3 ? C.green : C.textMuted }}>
                        <span>{l}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: i === 3 ? C.green : C.teal }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
