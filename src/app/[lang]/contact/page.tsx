import {SupportForm} from "@/components/support/SupportForm";import{i18n,type Locale}from"@/lib/i18n-config";export default async function Contact({params}:{params:Promise<{lang:string}>}){const{lang:r}=await params;const lang=(i18n.locales.includes(r as Locale)?r:i18n.defaultLocale)as Locale;return <SupportForm lang={lang}/>}
import {informationMetadata} from '@/lib/page-metadata';
export const generateMetadata=({params}:{params:Promise<{lang:string}>})=>informationMetadata(params,'contact');
