import { AccountDeletionPanel } from "@/components/auth/AccountDeletionPanel";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { i18n, type Locale } from "@/lib/i18n-config";
export default async function Page({params}:{params:Promise<{lang:string}>}){const{lang:raw}=await params;const lang=(i18n.locales.includes(raw as Locale)?raw:i18n.defaultLocale)as Locale;return <div className="space-y-4 py-5"><AccountBackLink lang={lang}/><AccountDeletionPanel lang={lang}/></div>}
import {informationMetadata} from '@/lib/page-metadata';
export const generateMetadata=({params}:{params:Promise<{lang:string}>})=>informationMetadata(params,'account-deletion');
