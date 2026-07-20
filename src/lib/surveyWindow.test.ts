/**
 * Smoke tests for survey window helpers (Node built-in test runner).
 * Run: node --experimental-strip-types --test src/lib/surveyWindow.test.ts
 *   or: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  forceOpenUntilFromHours,
  getSurveyWindowStatus,
  resolveActivityEndTime,
  surveyStatusLabelTh,
} from './surveyWindow.ts';

describe('surveyWindow', () => {
  const end = new Date('2026-07-16T12:00:00+07:00');

  it('resolves latest session end time', () => {
    const t = resolveActivityEndTime({
      sessions: [
        { endDateTime: new Date('2026-07-16T10:00:00+07:00') },
        { endDateTime: new Date('2026-07-16T14:00:00+07:00') },
      ],
    });
    assert.equal(t?.toISOString(), new Date('2026-07-16T14:00:00+07:00').toISOString());
  });

  it('opens after activity end within openMinutes (legacy)', () => {
    const now = new Date(end.getTime() + 30 * 60 * 1000);
    const s = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 2,
      surveyOpenMinutes: 60,
      endDateTime: end,
      now,
    });
    assert.equal(s.open, true);
    assert.equal(s.label, 'open');
  });

  it('expires after openMinutes (legacy)', () => {
    const now = new Date(end.getTime() + 2 * 60 * 60 * 1000);
    const s = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      surveyOpenMinutes: 60,
      endDateTime: end,
      now,
    });
    assert.equal(s.open, false);
    assert.equal(s.expired, true);
    assert.equal(s.label, 'expired');
    assert.match(surveyStatusLabelTh(s), /หมดเวลา/);
  });

  it('uses explicit openAt/closeAt', () => {
    const openAt = new Date('2026-07-17T09:00:00+07:00');
    const closeAt = new Date('2026-07-17T18:00:00+07:00');
    const s = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      openAt,
      closeAt,
      endDateTime: end,
      now: new Date('2026-07-17T12:00:00+07:00'),
    });
    assert.equal(s.open, true);
    assert.equal(s.label, 'open');
    assert.equal(s.openTime?.toISOString(), openAt.toISOString());
    assert.equal(s.closeTime?.toISOString(), closeAt.toISOString());
  });

  it('not_started before explicit openAt', () => {
    const openAt = new Date('2026-07-17T09:00:00+07:00');
    const closeAt = new Date('2026-07-17T18:00:00+07:00');
    const s = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      openAt,
      closeAt,
      now: new Date('2026-07-17T08:00:00+07:00'),
    });
    assert.equal(s.notStarted, true);
    assert.equal(s.open, false);
    assert.equal(s.label, 'not_started');
  });

  it('forceOpenUntil reopens expired window', () => {
    const now = new Date(end.getTime() + 5 * 60 * 60 * 1000);
    const force = forceOpenUntilFromHours(24, now);
    const s = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      surveyOpenMinutes: 60,
      endDateTime: end,
      forceOpenUntil: force,
      now,
    });
    assert.equal(s.open, true);
    assert.equal(s.label, 'forced_open');
  });

  it('userForceOpenUntil opens for that user only', () => {
    const now = new Date('2026-07-20T12:00:00+07:00');
    const closeAt = new Date('2026-07-18T12:00:00+07:00');
    const openAt = new Date('2026-07-17T09:00:00+07:00');
    const until = forceOpenUntilFromHours(48, now);

    const forUser = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      openAt,
      closeAt,
      userForceOpenUntil: { 'uid-a': until },
      userId: 'uid-a',
      now,
    });
    assert.equal(forUser.open, true);
    assert.equal(forUser.userForced, true);
    assert.equal(forUser.label, 'forced_open');
    assert.match(surveyStatusLabelTh(forUser), /รายบุคคล/);

    const other = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      openAt,
      closeAt,
      userForceOpenUntil: { 'uid-a': until },
      userId: 'uid-b',
      now,
    });
    assert.equal(other.open, false);
    assert.equal(other.expired, true);
  });

  it('not_started before activity end (legacy)', () => {
    const now = new Date(end.getTime() - 60 * 1000);
    const s = getSurveyWindowStatus({
      enabled: true,
      questionsLength: 1,
      surveyOpenMinutes: 1440,
      endDateTime: end,
      now,
    });
    assert.equal(s.notStarted, true);
    assert.equal(s.open, false);
    assert.equal(s.label, 'not_started');
  });
});
