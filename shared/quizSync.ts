export function isTransientQuizSubmissionFailure(
  statusCode?: number
): boolean {
  return (
    statusCode === undefined ||
    statusCode === 408 ||
    statusCode >= 500
  );
}

export function isQuizSubmissionCurrent(
  originatingUserId: string,
  originatingQuizId: string,
  currentUserId?: string | null,
  currentQuizId?: string | null
): boolean {
  return (
    currentUserId === originatingUserId &&
    currentQuizId === originatingQuizId
  );
}
