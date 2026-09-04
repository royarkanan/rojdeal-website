import Link from 'next/link';
import type { Locale } from '@/lib/i18n-config';
import { pageHref } from '@/lib/pagination';
const copy = {
  ar: ['صفحات النتائج', 'السابق', 'التالي'], ku: ['Rûpelên encaman', 'Berê', 'Piştî'],
  de: ['Ergebnisseiten', 'Zurück', 'Weiter'], en: ['Result pages', 'Previous', 'Next'],
};
export function Pagination({lang, page, hasNext, path, params}: {lang:Locale;page:number;hasNext:boolean;path:string;params:Record<string,unknown>}) {
  const t=copy[lang], numbers=[...new Set([1, Math.max(1,page-1),page,...(hasNext?[page+1]:[])])];
  const style='inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold';
  return <nav aria-label={t[0]} className="flex flex-wrap items-center justify-center gap-2 py-4">
    {page>1 ? <Link className={style} href={pageHref(path,params,page-1)}>{t[1]}</Link> : <span aria-disabled="true" className={`${style} opacity-40`}>{t[1]}</span>}
    {numbers.map((n,i)=><span key={n} className="flex items-center gap-2">{i>0 && n>numbers[i-1]+1 && <span>…</span>}<Link aria-current={n===page?'page':undefined} className={`${style} ${n===page?'bg-rojRed text-white':'bg-white'}`} href={pageHref(path,params,n)}>{n}</Link></span>)}
    {hasNext ? <Link className={style} href={pageHref(path,params,page+1)}>{t[2]}</Link> : <span aria-disabled="true" className={`${style} opacity-40`}>{t[2]}</span>}
  </nav>;
}
