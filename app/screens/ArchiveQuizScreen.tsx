import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,ScrollView,Share,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/rootNavigation';
import QuestionCard from '../components/QuestionCard';
import {theme} from '../theme/theme';
import CenteredWebContent,{webContentWidth} from '../components/ResponsiveLayout';
import {fetchApi,ApiError} from '../services/api';
import {useArchiveProgress,useGameIdentity,archiveRepository} from '../hooks/useArchiveProgress';
import {archiveShare,completeArchive,isArchiveDate,startArchive,validArchiveQuiz,type ArchiveQuiz,type ArchiveRecord} from '../../shared/archive';
import {DAILY_QUIZ_REVEAL_DELAY_MS,DAILY_QUIZ_TIMER_MS,getDailyQuizRemainingSeconds,normalizeDailyQuizAttempt} from '../../shared/dailyQuizAttempt';
import {calculateQuizPoints} from '../../shared/scoring';
import {trackAnalyticsEvent} from '../services/analytics';
import {getQuizDate} from '../utils/quizDate';

type Props=NativeStackScreenProps<RootStackParamList,'ArchiveQuiz'>;
export default function ArchiveQuizScreen({navigation,route}:Props){
  const {date}=route.params;const id=useGameIdentity();
  const {record,error:storageError,update,reload}=useArchiveProgress(id);
  const [loaded,setLoaded]=useState<{id:string;quiz:ArchiveQuiz}|null>(null);
  const [loadError,setLoadError]=useState<string|null>(null);const [notice,setNotice]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);const [reloadKey,setReloadKey]=useState(0);
  const [remaining,setRemaining]=useState(20);const [holding,setHolding]=useState(false);const [height,setHeight]=useState(0);
  const scroll=useRef<ScrollView>(null);const busy=useRef(false);const completing=useRef<string|null>(null);
  const currentId=useRef(id);currentId.current=id;
  const quiz=loaded?.id===id?loaded.quiz:null;
  const active=record?.active?.quiz.date===date?record.active:null;
  const attempt=active&&quiz&&active.quiz.contentVersion===quiz.contentVersion?active.attempt:null;
  const actor=id?.startsWith('guest_')?'guest' as const:'authenticated' as const;
  useEffect(()=>{
    let live=true;setLoading(true);setLoaded(null);setLoadError(null);setNotice(null);completing.current=null;
    if(!id)return;
    void (async()=>{
      const cached=await archiveRepository.read(id);
      if(!isArchiveDate(date,getQuizDate()))throw Error('Choose a past quiz from the Archive.');
      let selected:ArchiveQuiz;
      try{selected=(await fetchApi<{quiz:ArchiveQuiz}>(`/getArchiveQuiz?date=${encodeURIComponent(date)}`)).quiz;}
      catch(e){
        const retryable=!(e instanceof ApiError)||e.statusCode>=500||e.statusCode===408;
        if(!retryable||cached.active?.quiz.date!==date)throw e;
        selected=cached.active.quiz;if(live)setNotice('Continuing your saved quiz. Content updates cannot be checked while offline.');
      }
      if(!validArchiveQuiz(selected))throw Error('This archive quiz is unavailable.');
      if(!live||currentId.current!==id)return;
      if(cached.active?.quiz.date===date&&cached.active.quiz.contentVersion!==selected.contentVersion){
        await update(r=>({...r,active:r.active?.quiz.date===date?null:r.active}));
        if(live)setNotice('This quiz has been corrected. Start a fresh attempt using the updated questions.');
      }
      if(live)setLoaded({id,quiz:selected});
    })().catch(()=>{if(live)setLoadError('Unable to open this quiz. Connect and retry, or choose another date.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[id,date,reloadKey,update]);

  const save=(change:(r:ArchiveRecord)=>ArchiveRecord)=>{
    if(busy.current)return;busy.current=true;
    void update(change).catch(()=>{}).finally(()=>{busy.current=false;});
  };
  useEffect(()=>{
    if(!attempt||!quiz)return;
    const normalized=normalizeDailyQuizAttempt(attempt,5);
    if(normalized.phase!==attempt.phase||normalized.score!==attempt.score||normalized.questionIndex!==attempt.questionIndex){
      save(r=>r.active?{...r,active:{...r.active,attempt:normalizeDailyQuizAttempt(r.active.attempt,5)}}:r);return;
    }
    if(attempt.phaseEndsAt===null)return;
    const timer=setTimeout(()=>save(r=>r.active?{...r,active:{...r.active,attempt:normalizeDailyQuizAttempt(r.active.attempt,5)}}:r),Math.max(0,attempt.phaseEndsAt-Date.now())+10);
    return()=>clearTimeout(timer);
  },[attempt,quiz,update]);
  useEffect(()=>{
    if(!attempt)return;
    const sync=()=>setRemaining(attempt.phase==='answering'?getDailyQuizRemainingSeconds(attempt):attempt.phase==='preparing'?20:Math.ceil((attempt.answerTimings[quiz?.questions[attempt.questionIndex]?.id??'']??0)/1000));
    sync();const timer=setInterval(sync,250);return()=>clearInterval(timer);
  },[attempt,quiz]);
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active')void reload();});return()=>listener.remove();},[reload]);
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[attempt?.questionIndex]);
  useEffect(()=>{
    if(!attempt||attempt.phase!=='completing'||!id||completing.current===`${id}:${attempt.startedAt}`)return;
    const key=`${id}:${attempt.startedAt}`;completing.current=key;
    void update(r=>completeArchive(r)).then(r=>{
      if(currentId.current===id)trackAnalyticsEvent('archive_quiz_completed',actor,{quizDate:date,score:r.results[date].score,totalQuestions:5,durationMs:Math.min(Math.max(Date.now()-attempt.startedAt,0),600000)});
    }).catch(()=>{completing.current=null;});
  },[attempt,id,update,date,actor]);

  const start=()=>{
    if(!quiz||!id||busy.current)return;busy.current=true;
    void update(r=>startArchive(r,quiz)).then(()=>{
      if(currentId.current===id)trackAnalyticsEvent('archive_quiz_started',actor,{quizDate:date,totalQuestions:5});
    }).catch(()=>{}).finally(()=>{busy.current=false;completing.current=null;});
  };
  const ready=()=>save(r=>{
    if(!r.active||r.active.attempt.phase!=='preparing')return r;
    return {...r,active:{...r.active,attempt:{...r.active.attempt,phase:'answering',timerEndsAt:Date.now()+DAILY_QUIZ_TIMER_MS,updatedAt:Date.now()}}};
  });
  const select=(index:number)=>save(r=>{
    if(!r.active||r.active.attempt.phase!=='answering')return r;
    const a=r.active.attempt;const q=r.active.quiz.questions[a.questionIndex];
    if(a.answers[q.id]!==undefined)return r;
    const now=Date.now();const time=Math.max((a.timerEndsAt??now)-now,0);
    return {...r,active:{...r.active,attempt:{...a,answers:{...a.answers,[q.id]:index},answerTimings:{...a.answerTimings,[q.id]:time},
      pendingPoints:q.correctOptionIndex===index?calculateQuizPoints(time):0,phase:'answer_locked',timerEndsAt:null,phaseEndsAt:now+DAILY_QUIZ_REVEAL_DELAY_MS,updatedAt:now}}};
  });
  const result=record?.results[date];
  const question=quiz&&attempt?quiz.questions[attempt.questionIndex]:null;
  return <SafeAreaView style={styles.container}>
    <View style={styles.header}><Pressable onPress={()=>navigation.goBack()} accessibilityRole="button" style={styles.back}><Text style={styles.link}>← Archive</Text></Pressable><Text style={styles.label}>ARCHIVE · {date}</Text></View>
    {notice?<Text style={styles.notice}>{notice}</Text>:null}
    {storageError?<Pressable onPress={()=>{completing.current=null;save(r=>({...r}));}}><Text style={styles.error}>{storageError} Retry</Text></Pressable>:null}
    {loading?<ActivityIndicator color={theme.colors.accent} style={{margin:24}}/>:null}
    {loadError?<View style={styles.panel}><Text style={styles.copy}>{loadError}</Text><Pressable style={styles.button} onPress={()=>setReloadKey(k=>k+1)}><Text style={styles.buttonText}>Retry</Text></Pressable></View>:null}
    {!loading&&!loadError&&quiz&&!attempt?<ScrollView contentContainerStyle={styles.panel}><CenteredWebContent maxWidth={webContentWidth.quiz}>
      <Text style={styles.title}>{result?'Archive result':'A fresh chance'}</Text>
      {result?<><Text style={styles.score}>{result.score}/500</Text><Text style={styles.emojis}>{result.answers.map(a=>a?'⚽️':'❌').join('')}</Text>
        <Pressable style={styles.secondary} onPress={()=>void Share.share({message:archiveShare(result)}).catch(()=>{})}><Text style={styles.link}>Share archive result</Text></Pressable></>:null}
      <Text style={styles.copy}>Five questions. Your archive score stays separate from today’s quiz, streak and league tables.</Text>
      {record?.active&&record.active.quiz.date!==date?<Text style={styles.copy}>Starting this quiz replaces your unfinished archive attempt from {record.active.quiz.date}.</Text>:null}
      <Pressable style={styles.button} onPress={start} disabled={!record}><Text style={styles.buttonText}>{result?'Play again':'Start quiz'}</Text></Pressable>
      <Pressable style={styles.secondary} onPress={()=>navigation.goBack()}><Text style={styles.link}>Choose another date</Text></Pressable>
    </CenteredWebContent></ScrollView>:null}
    {!loading&&question&&attempt?<Pressable style={{flex:1}} onPressIn={()=>setHolding(true)} onPressOut={()=>setHolding(false)} onLayout={e=>setHeight(e.nativeEvent.layout.height)}>
      <ScrollView ref={scroll} contentContainerStyle={{flexGrow:1}} keyboardShouldPersistTaps="handled">
        <CenteredWebContent maxWidth={webContentWidth.quiz} style={{flex:1}}>
          <QuestionCard key={question.id} question={question} selectedOption={attempt.answers[question.id]??null} onSelectOption={select}
            disabled={attempt.phase!=='answering'||!!storageError} isExiting={attempt.phase==='exiting'} showResult={attempt.phase==='result_reveal'||attempt.phase==='exiting'}
            correctOptionIndex={question.correctOptionIndex} isHolding={holding} onOptionsReady={ready} revealImmediately={attempt.phase!=='preparing'}
            viewportHeight={height} questionNumber={attempt.questionIndex+1} totalQuestions={5} score={attempt.score} timerDuration={20}
            timerActive={attempt.phase==='answering'&&remaining>0} timeRemaining={remaining} setTimeRemaining={setRemaining} onTimeUp={()=>setRemaining(0)} />
        </CenteredWebContent>
      </ScrollView>
    </Pressable>:null}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:theme.colors.background},header:{paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'},back:{minHeight:44,justifyContent:'center'},
  label:{fontFamily:theme.fonts.gothamBold,color:theme.colors.textDark,fontSize:12},link:{fontFamily:theme.fonts.gothamBold,color:theme.colors.accent,fontSize:14},
  notice:{padding:12,fontFamily:theme.fonts.gothamBook,color:theme.colors.textDark,fontSize:13},error:{padding:12,fontFamily:theme.fonts.gothamMedium,color:theme.colors.incorrect},
  panel:{padding:24,flexGrow:1,justifyContent:'center'},title:{fontFamily:theme.fonts.uniSansHeavy,color:theme.colors.textDark,fontSize:36,textAlign:'center'},
  copy:{fontFamily:theme.fonts.gothamBook,color:theme.colors.textDark,fontSize:15,lineHeight:23,marginVertical:16,textAlign:'center'},
  score:{fontFamily:theme.fonts.gothamBlack,color:theme.colors.accent,fontSize:48,textAlign:'center',marginVertical:20},emojis:{fontSize:25,textAlign:'center'},
  button:{backgroundColor:theme.colors.accent,borderRadius:24,padding:16,minHeight:48,alignItems:'center'},buttonText:{fontFamily:theme.fonts.gothamBold,color:theme.colors.white,fontSize:16},secondary:{padding:16,alignItems:'center',minHeight:48},
});
