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
import {
  buildGeneratedUsername,
  chooseAvailableGeneratedUsername,
  normalizeGeneratedUsernameBase,
} from '../shared/username';
import { chooseIdentityProvisioningAction } from '../shared/identityPolicy';
import {
  canReuseFriendLink,
  decideFriendLinkAcceptance,
  normalizeSocialCode,
  orderFriendshipPair,
} from '../shared/socialPolicy';
import {
  getCompatibilityPlayerName,
  LEGACY_GUEST_LABEL,
  resolveChallengeIdentity,
} from '../netlify/functions/lib/challengeIdentity';

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

test('generates deterministic valid usernames from verified email prefixes', () => {
  assert.equal(normalizeGeneratedUsernameBase('Liam.Barker+test@example.com'), 'liam_barker_test');
  assert.equal(normalizeGeneratedUsernameBase('é@example.com'), 'player');
  assert.equal(
    buildGeneratedUsername('Very.Long.Email.Prefix@example.com', 'ABCDEF123456'),
    'very_long_e_abcdef12'
  );
});

test('uses the next deterministic generated username after a collision', async () => {
  const first = buildGeneratedUsername('player@example.com', '11111111');
  const selected = await chooseAvailableGeneratedUsername(
    'player@example.com',
    ['11111111', '22222222'],
    async (candidate) => candidate === first
  );

  assert.equal(selected, 'player_22222222');
});

test('keeps incomplete signup onboarding blocking across later restores', () => {
  assert.equal(
    chooseIdentityProvisioningAction({
      hasUserRow: false,
      hasUsername: false,
      intent: 'signup',
    }),
    'require_username'
  );
  assert.equal(
    chooseIdentityProvisioningAction({
      hasUserRow: true,
      hasUsername: false,
      onboardingStatus: 'username_required',
      intent: 'restore',
    }),
    'require_username'
  );
  assert.equal(
    chooseIdentityProvisioningAction({
      hasUserRow: false,
      hasUsername: false,
      intent: 'login',
    }),
    'generate_username'
  );
});

test('orders mutual friendships and reuses only active reusable links', () => {
  assert.deepEqual(orderFriendshipPair('auth0|z', 'auth0|a'), [
    'auth0|a',
    'auth0|z',
  ]);
  assert.equal(normalizeSocialCode(' abcd2345 '), 'ABCD2345');
  assert.equal(
    canReuseFriendLink({
      isReusable: true,
      expiresAt: '2026-07-26T12:00:00.000Z',
      now: new Date('2026-07-25T12:00:00.000Z'),
    }),
    true
  );
  assert.equal(
    canReuseFriendLink({
      isReusable: false,
      expiresAt: '2026-07-26T12:00:00.000Z',
      now: new Date('2026-07-25T12:00:00.000Z'),
    }),
    false
  );
  assert.equal(
    canReuseFriendLink({
      isReusable: true,
      expiresAt: '2026-07-24T12:00:00.000Z',
      now: new Date('2026-07-25T12:00:00.000Z'),
    }),
    false
  );

  assert.equal(
    decideFriendLinkAcceptance({
      isExpired: false,
      isSelf: false,
      alreadyFriends: false,
      isReusable: true,
      usedBy: null,
    }),
    'create_friendship'
  );
  assert.equal(
    decideFriendLinkAcceptance({
      isExpired: false,
      isSelf: false,
      alreadyFriends: true,
      isReusable: false,
      usedBy: 'auth0|someone-else',
    }),
    'already_friends'
  );
  assert.equal(
    decideFriendLinkAcceptance({
      isExpired: false,
      isSelf: false,
      alreadyFriends: false,
      isReusable: false,
      usedBy: 'auth0|first-user',
    }),
    'used_legacy'
  );
  assert.equal(
    decideFriendLinkAcceptance({
      isExpired: true,
      isSelf: false,
      alreadyFriends: false,
      isReusable: true,
      usedBy: null,
    }),
    'expired'
  );
});

test('uses current challenge usernames and labels legacy guest history', () => {
  const current = resolveChallengeIdentity(
    'auth0|player',
    'current_name',
    'old_name'
  );
  assert.equal(current?.username, 'current_name');
  assert.equal(getCompatibilityPlayerName(current), 'current_name');

  const legacyGuest = resolveChallengeIdentity(
    'guest_123',
    null,
    null
  );
  assert.equal(legacyGuest?.username, null);
  assert.equal(legacyGuest?.isLegacyGuest, true);
  assert.equal(legacyGuest?.legacyLabel, LEGACY_GUEST_LABEL);
  assert.equal(getCompatibilityPlayerName(legacyGuest), LEGACY_GUEST_LABEL);
});
