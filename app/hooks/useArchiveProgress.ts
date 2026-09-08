import { useCallback,useEffect,useRef,useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { createArchiveRepository,type ArchiveRecord } from '../../shared/archive';
export const archiveRepository=createArchiveRepository(AsyncStorage);
export function useGameIdentity() {
  const auth=useAuthStore(s=>s.isAuthenticated?s.user?.sub:null);
  const scope=auth??'guest';
  const [resolved,setResolved]=useState<{scope:string;id:string}|null>(null);
  useEffect(()=>{let active=true;void (async()=>{const id=auth??await getUserId();if(active)setResolved({scope,id});})();return()=>{active=false;};},[auth,scope]);
  return resolved?.scope===scope?resolved.id:null;
}
export function useArchiveProgress(id:string|null) {
  const [record,setRecord]=useState<ArchiveRecord|null>(null);
  const [error,setError]=useState<string|null>(null);
  const current=useRef(id);current.current=id;
  const reload=useCallback(async()=>{
    if(!id)return;
    try{const r=await archiveRepository.read(id);if(current.current===id){setRecord(r);setError(null);}}
    catch{if(current.current===id)setError('Unable to read archive progress. Please retry.');}
  },[id]);
  useEffect(()=>{void reload();},[reload]);
  const update=useCallback(async(change:(r:ArchiveRecord)=>ArchiveRecord)=>{
    if(!id)throw Error('Archive is not ready');
    try{const r=await archiveRepository.update(id,change);if(current.current===id){setRecord(r);setError(null);}return r;}
    catch(e){if(current.current===id)setError('Unable to save archive progress. Keep this screen open and retry.');throw e;}
  },[id]);
  return {record:record?.userId===id?record:null,error,reload,update};
}
