import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import thaiUniversities from '@/data/thaiUniversities.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InstitutionHit = {
  name: string;
  label: string;
  source: 'mhesi' | 'moe' | 'local';
  type: 'university' | 'school' | 'other';
  country?: string;
  province?: string;
};

type ThaiUni = {
  id: string;
  name: string;
  province: string;
  source: string;
  type: string;
};

type ThaiSchool = {
  id: string;
  name: string;
  province: string;
};

function isThaiName(s: string) {
  const t = (s || '').trim();
  if (!t) return false;
  return /[\u0E00-\u0E7F]/.test(t) && !/[A-Za-z]/.test(t);
}

const THAI_LIST = (thaiUniversities as ThaiUni[]).filter((r) => isThaiName(r.name));

let schoolCache: ThaiSchool[] | null = null;

function loadThaiSchools(): ThaiSchool[] {
  if (schoolCache) return schoolCache;
  try {
    const filePath = path.join(process.cwd(), 'src/data/thaiSchools.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    schoolCache = (JSON.parse(raw) as ThaiSchool[]).filter((r) => isThaiName(r.name));
  } catch {
    schoolCache = [];
  }
  return schoolCache;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Strip common Thai institution prefixes for looser matching */
function bareName(s: string) {
  return normalize(s).replace(
    /^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน|ราชวิทยาลัย)\s*/u,
    ''
  );
}

function scoreName(name: string, q: string): number {
  const n = normalize(name);
  const query = normalize(q);
  if (!query) return 0;
  if (n === query) return 100;
  if (n.startsWith(query)) return 80;
  if (n.includes(query)) return 60;

  const bn = bareName(name);
  const bq = bareName(q);
  if (bq && bn === bq) return 95;
  if (bq && bn.startsWith(bq)) return 75;
  if (bq && bn.includes(bq)) return 55;

  const tokens = query.split(' ').filter(Boolean);
  if (tokens.length && tokens.every((t) => n.includes(t))) return 50;
  return 0;
}

function ensureSchoolPrefix(name: string) {
  const n = name.trim();
  if (/^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน|ราชวิทยาลัย)/u.test(n)) return n;
  return `โรงเรียน${n}`;
}

function searchThaiUnis(q: string): InstitutionHit[] {
  const scored = THAI_LIST.map((row) => ({
    row,
    score: scoreName(row.name, q),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name, 'th'))
    .slice(0, 20);

  return scored.map(({ row }) => ({
    name: row.name,
    label: row.name,
    source: 'mhesi',
    type: 'university',
    province: row.province,
    country: 'Thailand',
  }));
}

function searchThaiSchools(q: string): InstitutionHit[] {
  if (normalize(q).length < 2) return [];

  const list = loadThaiSchools();
  const scored = list
    .map((row) => {
      const name = ensureSchoolPrefix(row.name);
      return { row, name, score: scoreName(name, q) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'th'))
    .slice(0, 25);

  return scored.map(({ name, row }) => ({
    name,
    label: name,
    source: 'moe' as const,
    type: 'school' as const,
    province: row.province,
    country: 'Thailand',
  }));
}

/**
 * GET /api/institutions/search?q=สงขลา&scope=th|schools|uni
 * Thai institution names only (no English / world sources).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const scope = (req.nextUrl.searchParams.get('scope') || 'th').toLowerCase();

  if (q.length < 1) {
    return NextResponse.json({ items: [] as InstitutionHit[] });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 });
  }

  const wantThaiUnis =
    scope === 'th' || scope === 'all' || scope === 'thai' || scope === 'uni';
  const wantSchools =
    scope === 'th' ||
    scope === 'all' ||
    scope === 'thai' ||
    scope === 'schools' ||
    scope === 'school';

  const thaiUnis = wantThaiUnis ? searchThaiUnis(q) : [];
  const thaiSchools = wantSchools ? searchThaiSchools(q) : [];

  const seen = new Set<string>();
  const items: InstitutionHit[] = [];
  for (const hit of [...thaiUnis, ...thaiSchools]) {
    if (!isThaiName(hit.name)) continue;
    const key = normalize(hit.name);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(hit);
    if (items.length >= 40) break;
  }

  return NextResponse.json({
    items,
    meta: {
      q,
      scope,
      uniCount: thaiUnis.length,
      schoolCount: thaiSchools.length,
      sources: ['mhesi-open-data', 'moe-school68'],
      lang: 'th',
    },
  });
}
