const FALLBACK_SITE_URL = 'https://pundittrivia.com';

export function getSiteUrl(
  environment: Record<string, string | undefined> = process.env
): string {
  const isProduction = environment.CONTEXT === 'production';
  const candidate = isProduction
    ? environment.URL
    : environment.DEPLOY_PRIME_URL || environment.URL;

  return (candidate || FALLBACK_SITE_URL).replace(/\/$/, '');
}
