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

  it('opens after activity end within openMinutes', () => {
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

  it('expires after openMinutes', () => {
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

  it('not_started before activity end', () => {
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
