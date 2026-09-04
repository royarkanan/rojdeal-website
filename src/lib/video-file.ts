export function inspectVideo(file:File, signal:AbortSignal,limits={maxVideoBytes:48*1024*1024,maxVideoSeconds:300}):Promise<number> {
  return new Promise((resolve,reject)=>{
    if(signal.aborted || file.size>limits.maxVideoBytes || !['video/mp4','video/quicktime'].includes(file.type)){reject(new Error('invalid_video'));return;}
    const element=document.createElement('video'),url=URL.createObjectURL(file);
    const finish=(duration?:number)=>{
      clearTimeout(timer);signal.removeEventListener('abort',abort);
      element.onloadedmetadata=null;element.onerror=null;element.removeAttribute('src');element.load();URL.revokeObjectURL(url);
      if(duration && Number.isFinite(duration) && duration<=limits.maxVideoSeconds)resolve(duration);else reject(new Error('invalid_video'));
    };
    const abort=()=>finish();
    const timer=setTimeout(abort,15000);
    signal.addEventListener('abort',abort,{once:true});
    element.preload='metadata';element.onloadedmetadata=()=>finish(element.duration);element.onerror=abort;element.src=url;
  });
}
