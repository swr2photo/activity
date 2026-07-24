import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS,
  DYNAMIC_QR_CLAIM_TTL_SECONDS,
  DYNAMIC_QR_WINDOW_SECONDS,
  currentDynamicQrToken,
  getWindowIndex,
  makeDynamicQrClaim,
  makeDynamicQrToken,
  secondsUntilWindowEnd,
  verifyDynamicQrClaim,
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

  it('accepts current and recent previous windows only', () => {
    const windowMs = DYNAMIC_QR_WINDOW_SECONDS * 1000;
    const now = Date.parse('2026-07-20T04:00:30.000Z');
    const idx = getWindowIndex(now);
    const current = makeDynamicQrToken(secret, code, idx);
    const prev = makeDynamicQrToken(secret, code, idx - 1);
    const withinGrace = makeDynamicQrToken(
      secret,
      code,
      idx - DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS
    );
    const older = makeDynamicQrToken(
      secret,
      code,
      idx - DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS - 1
    );

    assert.equal(verifyDynamicQrToken(secret, code, current, now), true);
    assert.equal(verifyDynamicQrToken(secret, code, prev, now), true);
    assert.equal(verifyDynamicQrToken(secret, code, withinGrace, now), true);
    assert.equal(verifyDynamicQrToken(secret, code, older, now), false);
    assert.equal(verifyDynamicQrToken(secret, code, 'nope', now), false);

    // ข้ามไปเกินช่วงที่ยอมรับ — token เดิมต้องตก
    const later = now + windowMs * (DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS + 2);
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

  it('issues claim that survives past rolling windows but expires by TTL', () => {
    const now = Date.parse('2026-07-20T04:00:30.000Z');
    const idx = getWindowIndex(now);
    const dt = makeDynamicQrToken(secret, code, idx);
    const { claim, expiresAt } = makeDynamicQrClaim(secret, code, dt, now);

    assert.equal(expiresAt, now + DYNAMIC_QR_CLAIM_TTL_SECONDS * 1000);
    assert.equal(verifyDynamicQrClaim(secret, code, dt, claim, now), true);

    // ผ่านไปหลายรอบ Rolling แล้ว token เดิมใช้ไม่ได้ แต่ claim ยังใช้ได้
    const afterManyWindows = now + DYNAMIC_QR_WINDOW_SECONDS * 1000 * 20;
    assert.equal(verifyDynamicQrToken(secret, code, dt, afterManyWindows), false);
    assert.equal(verifyDynamicQrClaim(secret, code, dt, claim, afterManyWindows), true);

    // หมดอายุ claim
    const afterTtl = now + (DYNAMIC_QR_CLAIM_TTL_SECONDS + 1) * 1000;
    assert.equal(verifyDynamicQrClaim(secret, code, dt, claim, afterTtl), false);

    // claim ผูกกับ dt / activity
    assert.equal(verifyDynamicQrClaim(secret, code, 'other-token-xxx', claim, now), false);
    assert.equal(verifyDynamicQrClaim(secret, 'OTHERCODE', dt, claim, now), false);
  });
});
