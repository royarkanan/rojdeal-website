'use client';
import {useEffect,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {supabase} from '@/lib/supabase';
import {currentUser} from '@/services/account';
export function useAccount(){
 const [state,setState]=useState<{user:User|null;loading:boolean;error:boolean}>({user:null,loading:true,error:false});
 const [version,setVersion]=useState(0);
 useEffect(()=>{let live=true,changed=false;
 const {data}=supabase.auth.onAuthStateChange((_event,session)=>{changed=true;if(live)setState({user:session?.user??null,loading:false,error:false});});
 void currentUser().then(user=>{if(live&&!changed)setState({user,loading:false,error:false});}).catch(()=>{if(live&&!changed)setState({user:null,loading:false,error:true});});
 return()=>{live=false;data.subscription.unsubscribe();};
 },[version]);
 return {...state,retry:()=>setVersion(v=>v+1)};
}
