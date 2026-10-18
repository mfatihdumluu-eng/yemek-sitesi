import {sql,session,validOrigin,jsonError} from './_auth.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try {
 const user=await session(req);
 if(!user)return jsonError(res,401,'Üyelik girişi gerekli');
 if(req.method==='GET'){
  const orders=await sql`SELECT id,status,delivery_type,delivery_time,subtotal,total,currency,payment_status,created_at FROM orders WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 50`;
  return res.status(200).json({orders});
 }
 if(req.method!=='POST')return jsonError(res,405,'Unsupported method');
 if(!validOrigin(req))return jsonError(res,403,'Invalid origin');
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(!Array.isArray(b.items)||b.items.length<1||b.items.length>30)return jsonError(res,400,'Invalid items');
 const quantity=new Map();
 for(const row of b.items){
   if(typeof row?.productId!=='string'||row.productId.length>128||!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>50)return jsonError(res,400,'Invalid item');
   quantity.set(row.productId,(quantity.get(row.productId)||0)+row.quantity);
 }
 const products=await sql`SELECT id,chef_id,price,min_order FROM products WHERE id=ANY(${[...quantity.keys()]}) AND is_active=true`;
 if(products.length!==quantity.size)return jsonError(res,409,'Product unavailable');
 let cents=0;
 for(const p of products){if(quantity.get(p.id)<Number(p.min_order||1))return jsonError(res,400,'Minimum order not met');cents+=Math.round(Number(p.price)*100)*quantity.get(p.id);}
 if(!Number.isSafeInteger(cents)||cents<=0)return jsonError(res,400,'Invalid total');
 const delivery=String(b.deliveryType||'pickup');
 if(!['pickup','delivery'].includes(delivery))return jsonError(res,400,'Invalid delivery');
 const total=(cents/100).toFixed(2), data=JSON.stringify(products.map(p=>({productId:p.id,chefId:p.chef_id,quantity:quantity.get(p.id),unitPrice:Number(p.price)})));
 const result=await sql`WITH inserted_order AS (
 INSERT INTO orders(user_id,status,delivery_type,subtotal,total,currency,payment_status) VALUES (${user.id},'pending',${delivery},${total},${total},'EUR','unpaid') RETURNING id
 ), inserted_items AS (
 INSERT INTO order_items(order_id,product_id,chef_id,quantity,unit_price)
 SELECT inserted_order.id,x."productId",x."chefId",x.quantity,x."unitPrice" FROM inserted_order CROSS JOIN jsonb_to_recordset(${data}::jsonb) AS x("productId" text,"chefId" text,quantity integer,"unitPrice" numeric) RETURNING id
 ) SELECT id,(SELECT count(*) FROM inserted_items) AS item_count FROM inserted_order`;
 return res.status(201).json({orderId:result[0].id,total,currency:'EUR',status:'pending',paymentStatus:'unpaid'});
 }catch(err){console.error('order processing failed',err);return jsonError(res,500,'Could not create order');}
}