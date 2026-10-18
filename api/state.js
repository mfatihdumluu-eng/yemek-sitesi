import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const date = v => v ? new Date(v).toISOString().slice(0, 10) : '';
const reqMap = r => ({id:r.id,type:r.type,title:r.title,detail:r.detail,people:Number(r.people||1),budget:Number(r.budget||0),date:date(r.requested_date),theme:r.theme||'none',createdAt:r.created_at});
const offerMap = r => ({id:r.id,requestId:r.request_id,chefId:r.chef_id,price:Number(r.price||0),eta:r.eta||'',note:r.note||'',createdAt:r.created_at});
const promoMap = r => ({id:r.id,chefId:r.chef_id,scope:r.scope,productIds:r.product_ids||[],percent:Number(r.percent||0),start:date(r.starts_on),end:date(r.ends_on)});
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if(req.method==='GET') {
      // Pending record ownership migration, private user records are not exposed.
      return res.status(200).json({requests:[],offers:[],acties:[]});
      const [requests,offers,promotions]=await Promise.all([
        sql\`SELECT * FROM requests ORDER BY created_at DESC\`,
        sql\`SELECT * FROM offers ORDER BY created_at DESC\`,
        sql\`SELECT * FROM promotions ORDER BY created_at DESC\`
      ]);
      return res.status(200).json({requests:requests.map(reqMap),offers:offers.map(offerMap),acties:promotions.map(promoMap)});
    }
    if(req.method==='POST') return res.status(403).json({error:'Role-scoped write API is being implemented. Legacy shared writes are disabled.'});
    if(req.method!=='POST') { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed'}); }
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const items=body.items;
    if(!Array.isArray(items)||items.length>100) return res.status(400).json({error:'Invalid items'});
    const collection=body.collection;
    if(!['requests','offers','acties'].includes(collection)) return res.status(400).json({error:'Unknown collection'});
    // Legacy demo compatibility: upsert records. Never delete shared database rows
    // based on a client-submitted array, as this would erase other users' entries.
    const statements=[];
    for(const x of items) {
      if(!x||typeof x.id!=='string'||x.id.length>128) return res.status(400).json({error:'Invalid id'});
      if(collection==='requests') statements.push(sql\`INSERT INTO requests (id,type,title,detail,people,budget,requested_date,theme,created_at) VALUES (\${x.id},\${String(x.type||'custom')},\${String(x.title||'')},\${String(x.detail||'')},\${Number(x.people||1)},\${Number(x.budget||0)},\${x.date||null},\${String(x.theme||'none')},\${x.createdAt||new Date().toISOString()}) ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type,title=EXCLUDED.title,detail=EXCLUDED.detail,people=EXCLUDED.people,budget=EXCLUDED.budget,requested_date=EXCLUDED.requested_date,theme=EXCLUDED.theme\`);
      if(collection==='offers') statements.push(sql\`INSERT INTO offers (id,request_id,chef_id,price,eta,note,created_at) VALUES (\${x.id},\${String(x.requestId)},\${x.chefId||null},\${Number(x.price||0)},\${x.eta||''},\${x.note||''},\${x.createdAt||new Date().toISOString()}) ON CONFLICT (id) DO UPDATE SET request_id=EXCLUDED.request_id,chef_id=EXCLUDED.chef_id,price=EXCLUDED.price,eta=EXCLUDED.eta,note=EXCLUDED.note\`);
      if(collection==='acties') statements.push(sql\`INSERT INTO promotions (id,chef_id,scope,product_ids,percent,starts_on,ends_on) VALUES (\${x.id},\${x.chefId||null},\${String(x.scope||'all')},\${JSON.stringify(x.productIds||[])},\${Number(x.percent||0)},\${x.start||null},\${x.end||null}) ON CONFLICT (id) DO UPDATE SET chef_id=EXCLUDED.chef_id,scope=EXCLUDED.scope,product_ids=EXCLUDED.product_ids,percent=EXCLUDED.percent,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on\`);
    }
    if(statements.length) await sql.transaction(statements);
    return res.status(200).json({ok:true});
  } catch(e) { console.error('API failed',e); return res.status(500).json({error:'Database operation failed'}); }
}
