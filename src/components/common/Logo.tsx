'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const Logo: React.FC<{ lang?: string }> = ({ lang = 'ar' }) => (
  <Link href={"/" + lang} className="flex items-center gap-2.5 group" aria-label="RojDeal">
    <Image src="/brand/rojdeal_mark.png" alt="" width={44} height={44} priority className="h-11 w-11 rounded-[14px]" />
    <span className="text-2xl font-black tracking-[-0.5px] text-rojNavy">RojDeal</span>
  </Link>
);
