import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {settings} from './config';import {problem} from './auth';
export async function processUpload(req:FastifyRequest){
 const file=await req.file();if(!file)problem(400,'Select an image');
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.mimetype))problem(400,'Only JPEG, PNG, WebP and AVIF images are accepted');
 const buffer=await file.toBuffer();let metadata;try{metadata=await sharp(buffer,{limitInputPixels:24000000}).metadata()}catch{problem(400,'Invalid image data')}
 if(!metadata||!['jpeg','png','webp','avif','heif'].includes(metadata.format||''))problem(400,'Invalid image format');
 const id=randomUUID(),variants:Record<string,string>={};await mkdir(settings.mediaDir,{recursive:true});
 for(const size of [256,512,1024]){const data=await sharp(buffer,{limitInputPixels:24000000}).rotate().resize(size,size,{fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer().catch(()=>problem(400,'Image cannot be decoded. Please upload a valid image.'));const key=`${id}-${size}.webp`;
  if(process.env.S3_BUCKET){if(!process.env.S3_PUBLIC_URL)problem(503,'Set S3_PUBLIC_URL for media delivery');const client=new S3Client({region:process.env.S3_REGION||'us-east-1',endpoint:process.env.S3_ENDPOINT,forcePathStyle:!!process.env.S3_ENDPOINT});await client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:`products/${key}`,Body:data,ContentType:'image/webp',CacheControl:'public,max-age=31536000,immutable'}));variants[size]=`${process.env.S3_PUBLIC_URL}/products/${key}`;
  }else{if(settings.secure&&process.env.LOCAL_MEDIA_STORAGE!=='true')problem(503,'Configure persistent media storage for production');await writeFile(resolve(settings.mediaDir,key),data);variants[size]=`/media/${key}`;}
 }
 return {url:variants[1024],variants,alt:file.filename.replace(/\.[^.]+$/,'')};
}
export function storageRoutes(app:FastifyInstance){app.post('/api/v1/admin/media',async req=>processUpload(req));}
