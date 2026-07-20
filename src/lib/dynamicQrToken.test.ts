import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DYNAMIC_QR_WINDOW_SECONDS,
  currentDynamicQrToken,
  getWindowIndex,
  makeDynamicQrToken,
  secondsUntilWindowEnd,
  verifyDynamicQrToken,
} from './dynamicQrToken.ts';

describe('dynamicQrToken', () => {
  const secret = 'test-secret-at-least-16';
  const code = 'ACTDEMO01';

  it('makes stable tokens for the same window', () => {
    const t0 = Date.parse('2026-07-20T04:00:00.000Z');
    const a = makeDynamicQrToken(secret, code, getWindowIndex(t0));
    const b = makeDynamicQrToken(secret, code.toLowerCase(), getWindowIndex(t0));
    assert.equal(a, b);
    assert.equal(a.length, 16);
  });

  it('accepts current and previous window only', () => {
    const windowMs = DYNAMIC_QR_WINDOW_SECONDS * 1000;
    const now = Date.parse('2026-07-20T04:00:30.000Z');
    const idx = getWindowIndex(now);
    const current = makeDynamicQrToken(secret, code, idx);
    const prev = makeDynamicQrToken(secret, code, idx - 1);
    const older = makeDynamicQrToken(secret, code, idx - 2);

    assert.equal(verifyDynamicQrToken(secret, code, current, now), true);
    assert.equal(verifyDynamicQrToken(secret, code, prev, now), true);
    assert.equal(verifyDynamicQrToken(secret, code, older, now), false);
    assert.equal(verifyDynamicQrToken(secret, code, 'nope', now), false);

    // ข้ามไปหน้าต่างถัดไป — token เก่ากว่า 2 ช่วงต้องตก
    const later = now + windowMs * 2;
    assert.equal(verifyDynamicQrToken(secret, code, current, later), false);
  });

  it('reports expiresIn within the window', () => {
    const now = Date.parse('2026-07-20T04:00:00.000Z');
    assert.equal(secondsUntilWindowEnd(now), DYNAMIC_QR_WINDOW_SECONDS);
    const mid = now + 10_000;
    assert.equal(secondsUntilWindowEnd(mid), DYNAMIC_QR_WINDOW_SECONDS - 10);

    const cur = currentDynamicQrToken(secret, code, mid);
    assert.equal(cur.expiresIn, DYNAMIC_QR_WINDOW_SECONDS - 10);
    assert.equal(verifyDynamicQrToken(secret, code, cur.token, mid), true);
  });
});
