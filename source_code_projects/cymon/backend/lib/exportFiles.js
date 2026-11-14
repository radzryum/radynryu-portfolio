// One-click data-export file builders (admin backup downloads).
// CSV is hand-rolled (no dependency); XLSX uses the `xlsx` package.
const XLSX = require('xlsx');

const EXPORT_FORMATS = ['json', 'csv', 'xlsx'];

const EXPORT_CONTENT_TYPES = {
  json: 'application/json',
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

function exportDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Flatten one value for tabular formats: objects/arrays become JSON text,
// null/undefined become empty strings. Dates pass through as ISO strings.
function flatCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function exportColumns(rows) {
  const cols = [];
  const seen = new Set();
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }
  return cols;
}

// Minimal RFC-4180 CSV: quote fields containing a quote, comma, or newline.
// A leading BOM keeps Excel from mangling non-ASCII names on open.
function toCsv(rows) {
  const cols = exportColumns(rows);
  const escape = (value) => {
    const text = flatCell(value);
    return /["\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [cols.map(escape).join(',')];
  for (const row of rows || []) {
    lines.push(cols.map((col) => escape(row ? row[col] : '')).join(','));
  }
  return `﻿${lines.join('\r\n')}`;
}

function toXlsx(sheetName, rows) {
  const cols = exportColumns(rows);
  const data = (rows || []).map((row) => {
    const out = {};
    for (const col of cols) out[col] = row ? row[col] ?? '' : '';
    return out;
  });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data, { header: cols });
  sheet['!cols'] = cols.map((col) => ({
    wch: Math.min(60, Math.max(col.length + 2, ...data.map((r) => String(r[col] ?? '').length + 2))),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, String(sheetName || 'Export').slice(0, 31));
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function sendDownload(res, { buffer, filename, contentType }) {
  const safe = String(filename || 'export').replace(/[^a-z0-9._-]+/gi, '_');
  res.set({
    'Content-Type': contentType,
    'Content-Length': String(buffer.length),
    'Content-Disposition': `attachment; filename="${safe}"`,
    'Cache-Control': 'private, no-store',
  });
  res.end(buffer);
}

module.exports = {
  EXPORT_FORMATS,
  EXPORT_CONTENT_TYPES,
  exportDateStamp,
  exportColumns,
  flatCell,
  toCsv,
  toXlsx,
  sendDownload,
};
