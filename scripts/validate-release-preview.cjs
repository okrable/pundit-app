/* Run after npm test with PREVIEW_DATABASE_URL for the isolated acceptance database.
 * Creates only synthetic test users/results; never reads or modifies production results.
 */
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
if(!process.env.PREVIEW_DATABASE_URL)throw Error('PREVIEW_DATABASE_URL required');
const target=new URL(process.env.PREVIEW_DATABASE_URL);
if(decodeURIComponent(target.pathname)!=='/pundit_preview_v214')throw Error('Expected named isolated preview database');
process.env.CONTEXT='deploy-preview';
const db=require('../.test-dist/netlify/functions/lib/db');
const quiz=require('../.test-dist/netlify/functions/lib/quizResults');
const journey=require('../.test-dist/netlify/functions/lib/journeyResults');
const achievements=require('../.test-dist/netlify/functions/lib/achievements');
const {createSubmitQuizHandler}=require('../.test-dist/netlify/functions/submitQuiz');
(async()=>{
 const [{name}]=await db.query('SELECT current_database() AS name');assert.equal(name,'pundit_preview_v214');
 const prefix=`preview-v214-${randomUUID()}`;const date='2026-09-08';
 const keys=Array.from({length:5},(_,i)=>({question_id:`fixture-${i}`,player_name:'A',player_0:'A',player_1:'B',player_2:'C',player_3:'D'}));
 const deps={...db,...quiz,...achievements,requireCompletedIdentity:async()=>({}),enforceRateLimit:async()=>null,getAnswerKeyRows:async()=>keys};
 const handler=createSubmitQuizHandler(deps);
 const id=`${prefix}-quiz`;await db.query('INSERT INTO users(id) VALUES($1)',[id]);
 const event=(selected=0)=>({httpMethod:'POST',body:JSON.stringify({userId:id,quizId:`quiz-${date}`,answers:keys.map(k=>({questionId:k.question_id,selectedOptionIndex:selected,timeRemainingMs:20000}))})});
 const initial=await handler(event(),{});assert.equal(initial.statusCode,200);assert.equal(JSON.parse(initial.body).score,500);
 // Lost successful response, altered retry, and concurrent duplicate requests.
 const retries=await Promise.all(Array.from({length:4},()=>handler(event(3),{})));
 for(const r of retries){assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).score,500);assert.deepEqual(JSON.parse(r.body).newlyUnlockedAchievements,[]);}
 await db.query('INSERT INTO results(user_id,quiz_id,quiz_date,score,total_questions,answers) VALUES($1,$2,$3,100,5,$4)',[id,'quiz-2026-09-07','2026-09-07',[true,false,false,false,false]]);
 await Promise.all(Array.from({length:3},()=>quiz.withUserResultTransaction(id,c=>quiz.recomputeUserQuizStats(c,id))));
 const [stats]=await db.query('SELECT total_quizzes,total_correct,best_score FROM users WHERE id=$1',[id]);
 assert.deepEqual(Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Number(v)])),{total_quizzes:2,total_correct:6,best_score:500});
 for(const outcome of ['solved','given_up']){
  const user=`${prefix}-${outcome}`;await db.query('INSERT INTO users(id) VALUES($1)',[user]);
  const jd={transaction:quiz.withUserResultTransaction,read:journey.readJourneyResult,query:db.queryWithClient,game:async()=>({canonicalName:'Alan Shearer',acceptedSurnames:['Shearer']}),today:()=>date};
  await journey.persistJourneyOutcome(user,`career-${date}`,outcome,'Shearer',2,jd);
  const conflict=await Promise.all(Array.from({length:3},()=>journey.persistJourneyOutcome(user,`career-${date}`,outcome==='solved'?'given_up':'solved','Shearer',2,jd)));
  assert.ok(conflict.every(r=>r.outcome===outcome));
  if(outcome==='given_up')await assert.rejects(journey.persistJourneyOutcome(user,`career-${date}`,'solved','Shearer',1,jd),e=>e.status===409);
 }
 console.log('PASS: isolated Cockroach canonical retry, duplicate writes, stats projection and both Journey outcome conflicts.');
 console.log(`Synthetic acceptance prefix: ${prefix}`);
})().catch(e=>{console.error({name:e.name,code:e.code,message:e.message});process.exitCode=1;}).finally(()=>db.getPool().end());
