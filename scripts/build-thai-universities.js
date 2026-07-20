const fs = require('fs');
const raw = fs.readFileSync('src/data/mhesi_univ_2564.csv', 'utf8');
const lines = raw.trim().split(/\r?\n/).slice(1);
const rows = [];
for (const line of lines) {
  // "ACADEMIC_YEAR","UNIV_ID","UNIV_NAME","PROVINCE_UNIV_NAME_TH"
  const m = line.match(/^"([^"]*)","([^"]*)","([^"]*)","([^"]*)"$/);
  if (!m) continue;
  rows.push({
    id: m[2],
    name: m[3],
    province: m[4],
    source: 'mhesi',
    type: 'university',
  });
}
fs.writeFileSync('src/data/thaiUniversities.json', JSON.stringify(rows));
console.log('count', rows.length);
console.log('sample', rows[0]);
console.log(
  'psu',
  rows.filter((r) => r.name.includes('สงขลา')).slice(0, 5)
);
