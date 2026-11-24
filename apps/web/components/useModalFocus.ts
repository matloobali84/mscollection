'use client';
import {useEffect} from 'react';
export function useModalFocus(open:boolean,dialogKey?:string){
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"]'),activeDialog=dialogs[dialogs.length-1];
  const background=[...document.querySelectorAll<HTMLElement>('body>div>main,body>div>header,body>div>footer')].filter(el=>!activeDialog||!el.contains(activeDialog)).map(el=>({el,inert:el.inert}));background.forEach(({el})=>el.inert=true);
  const frame=requestAnimationFrame(()=>{const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"]');dialogs[dialogs.length-1]?.querySelector<HTMLElement>('button,input,a[href],select,textarea,[tabindex="0"]')?.focus({preventScroll:true})});
  const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"]'),dialog=dialogs[dialogs.length-1];if(!dialog)return;const controls=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length>0);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first?.focus()}};
  document.addEventListener('keydown',trap);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',trap);document.body.style.overflow=overflow;background.forEach(({el,inert})=>el.inert=inert);if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[open,dialogKey]);
}
