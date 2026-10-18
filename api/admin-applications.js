import {sql,session,validOrigin,jsonError,onlyJson} from './_auth.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try {
 const user=await session(req);
 if(!user||user.role!=='admin')return jsonError(res,403,'Forbidden');
 if(req.method==='GET'){
  const rows=await sql`SELECT a.id,a.business_name,a.description,a.status,a.created_at,u.display_name,u.email FROM chef_applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100`;
  return res.status(200).json({applications:rows});
 }
 if(req.method!=='POST')return jsonError(res,405,'Unsupported method');
 if(!validOrigin(req)||!onlyJson(req,res))return jsonError(res,403,'Invalid request');
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(!/^[0-9a-f-]{36}$/i.test(String(body.applicationId||'')))return jsonError(res,400,'Invalid application');
 const decision=String(body.decision||'');
 if(!['approved','rejected'].includes(decision))return jsonError(res,400,'Invalid decision');
 const id=String(body.applicationId);
 if(decision==='rejected'){
  const rows=await sql`UPDATE chef_applications SET status='rejected' WHERE id=${id} AND status='pending' RETURNING id`;
  return rows.length?res.status(200).json({ok:true,status:'rejected'}):jsonError(res,409,'No pending application');
 }
 const result=await sql`WITH a AS (
  UPDATE chef_applications SET status='approved' WHERE id=${id} AND status='pending' RETURNING id,user_id,business_name
 ), u AS (
  UPDATE users SET role='chef' WHERE id IN(SELECT user_id FROM a) AND role='customer' RETURNING id
 ), c AS (
  INSERT INTO chefs(id,name,is_active) SELECT 'chef-'||a.user_id::text,a.business_name,false FROM a JOIN u ON a.user_id=u.id
  ON CONFLICT (id) DO NOTHING RETURNING id
 ), owner AS (
  INSERT INTO chef_owners(chef_id,user_id) SELECT c.id,a.user_id FROM c JOIN a ON true ON CONFLICT DO NOTHING RETURNING chef_id
 ) SELECT (SELECT count(*) FROM a) AS approved,(SELECT count(*) FROM owner) AS linked`;
 if(!result[0].approved||!result[0].linked)return jsonError(res,409,'Application cannot be approved');
 return res.status(200).json({ok:true,status:'approved'});
 }catch(error){console.error('seller review failed',error);return jsonError(res,500,'Review failed');}
}