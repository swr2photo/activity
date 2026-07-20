import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import thaiUniversities from '@/data/thaiUniversities.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InstitutionHit = {
  name: string;
  label: string;
  source: 'mhesi' | 'moe' | 'hipolabs' | 'local';
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

const THAI_LIST = thaiUniversities as ThaiUni[];

let schoolCache: ThaiSchool[] | null = null;

function loadThaiSchools(): ThaiSchool[] {
  if (schoolCache) return schoolCache;
  try {
    const filePath = path.join(process.cwd(), 'src/data/thaiSchools.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    schoolCache = JSON.parse(raw) as ThaiSchool[];
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
    /^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน)\s*/u,
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

function displaySchoolName(name: string) {
  if (/^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน)/u.test(name.trim())) return name;
  return `โรงเรียน${name}`;
}

async function searchHipolabs(q: string, country?: string): Promise<InstitutionHit[]> {
  try {
    const params = new URLSearchParams({ name: q, limit: '25' });
    if (country) params.set('country', country);
    const url = `http://universities.hipolabs.com/search?${params.toString()}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      name?: string;
      country?: string;
    }>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((x) => x?.name)
      .map((x) => ({
        name: String(x.name),
        label: x.country ? `${x.name} (${x.country})` : String(x.name),
        source: 'hipolabs' as const,
        type: 'university' as const,
        country: x.country,
      }));
  } catch {
    return [];
  }
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
    label: row.province ? `${row.name} — ${row.province}` : row.name,
    source: 'mhesi',
    type: 'university',
    province: row.province,
    country: 'Thailand',
  }));
}

function searchThaiSchools(q: string): InstitutionHit[] {
  // Require 2+ chars for school scan (~56k rows)
  if (normalize(q).length < 2) return [];

  const list = loadThaiSchools();
  const scored = list
    .map((row) => ({
      row,
      score: scoreName(row.name, q) || scoreName(displaySchoolName(row.name), q),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name, 'th'))
    .slice(0, 25);

  return scored.map(({ row }) => {
    const name = displaySchoolName(row.name);
    return {
      name,
      label: row.province ? `${name} — ${row.province}` : name,
      source: 'moe' as const,
      type: 'school' as const,
      province: row.province,
      country: 'Thailand',
    };
  });
}

/**
 * GET /api/institutions/search?q=สงขลา&scope=th|world|all|schools
 * - th: MHESI Thai universities + MOE Thai schools
 * - schools: MOE schools only
 * - world: Hipolabs worldwide universities
 * - all: Thai unis + schools + Hipolabs (default)
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const scope = (req.nextUrl.searchParams.get('scope') || 'all').toLowerCase();

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
  const wantWorld = scope === 'world' || scope === 'all';

  const [thaiUnis, thaiSchools, worldTh, world] = await Promise.all([
    Promise.resolve(wantThaiUnis ? searchThaiUnis(q) : []),
    Promise.resolve(wantSchools ? searchThaiSchools(q) : []),
    wantWorld ? searchHipolabs(q, 'Thailand') : Promise.resolve([]),
    wantWorld ? searchHipolabs(q) : Promise.resolve([]),
  ]);

  // Prefer universities, then schools, then world
  const seen = new Set<string>();
  const items: InstitutionHit[] = [];
  for (const hit of [...thaiUnis, ...thaiSchools, ...worldTh, ...world]) {
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
      sources: ['mhesi-open-data', 'moe-school-catalog', 'hipolabs-university-domains'],
    },
  });
}
