function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return [headerLine, ...bodyLines].join("\n");
}
