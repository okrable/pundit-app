import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { requireCompletedIdentity } from './lib/identity';
import { enforceRateLimit } from './lib/rateLimit';
import { isJourneyOutcome } from '../../shared/journeyOutcome';
import { persistJourneyOutcome, JourneyResultError } from './lib/journeyResults';
const handler: LambdaHandler = async event => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (statusCode: number, body: unknown) => ({ statusCode, headers, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return reply(200, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, gameId } = body;
    const version = body.contractVersion === 2 ? 2 : 1;
    const outcome = version === 1 ? 'solved' : body.outcome;
    const answer = body.submittedAnswer ?? '';
    if (typeof userId !== 'string' || !userId || userId.startsWith('guest_') ||
        typeof gameId !== 'string' || !/^career-\d{4}-\d{2}-\d{2}$/.test(gameId) ||
        !isJourneyOutcome(outcome) || typeof answer !== 'string' || answer.length > 120 ||
        (outcome === 'solved' && !answer.trim())) return reply(400,{error:'Invalid Journey completion'});
    const identity = await requireCompletedIdentity(event,userId,headers);
    if (identity.response) return identity.response;
    const limited = await enforceRateLimit(event,headers,{scope:'complete-career-game',subject:userId,limit:12,windowSeconds:300});
    if (limited) return limited;
    return reply(200,{result:await persistJourneyOutcome(userId,gameId,outcome,answer,version)});
  } catch(error) {
    if (error instanceof JourneyResultError) return reply(error.status,{error:error.code,code:error.code});
    return reply(error instanceof SyntaxError ? 400 : 500,{error:'Unable to save Journey'});
  }
};
export default withLambda(handler);
