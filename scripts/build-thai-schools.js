/**
 * Build thaiSchools.json from MOE catalog year 2568 (school68.xlsx)
 * Source: https://catalog.moe.go.th/dataset/dataset-15_37/resource/6a4e41b3-7180-4a1f-86b3-a918165752fe
 * Download: .../download/school68.xlsx
 *
 * Usage: node scripts/build-thai-schools.js [path/to/school68.xlsx]
 * Requires: npm i -D xlsx  (build-time only)
 */
const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch {
  console.error('Missing dependency: run `npm i -D xlsx` then retry');
  process.exit(1);
}

const input =
  process.argv[2] || path.join(__dirname, '../src/data/school68.xlsx');
const outPath = path.join(__dirname, '../src/data/thaiSchools.json');

/** Already an institution-type name — do not double-prefix */
const HAS_PREFIX =
  /^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน|ศูนย์|สำนักงาน|กอง|ราชวิทยาลัย)/u;

function withSchoolPrefix(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';
  if (HAS_PREFIX.test(name)) return name;
  return `โรงเรียน${name}`;
}

if (!fs.existsSync(input)) {
  console.error('File not found:', input);
  process.exit(1);
}

const wb = XLSX.readFile(input);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

const byKey = new Map();
let skipped = 0;
let prefixed = 0;

for (const row of rawRows) {
  const id = String(row['รหัสสถานศึกษา'] ?? row.SchoolCode ?? '').trim();
  const rawName = String(row['ชื่อสถานศึกษา'] ?? row.SchoolName ?? '').trim();
  const province = String(row['จังหวัด'] ?? row.ProvinceName ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!rawName) {
    skipped++;
    continue;
  }

  const before = rawName.replace(/\s+/g, ' ');
  const name = withSchoolPrefix(before);
  if (name !== before) prefixed++;

  const key = id || `${name}|${province}`;
  const prev = byKey.get(key);
  const next = { id: id || key, name, province };
  if (!prev || name.length > prev.name.length) {
    byKey.set(key, next);
  }
}

const rows = [...byKey.values()].sort((a, b) =>
  a.name.localeCompare(b.name, 'th')
);

fs.writeFileSync(outPath, JSON.stringify(rows));
const sizeMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);

console.log({
  source: 'moe-school68',
  inputRows: rawRows.length,
  unique: rows.length,
  skipped,
  addedPrefix: prefixed,
  out: outPath,
  sizeMb: `${sizeMb} MB`,
  sample: rows.find((r) => r.name.includes('หาดใหญ่')) || rows[0],
  phyathai: rows.find((r) => r.name.includes('พญาไท')),
});
