import {sql,session,validOrigin,onlyJson,jsonError} from './_auth.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
const user=await session(req);
if(req.method==='GET'){const all=user?.role==='admin';const rows=all?await sql`SELECT * FROM market_areas ORDER BY country_code,period_key`:await sql`SELECT country_code,title,period_key,start_date,end_date FROM market_areas WHERE enabled=true AND (start_date IS NULL OR start_date<=CURRENT_DATE) AND (end_date IS NULL OR end_date>=CURRENT_DATE) ORDER BY country_code,period_key`;return res.status(200).json({areas:rows});}
if(req.method!=='POST')return jsonError(res,405,'Method not allowed');
if(!user||user.role!=='admin')return jsonError(res,403,'Admin only');
if(!validOrigin(req)||!onlyJson(req,res))return;
const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
const country=String(b.country_code||'').trim().toUpperCase(),key=String(b.period_key||'').trim().toLowerCase(),title=String(b.title||'').trim();
if(!/^[A-Z]{2}$/.test(country)||!/^[a-z0-9_-]{2,35}$/.test(key)||title.length<3||title.length>100)return jsonError(res,400,'Geçersiz alan bilgileri');
const start=b.start_date||null,end=b.end_date||null;
if((start&&!/^\d{4}-\d{2}-\d{2}$/.test(start))||(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end))||(start&&end&&start>end))return jsonError(res,400,'Geçersiz tarih aralığı');
const rows=await sql`INSERT INTO market_areas(country_code,period_key,title,start_date,end_date,enabled) VALUES(${country},${key},${title},${start},${end},${b.enabled===true}) ON CONFLICT(country_code,period_key) DO UPDATE SET title=EXCLUDED.title,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,enabled=EXCLUDED.enabled,updated_at=now() RETURNING *`;
return res.status(200).json({area:rows[0]});
}catch(e){console.error(e);return jsonError(res,500,'İşlem başarısız')}}