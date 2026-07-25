import { Platform } from 'react-native';
import { APP_VERSION } from '../constants/version';
import { APP_ENVIRONMENT } from '../constants/environment';
import { fetchApi } from './api';
import { logWarn } from './debugLog';

export type AnalyticsEventName =
  | 'quiz_started'
  | 'quiz_completed'
  | 'auth_completed'
  | 'challenge_created'
  | 'challenge_joined'
  | 'challenge_submitted';

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  actorType: 'guest' | 'authenticated'
): void {
  void fetchApi<{ accepted: boolean }>(
    '/trackEvent',
    {
      method: 'POST',
      body: JSON.stringify({
        eventName,
        actorType,
        platform: Platform.OS,
        appVersion: APP_VERSION,
        appEnvironment: APP_ENVIRONMENT,
      }),
    },
    { timeoutMs: 4000 }
  ).catch((error) => {
    logWarn('analytics.event.failed', {
      eventName,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}
