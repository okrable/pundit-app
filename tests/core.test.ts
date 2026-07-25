import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuizPoints } from '../shared/scoring';
import { validateSubmittedAnswers } from '../shared/submissionValidation';
import { chooseReconciliationSource } from '../shared/reconciliation';
import {
  buildShareUrl,
  getSharedCodeActionFromUrl,
  resolveSharedCode,
} from '../app/services/sharedCode';
import { getSiteUrl } from '../netlify/functions/lib/siteUrl';
import { getQuizDate } from '../app/utils/quizDate';

test('scores answers consistently across timer boundaries', () => {
  assert.equal(calculateQuizPoints(undefined), 60);
  assert.equal(calculateQuizPoints(16_000), 100);
  assert.equal(calculateQuizPoints(12_000), 80);
  assert.equal(calculateQuizPoints(8_000), 60);
  assert.equal(calculateQuizPoints(4_000), 40);
  assert.equal(calculateQuizPoints(0), 20);
});

test('validates answer shape, bounds, and duplicates', () => {
  const valid = [
    { questionId: 'q1', selectedOptionIndex: 0, timeRemainingMs: 20_000 },
    { questionId: 'q2', selectedOptionIndex: 3, timeRemainingMs: 0 },
  ];

  assert.equal(validateSubmittedAnswers(valid), null);
  assert.match(validateSubmittedAnswers('bad') || '', /array/);
  assert.match(
    validateSubmittedAnswers([...valid, valid[0]]) || '',
    /Duplicate/
  );
  assert.match(
    validateSubmittedAnswers([{ questionId: 'q1', selectedOptionIndex: 4 }]) || '',
    /between 0 and 3/
  );
});

test('uses local, server, then guest state for reconciliation', () => {
  assert.equal(
    chooseReconciliationSource({
      hasLocalResult: true,
      hasServerResult: true,
      hasGuestResult: true,
    }),
    'local'
  );
  assert.equal(
    chooseReconciliationSource({
      hasLocalResult: false,
      hasServerResult: true,
      hasGuestResult: true,
    }),
    'server'
  );
  assert.equal(
    chooseReconciliationSource({
      hasLocalResult: false,
      hasServerResult: false,
      hasGuestResult: true,
    }),
    'guest'
  );
  assert.equal(
    chooseReconciliationSource({
      hasLocalResult: false,
      hasServerResult: false,
      hasGuestResult: false,
    }),
    'none'
  );
});

test('resolves challenge and friend codes from text and URLs', () => {
  assert.equal(resolveSharedCode('ABC234').kind, 'challenge');
  assert.equal(resolveSharedCode('ABCD2345').kind, 'friendInvite');
  assert.equal(
    getSharedCodeActionFromUrl('https://pundittrivia.com/c/ABC234')?.kind,
    'challenge'
  );
  assert.equal(
    getSharedCodeActionFromUrl('https://pundittrivia.com/f/ABCD2345')?.kind,
    'friendInvite'
  );
  assert.equal(
    buildShareUrl('c', 'abc-234', 'https://preview.example/'),
    'https://preview.example/c/ABC234'
  );
});

test('uses the deploy URL for previews and primary URL for production', () => {
  assert.equal(
    getSiteUrl({
      CONTEXT: 'deploy-preview',
      URL: 'https://pundittrivia.com',
      DEPLOY_PRIME_URL: 'https://deploy-preview-12--pundit.netlify.app',
    }),
    'https://deploy-preview-12--pundit.netlify.app'
  );
  assert.equal(
    getSiteUrl({
      CONTEXT: 'production',
      URL: 'https://pundittrivia.com',
      DEPLOY_PRIME_URL: 'https://main--pundit.netlify.app',
    }),
    'https://pundittrivia.com'
  );
});

test('formats quiz dates in the configured timezone', () => {
  assert.equal(
    getQuizDate(new Date('2026-07-25T12:00:00.000Z')),
    '2026-07-25'
  );
  assert.equal(
    getQuizDate(new Date('2026-07-24T23:30:00.000Z')),
    '2026-07-25'
  );
});
