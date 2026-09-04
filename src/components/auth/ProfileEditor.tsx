"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {ownProfile} from '@/services/account';
import type {Locale} from '@/lib/i18n-config';
import {accountText,type AccountLabel} from '@/lib/account-copy';
import {useAccount} from '@/components/account/useAccount';
import {AccountState} from '@/components/account/AccountState';
import {AccountPageHeader} from '@/components/account/AccountBackLink';
import {phoneInput,phoneText} from '@/lib/phone';
const copy={ar:{title:"تعديل الحساب",name:"الاسم الظاهر",phone:"رقم الهاتف مع رمز الدولة",type:"نوع الحساب",person:"شخصي",agency:"مكتب أو شركة",business:"اسم المكتب أو الشركة",address:"عنوان المكتب",call:"السماح بالاتصال المباشر",chooseImage:"اختيار صورة",noImage:"لم تُختر صورة جديدة",save:"حفظ",done:"تم حفظ الحساب.",fail:"تعذر حفظ الحساب."},ku:{title:"Hesab biguherîne",name:"Nav",phone:"Telefon",type:"Cureya hesabê",person:"Kesane",agency:"Ofîs",business:"Navê ofîsê",address:"Navnîşan",call:"Telefonê destûr bide",chooseImage:"Wêne hilbijêre",noImage:"Wêneyeke nû nehat hilbijartin",save:"Tomar bike",done:"Hesab hat tomarkirin.",fail:"Tomarkirin bi ser neket."},de:{title:"Konto bearbeiten",name:"Anzeigename",phone:"Telefon mit Ländervorwahl",type:"Kontotyp",person:"Privat",agency:"Büro oder Unternehmen",business:"Unternehmensname",address:"Büroadresse",call:"Direkte Anrufe erlauben",chooseImage:"Bild auswählen",noImage:"Kein neues Bild ausgewählt",save:"Speichern",done:"Konto gespeichert.",fail:"Konto konnte nicht gespeichert werden."},en:{title:"Edit account",name:"Display name",phone:"Phone with country code",type:"Account type",person:"Personal",agency:"Office or company",business:"Business name",address:"Office address",call:"Allow direct calls",chooseImage:"Choose image",noImage:"No new image selected",save:"Save",done:"Account saved.",fail:"Account could not be saved."}}as const;

export function ProfileEditor({lang}:{lang:Locale}){
 const auth=useAccount();
 if(auth.loading||auth.error||!auth.user)return <AccountState lang={lang} loading={auth.loading} error={auth.error} retry={auth.retry}/>;
 return <Editor key={auth.user.id} lang={lang} userId={auth.user.id}/>;
}
async function avatarJpeg(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('invalid_image');
 const bitmap=await createImageBitmap(file);
 try{const side=Math.min(bitmap.width,bitmap.height);if(!side)throw new Error('invalid_image');const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('invalid_image');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,512);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,512,512);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('invalid_image')),'image/jpeg',0.88));}finally{bitmap.close();}
}
function Editor({lang,userId}:{lang:Locale;userId:string}){
 const t=copy[lang],a=(key:AccountLabel)=>accountText(lang,key),lock=useRef(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[image,setImage]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [form,setForm]=useState({name:'',phone:'',type:'individual',business:'',address:'',call:true,avatar:'',latitude:'',longitude:''});
 useEffect(()=>{let live=true;setLoading(true);setError(false);
 void ownProfile(userId).then(p=>{if(live)setForm({name:String(p.display_name??''),phone:String(p.phone??''),type:p.account_type==='agency'?'agency':'individual',business:String(p.business_name??''),address:String(p.office_address??''),call:p.direct_call_enabled!==false,avatar:String(p.avatar_url??''),latitude:p.office_latitude==null?'':String(p.office_latitude),longitude:p.office_longitude==null?'':String(p.office_longitude)});}).catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});
 return()=>{live=false;};},[userId,version]);
 useEffect(()=>{if(!image){setPreview('');return;}const url=URL.createObjectURL(image);setPreview(url);return()=>URL.revokeObjectURL(url);},[image]);
 if(loading||error)return <AccountState lang={lang} loading={loading} error={error} retry={()=>setVersion(v=>v+1)}/>;
 const field='h-12 w-full min-w-0 rounded-2xl border bg-white px-4 text-base';
 return <form className="mx-auto max-w-3xl space-y-4 pb-20" onSubmit={async e=>{
 e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setMessage('');let uploaded:string|null=null,saved=false;
 try{
 const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||auth.user?.id!==userId)throw new Error('auth_changed');
 let avatar=form.avatar;
 if(image){const blob=await avatarJpeg(image);const path=`${userId}/${crypto.randomUUID()}.jpg`;const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(uploadError)throw uploadError;uploaded=path;avatar=supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;}
 const agency=form.type==='agency';
 const update={display_name:form.name.trim(),phone:form.phone.trim()||null,account_type:form.type,business_name:agency?form.business.trim()||null:null,office_address:agency?form.address.trim()||null:null,direct_call_enabled:form.call,avatar_url:avatar||null,office_latitude:agency&&form.latitude!==''?Number(form.latitude):null,office_longitude:agency&&form.longitude!==''?Number(form.longitude):null};
 const {data:rows,error:saveError}=await supabase.from('profiles').update(update).eq('id',userId).select('id');if(saveError)throw saveError;if(rows?.length!==1)throw new Error('not_saved');saved=true;
 setForm(v=>({...v,avatar}));setImage(null);
 const {error:metadataError}=await supabase.auth.updateUser({data:update});setMessage(metadataError?a('metadataError'):t.done);
 }catch{setMessage(saved?a('metadataError'):t.fail);if(uploaded&&!saved){try{await supabase.storage.from('profile-avatars').remove([uploaded]);}catch{/* Keep the actionable save error even when cleanup fails. */}}}finally{lock.current=false;setBusy(false);}
 }}>
 <AccountPageHeader lang={lang} title="edit"/>
 <fieldset disabled={busy} className="space-y-4 rounded-3xl bg-white p-4 shadow-sm disabled:opacity-60 sm:p-6">
 {(preview||/^https?:\/\//.test(form.avatar))&&<img src={preview||form.avatar} alt={a('avatar')} className="h-24 w-24 rounded-full border bg-white object-cover"/>}
 <label className="block min-w-0 space-y-2"><span className="block">{a('avatar')}</span><span className="flex min-h-12 items-center gap-3 rounded-2xl border bg-white px-4"><strong className="shrink-0 rounded-xl bg-rojRed px-4 py-2 text-white">{t.chooseImage}</strong><span className="min-w-0 truncate text-sm text-gray-600">{image?.name||t.noImage}</span></span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>{const file=e.target.files?.[0];if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setMessage(a('imageLimit'));e.target.value='';return;}setImage(file);setMessage('');}}}/><span className="block text-sm text-gray-600">{a('imageLimit')}</span></label>
 <label className="block space-y-2"><span>{t.name}</span><input required maxLength={120} className={field} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
 <label className="block space-y-2"><span>{t.phone}</span><input
 type="tel"
 inputMode="tel"
 autoComplete="tel"
 pattern="\\+[0-9]{7,15}"
 className={field}
 dir="ltr"
 value={form.phone}
 onChange={e=>setForm({...form,phone:phoneInput(e.target.value)})}
 onBlur={()=>setForm({...form,phone:phoneText(form.phone).replace(/[^0-9+]/g,'')})}
/></label>
 <label className="block space-y-2"><span>{t.type}</span><select className={field} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="individual">{t.person}</option><option value="agency">{t.agency}</option></select></label>
 {form.type==='agency'&&<><label className="block space-y-2"><span>{t.business}</span><input className={field} value={form.business} onChange={e=>setForm({...form,business:e.target.value})}/></label><label className="block space-y-2"><span>{t.address}</span><input className={field} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><div className="grid gap-3 sm:grid-cols-2"><label>{a('latitude')}<input type="number" step="any" min={-90} max={90} className={field} value={form.latitude} required={form.longitude!==''} onChange={e=>setForm({...form,latitude:e.target.value})}/></label><label>{a('longitude')}<input type="number" step="any" min={-180} max={180} className={field} value={form.longitude} required={form.latitude!==''} onChange={e=>setForm({...form,longitude:e.target.value})}/></label></div></>}
 <label className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold"><input type="checkbox" className="h-5 w-5 accent-rojRed" checked={form.call} onChange={e=>setForm({...form,call:e.target.checked})}/>{t.call}</label>
 <button className="w-full rounded-2xl bg-rojRed py-4 font-black text-white">{busy?'…':t.save}</button></fieldset>
 {message&&<p role="status" className="rounded-xl bg-white p-3 font-bold">{message}</p>}
 </form>;
}
