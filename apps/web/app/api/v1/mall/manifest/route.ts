import {shops,floors,isVisible} from '@ms/shared';
export const dynamic='force-static';
export function GET(){return Response.json({name:'MS Collection',floors:floors.filter(f=>f.active&&shops.some(s=>s.floor===f.id&&isVisible(s))),shops:shops.filter(s=>isVisible(s)),revision:1});}
