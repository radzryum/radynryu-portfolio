const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { exportColumns, flatCell, toCsv } = require('../lib/exportFiles');

test('exportColumns unions keys in first-seen order', () => {
  assert.deepEqual(exportColumns([{ a: 1, b: 2 }, { b: 3, c: 4 }]), ['a', 'b', 'c']);
  assert.deepEqual(exportColumns([]), []);
});

test('flatCell stringifies objects and empties nulls', () => {
  assert.equal(flatCell(null), '');
  assert.equal(flatCell(undefined), '');
  assert.equal(flatCell(7), '7');
  assert.equal(flatCell(['x', 'y']), '["x","y"]');
  assert.equal(flatCell({ a: 1 }), '{"a":1}');
});

test('toCsv quotes commas, quotes, and newlines', () => {
  const csv = toCsv([
    { name: 'Dela Cruz, Juan', note: 'said "hi"\nbye', age: 7 },
  ]);
  const [, body] = csv.split('\r\n');
  assert.equal(body, '"Dela Cruz, Juan","said ""hi""\nbye",7');
});

test('toCsv keeps one header row for empty exports', () => {
  assert.equal(toCsv([]), '﻿');
});

test('xlsx round-trips export rows', () => {
  const { toXlsx } = require('../lib/exportFiles');
  const buf = toXlsx('Students', [{ name: 'Maria', age: 7 }]);
  const book = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
  assert.deepEqual(rows, [{ name: 'Maria', age: 7 }]);
});
