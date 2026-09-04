import type {Metadata} from 'next';
import {siteUrl} from './site';
const titles={
 about:['عن RojDeal','Derbarê RojDeal','Über RojDeal','About RojDeal'],
 safety:['قواعد السلامة','Rêbazên ewlehiyê','Sicherheitshinweise','Safety'],
 contact:['التواصل والدعم','Têkilî û piştgirî','Kontakt und Support','Contact and support'],
 privacy:['الخصوصية','Nepenî','Datenschutz','Privacy'],
 terms:['الشروط','Merc','Bedingungen','Terms'],
 imprint:['بيانات الناشر','Agahiyên weşanger','Impressum','Legal notice'],
 'how-to':['كيفية الاستخدام','RojDeal çawa tê bikaranîn','So funktioniert RojDeal','How RojDeal works'],
 'community-rules':['قواعد المجتمع','Rêbazên civakê','Community-Regeln','Community rules'],
 'account-deletion':['حذف الحساب والبيانات','Jêbirina hesab û daneyan','Konto und Daten löschen','Delete account and data'],
};
export async function informationMetadata(params:Promise<{lang:string}>,page:keyof typeof titles):Promise<Metadata>{
 const {lang}=await params,index=['ar','ku','de','en'].indexOf(lang),locale=index<0?'ar':lang;
 return {title:titles[page][Math.max(index,0)],alternates:{canonical:`${siteUrl}/${locale}/${page}`,languages:Object.fromEntries(['ar','ku','de','en'].map(code=>[code,`${siteUrl}/${code}/${page}`]))}};
}
