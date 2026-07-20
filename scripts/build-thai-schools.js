/**
 * Build thaiSchools.json from MOE catalog year 2568 (school68.xlsx)
 * Source: https://catalog.moe.go.th/dataset/dataset-15_37/resource/6a4e41b3-7180-4a1f-86b3-a918165752fe
 *
 * Usage: node scripts/build-thai-schools.js [path/to/school68.xlsx]
 * Requires: npm i -D xlsx  (build-time only)
 *
 * If xlsx is missing, re-prefixes the existing thaiSchools.json instead.
 */
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '../src/data/thaiSchools.json');
const xlsxPath =
  process.argv[2] || path.join(__dirname, '../src/data/school68.xlsx');

/** Keep these as-is; everything else gets โรงเรียน */
const HAS_PREFIX = /^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน|ราชวิทยาลัย)/u;

function isThaiName(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  // Must contain Thai script; reject Latin letters
  return /[\u0E00-\u0E7F]/.test(t) && !/[A-Za-z]/.test(t);
}

function withSchoolPrefix(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';
  if (HAS_PREFIX.test(name)) return name;
  return `โรงเรียน${name}`;
}

function writeRows(rows) {
  const cleaned = rows
    .map((r) => ({
      id: String(r.id || '').trim(),
      name: withSchoolPrefix(r.name),
      province: String(r.province || '').trim().replace(/\s+/g, ' '),
    }))
    .filter((r) => r.name && isThaiName(r.name));

  const byKey = new Map();
  for (const row of cleaned) {
    const key = row.id || `${row.name}|${row.province}`;
    const prev = byKey.get(key);
    if (!prev || row.name.length > prev.name.length) byKey.set(key, row);
  }

  const out = [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'th')
  );
  fs.writeFileSync(outPath, JSON.stringify(out));
  const sizeMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  const noPrefix = out.filter((r) => !HAS_PREFIX.test(r.name)).length;
  console.log({
    unique: out.length,
    noPrefix,
    sizeMb: `${sizeMb} MB`,
    sample: out.find((r) => r.name.includes('พญาไท')) || out[0],
    army: out.find((r) => r.name.includes('กองทัพบก')),
  });
}

if (fs.existsSync(xlsxPath)) {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.error('Missing dependency: run `npm i -D xlsx` then retry');
    process.exit(1);
  }
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const rows = rawRows.map((row) => ({
    id: String(row['รหัสสถานศึกษา'] ?? '').trim(),
    name: String(row['ชื่อสถานศึกษา'] ?? '').trim(),
    province: String(row['จังหวัด'] ?? '').trim(),
  }));
  console.log({ source: 'school68.xlsx', inputRows: rawRows.length });
  writeRows(rows);
} else if (fs.existsSync(outPath)) {
  console.log({ source: 'reprefix-existing', file: outPath });
  writeRows(JSON.parse(fs.readFileSync(outPath, 'utf8')));
} else {
  console.error('No school68.xlsx and no thaiSchools.json found');
  process.exit(1);
}
