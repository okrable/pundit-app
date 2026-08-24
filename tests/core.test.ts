import test from 'node:test';
import assert from 'node:assert/strict';
import type { Query } from '@google-cloud/bigquery';
import { calculateQuizPoints } from '../shared/scoring';
import { validateSubmittedAnswers } from '../shared/submissionValidation';
import { chooseReconciliationSource } from '../shared/reconciliation';
import {
  buildShareUrl,
  getSharedCodeActionFromUrl,
  getWebSharedCodeUrlReplacement,
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
  shouldFailIdentityAfterActivationError,
  shouldShowIdentityFailure,
  shouldShowIdentitySync,
  shouldShowUsernameOnboarding,
  shouldResumeAuthenticatedReconciliation,
} from '../shared/clientIdentityPolicy';
import {
  canReuseFriendLink,
  decideFriendLinkAcceptance,
  decideFriendInvitePreview,
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
import {
  getCareerGameForDate,
  getCurrentCareerGameDate,
} from '../netlify/functions/lib/careerGame';
import { buildDailyQuizResponse } from '../netlify/functions/lib/dailyQuizResponse';
import getDailyQuizFunction from '../netlify/functions/getDailyQuiz';
import {
  getAnswerKeyRows,
  getCareerSourceRows,
  getDailyQuestionRows,
  getQuestionSource,
  QuestionSourceClients,
  QuestionSourceError,
  SourceQuestionRow,
  validateCareerRows,
  validateQuestionRows,
} from '../netlify/functions/lib/questionSource';
import {
  authorizeUser,
  classifyAuth0VerificationFailure,
} from '../netlify/functions/lib/auth';
import {
  AUTH_VERIFICATION_CACHE_TTL_MS,
  createBlobAuthVerificationCache,
} from '../netlify/functions/lib/authVerificationCache';
import {
  getCareerTileState,
  getGamesHubCompletionState,
} from '../shared/gamesHub';
import {
  getCareerResultForDate,
  orderCareerRows,
} from '../shared/careerGame';
import createChallengeFunction from '../netlify/functions/createChallenge';
import getChallengeFunction from '../netlify/functions/getChallenge';
import joinChallengeFunction from '../netlify/functions/joinChallenge';
import submitChallengeAnswersFunction from '../netlify/functions/submitChallengeAnswers';
import revokeChallengeFunction from '../netlify/functions/revokeChallenge';
import getUserChallengesFunction from '../netlify/functions/getUserChallenges';
import {
  getNativeTabsFallbackReason,
  selectMainNavigator,
} from '../shared/navigationPolicy';
import {
  AVATAR_DEFINITIONS,
  SYMBOL_AVATAR_DEFINITIONS,
  chooseRandomSymbolAvatarId,
  isAvatarId,
  resolvePersistedAvatarId,
} from '../shared/avatarCatalog';
import {
  buildDailyQuizPath,
  formatDailyQuizShare,
  getDailyQuizCacheControl,
  getDailyQuizNumber,
  isQuizForDate,
} from '../shared/dailyQuiz';
import {
  DAILY_QUIZ_EXIT_DELAY_MS,
  DAILY_QUIZ_RESULT_HOLD_MS,
  createDailyQuizAttempt,
  getDailyQuizRemainingSeconds,
  isDailyQuizAttemptCompatible,
  normalizeDailyQuizAttempt,
} from '../shared/dailyQuizAttempt';
import {
  ACHIEVEMENTS,
  applyAchievementEvent,
  createEmptyAchievementSnapshot,
  type AchievementSnapshot,
  type DailyQuizAchievementEvent,
} from '../shared/achievements';
import {
  beginAchievementReveal,
  dismissAchievementReveal,
  enqueueAchievementReveals,
  releaseDeferredAchievementReveals,
  type AchievementRevealQueues,
} from '../shared/achievementRevealPolicy';
import {
  isAnalyticsActorType,
  isAnalyticsEventName,
  isAnalyticsId,
  normalizeAnalyticsProperties,
} from '../shared/analytics';
import {
  getLeaderboardCachePartitionKey,
  getLeaderboardDateWindow,
  parseLeaderboardPeriod,
} from '../shared/leaderboard';

function dailyAchievementEvent(
  date: string,
  overrides: Partial<DailyQuizAchievementEvent> = {}
): DailyQuizAchievementEvent {
  return {
    id: `daily:quiz-${date}`,
    kind: 'daily-quiz',
    occurredAt: `${date}T12:00:00.000Z`,
    quizDate: date,
    quizId: `quiz-${date}`,
    score: 300,
    answersCorrect: [true, false, true, false, true],
    correctAtZero: false,
    allowCumulative: true,
    ...overrides,
  };
}

test('accepts only declared pseudonymous analytics envelope values', () => {
  assert.equal(isAnalyticsEventName('app_shell_ready'), true);
  assert.equal(isAnalyticsEventName('quiz_start_requested'), true);
  assert.equal(isAnalyticsEventName('quiz_attempt_resumed'), true);
  assert.equal(isAnalyticsEventName('leaderboard_viewed'), true);
  assert.equal(isAnalyticsEventName('leaderboard_filter_changed'), true);
  assert.equal(isAnalyticsEventName('arbitrary_event'), false);
  assert.equal(isAnalyticsActorType('guest'), true);
  assert.equal(isAnalyticsActorType('user-123'), false);
  assert.equal(isAnalyticsId('2b5c2e94-39c4-4b56-b0bf-682c30d9fd39'), true);
  assert.equal(isAnalyticsId('auth0|user-123'), false);
});

test('normalizes fixed analytics properties without accepting free-form metadata', () => {
  assert.deepEqual(
    normalizeAnalyticsProperties({
      quizDate: '2026-08-22',
      source: 'cache',
      durationMs: 1250,
      questionNumber: 1,
      totalQuestions: 5,
      score: 100,
      exitReason: 'screen_exit',
      leaderboardScope: 'friends',
      leaderboardPeriod: 'weekly',
    }),
    {
      quizDate: '2026-08-22',
      source: 'cache',
      durationMs: 1250,
      questionNumber: 1,
      totalQuestions: 5,
      score: 100,
      exitReason: 'screen_exit',
      leaderboardScope: 'friends',
      leaderboardPeriod: 'weekly',
    }
  );
  assert.equal(normalizeAnalyticsProperties({ username: 'liam' }), null);
  assert.equal(normalizeAnalyticsProperties({ answer: 'Player name' }), null);
  assert.equal(normalizeAnalyticsProperties({ durationMs: -1 }), null);
  assert.equal(normalizeAnalyticsProperties({ quizDate: '22-08-2026' }), null);
  assert.equal(normalizeAnalyticsProperties({ leaderboardScope: 'private' }), null);
  assert.equal(normalizeAnalyticsProperties({ leaderboardPeriod: 'monthly' }), null);
});

test('parses leaderboard periods with daily compatibility fallback', () => {
  assert.equal(parseLeaderboardPeriod('weekly'), 'weekly');
  assert.equal(parseLeaderboardPeriod('daily'), 'daily');
  assert.equal(parseLeaderboardPeriod(undefined), 'daily');
  assert.equal(parseLeaderboardPeriod('monthly'), 'daily');
});

test('calculates London quiz-date leaderboard windows across boundaries', () => {
  assert.deepEqual(getLeaderboardDateWindow('2026-08-24', 'weekly'), {
    quizDate: '2026-08-24',
    previousQuizDate: '2026-08-23',
    periodStart: '2026-08-24',
    periodEnd: '2026-08-30',
  });
  assert.deepEqual(getLeaderboardDateWindow('2026-08-30', 'weekly'), {
    quizDate: '2026-08-30',
    previousQuizDate: '2026-08-29',
    periodStart: '2026-08-24',
    periodEnd: '2026-08-30',
  });
  assert.equal(getLeaderboardDateWindow('2027-01-01', 'weekly').periodStart, '2026-12-28');
  assert.equal(getLeaderboardDateWindow('2027-01-01', 'weekly').periodEnd, '2027-01-03');
  assert.equal(getLeaderboardDateWindow('2026-03-01', 'weekly').periodStart, '2026-02-23');
});

test('partitions leaderboard caches by scope, period, anchor, and account', () => {
  assert.equal(
    getLeaderboardCachePartitionKey('global', 'daily', '2026-08-24'),
    'leaderboard_global_daily_2026-08-24_public'
  );
  assert.notEqual(
    getLeaderboardCachePartitionKey('friends', 'weekly', '2026-08-24', 'user-a'),
    getLeaderboardCachePartitionKey('friends', 'weekly', '2026-08-24', 'user-b')
  );
  assert.notEqual(
    getLeaderboardCachePartitionKey('friends', 'weekly', '2026-08-24', 'user-a'),
    getLeaderboardCachePartitionKey('friends', 'weekly', '2026-08-31', 'user-a')
  );
});

test('defines the complete achievement catalogue', () => {
  assert.equal(ACHIEVEMENTS.length, 8);
  assert.equal(new Set(ACHIEVEMENTS.map(({ id }) => id)).size, 8);
  assert.deepEqual(
    ACHIEVEMENTS.filter(({ secret }) => secret).map(({ id }) => id),
    ['stoppage-time', 'comeback-king', 'fashion-show']
  );
});

test('evaluates single-play daily achievements from local result facts', () => {
  const perfect = applyAchievementEvent(
    createEmptyAchievementSnapshot(),
    dailyAchievementEvent('2026-08-18', {
      score: 500,
      answersCorrect: [true, true, true, true, true],
      correctAtZero: true,
    })
  );
  assert.deepEqual(perfect.newlyUnlocked, [
    'debut',
    'sharpshooter',
    'top-bins',
    'stoppage-time',
  ]);

  const comeback = applyAchievementEvent(
    createEmptyAchievementSnapshot(),
    dailyAchievementEvent('2026-08-18', {
      answersCorrect: [false, false, true, true, true],
    })
  );
  assert.equal(Boolean(comeback.snapshot.unlocked['comeback-king']), true);
});

test('advances authenticated achievement streak and veteran progress from release activity', () => {
  let snapshot: AchievementSnapshot = createEmptyAchievementSnapshot();
  for (let day = 1; day <= 30; day += 1) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    snapshot = applyAchievementEvent(snapshot, dailyAchievementEvent(date)).snapshot;
  }
  assert.equal(snapshot.progress.dailyCompletions, 30);
  assert.equal(snapshot.progress.dailyStreak, 30);
  assert.equal(Boolean(snapshot.unlocked.dedication), true);
  assert.equal(Boolean(snapshot.unlocked.veteran), true);

  const reset = applyAchievementEvent(
    snapshot,
    dailyAchievementEvent('2026-10-02')
  ).snapshot;
  assert.equal(reset.progress.dailyStreak, 1);
});

test('keeps cumulative milestones unavailable to guest achievement events', () => {
  let snapshot = createEmptyAchievementSnapshot();
  for (let day = 1; day <= 30; day += 1) {
    snapshot = applyAchievementEvent(
      snapshot,
      dailyAchievementEvent(`2026-09-${String(day).padStart(2, '0')}`, {
        allowCumulative: false,
      })
    ).snapshot;
  }
  assert.equal(snapshot.unlocked.dedication, undefined);
  assert.equal(snapshot.unlocked.veteran, undefined);
});

test('does not requeue authenticated daily achievements while their reveal is active', () => {
  const initial: AchievementRevealQueues = {
    activeRevealIds: [],
    immediateRevealIds: [],
    deferredDailyRevealIds: ['debut', 'sharpshooter', 'top-bins'],
    locallyRevealedIds: [],
  };
  const released = releaseDeferredAchievementReveals(initial);
  const active = beginAchievementReveal(released);
  const reconciled = enqueueAchievementReveals(
    active,
    ['debut', 'sharpshooter', 'top-bins'],
    'deferred'
  );

  assert.deepEqual(reconciled.activeRevealIds, [
    'debut',
    'sharpshooter',
    'top-bins',
  ]);
  assert.deepEqual(reconciled.immediateRevealIds, []);
  assert.deepEqual(reconciled.deferredDailyRevealIds, []);
});

test('dismissal removes duplicate achievement IDs from every reveal queue', () => {
  const dismissed = dismissAchievementReveal({
    activeRevealIds: ['debut', 'sharpshooter', 'top-bins'],
    immediateRevealIds: ['debut'],
    deferredDailyRevealIds: ['sharpshooter', 'top-bins'],
    locallyRevealedIds: [],
  });

  assert.deepEqual(dismissed.activeRevealIds, []);
  assert.deepEqual(dismissed.immediateRevealIds, []);
  assert.deepEqual(dismissed.deferredDailyRevealIds, []);
  assert.deepEqual(dismissed.locallyRevealedIds, [
    'debut',
    'sharpshooter',
    'top-bins',
  ]);

  const reconciledAfterDismissal = enqueueAchievementReveals(
    dismissed,
    ['debut', 'sharpshooter', 'top-bins'],
    'immediate'
  );
  assert.deepEqual(reconciledAfterDismissal.immediateRevealIds, []);
});

test('queues only valid unseen cross-device achievement reveals', () => {
  const queues: AchievementRevealQueues = {
    activeRevealIds: [],
    immediateRevealIds: [],
    deferredDailyRevealIds: [],
    locallyRevealedIds: ['debut'],
  };
  const reconciled = enqueueAchievementReveals(
    queues,
    ['debut', 'dedication', 'veteran'],
    'immediate',
    ['dedication'],
    ['veteran']
  );

  assert.deepEqual(reconciled.immediateRevealIds, []);

  const unseen = enqueueAchievementReveals(
    queues,
    ['fashion-show'],
    'immediate'
  );
  assert.deepEqual(unseen.immediateRevealIds, ['fashion-show']);
});

test('unlocks Fashion Show after three same-day avatar changes and resets the daily count', () => {
  let snapshot = createEmptyAchievementSnapshot();
  for (let index = 1; index <= 3; index += 1) {
    snapshot = applyAchievementEvent(snapshot, {
      id: `avatar-${index}`,
      kind: 'avatar-change',
      occurredAt: `2026-08-18T1${index}:00:00.000Z`,
      quizDate: '2026-08-18',
      allowCumulative: true,
    }).snapshot;
  }
  assert.equal(Boolean(snapshot.unlocked['fashion-show']), true);
  assert.equal(snapshot.progress.avatarChangesToday, 3);

  snapshot = applyAchievementEvent(snapshot, {
    id: 'avatar-next-day',
    kind: 'avatar-change',
    occurredAt: '2026-08-19T10:00:00.000Z',
    quizDate: '2026-08-19',
    allowCumulative: true,
  }).snapshot;
  assert.equal(snapshot.progress.avatarChangesToday, 1);
});

test('validates the complete avatar catalogue', () => {
  assert.equal(AVATAR_DEFINITIONS.length, 58);
  assert.equal(SYMBOL_AVATAR_DEFINITIONS.length, 32);
  assert.equal(new Set(AVATAR_DEFINITIONS.map(({ id }) => id)).size, 58);
  assert.equal(isAvatarId('symbol-stadium'), true);
  assert.equal(isAvatarId('letter-z'), true);
  assert.equal(isAvatarId('letter-aa'), false);
  assert.equal(isAvatarId(null), false);
});

test('chooses automatic avatars only from football symbols', () => {
  const first = chooseRandomSymbolAvatarId(0);
  const last = chooseRandomSymbolAvatarId(1);
  assert.equal(first, SYMBOL_AVATAR_DEFINITIONS[0].id);
  assert.equal(last, SYMBOL_AVATAR_DEFINITIONS[31].id);
  assert.equal(first.startsWith('symbol-'), true);
  assert.equal(last.startsWith('symbol-'), true);
  assert.equal(chooseRandomSymbolAvatarId(Number.NaN), first);
  assert.equal(resolvePersistedAvatarId('symbol-stadium', 0), 'symbol-stadium');
  assert.equal(resolvePersistedAvatarId(null, 0), first);
});

test('scores answers consistently across timer boundaries', () => {
  assert.equal(calculateQuizPoints(undefined), 60);

  const expectedPointsBySecond = [
    10, 10, 10, 10,
    20, 20,
    30, 30,
    40, 40,
    50, 50,
    60, 60,
    70, 70,
    80, 80,
    90, 90,
    100,
  ];

  expectedPointsBySecond.forEach((expectedPoints, secondsRemaining) => {
    assert.equal(calculateQuizPoints(secondsRemaining * 1000), expectedPoints);
  });

  assert.equal(calculateQuizPoints(-1_000), 10);
});

test('derives stable daily quiz numbers from the launch-date anchor', () => {
  assert.equal(getDailyQuizNumber('2026-06-30'), null);
  assert.equal(getDailyQuizNumber('2026-07-01'), 1);
  assert.equal(getDailyQuizNumber('2026-08-06'), 37);
  assert.equal(getDailyQuizNumber('2026-08-07'), 38);
  assert.equal(getDailyQuizNumber('2026-08-08'), 39);

  const leapDayNumber = getDailyQuizNumber('2028-02-29');
  assert.equal(getDailyQuizNumber('2028-02-28'), (leapDayNumber ?? 0) - 1);
  assert.equal(getDailyQuizNumber('2028-03-01'), (leapDayNumber ?? 0) + 1);
  assert.equal(getDailyQuizNumber('2026-02-30'), null);
  assert.equal(getDailyQuizNumber('not-a-date'), null);
});

test('formats standard and perfect daily quiz shares consistently', () => {
  assert.equal(
    formatDailyQuizShare({
      date: '2026-08-07',
      score: 380,
      answers: [true, true, true, true, false],
    }),
    [
      'Pundit Trivia #38',
      '⚽️⚽️⚽️⚽️❌',
      '',
      '🏆 380/500',
      '',
      'Can you beat that?',
      '👉 https://pundittrivia.com/',
      '',
      '#ThinkYouKnowFootball?',
    ].join('\n')
  );

  assert.equal(
    formatDailyQuizShare({
      date: '2026-08-07',
      score: 500,
      answers: [true, true, true, true, true],
    }),
    [
      'Pundit Trivia #38',
      '⚽️⚽️⚽️⚽️⚽️',
      '',
      '🐐 500/500',
      '',
      'I know football. Do you?',
      '👉 https://pundittrivia.com/',
      '',
      '#ThinkYouKnowFootball?',
    ].join('\n')
  );

  assert.equal(
    formatDailyQuizShare({
      date: 'invalid',
      score: 490,
      answers: [true, false],
    }).startsWith('Pundit Trivia\n⚽️❌'),
    true
  );
});

test('keeps daily quiz identity and CDN caching scoped to the requested date', () => {
  assert.equal(
    isQuizForDate(
      { id: 'quiz-2026-08-07', date: '2026-08-07' },
      '2026-08-07'
    ),
    true
  );
  assert.equal(
    isQuizForDate(
      { id: 'quiz-2026-08-06', date: '2026-08-06' },
      '2026-08-07'
    ),
    false
  );
  assert.equal(
    isQuizForDate(
      { id: 'quiz-2026-08-06', date: '2026-08-07' },
      '2026-08-07'
    ),
    false
  );
  assert.equal(
    getDailyQuizCacheControl(true),
    'public, max-age=300, stale-while-revalidate=21600'
  );
  assert.equal(getDailyQuizCacheControl(false), 'no-store');
  assert.equal(buildDailyQuizPath('2026-08-07'), '/getDailyQuiz?date=2026-08-07');
  assert.equal(buildDailyQuizPath(), '/getDailyQuiz');
});

test('serves Lambda-shaped endpoints through the modern Netlify wrapper', async () => {
  const response = await getDailyQuizFunction(
    new Request('https://preview.example/.netlify/functions/getDailyQuiz', {
      method: 'OPTIONS',
    }),
    {} as never
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  assert.equal(await response.text(), '');
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
  assert.ok(game);

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

test('accepts career completion only for the current daily game', () => {
  const currentDate = '2026-08-04';

  assert.equal(
    getCurrentCareerGameDate('career-2026-08-04', currentDate),
    currentDate
  );
  assert.equal(
    getCurrentCareerGameDate('career-2026-08-03', currentDate),
    null
  );
  assert.equal(
    getCurrentCareerGameDate('career-2026-08-05', currentDate),
    null
  );
  assert.equal(
    getCurrentCareerGameDate('career-2026-8-4', currentDate),
    null
  );
  assert.equal(
    getCurrentCareerGameDate('career-2026-08-04-extra', currentDate),
    null
  );
});

test('adds the career game without changing daily quiz root fields', async () => {
  const careerGame = await getCareerGameForDate('2026-07-27', 'uk');
  assert.ok(careerGame);
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

test('selects BigQuery only for UK dates at or after cutover', () => {
  assert.equal(getQuestionSource('2026-08-09', 'uk', '2026-08-10'), 'cockroach');
  assert.equal(getQuestionSource('2026-08-10', 'uk', '2026-08-10'), 'bigquery');
  assert.equal(getQuestionSource('2026-08-11', 'UK', '2026-08-10'), 'bigquery');
  assert.equal(getQuestionSource('2026-08-11', 'dn', '2026-08-10'), 'cockroach');
  assert.equal(getQuestionSource('2026-08-11', 'uk', ''), 'cockroach');
  assert.throws(
    () => getQuestionSource('2026-08-11', 'uk', '10-08-2026'),
    (error: unknown) =>
      error instanceof QuestionSourceError &&
      error.code === 'INVALID_CUTOVER_DATE'
  );
});

function buildSourceQuestion(rank: number): SourceQuestionRow {
  return {
    question_id: `question-${rank}`,
    question: `Question ${rank}`,
    player_id: `player-${rank}`,
    player_name: `Correct ${rank}`,
    player_0: `Wrong A ${rank}`,
    player_1: `Correct ${rank}`,
    player_2: `Wrong B ${rank}`,
    player_3: `Wrong C ${rank}`,
    rank,
    correct_answer_position: 1,
  };
}

test('validates complete ordered BigQuery question bundles', () => {
  const rows = [5, 2, 1, 4, 3].map(buildSourceQuestion);
  const validated = validateQuestionRows(
    rows,
    [1, 2, 3, 4, 5],
    'bigquery',
    true
  );
  assert.deepEqual(validated.map((row) => row.rank), [1, 2, 3, 4, 5]);

  assert.throws(
    () => validateQuestionRows(rows.slice(0, 4), [1, 2, 3, 4, 5], 'bigquery', true),
    (error: unknown) =>
      error instanceof QuestionSourceError &&
      error.code === 'INCOMPLETE_QUESTION_SET'
  );

  const mismatched = { ...buildSourceQuestion(1), correct_answer_position: 0 };
  assert.throws(
    () => validateQuestionRows([mismatched], [1], 'bigquery', true),
    (error: unknown) =>
      error instanceof QuestionSourceError &&
      error.code === 'CORRECT_POSITION_MISMATCH'
  );
});

test('reads and maps BigQuery bundles with a mocked server client', async () => {
  const originalCutover = process.env.BIGQUERY_CUTOVER_DATE;
  process.env.BIGQUERY_CUTOVER_DATE = '2026-08-10';
  const bundle = [6, 2, 1, 5, 3, 4].map(buildSourceQuestion);
  const careerRows = [
    {
      years: '2020–2022',
      team: 'Club',
      appearances: 10,
      goals: 2,
      category: 'Domestic',
      rank: 1,
    },
    {
      years: '2022–',
      team: 'Country',
      appearances: 5,
      goals: 1,
      category: 'International',
      rank: 1,
    },
  ];
  const queries: string[] = [];
  const clients: QuestionSourceClients = {
    async bigQuery<T>(options: Query) {
      const sql = String(options.query);
      queries.push(sql);
      if (sql.includes('.questions')) {
        const params = Array.isArray(options.params) ? undefined : options.params;
        assert.equal(
          (params?.date as { value?: string } | undefined)?.value,
          '2026-08-10'
        );
      }
      return (sql.includes('player_stats') ? careerRows : bundle) as T[];
    },
    async cockroach<T>() {
      throw new Error('Cockroach should not be called after cutover');
    },
  };

  try {
    const daily = await getDailyQuestionRows('2026-08-10', 'uk', clients);
    assert.deepEqual(daily.map((row) => row.rank), [1, 2, 3, 4, 5]);

    const answerKeys = await getAnswerKeyRows(
      '2026-08-10',
      'uk',
      daily.map((row) => row.question_id),
      clients
    );
    assert.deepEqual(answerKeys.map((row) => row.rank), [1, 2, 3, 4, 5]);

    const career = await getCareerSourceRows('2026-08-10', 'uk', clients);
    assert.equal(career?.question.rank, 6);
    assert.deepEqual(career?.career, careerRows);
    assert.equal(queries.filter((sql) => sql.includes('.questions')).length, 3);
    assert.equal(queries.filter((sql) => sql.includes('player_stats')).length, 1);
  } finally {
    if (originalCutover === undefined) {
      delete process.env.BIGQUERY_CUTOVER_DATE;
    } else {
      process.env.BIGQUERY_CUTOVER_DATE = originalCutover;
    }
  }
});

test('uses a mocked Cockroach client before cutover without calling BigQuery', async () => {
  const originalCutover = process.env.BIGQUERY_CUTOVER_DATE;
  process.env.BIGQUERY_CUTOVER_DATE = '2026-08-11';
  const rows = [1, 2, 3, 4, 5].map(buildSourceQuestion);
  let cockroachCalls = 0;
  const clients: QuestionSourceClients = {
    async bigQuery<T>() {
      throw new Error('BigQuery should not be called before cutover');
    },
    async cockroach<T>() {
      cockroachCalls += 1;
      return rows as T[];
    },
  };

  try {
    const daily = await getDailyQuestionRows('2026-08-10', 'uk', clients);
    assert.equal(cockroachCalls, 1);
    assert.deepEqual(daily, rows);
  } finally {
    if (originalCutover === undefined) {
      delete process.env.BIGQUERY_CUTOVER_DATE;
    } else {
      process.env.BIGQUERY_CUTOVER_DATE = originalCutover;
    }
  }
});

test('categorizes mocked BigQuery read failures as retryable source errors', async () => {
  const originalCutover = process.env.BIGQUERY_CUTOVER_DATE;
  process.env.BIGQUERY_CUTOVER_DATE = '2026-08-10';
  const clients: QuestionSourceClients = {
    async bigQuery<T>() {
      throw new Error('temporary upstream failure');
    },
    async cockroach<T>() {
      throw new Error('Cockroach should not be called after cutover');
    },
  };

  try {
    await assert.rejects(
      getDailyQuestionRows('2026-08-10', 'uk', clients),
      (error: unknown) =>
        error instanceof QuestionSourceError &&
        error.source === 'bigquery' &&
        error.code === 'READ_FAILED'
    );
  } finally {
    if (originalCutover === undefined) {
      delete process.env.BIGQUERY_CUTOVER_DATE;
    } else {
      process.env.BIGQUERY_CUTOVER_DATE = originalCutover;
    }
  }
});

test('validates ordered career rows and rejects duplicate category ranks', () => {
  const career = [
    {
      years: '2020–2022',
      team: 'Club',
      appearances: 10,
      goals: 2,
      category: 'Domestic',
      rank: 1,
    },
    {
      years: '2022–',
      team: 'Country',
      appearances: 5,
      goals: 1,
      category: 'International',
      rank: 1,
    },
  ];
  assert.equal(validateCareerRows(career).length, 2);
  assert.throws(
    () => validateCareerRows([career[0], { ...career[0], team: 'Other Club' }]),
    (error: unknown) =>
      error instanceof QuestionSourceError &&
      error.code === 'INVALID_CAREER_ROWS'
  );
});

test('omits an unavailable career game without changing the daily quiz', () => {
  const response = buildDailyQuizResponse(
    '2026-08-10',
    [buildSourceQuestion(1)],
    undefined
  );
  assert.equal(response.questions.length, 1);
  assert.equal(response.careerGame, undefined);
});

test('keeps daily quiz and career completion states independent', () => {
  assert.deepEqual(getGamesHubCompletionState(false, false), {
    quiz: 'available',
    career: 'available',
  });
  assert.deepEqual(getGamesHubCompletionState(false, false, true), {
    quiz: 'in_progress',
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

test('derives every Journey tile state without revealing stale results', () => {
  assert.equal(
    getCareerTileState({ hasGame: false, hasResult: false, isLoading: true }),
    'loading'
  );
  assert.equal(
    getCareerTileState({ hasGame: false, hasResult: false, isLoading: false }),
    'unavailable'
  );
  assert.equal(
    getCareerTileState({ hasGame: true, hasResult: false, isLoading: false }),
    'available'
  );
  assert.equal(
    getCareerTileState({ hasGame: true, hasResult: true, isLoading: false }),
    'completed'
  );

  const result = { date: '2026-08-13', canonicalName: 'Player One' };
  assert.equal(getCareerResultForDate(result, '2026-08-13'), result);
  assert.equal(getCareerResultForDate(result, '2026-08-14'), null);
});

test('orders Journey careers by category and then rank', () => {
  const rows = [
    { team: 'International 2', category: 'International', rank: 2 },
    { team: 'Domestic 2', category: 'Domestic', rank: 2 },
    { team: 'International 1', category: 'International', rank: 1 },
    { team: 'Domestic 1', category: 'Domestic', rank: 1 },
  ];

  assert.deepEqual(
    orderCareerRows(rows).map(({ team }) => team),
    ['Domestic 1', 'Domestic 2', 'International 1', 'International 2']
  );
  assert.deepEqual(rows.map(({ team }) => team), [
    'International 2',
    'Domestic 2',
    'International 1',
    'Domestic 1',
  ]);
});

test('retires every challenge Function before request validation or protected work', async () => {
  const originalEnabled = process.env.CHALLENGES_ENABLED;
  delete process.env.CHALLENGES_ENABLED;

  const endpoints = [
    { name: 'createChallenge', fn: createChallengeFunction, method: 'POST' },
    { name: 'getChallenge', fn: getChallengeFunction, method: 'GET' },
    { name: 'joinChallenge', fn: joinChallengeFunction, method: 'POST' },
    {
      name: 'submitChallengeAnswers',
      fn: submitChallengeAnswersFunction,
      method: 'POST',
    },
    { name: 'revokeChallenge', fn: revokeChallengeFunction, method: 'POST' },
    { name: 'getUserChallenges', fn: getUserChallengesFunction, method: 'GET' },
  ] as const;

  try {
    for (const endpoint of endpoints) {
      const response = await endpoint.fn(
        new Request(
          `https://preview.example/.netlify/functions/${endpoint.name}`,
          { method: endpoint.method }
        ),
        {} as never
      );
      assert.equal(response.status, 410, endpoint.name);
      assert.deepEqual(await response.json(), {
        code: 'CHALLENGE_UNAVAILABLE',
        message: 'Challenge mode is currently unavailable.',
      });
    }
  } finally {
    if (originalEnabled === undefined) {
      delete process.env.CHALLENGES_ENABLED;
    } else {
      process.env.CHALLENGES_ENABLED = originalEnabled;
    }
  }
});

test('distinguishes rejected Auth0 tokens from temporary verification failures', () => {
  assert.equal(classifyAuth0VerificationFailure(401), 'invalid');
  assert.equal(classifyAuth0VerificationFailure(429), 'unavailable');
  assert.equal(classifyAuth0VerificationFailure(500), 'unavailable');
  assert.equal(classifyAuth0VerificationFailure(503), 'unavailable');
  assert.equal(classifyAuth0VerificationFailure(undefined), 'unavailable');
});

test('keeps temporary Auth0 userinfo failures distinct from invalid tokens', async () => {
  const originalFetch = globalThis.fetch;
  const originalDomain = process.env.AUTH0_DOMAIN;
  const event = {
    headers: { authorization: 'Bearer test-token' },
  } as unknown as Parameters<typeof authorizeUser>[0];

  process.env.AUTH0_DOMAIN = 'example.auth0.com';
  const unavailableCache = {
    has: async () => false,
    remember: async () => undefined,
  };

  try {
    globalThis.fetch = async () => new Response(null, {
      status: 429,
      headers: { 'Retry-After': '10' },
    });
    const unavailable = await authorizeUser(event, 'auth0|player', {}, {
      verificationCache: unavailableCache,
    });
    assert.equal(unavailable.response?.statusCode, 503);
    assert.equal(unavailable.response?.headers?.['Retry-After'], '10');
    assert.deepEqual(JSON.parse(unavailable.response?.body ?? '{}'), {
      error: 'Authentication service temporarily unavailable',
      code: 'AUTH_VERIFICATION_UNAVAILABLE',
    });

    globalThis.fetch = async () => new Response(null, { status: 401 });
    const invalid = await authorizeUser(event, 'auth0|player', {}, {
      verificationCache: unavailableCache,
    });
    assert.equal(invalid.response?.statusCode, 401);
    assert.deepEqual(JSON.parse(invalid.response?.body ?? '{}'), {
      error: 'Invalid or expired access token',
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDomain === undefined) {
      delete process.env.AUTH0_DOMAIN;
    } else {
      process.env.AUTH0_DOMAIN = originalDomain;
    }
  }
});

test('reuses one verified Auth0 result across protected requests for the same token owner', async () => {
  const originalFetch = globalThis.fetch;
  const originalDomain = process.env.AUTH0_DOMAIN;
  const event = {
    headers: { authorization: 'Bearer shared-token' },
  } as unknown as Parameters<typeof authorizeUser>[0];
  const cachedOwners = new Map<string, string>();
  const verificationCache = {
    has: async (accessToken: string, expectedUserId: string) =>
      cachedOwners.get(accessToken) === expectedUserId,
    remember: async (accessToken: string, verifiedUserId: string) => {
      cachedOwners.set(accessToken, verifiedUserId);
    },
  };
  let userInfoRequests = 0;

  process.env.AUTH0_DOMAIN = 'example.auth0.com';

  try {
    globalThis.fetch = async () => {
      userInfoRequests += 1;
      return Response.json({
        sub: 'auth0|player',
        email: 'player@example.com',
        email_verified: true,
      });
    };

    const first = await authorizeUser(event, 'auth0|player', {}, { verificationCache });
    const second = await authorizeUser(event, 'auth0|player', {}, { verificationCache });

    assert.equal(first.response, null);
    assert.equal(second.response, null);
    assert.equal(second.user?.sub, 'auth0|player');
    assert.equal(userInfoRequests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDomain === undefined) {
      delete process.env.AUTH0_DOMAIN;
    } else {
      process.env.AUTH0_DOMAIN = originalDomain;
    }
  }
});

test('stores only expiring digests in the shared Auth0 verification cache', async () => {
  const values = new Map<string, unknown>();
  let now = 1_000;
  const cache = createBlobAuthVerificationCache({
    now: () => now,
    getVerificationStore: () => ({
      get: async (key) => values.get(key) ?? null,
      setJSON: async (key, value) => {
        values.set(key, value);
      },
      delete: async (key) => {
        values.delete(key);
      },
    }),
  });

  await cache.remember('raw-access-token', 'auth0|player');

  assert.equal(values.size, 1);
  const [[storedKey, storedValue]] = [...values.entries()];
  assert.equal(storedKey.includes('raw-access-token'), false);
  assert.equal(JSON.stringify(storedValue).includes('raw-access-token'), false);
  assert.equal(JSON.stringify(storedValue).includes('auth0|player'), false);
  assert.equal(await cache.has('raw-access-token', 'auth0|player'), true);
  assert.equal(await cache.has('raw-access-token', 'auth0|other'), false);

  now += AUTH_VERIFICATION_CACHE_TTL_MS + 1;
  assert.equal(await cache.has('raw-access-token', 'auth0|player'), false);
  assert.equal(values.size, 0);
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
    getSharedCodeActionFromUrl('pundit-app://challenge/ABC234')?.kind,
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

test('consumes web shared-code URLs without discarding unrelated URL state', () => {
  assert.equal(
    getWebSharedCodeUrlReplacement(
      'https://pundittrivia.com/f/ABCD2345?utm_source=friend#games'
    ),
    '/?utm_source=friend#games'
  );
  assert.equal(
    getWebSharedCodeUrlReplacement(
      'https://pundittrivia.com/add-friend/ABCD2345?ref=share'
    ),
    '/?ref=share'
  );
  assert.equal(
    getWebSharedCodeUrlReplacement(
      'https://pundittrivia.com/c/ABC234?utm_campaign=challenge'
    ),
    '/?utm_campaign=challenge'
  );
  assert.equal(
    getWebSharedCodeUrlReplacement(
      'https://pundittrivia.com/challenge/ABC234#challenge'
    ),
    '/#challenge'
  );
  assert.equal(
    getWebSharedCodeUrlReplacement(
      'https://pundittrivia.com/games?invite=ABCD2345&theme=dark#today'
    ),
    '/games?theme=dark#today'
  );
  assert.equal(
    getWebSharedCodeUrlReplacement(
      'https://pundittrivia.com/?code=ABCD2345&challenge=ABC234&keep=yes'
    ),
    '/?keep=yes'
  );
  assert.equal(
    getWebSharedCodeUrlReplacement('https://pundittrivia.com/games?keep=yes'),
    null
  );
  assert.equal(
    getWebSharedCodeUrlReplacement('pundit-app://add-friend/ABCD2345'),
    null
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
  const verifiedSession = {
    isAuthenticated: true,
    authStatus: 'authenticated' as const,
    identityStatus: 'complete' as const,
    token: 'token',
    userId: 'auth0|player',
    authStateVersion: 4,
  };
  assert.equal(
    canProcessProtectedAction(verifiedSession, {
      userId: 'auth0|player',
      authStateVersion: 4,
    }),
    true
  );
  assert.equal(
    canProcessProtectedAction(
      { ...verifiedSession, token: null },
      { userId: 'auth0|player', authStateVersion: 4 }
    ),
    false
  );
  assert.equal(
    canProcessProtectedAction(
      { ...verifiedSession, identityStatus: 'syncing' },
      { userId: 'auth0|player', authStateVersion: 4 }
    ),
    false
  );
  assert.equal(
    canProcessProtectedAction(verifiedSession, {
      userId: 'auth0|other',
      authStateVersion: 4,
    }),
    false
  );
  assert.equal(
    canProcessProtectedAction(verifiedSession, {
      userId: 'auth0|player',
      authStateVersion: 5,
    }),
    false
  );
  assert.equal(shouldShowUsernameOnboarding(true, 'username_required'), true);
  assert.equal(shouldShowUsernameOnboarding(true, 'syncing'), false);
  assert.equal(shouldShowIdentitySync(true, 'unknown', 'idle'), true);
  assert.equal(shouldShowIdentitySync(true, 'complete', 'syncing'), true);
  assert.equal(shouldShowIdentityFailure(true, 'failed', 'idle'), true);
  assert.equal(shouldShowIdentityFailure(true, 'complete', 'failed'), true);
  assert.equal(shouldShowIdentitySync(true, 'complete', 'syncing', true), false);
  assert.equal(shouldShowIdentityFailure(true, 'complete', 'failed', true), false);
  assert.equal(shouldResumeAuthenticatedReconciliation('complete', 'failed'), true);
  assert.equal(shouldResumeAuthenticatedReconciliation('complete', 'syncing'), false);
  assert.equal(shouldResumeAuthenticatedReconciliation('failed', 'failed'), false);
  assert.equal(shouldFailIdentityAfterActivationError(false), true);
  assert.equal(shouldFailIdentityAfterActivationError(true), false);
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

  assert.equal(
    decideFriendInvitePreview({
      isExpired: false,
      isSelf: false,
      inviterAvailable: true,
      alreadyFriends: false,
      isReusable: true,
      usedBy: null,
    }),
    'available'
  );
  assert.equal(
    decideFriendInvitePreview({
      isExpired: false,
      isSelf: false,
      inviterAvailable: true,
      alreadyFriends: true,
      isReusable: false,
      usedBy: 'auth0|first-user',
    }),
    'already_friends'
  );
  assert.equal(
    decideFriendInvitePreview({
      isExpired: false,
      isSelf: false,
      inviterAvailable: false,
      alreadyFriends: false,
      isReusable: true,
      usedBy: null,
    }),
    'inviter_unavailable'
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

test('creates identity-scoped compatible Daily Quiz attempts', () => {
  const quiz = {
    id: 'quiz-2026-08-24',
    date: '2026-08-24',
    questions: [
      { id: 'q1', prompt: 'Question?', options: ['A', 'B'], correctOptionIndex: 0 },
      { id: 'q2', prompt: 'Next?', options: ['C', 'D'], correctOptionIndex: 1 },
    ],
  };
  const attempt = createDailyQuizAttempt('guest_test', quiz, 1_000);
  assert.equal(attempt.phase, 'preparing');
  assert.equal(attempt.startedAt, 1_000);
  assert.equal(isDailyQuizAttemptCompatible(attempt, 'guest_test', quiz, quiz.date), true);
  assert.equal(isDailyQuizAttemptCompatible(attempt, 'auth0|other', quiz, quiz.date), false);
  assert.equal(
    isDailyQuizAttemptCompatible(attempt, 'guest_test', {
      ...quiz,
      questions: [{ ...quiz.questions[0], options: ['B', 'A'] }, quiz.questions[1]],
    }, quiz.date),
    false
  );
});

test('restores the Daily Quiz timer from elapsed wall-clock time', () => {
  const quiz = {
    id: 'quiz-2026-08-24', date: '2026-08-24',
    questions: [{ id: 'q1', prompt: 'Question?', options: ['A', 'B'], correctOptionIndex: 0 }],
  };
  const attempt = {
    ...createDailyQuizAttempt('guest_test', quiz, 1_000),
    phase: 'answering' as const,
    timerEndsAt: 21_000,
  };
  assert.equal(getDailyQuizRemainingSeconds(attempt, 6_500), 15);
  assert.equal(getDailyQuizRemainingSeconds(attempt, 25_000), 0);
});

test('normalizes elapsed answer phases without retrying an answered question', () => {
  const quiz = {
    id: 'quiz-2026-08-24', date: '2026-08-24',
    questions: [
      { id: 'q1', prompt: 'Question?', options: ['A', 'B'], correctOptionIndex: 0 },
      { id: 'q2', prompt: 'Next?', options: ['C', 'D'], correctOptionIndex: 1 },
    ],
  };
  const lockedAt = 2_000;
  const locked = {
    ...createDailyQuizAttempt('guest_test', quiz, 1_000),
    answers: { q1: 0 },
    answerTimings: { q1: 15_000 },
    pendingPoints: 80,
    phase: 'answer_locked' as const,
    phaseEndsAt: lockedAt,
  };
  const revealed = normalizeDailyQuizAttempt(locked, quiz.questions.length, lockedAt);
  assert.equal(revealed.phase, 'result_reveal');
  assert.equal(revealed.score, 80);
  assert.equal(revealed.pendingPoints, 0);

  const advancedAt = lockedAt + DAILY_QUIZ_RESULT_HOLD_MS + DAILY_QUIZ_EXIT_DELAY_MS;
  const advanced = normalizeDailyQuizAttempt(locked, quiz.questions.length, advancedAt);
  assert.equal(advanced.phase, 'preparing');
  assert.equal(advanced.questionIndex, 1);
  assert.deepEqual(advanced.answers, { q1: 0 });
});
