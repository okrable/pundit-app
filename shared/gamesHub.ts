export type HubModeState = 'available' | 'completed';
export type CareerTileState = HubModeState | 'loading' | 'unavailable';

export function getGamesHubCompletionState(
  hasQuizResult: boolean,
  hasCareerResult: boolean
): { quiz: HubModeState; career: HubModeState } {
  return {
    quiz: hasQuizResult ? 'completed' : 'available',
    career: hasCareerResult ? 'completed' : 'available',
  };
}

export function getCareerTileState({
  hasGame,
  hasResult,
  isLoading,
}: {
  hasGame: boolean;
  hasResult: boolean;
  isLoading: boolean;
}): CareerTileState {
  if (hasResult) return 'completed';
  if (hasGame) return 'available';
  return isLoading ? 'loading' : 'unavailable';
}
