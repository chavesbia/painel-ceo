// Semicolon-CSV parser (handles quoted fields with embedded ; and "" escapes)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ';') { row.push(cur); cur = ""; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => v && v.trim() !== ""));
}

export function parseBrl(v: string | undefined): number {
  if (!v) return 0;
  const s = v.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseBrDate(v: string | undefined): string | null {
  if (!v || v.trim() === "" || v.trim() === "-") return null;
  const m = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Extract CNPJ/CPF from "NOME - 00.000.000/0000-00"
export function extractDoc(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
  return m ? m[1] : null;
}

export const EXCLUDED_CNPJ = "37.260.594/0002-60";

export type ParsedInvoiceRow = {
  kind: "receivable" | "payable";
  numero: string;
  unidade_negocio: string | null;
  entidade: string | null;
  entidade_doc: string | null;
  valor_parcela: number;
  valor_pago: number;
  total_fatura: number | null;
  situacao: string | null;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  conta_bancaria: string | null;
  plano_contas: string | null;
  centro_custos: string | null;
  origem: string | null;
  descricao: string | null;
  numero_nota: string | null;
  data_cadastro: string | null;
  criado_por: string | null;
};

export function csvToInvoices(
  text: string,
  kind: "receivable" | "payable",
): { rows: ParsedInvoiceRow[]; skipped: number; total: number } {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], skipped: 0, total: 0 };
  const header = grid[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const col = {
    un: idx("Unidade de Negócio"),
    num: idx("Nº"),
    ent: idx("Entidade"),
    vp: idx("Valor da Parcela"),
    vpago: idx("Valor Pago"),
    tot: idx("Total Fatura"),
    sit: idx("Situação"),
    dc: idx("Data Competência"),
    dv: idx("Data Vencimento"),
    dp: idx("Data Pagamento"),
    fp: idx("Forma Pag. Fatura"),
    cb: idx("Conta Bancária"),
    pc: idx("Plano de Contas"),
    cc: idx("Centro de Custos"),
    or: idx("Origem"),
    de: idx("Descrição"),
    nn: idx("Nº da Nota"),
    dca: idx("Data do Cadastro"),
    cp: idx("Criado por"),
  };
  const rows: ParsedInvoiceRow[] = [];
  let skipped = 0;
  const total = grid.length - 1;
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    const numero = (line[col.num] || "").trim();
    const unidade = (line[col.un] || "").trim();
    if (!numero) { skipped++; continue; }
    if (unidade.includes(EXCLUDED_CNPJ)) { skipped++; continue; }
    // Regra para Faturas a Receber: só considerar registros com Nº da Nota contendo "Autorizada"
    // e com "Criado por" preenchido. Caso contrário, ignorar.
    if (kind === "receivable") {
      const numeroNota = (line[col.nn] || "").trim();
      const criadoPor = (line[col.cp] || "").trim();
      if (!/autorizada/i.test(numeroNota) || !criadoPor) { skipped++; continue; }
    }
    rows.push({
      kind,
      numero,
      unidade_negocio: unidade || null,
      entidade: (line[col.ent] || "").trim() || null,
      entidade_doc: extractDoc(line[col.ent]),
      valor_parcela: parseBrl(line[col.vp]),
      valor_pago: col.vpago >= 0 ? parseBrl(line[col.vpago]) : 0,
      total_fatura: line[col.tot] ? parseBrl(line[col.tot]) : null,
      situacao: (line[col.sit] || "").trim() || null,
      data_competencia: parseBrDate(line[col.dc]),
      data_vencimento: parseBrDate(line[col.dv]),
      data_pagamento: parseBrDate(line[col.dp]),
      forma_pagamento: (line[col.fp] || "").trim() || null,
      conta_bancaria: (line[col.cb] || "").trim() || null,
      plano_contas: (line[col.pc] || "").trim() || null,
      centro_custos: (line[col.cc] || "").trim() || null,
      origem: (line[col.or] || "").trim() || null,
      descricao: (line[col.de] || "").trim() || null,
      numero_nota: (line[col.nn] || "").trim() || null,
      data_cadastro: parseBrDate(line[col.dca]),
      criado_por: (line[col.cp] || "").trim() || null,
    });
  }
  return { rows, skipped, total };
}