/**
 * Unit tests for base64 -> Storage media migration core helpers.
 * Run: node --experimental-strip-types --test src/lib/mediaMigrationCore.test.ts
 *   or: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  base64Bytes,
  buildDownloadUrl,
  classifyStorageError,
  findDataUrls,
  parseDataUrl,
  replaceDataUrls,
} from './mediaMigrationCore.ts';

describe('mediaMigrationCore', () => {
  // 0xb0 ในไบต์แรกของกลุ่ม 3 ไบต์ → ตัวอักษร 's' ใน base64 (0b101100 = 44)
  const samplePayload = Buffer.from([0xff, 0xd8, 0xff, 0xb0, 0x00, 0x01, 0xb0, 0x22, 0x33, 0x73, 0x74]);
  const sampleB64 = samplePayload.toString('base64');
  const sampleDataUrl = `data:image/jpeg;base64,${sampleB64}`;

  it('decodes base64 intact without stripping lowercase "s" characters', () => {
    assert.ok(sampleB64.includes('s'), 'test fixture should contain lowercase "s" in base64');
    const parsed = parseDataUrl(sampleDataUrl);
    assert.ok(parsed);
    assert.equal(parsed.mime, 'image/jpeg');
    assert.deepEqual(parsed.buffer, samplePayload);
  });

  it('strips whitespace/newlines from base64 and handles charset parameters', () => {
    const wrapped = `  data:image/png;charset=utf-8;base64,${sampleB64.slice(0, 12)}\n  ${sampleB64.slice(12)}  `;
    const parsed = parseDataUrl(wrapped);
    assert.ok(parsed);
    assert.equal(parsed.mime, 'image/png');
    assert.deepEqual(parsed.buffer, samplePayload);
    assert.equal(base64Bytes(sampleB64), samplePayload.length);
  });

  it('rejects non-base64 or empty data URLs', () => {
    assert.equal(parseDataUrl('https://example.com/banner.jpg'), null);
    assert.equal(parseDataUrl('data:image/jpeg;base64,'), null);
    assert.equal(parseDataUrl('data:text/plain,hello'), null);
  });

  it('finds direct, nested, and inline HTML data URLs while ignoring normal URLs and non-plain objects', () => {
    const fakeTimestamp = new Date('2026-07-16T12:00:00Z');
    const doc = {
      bannerUrl: sampleDataUrl,
      dynamicQrBgUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/ok.jpg',
      description: `<p>Hello</p><img src="${sampleDataUrl}" alt="pic" />`,
      files: [
        { id: '1', url: sampleDataUrl },
        { id: '2', url: 'https://example.com/doc.pdf' },
      ],
      sessions: [
        {
          id: 's1',
          startDateTime: fakeTimestamp,
          files: [{ id: 'f1', url: sampleDataUrl }],
        },
      ],
    };

    const found = findDataUrls(doc);
    assert.equal(found.length, 4);
    assert.deepEqual(
      found.map((f) => f.field),
      ['bannerUrl', 'description', 'files', 'sessions']
    );
    assert.equal(found[0].bytes, samplePayload.length);
    assert.equal(found[1].path, 'description<inline>');
  });

  it('replaces direct and inline data URLs without mutating input or non-plain objects', async () => {
    const ts = new Date('2026-07-16T12:00:00Z');
    const original = {
      bannerUrl: sampleDataUrl,
      description: `<img src="${sampleDataUrl}" /><div style="background:url('${sampleDataUrl}')"></div>`,
      sessions: [{ startDateTime: ts, files: [{ url: sampleDataUrl }] }],
    };

    let count = 0;
    const replaced = (await replaceDataUrls(
      original,
      async (_dataUrl, mime, hint) => {
        count++;
        // ใส่ $& ใน URL เพื่อทดสอบว่า .replace ไม่ตีความผิด
        return `https://firebasestorage.googleapis.com/v0/b/b/o/${hint}_${count}.${mime.split('/')[1]}?alt=media&token=t$&`;
      },
      'doc'
    )) as typeof original;

    assert.equal(count, 4);
    assert.ok(replaced.bannerUrl.startsWith('https://firebasestorage.googleapis.com/'));
    assert.ok(replaced.bannerUrl.includes('token=t$&'));
    assert.ok(!replaced.description.includes('data:image/'));
    assert.equal(replaced.description.match(/https:\/\/firebasestorage\.googleapis\.com/g)?.length, 2);
    assert.strictEqual(replaced.sessions[0].startDateTime, ts);
    // ไม่แก้ข้อมูลต้นฉบับ
    assert.equal(original.bannerUrl, sampleDataUrl);
  });

  it('builds Firebase Storage download URLs properly', () => {
    const url = buildDownloadUrl('my-bucket.appspot.com', 'migrated/activityQRCodes/abc/bannerUrl_123.jpg', 'tok-1');
    assert.equal(
      url,
      'https://firebasestorage.googleapis.com/v0/b/my-bucket.appspot.com/o/migrated%2FactivityQRCodes%2Fabc%2FbannerUrl_123.jpg?alt=media&token=tok-1'
    );
  });

  it('ignores generated qrUrl/qrCode fields by default and classifies storage billing errors', () => {
    const found = findDataUrls({
      qrUrl: sampleDataUrl,
      qrCode: sampleDataUrl,
      bannerUrl: sampleDataUrl,
    });
    assert.equal(found.length, 1);
    assert.equal(found[0].field, 'bannerUrl');

    assert.equal(
      classifyStorageError('The billing account for the owning project is disabled in state closed').kind,
      'billing_disabled'
    );
    assert.equal(classifyStorageError('storage/quota-exceeded').kind, 'quota_exceeded');
    assert.equal(classifyStorageError('403 Forbidden permission denied').kind, 'permission_denied');
  });
});
