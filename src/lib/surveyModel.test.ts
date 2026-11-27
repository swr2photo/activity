/**
 * Unit tests for D:\01-web-style survey model & validation helpers.
 * Run: node --experimental-strip-types --test src/lib/surveyModel.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAnswerForDisplay,
  getChoiceOptions,
  getLikertOptions,
  getOrderedSections,
  isSurveyAnswered,
  normalizeQuestionType,
  validateSurveyQuestion,
  type SurveyQuestion,
} from './surveyModel.ts';

describe('surveyModel', () => {
  it('normalizes legacy rating/choice types while keeping new types intact', () => {
    assert.equal(normalizeQuestionType('rating'), 'likert');
    assert.equal(normalizeQuestionType('choice'), 'single_select');
    assert.equal(normalizeQuestionType('multiple_select'), 'multiple_select');
    assert.equal(normalizeQuestionType('dropdown'), 'dropdown');
    assert.equal(normalizeQuestionType('date'), 'date');
  });

  it('generates default 1-5 rating options for legacy rating questions and custom likert scales', () => {
    const legacy: SurveyQuestion = { id: 'q1', type: 'rating', question: 'พอใจแค่ไหน' };
    const opts = getLikertOptions(legacy);
    assert.equal(opts.length, 5);
    assert.equal(opts[0].value, '1');
    assert.equal(opts[4].value, '5');

    const freq: SurveyQuestion = {
      id: 'q2',
      type: 'likert',
      question: 'ความถี่',
      presentation: { shape: 'circle', levels: 7, startFrom: 0 },
    };
    const freqOpts = getLikertOptions(freq);
    assert.equal(freqOpts.length, 7);
    assert.equal(freqOpts[0].value, '0');
    assert.equal(freqOpts[6].value, '6');
  });

  it('appends exclusive none and allowOther options cleanly', () => {
    const q: SurveyQuestion = {
      id: 'q3',
      type: 'multiple_select',
      question: 'ช่องทาง',
      options: ['Facebook', 'LINE'],
      exclusiveNone: true,
      allowOther: true,
    };
    const opts = getChoiceOptions(q);
    assert.deepEqual(
      opts.map((o) => o.value),
      ['Facebook', 'LINE', 'none', 'other']
    );
  });

  it('validates required, other specify text, email, number bounds, and legacy text rules', () => {
    const qMulti: SurveyQuestion = {
      id: 'qm',
      type: 'multiple_select',
      question: 'เลือก',
      required: true,
      allowOther: true,
    };
    assert.equal(isSurveyAnswered(qMulti, ['other'], ''), false);
    assert.equal(isSurveyAnswered(qMulti, ['other'], 'เพื่อนบอก'), true);
    assert.ok(validateSurveyQuestion(qMulti, ['other'], ''));
    assert.equal(validateSurveyQuestion(qMulti, ['other'], 'เพื่อนบอก'), null);

    const qEmail: SurveyQuestion = { id: 'qe', type: 'email', question: 'อีเมล', required: true };
    assert.ok(validateSurveyQuestion(qEmail, 'not-an-email'));
    assert.equal(validateSurveyQuestion(qEmail, 'user@psu.ac.th'), null);

    const qNum: SurveyQuestion = { id: 'qn', type: 'number', question: 'อายุ', min: 10, max: 99 };
    assert.ok(validateSurveyQuestion(qNum, '5'));
    assert.equal(validateSurveyQuestion(qNum, '21'), null);

    const qText: SurveyQuestion = {
      id: 'qt',
      type: 'text',
      question: 'รหัส',
      prefix: '67',
      validationType: 'number',
      allowSpaces: false,
    };
    assert.ok(validateSurveyQuestion(qText, '66123'));
    assert.equal(validateSurveyQuestion(qText, '6710210001'), null);
  });

  it('formats answers for CSV/UI and falls back to single default section when none defined', () => {
    const q: SurveyQuestion = {
      id: 'qm',
      type: 'multiple_select',
      question: 'ช่องทาง',
      options: ['Facebook'],
      allowOther: true,
    };
    assert.equal(formatAnswerForDisplay(q, ['Facebook', 'other'], 'เว็บคณะ'), 'Facebook, อื่น ๆ: เว็บคณะ');

    const sections = getOrderedSections({
      title: 'ประเมินกิจกรรม',
      questions: [{ id: 'q1', type: 'text', question: 'ข้อ 1' }],
    });
    assert.equal(sections.length, 1);
    assert.equal(sections[0].label, 'ประเมินกิจกรรม');
  });
});
