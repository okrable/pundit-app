export type AppEnvironment = 'production' | 'preview' | 'local';

const configuredEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

export const APP_ENVIRONMENT: AppEnvironment =
  configuredEnvironment === 'production' || configuredEnvironment === 'preview'
    ? configuredEnvironment
    : 'local';

export const IS_PREVIEW_BUILD = APP_ENVIRONMENT === 'preview';
