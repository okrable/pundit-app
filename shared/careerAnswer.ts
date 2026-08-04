export interface CareerAnswerKey {
  canonicalName: string;
  acceptedAliases?: string[];
  acceptedSurnames?: string[];
}

export function normalizeCareerAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function editDistanceWithinOne(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  if (Math.abs(left.length - right.length) > 1) {
    return false;
  }

  if (left.length === right.length) {
    let differences = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        differences += 1;
        if (differences > 1) {
          return false;
        }
      }
    }
    return differences === 1;
  }

  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shortIndex = 0;
  let longIndex = 0;
  let edits = 0;

  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }

    edits += 1;
    longIndex += 1;
    if (edits > 1) {
      return false;
    }
  }

  return true;
}

export function matchesCareerAnswer(
  submittedAnswer: string,
  answerKey: CareerAnswerKey
): boolean {
  const normalizedSubmission = normalizeCareerAnswer(submittedAnswer);
  if (!normalizedSubmission) {
    return false;
  }

  const acceptedAnswers = Array.from(
    new Set(
      [
        answerKey.canonicalName,
        ...(answerKey.acceptedAliases ?? []),
        ...(answerKey.acceptedSurnames ?? []),
      ]
        .map(normalizeCareerAnswer)
        .filter(Boolean)
    )
  );

  if (acceptedAnswers.includes(normalizedSubmission)) {
    return true;
  }

  if (normalizedSubmission.length < 7) {
    return false;
  }

  const fuzzyMatches = acceptedAnswers.filter(
    (candidate) =>
      candidate.length >= 7 &&
      editDistanceWithinOne(normalizedSubmission, candidate)
  );

  return fuzzyMatches.length === 1;
}
