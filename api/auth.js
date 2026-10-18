import {sql,hashPassword,checkPassword,sha256,validOrigin,cookie,session,issueSession,jsonError,onlyJson} from './_auth.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 if(req.method==='GET')return res.status(200).json({user:await session(req)});
 if(req.method!=='POST')return jsonError(res,405,'Unsupported method');
 if(!validOrigin(req))return jsonError(res,403,'Invalid origin');
 if(!onlyJson(req,res))return;
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(b.action==='logout'){
  const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('gp_session='))?.slice(11);
  if(token&&/^[a-f0-9]{64}$/.test(token))await sql`DELETE FROM user_sessions WHERE token_hash=${sha256(token)}`;
  cookie(res,'',0);return res.status(200).json({ok:true});
 }
 if(b.action==='apply-chef'){
  const u=await session(req);if(!u)return jsonError(res,401,'Sign in first');
  const name=String(b.businessName||'').trim(),description=String(b.description||'').trim();
  if(name.length<3||name.length>120||description.length>2000)return jsonError(res,400,'Invalid application');
  const p=await sql`SELECT id FROM chef_applications WHERE user_id=${u.id} AND status='pending' LIMIT 1`;
  if(p.length)return jsonError(res,409,'Application already pending');
  await sql`INSERT INTO chef_applications(user_id,business_name,description) VALUES(${u.id},${name},${description})`;
  return res.status(201).json({ok:true,status:'pending'});
 }
 const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length>256)return jsonError(res,400,'Invalid credentials');
 if(b.action==='register'){
  const name=String(b.name||'').trim();
  if(name.length<2||name.length>100||password.length<12)return jsonError(res,400,'Name and minimum 12-character password required');
  const duplicate=await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`;
  if(duplicate.length)return jsonError(res,409,'Email already exists');
  const hash=hashPassword(password);
  const rows=await sql`INSERT INTO users(email,display_name,role,password_hash) VALUES(${email},${name},'customer',${hash}) RETURNING id,email,display_name,role`;
  await issueSession(rows[0],res);
  return res.status(201).json({user:rows[0]});
 }
 if(b.action==='login'){
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,100);
  const ipHash=sha256(ip),emailHash=sha256(email);
  const limits=await sql`SELECT
    (SELECT count(*)::int FROM auth_login_attempts WHERE ip_hash=${ipHash} AND attempted_at>now()-interval '15 minutes') AS ip_count,
    (SELECT count(*)::int FROM auth_login_attempts WHERE email_hash=${emailHash} AND attempted_at>now()-interval '15 minutes') AS email_count`;
  if(limits[0].ip_count>=30||limits[0].email_count>=8){
    res.setHeader('Retry-After','900');
    return jsonError(res,429,'Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin');
  }
  await sql`INSERT INTO auth_login_attempts(email_hash,ip_hash) VALUES(${emailHash},${ipHash})`;
  const rows=await sql`SELECT id,email,display_name,role,password_hash FROM users WHERE email=${email} LIMIT 1`;
  if(!rows.length||!checkPassword(password,rows[0].password_hash))return jsonError(res,401,'Invalid email or password');
  await sql`DELETE FROM auth_login_attempts WHERE email_hash=${emailHash}`;
  await issueSession(rows[0],res);
  const {password_hash,...user}=rows[0];return res.status(200).json({user});
 }
 return jsonError(res,400,'Unknown action');
 }catch(err){console.error('authentication error',err);return jsonError(res,500,'Authentication failed');}
}