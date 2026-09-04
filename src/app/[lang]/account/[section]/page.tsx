import {notFound} from 'next/navigation';
import {AccountSection} from '@/components/account/AccountSection';
import {sections,type AccountSectionName} from '@/lib/account-sections';
import {i18n,type Locale} from '@/lib/i18n-config';
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{lang:string;section:string}>}){
 const {lang,section}=await params;
 if(!i18n.locales.includes(lang as Locale)||!sections.includes(section as AccountSectionName))notFound();
 return <AccountSection lang={lang as Locale} section={section as AccountSectionName}/>;
}
