import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
export const sql=neon(process.env.DATABASE_URL);
export function hashPassword(password) {
 const salt=randomBytes(16).toString('hex');
 return 'scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex');
}
export function checkPassword(password,stored) {
 if(typeof stored!=='string'||!stored.startsWith('scrypt$'))return false;
 const [,salt,hash]=stored.split('$');
 if(!salt||!hash)return false;
 const a=Buffer.from(hash,'hex'),b=scryptSync(password,salt,a.length);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export function validOrigin(req) {
 const origin=req.headers.origin;
 if(!origin)return false;
 try {
  const url=new URL(origin);
  return url.protocol==='https:'&&url.host===req.headers.host;
 }catch{return false;}
}
export function cookie(res,token,maxAge=0) {
 res.setHeader('Set-Cookie','gp_session='+encodeURIComponent(token||'')+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge);
}
export async function session(req) {
 const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('gp_session='))?.slice(11);
 if(!token||!(/^[a-f0-9]{64}$/.test(token)))return null;
 const users=await sql\`SELECT u.id,u.email,u.display_name,u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=\${sha256(token)} AND s.expires_at>now() LIMIT 1\`;
 return users[0]||null;
}
export async function issueSession(user,res) {
 const token=randomBytes(32).toString('hex');
 await sql\`INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES (\${user.id},\${sha256(token)},now()+interval '7 days')\`;
 cookie(res,token,604800);
}
export function jsonError(res,status,error){return res.status(status).json({error});}
export function onlyJson(req,res){
 if(!req.headers['content-type']?.startsWith('application/json')){jsonError(res,415,'JSON gerekli');return false;}
 return true;
}