export function parseCsv(text: string): Record<string, unknown>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = clean.split("\n")[0].includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (quoted && clean[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if (c === "\n" && !quoted) {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw Error("CSV com aspas não fechadas");
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift()?.map((v) => v.trim());
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw Error("Cabeçalhos vazios ou duplicados");
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r, i) => {
      if (r.length !== headers.length)
        throw Error(`Linha ${i + 2}: quantidade de colunas inválida`);
      if (r.some((v) => /^[=+@]/.test(v)))
        throw Error(`Linha ${i + 2}: fórmulas não permitidas`);
      return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
    });
}
