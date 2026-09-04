import{InfoPage}from"@/components/legal/InfoPage";import{i18n,type Locale}from"@/lib/i18n-config";export default async function Page({params}:{params:Promise<{lang:string}>}){const{lang:r}=await params;const lang=(i18n.locales.includes(r as Locale)?r:i18n.defaultLocale)as Locale;return <InfoPage lang={lang} kind="terms"/>}
import {informationMetadata} from '@/lib/page-metadata';
export const generateMetadata=({params}:{params:Promise<{lang:string}>})=>informationMetadata(params,'terms');
