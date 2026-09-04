'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
export function FilePreview({file}:{file:File}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const value=URL.createObjectURL(file);setUrl(value);return()=>URL.revokeObjectURL(value);},[file]);
  return url?<Image src={url} alt="" fill unoptimized className="object-cover"/>:null;
}
