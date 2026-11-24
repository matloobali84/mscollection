export function whatsAppLink(phone:string|undefined,message=''){
 let digits=(phone||'').replace(/\D/g,'');if(digits.startsWith('03'))digits='92'+digits.slice(1);
 if(!/^\d{10,15}$/.test(digits))return null;
 return `https://wa.me/${digits}${message?'?text='+encodeURIComponent(message):''}`;
}
