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
import {
  chooseIdentityProvisioningAction,
  chooseUsernameAssignmentAction,
} from '../shared/identityPolicy';
import { isCacheSchemaCurrent } from '../shared/cachePolicy';
import { formatPublicPlayerName } from '../app/utils/publicIdentity';
import {
  buildIdentityActivationKey,
  canProcessProtectedAction,
  isIdentityActivationCurrent,
  resolveStoredIdentityStatus,
  shouldBlockAuthenticatedNavigation,
  shouldShowIdentityFailure,
  shouldShowIdentitySync,
  shouldShowUsernameOnboarding,
} from '../shared/clientIdentityPolicy';
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
import {
  buildStreakStatus,
  calculateStreakProjection,
  projectStreakAfterPlay,
} from '../shared/streak';
import {
  isQuizSubmissionCurrent,
  isTransientQuizSubmissionFailure,
} from '../shared/quizSync';
import {
  matchesCareerAnswer,
  normalizeCareerAnswer,
} from '../shared/careerAnswer';
import { getCareerGameForDate } from '../netlify/functions/lib/careerGame';
import { buildDailyQuizResponse } from '../netlify/functions/lib/dailyQuizResponse';
import { getGamesHubCompletionState } from '../shared/gamesHub';
import {
  getNativeTabsFallbackReason,
  selectMainNavigator,
} from '../shared/navigationPolicy';

test('scores answers consistently across timer boundaries', () => {
  assert.equal(calculateQuizPoints(undefined), 60);
  assert.equal(calculateQuizPoints(16_000), 100);
  assert.equal(calculateQuizPoints(12_000), 80);
  assert.equal(calculateQuizPoints(8_000), 60);
  assert.equal(calculateQuizPoints(4_000), 40);
  assert.equal(calculateQuizPoints(0), 20);
});

test('matches career answers with configured names and conservative spelling tolerance', () => {
  const answerKey = {
    canonicalName: 'Anthony Gordon',
    acceptedAliases: ['Anthony M. Gordon'],
    acceptedSurnames: ['Gordon', 'Van der Vaart'],
  };

  assert.equal(normalizeCareerAnswer('  ÁNTHONY-GORDON  '), 'anthony gordon');
  assert.equal(matchesCareerAnswer('Anthony Gordon', answerKey), true);
  assert.equal(matchesCareerAnswer('gordon', answerKey), true);
  assert.equal(matchesCareerAnswer('van-der-vaart', answerKey), true);
  assert.equal(matchesCareerAnswer('Anthony Gordn', answerKey), true);
  assert.equal(matchesCareerAnswer('Gordn', answerKey), false);
  assert.equal(matchesCareerAnswer('Anthony Jordan', answerKey), false);
  assert.equal(matchesCareerAnswer('   ', answerKey), false);
});

test('returns the temporary Anthony Gordon career fixture in display order', async () => {
  const game = await getCareerGameForDate('2026-07-27', 'uk');

  assert.equal(game.id, 'career-2026-07-27');
  assert.equal(game.date, '2026-07-27');
  assert.equal(game.number, undefined);
  assert.equal(game.canonicalName, 'Anthony Gordon');
  assert.deepEqual(game.acceptedSurnames, ['Gordon']);
  assert.deepEqual(
    game.career.map((row) => [
      row.years,
      row.team,
      row.appearances,
      row.goals,
      row.category,
      row.rank,
    ]),
    [
      ['2017–2023', 'Everton', 65, 7, 'Domestic', 1],
      ['2021', '→ Preston North End (loan)', 11, 0, 'Domestic', 2],
      ['2023–2026', 'Newcastle United', 111, 24, 'Domestic', 3],
      ['2026–', 'Barcelona', 0, 0, 'Domestic', 4],
    ]
  );
});

test('adds the career game without changing daily quiz root fields', async () => {
  const careerGame = await getCareerGameForDate('2026-07-27', 'uk');
  const response = buildDailyQuizResponse(
    '2026-07-27',
    [
      {
        question_id: 'question-1',
        question: 'Who is this player?',
        player_name: 'Correct Player',
        player_0: 'First Player',
        player_1: 'Correct Player',
        player_2: 'Third Player',
        player_3: 'Fourth Player',
      },
    ],
    careerGame
  );

  assert.equal(response.id, 'quiz-2026-07-27');
  assert.equal(response.date, '2026-07-27');
  assert.deepEqual(response.questions, [
    {
      id: 'question-1',
      prompt: 'Who is this player?',
      options: [
        'First Player',
        'Correct Player',
        'Third Player',
        'Fourth Player',
      ],
      correctOptionIndex: 1,
    },
  ]);
  assert.equal(response.careerGame, careerGame);
});

test('keeps daily quiz and career completion states independent', () => {
  assert.deepEqual(getGamesHubCompletionState(false, false), {
    quiz: 'available',
    career: 'available',
  });
  assert.deepEqual(getGamesHubCompletionState(true, false), {
    quiz: 'completed',
    career: 'available',
  });
  assert.deepEqual(getGamesHubCompletionState(false, true), {
    quiz: 'available',
    career: 'completed',
  });
  assert.deepEqual(getGamesHubCompletionState(true, true), {
    quiz: 'completed',
    career: 'completed',
  });
});

test('selects the platform navigator and safely falls back when native tabs are unavailable', () => {
  assert.equal(
    selectMainNavigator({
      platform: 'web',
      isExpoGo: false,
      hasNativeTabsHost: true,
    }),
    'web-drawer'
  );
  assert.equal(
    selectMainNavigator({
      platform: 'android',
      isExpoGo: false,
      hasNativeTabsHost: true,
    }),
    'js-tabs'
  );
  assert.equal(
    selectMainNavigator({
      platform: 'ios',
      isExpoGo: false,
      hasNativeTabsHost: true,
    }),
    'ios-native-tabs'
  );
  assert.equal(
    selectMainNavigator({
      platform: 'ios',
      isExpoGo: true,
      hasNativeTabsHost: true,
    }),
    'js-tabs'
  );
  assert.equal(
    getNativeTabsFallbackReason({
      platform: 'ios',
      isExpoGo: true,
      hasNativeTabsHost: true,
    }),
    'expo-go'
  );
  assert.equal(
    selectMainNavigator({
      platform: 'ios',
      isExpoGo: false,
      hasNativeTabsHost: false,
    }),
    'js-tabs'
  );
  assert.equal(
    getNativeTabsFallbackReason({
      platform: 'ios',
      isExpoGo: false,
      hasNativeTabsHost: false,
    }),
    'tabs-host-unavailable'
  );
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
  assert.equal(
    chooseIdentityProvisioningAction({
      hasUserRow: false,
      hasUsername: false,
      intent: 'restore',
    }),
    'generate_username'
  );
});

test('makes username assignment creation-only and retry-safe', () => {
  assert.equal(
    chooseUsernameAssignmentAction({
      currentUsername: null,
      requestedUsername: 'new_player',
      onboardingStatus: 'username_required',
    }),
    'assign'
  );
  assert.equal(
    chooseUsernameAssignmentAction({
      currentUsername: 'fixed_player',
      requestedUsername: 'fixed_player',
      onboardingStatus: 'complete',
    }),
    'idempotent'
  );
  assert.equal(
    chooseUsernameAssignmentAction({
      currentUsername: 'fixed_player',
      requestedUsername: 'changed_player',
      onboardingStatus: 'complete',
    }),
    'immutable'
  );
});

test('restores and gates authenticated identity before protected work', () => {
  assert.equal(resolveStoredIdentityStatus({}), 'unknown');
  assert.equal(
    resolveStoredIdentityStatus({ onboardingStatus: 'username_required' }),
    'username_required'
  );
  assert.equal(
    resolveStoredIdentityStatus({
      username: 'complete_player',
      onboardingStatus: 'complete',
    }),
    'complete'
  );
  assert.equal(shouldBlockAuthenticatedNavigation(true, 'username_required'), true);
  assert.equal(shouldBlockAuthenticatedNavigation(true, 'failed'), true);
  assert.equal(shouldBlockAuthenticatedNavigation(true, 'complete'), false);
  assert.equal(shouldBlockAuthenticatedNavigation(false, 'unknown'), false);
  assert.equal(canProcessProtectedAction(true, 'complete'), true);
  assert.equal(canProcessProtectedAction(true, 'syncing'), false);
  assert.equal(shouldShowUsernameOnboarding(true, 'username_required'), true);
  assert.equal(shouldShowUsernameOnboarding(true, 'syncing'), false);
  assert.equal(shouldShowIdentitySync(true, 'unknown', 'idle'), true);
  assert.equal(shouldShowIdentitySync(true, 'complete', 'syncing'), true);
  assert.equal(shouldShowIdentityFailure(true, 'failed', 'idle'), true);
  assert.equal(shouldShowIdentityFailure(true, 'complete', 'failed'), true);
  assert.equal(buildIdentityActivationKey('auth0|player', 4), 'auth0|player:4');
  assert.notEqual(
    buildIdentityActivationKey('auth0|player', 4),
    buildIdentityActivationKey('auth0|player', 5)
  );
  assert.equal(
    isIdentityActivationCurrent('auth0|player', 4, {
      userId: 'auth0|player',
      token: 'token',
      isAuthenticated: true,
      authStateVersion: 4,
    }),
    true
  );
  assert.equal(
    isIdentityActivationCurrent('auth0|player', 4, {
      userId: 'auth0|other',
      token: 'token',
      isAuthenticated: true,
      authStateVersion: 4,
    }),
    false
  );
  assert.equal(
    isIdentityActivationCurrent('auth0|player', 4, {
      userId: 'auth0|player',
      token: null,
      isAuthenticated: true,
      authStateVersion: 4,
    }),
    false
  );
  assert.equal(
    isIdentityActivationCurrent('auth0|player', 4, {
      userId: 'auth0|player',
      token: 'token',
      isAuthenticated: true,
      authStateVersion: 5,
    }),
    false
  );
});

test('projects an immediate post-play streak from date-aware state', () => {
  assert.equal(
    projectStreakAfterPlay({
      current: 3,
      state: 'at_risk',
      lastPlayedDate: '2026-07-25',
      asOfQuizDate: '2026-07-26',
    }),
    4
  );
  assert.equal(
    projectStreakAfterPlay({
      current: 3,
      state: 'active_today',
      lastPlayedDate: '2026-07-26',
      asOfQuizDate: '2026-07-26',
    }),
    3
  );
  assert.equal(
    projectStreakAfterPlay({
      current: 0,
      state: 'inactive',
      lastPlayedDate: '2026-07-20',
      asOfQuizDate: '2026-07-26',
    }),
    1
  );
  assert.equal(
    projectStreakAfterPlay({
      current: 0,
      state: 'not_started',
      lastPlayedDate: null,
      asOfQuizDate: '2026-07-26',
    }),
    1
  );
});

test('retries only transient quiz submission failures', () => {
  assert.equal(isTransientQuizSubmissionFailure(undefined), true);
  assert.equal(isTransientQuizSubmissionFailure(408), true);
  assert.equal(isTransientQuizSubmissionFailure(500), true);
  assert.equal(isTransientQuizSubmissionFailure(503), true);
  assert.equal(isTransientQuizSubmissionFailure(400), false);
  assert.equal(isTransientQuizSubmissionFailure(401), false);
  assert.equal(isTransientQuizSubmissionFailure(429), false);
  assert.equal(
    isQuizSubmissionCurrent(
      'auth0|player',
      'quiz-today',
      'auth0|player',
      'quiz-today'
    ),
    true
  );
  assert.equal(
    isQuizSubmissionCurrent(
      'auth0|player',
      'quiz-today',
      'auth0|other',
      'quiz-today'
    ),
    false
  );
  assert.equal(
    isQuizSubmissionCurrent(
      'auth0|player',
      'quiz-today',
      'auth0|player',
      'quiz-newer'
    ),
    false
  );
});

test('formats only canonical usernames or explicit legacy labels', () => {
  assert.equal(formatPublicPlayerName('liam', null), 'liam');
  assert.equal(formatPublicPlayerName(null, 'Legacy guest'), 'Legacy guest');
  assert.equal(formatPublicPlayerName(null, null, 'Opponent'), 'Opponent');
});

test('compares resource cache schemas without cross-resource assumptions', () => {
  assert.equal(isCacheSchemaCurrent(1, 1), true);
  assert.equal(isCacheSchemaCurrent(1, 2), false);
  assert.equal(isCacheSchemaCurrent(2, 2), true);
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

test('calculates current streak projections from distinct result dates', () => {
  assert.deepEqual(calculateStreakProjection([]), {
    runLength: 0,
    lastPlayedDate: null,
  });
  assert.deepEqual(calculateStreakProjection(['2026-07-25']), {
    runLength: 1,
    lastPlayedDate: '2026-07-25',
  });
  assert.deepEqual(
    calculateStreakProjection([
      '2026-07-23',
      '2026-07-25',
      '2026-07-24',
      '2026-07-25',
      '2026-07-20',
    ]),
    {
      runLength: 3,
      lastPlayedDate: '2026-07-25',
    }
  );
  assert.deepEqual(
    calculateStreakProjection(['2026-01-01', '2025-12-31', '2025-12-30']),
    {
      runLength: 3,
      lastPlayedDate: '2026-01-01',
    }
  );
});

test('classifies active, at-risk, inactive, and not-started streaks', () => {
  assert.deepEqual(
    buildStreakStatus(
      { runLength: 0, lastPlayedDate: null },
      '2026-07-25'
    ),
    {
      current: 0,
      state: 'not_started',
      lastPlayedDate: null,
      asOfQuizDate: '2026-07-25',
    }
  );
  assert.equal(
    buildStreakStatus(
      { runLength: 4, lastPlayedDate: '2026-07-25' },
      '2026-07-25'
    ).state,
    'active_today'
  );
  assert.deepEqual(
    buildStreakStatus(
      { runLength: 4, lastPlayedDate: '2026-07-24' },
      '2026-07-25'
    ),
    {
      current: 4,
      state: 'at_risk',
      lastPlayedDate: '2026-07-24',
      asOfQuizDate: '2026-07-25',
    }
  );
  assert.deepEqual(
    buildStreakStatus(
      { runLength: 8, lastPlayedDate: '2026-07-23' },
      '2026-07-25'
    ),
    {
      current: 0,
      state: 'inactive',
      lastPlayedDate: '2026-07-23',
      asOfQuizDate: '2026-07-25',
    }
  );
});
