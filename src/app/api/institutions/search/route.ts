import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import thaiUniversities from '@/data/thaiUniversities.json';

export const runtime = 'nodejs';

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

type IndexedItem = {
  name: string;
  norm: string;
  bare: string;
  province: string;
};

const PREFIX_RE = /^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน|ราชวิทยาลัย)\s*/u;
const HAS_PREFIX_RE = /^(โรงเรียน|วิทยาลัย|มหาวิทยาลัย|สถาบัน|ราชวิทยาลัย)/u;

function isThaiName(s: string) {
  const t = (s || '').trim();
  if (!t) return false;
  return /[\u0E00-\u0E7F]/.test(t) && !/[A-Za-z]/.test(t);
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function bareName(norm: string) {
  return norm.replace(PREFIX_RE, '');
}

function ensureSchoolPrefix(name: string) {
  const n = name.trim();
  if (HAS_PREFIX_RE.test(n)) return n;
  return `โรงเรียน${n}`;
}

const THAI_UNIS: IndexedItem[] = (thaiUniversities as ThaiUni[])
  .filter((r) => isThaiName(r.name))
  .map((r) => {
    const name = r.name.trim();
    const norm = normalize(name);
    return { name, norm, bare: bareName(norm), province: r.province || '' };
  });

type SchoolIndex = {
  items: IndexedItem[];
  /** ดัชนี bigram 2 ตัวอักษรของ bare name สำหรับตัดรายการผู้สมัครจาก 55,621 เหลือหลักร้อย (<2ms) */
  bigrams: Map<string, number[]>;
};

let schoolIndexPromise: Promise<SchoolIndex> | null = null;

async function getSchoolIndex(): Promise<SchoolIndex> {
  if (schoolIndexPromise) return schoolIndexPromise;

  schoolIndexPromise = (async () => {
    try {
      const filePath = path.join(process.cwd(), 'src/data/thaiSchools.json');
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as ThaiSchool[];
      const items: IndexedItem[] = [];
      const bigrams = new Map<string, number[]>();

      for (let i = 0; i < parsed.length; i++) {
        const r = parsed[i];
        if (!isThaiName(r.name)) continue;
        const name = ensureSchoolPrefix(r.name);
        const norm = normalize(name);
        const bare = bareName(norm);
        const idx = items.length;
        items.push({ name, norm, bare, province: r.province || '' });

        // เก็บ bigram ไม่ซ้ำของชื่อโรงเรียน (ไม่รวมคำว่า "โรงเรียน")
        const seenBg = new Set<string>();
        const target = bare.length >= 2 ? bare : norm;
        for (let k = 0; k < target.length - 1; k++) {
          const bg = target.slice(k, k + 2);
          if (bg.includes(' ') || seenBg.has(bg)) continue;
          seenBg.add(bg);
          let bucket = bigrams.get(bg);
          if (!bucket) {
            bucket = [];
            bigrams.set(bg, bucket);
          }
          bucket.push(idx);
        }
      }
      return { items, bigrams };
    } catch {
      return { items: [], bigrams: new Map() };
    }
  })();

  return schoolIndexPromise;
}

function scorePreNormalized(
  item: IndexedItem,
  query: string,
  bareQuery: string,
  tokens: string[]
): number {
  const n = item.norm;
  if (n === query) return 100;
  if (n.startsWith(query)) return 80;
  if (n.includes(query)) return 60;

  if (bareQuery) {
    const bn = item.bare;
    if (bn === bareQuery) return 95;
    if (bn.startsWith(bareQuery)) return 75;
    if (bn.includes(bareQuery)) return 55;
  }

  if (tokens.length > 1 && tokens.every((t) => n.includes(t))) return 50;
  return 0;
}

function searchThaiUnis(query: string, bareQuery: string, tokens: string[]): InstitutionHit[] {
  const matches: Array<{ item: IndexedItem; score: number }> = [];
  for (let i = 0; i < THAI_UNIS.length; i++) {
    const item = THAI_UNIS[i];
    const score = scorePreNormalized(item, query, bareQuery, tokens);
    if (score > 0) matches.push({ item, score });
  }
  matches.sort((a, b) => b.score - a.score || (a.item.name < b.item.name ? -1 : a.item.name > b.item.name ? 1 : 0));

  return matches.slice(0, 20).map(({ item }) => ({
    name: item.name,
    label: item.name,
    source: 'mhesi',
    type: 'university',
    province: item.province,
    country: 'Thailand',
  }));
}

async function searchThaiSchools(
  query: string,
  bareQuery: string,
  tokens: string[]
): Promise<InstitutionHit[]> {
  if (query.length < 2) return [];

  const { items, bigrams } = await getSchoolIndex();
  if (items.length === 0) return [];

  // เลือก bucket ที่เล็กที่สุดจาก bigrams ของคำค้น เพื่อหลีกเลี่ยง full scan 55,621 แถว
  const searchKey = bareQuery.length >= 2 ? bareQuery : query;
  let candidateIds: number[] | null = null;
  for (let k = 0; k < searchKey.length - 1; k++) {
    const bg = searchKey.slice(k, k + 2);
    if (bg.includes(' ')) continue;
    const bucket = bigrams.get(bg);
    if (!bucket) return []; // ไม่มีโรงเรียนใดมี bigram นี้เลย -> คืนว่างทันที O(1)
    if (candidateIds === null || bucket.length < candidateIds.length) {
      candidateIds = bucket;
    }
  }

  const matches: Array<{ item: IndexedItem; score: number }> = [];
  if (candidateIds) {
    for (let i = 0; i < candidateIds.length; i++) {
      const item = items[candidateIds[i]];
      const score = scorePreNormalized(item, query, bareQuery, tokens);
      if (score > 0) matches.push({ item, score });
    }
  } else {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const score = scorePreNormalized(item, query, bareQuery, tokens);
      if (score > 0) matches.push({ item, score });
    }
  }

  // เรียงตามคะแนน + ความยาวชื่อที่สั้นกว่าก่อน (เร็วกว่า ICU localeCompare หลายสิบเท่า)
  matches.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length);
  const top = matches.slice(0, 25);

  return top.map(({ item }) => ({
    name: item.name,
    label: item.name,
    source: 'moe' as const,
    type: 'school' as const,
    province: item.province,
    country: 'Thailand',
  }));
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
};

/**
 * GET /api/institutions/search?q=สงขลา&scope=th|schools|uni
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const scope = (req.nextUrl.searchParams.get('scope') || 'th').toLowerCase();

  if (q.length < 1) {
    return NextResponse.json({ items: [] as InstitutionHit[] }, { headers: CACHE_HEADERS });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 });
  }

  const query = normalize(q);
  const bareQuery = bareName(query);
  const tokens = query.split(' ').filter(Boolean);

  const wantThaiUnis =
    scope === 'th' || scope === 'all' || scope === 'thai' || scope === 'uni';
  const wantSchools =
    scope === 'th' ||
    scope === 'all' ||
    scope === 'thai' ||
    scope === 'schools' ||
    scope === 'school';

  const thaiUnis = wantThaiUnis ? searchThaiUnis(query, bareQuery, tokens) : [];
  const thaiSchools = wantSchools ? await searchThaiSchools(query, bareQuery, tokens) : [];

  const seen = new Set<string>();
  const items: InstitutionHit[] = [];
  for (const hit of [...thaiUnis, ...thaiSchools]) {
    const key = normalize(hit.name);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(hit);
    if (items.length >= 40) break;
  }

  return NextResponse.json(
    {
      items,
      meta: {
        q,
        scope,
        uniCount: thaiUnis.length,
        schoolCount: thaiSchools.length,
        sources: ['mhesi-open-data', 'moe-school68'],
        lang: 'th',
      },
    },
    { headers: CACHE_HEADERS }
  );
}
