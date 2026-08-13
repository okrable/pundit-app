export const CHALLENGE_UNAVAILABLE_CODE = 'CHALLENGE_UNAVAILABLE';
export const CHALLENGE_UNAVAILABLE_MESSAGE =
  'Challenge mode is currently unavailable.';

export function getChallengeUnavailableResponse(
  headers: Record<string, string>,
  enabledValue = process.env.CHALLENGES_ENABLED
) {
  if (enabledValue?.trim().toLowerCase() === 'true') {
    return null;
  }

  return {
    statusCode: 410,
    headers,
    body: JSON.stringify({
      code: CHALLENGE_UNAVAILABLE_CODE,
      message: CHALLENGE_UNAVAILABLE_MESSAGE,
    }),
  };
}
