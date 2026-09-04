import {SharedLegalDocuments} from '@/components/legal/SharedLegalDocuments';
import {i18n,type Locale} from '@/lib/i18n-config';
export default async function Page({params}:{params:Promise<{lang:string}>}){const {lang:raw}=await params;return <SharedLegalDocuments lang={(i18n.locales.includes(raw as Locale)?raw:i18n.defaultLocale)as Locale}/>;}
