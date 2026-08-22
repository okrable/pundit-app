import { Platform } from 'react-native';
import { APP_VERSION } from '../constants/version';
import { APP_ENVIRONMENT } from '../constants/environment';
import { fetchApi } from './api';
import { logWarn } from './debugLog';
import type {
  AnalyticsActorType,
  AnalyticsEventName,
  AnalyticsProperties,
} from '../../shared/analytics';
import {
  getOrCreateAnalyticsId,
  isProductAnalyticsEnabled,
} from '../storage/analyticsStorage';

export type { AnalyticsEventName } from '../../shared/analytics';

const analyticsTimings = new Map<string, number>();
const appLaunchStartedAt = Date.now();

export function markAnalyticsTiming(key: string): void {
  analyticsTimings.set(key, Date.now());
}

export function getAnalyticsTimingDuration(key: string): number | undefined {
  const startedAt = analyticsTimings.get(key);
  return startedAt === undefined ? undefined : Math.max(0, Date.now() - startedAt);
}

export function clearAnalyticsTiming(key: string): void {
  analyticsTimings.delete(key);
}

export function getAppLaunchDuration(): number {
  return Math.max(0, Date.now() - appLaunchStartedAt);
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  actorType: AnalyticsActorType,
  properties: AnalyticsProperties = {}
): void {
  void (async () => {
    if (!(await isProductAnalyticsEnabled())) return;
    const analyticsId = await getOrCreateAnalyticsId();

    await fetchApi<{ accepted: boolean }>(
      '/trackEvent',
      {
        method: 'POST',
        body: JSON.stringify({
          eventName,
          actorType,
          platform: Platform.OS,
          appVersion: APP_VERSION,
          appEnvironment: APP_ENVIRONMENT,
          analyticsId,
          trackingVersion: 1,
          properties,
        }),
      },
      { timeoutMs: 4000 }
    );
  })().catch((error) => {
    logWarn('analytics.event.failed', {
      eventName,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}
