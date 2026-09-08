import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/rootNavigation';
import {theme} from '../theme/theme';
import CenteredWebContent,{webContentWidth} from '../components/ResponsiveLayout';
import {fetchApi} from '../services/api';
import {useArchiveProgress,useGameIdentity} from '../hooks/useArchiveProgress';
import {trackAnalyticsEvent} from '../services/analytics';
import {getQuizDate} from '../utils/quizDate';
interface Entry{date:string;id:string;contentVersion:string;}
type Props=NativeStackScreenProps<RootStackParamList,'Archive'>;
export default function ArchiveScreen({navigation}:Props){
  const id=useGameIdentity();const {record,error:storageError,reload}=useArchiveProgress(id);
  const [entries,setEntries]=useState<Entry[]>([]);const [cursor,setCursor]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(false);
  const pending=useRef(false);const mounted=useRef(true);const day=getQuizDate();
  useEffect(()=>()=>{mounted.current=false;},[]);
  const load=useCallback(async(before?:string)=>{
    if(pending.current)return;pending.current=true;setLoading(true);setError(null);
    try{const r=await fetchApi<{quizzes:Entry[];nextCursor:string|null}>(`/getArchiveCatalog${before?`?before=${before}`:''}`);
      if(mounted.current){setEntries(old=>before?[...old,...r.quizzes.filter(q=>!old.some(e=>e.date===q.date))]:r.quizzes);setCursor(r.nextCursor);}}
    catch{if(mounted.current)setError('The archive could not be loaded. Check your connection and retry.');}
    finally{pending.current=false;if(mounted.current)setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load,day]);
  useFocusEffect(useCallback(()=>{void reload();},[reload]));
  const tracked=useRef<string|null>(null);
  useEffect(()=>{if(id&&tracked.current!==id){tracked.current=id;trackAnalyticsEvent('archive_opened',id.startsWith('guest_')?'guest':'authenticated');}},[id]);
  return <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <CenteredWebContent maxWidth={webContentWidth.quiz}>
        <Pressable style={styles.back} onPress={()=>navigation.goBack()} accessibilityRole="button"><Text style={styles.link}>← Games</Text></Pressable>
        <Text style={styles.title}>Quiz Archive</Text>
        <Text style={styles.copy}>A fresh chance at past quizzes. Archive scores stay separate from your daily record.</Text>
        {record?.active?<Pressable style={styles.primary} onPress={()=>navigation.navigate('ArchiveQuiz',{date:record.active!.quiz.date})} accessibilityRole="button">
          <Text style={styles.primaryText}>Resume {record.active.quiz.date}</Text>
        </Pressable>:null}
        {storageError?<Text style={styles.error}>{storageError}</Text>:null}
        {entries.filter(e=>e.date<day).map(entry=>{
          const result=record?.results[entry.date];
          return <Pressable style={styles.row} key={entry.date} onPress={()=>navigation.navigate('ArchiveQuiz',{date:entry.date})} accessibilityRole="button" accessibilityLabel={`Play archive quiz ${entry.date}${result?`, latest score ${result.score}`:''}`}>
            <View style={{flex:1}}><Text style={styles.date}>{new Date(`${entry.date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'})}</Text>
              <Text style={styles.detail}>{result?`Played on this device · Latest ${result.score}/500`:'Five questions'}</Text></View>
            <Text style={styles.link}>{result?'Replay':'Play'} →</Text>
          </Pressable>;
        })}
        {loading?<ActivityIndicator color={theme.colors.accent} style={{margin:20}}/>:null}
        {error?<><Text style={styles.error}>{error}</Text><Pressable style={styles.primary} onPress={()=>void load(cursor??undefined)}><Text style={styles.primaryText}>Retry</Text></Pressable></>:null}
        {!loading&&!error&&entries.length===0?<Text style={styles.copy}>No complete past quizzes are available yet.</Text>:null}
        {cursor&&!loading&&!error?<Pressable style={styles.primary} onPress={()=>void load(cursor)}><Text style={styles.primaryText}>Load older quizzes</Text></Pressable>:null}
        {!cursor&&entries.length>0?<Text style={styles.detail}>You’ve reached the earliest available quizzes. Pick any date to play again.</Text>:null}
      </CenteredWebContent>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:theme.colors.background},scroll:{padding:20,paddingBottom:40},back:{minHeight:44,justifyContent:'center'},
  title:{fontFamily:theme.fonts.uniSansHeavy,fontSize:36,color:theme.colors.textDark},copy:{fontFamily:theme.fonts.gothamBook,fontSize:15,lineHeight:23,color:theme.colors.textDark,marginVertical:16},
  row:{backgroundColor:theme.colors.white,borderRadius:theme.borderRadius.lg,padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',gap:12},
  date:{fontFamily:theme.fonts.gothamBold,fontSize:17,color:theme.colors.textDark},detail:{fontFamily:theme.fonts.gothamBook,fontSize:13,lineHeight:20,color:theme.colors.textDark,marginVertical:6},
  link:{fontFamily:theme.fonts.gothamBold,fontSize:14,color:theme.colors.accent},primary:{backgroundColor:theme.colors.accent,borderRadius:24,padding:14,alignItems:'center',marginVertical:12},
  primaryText:{fontFamily:theme.fonts.gothamBold,color:theme.colors.white,fontSize:15},error:{fontFamily:theme.fonts.gothamMedium,color:theme.colors.incorrect,lineHeight:22,marginVertical:10},
});
