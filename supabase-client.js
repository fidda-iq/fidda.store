/* FIDDA — Supabase connection + durable realtime synchronization */
const FIDDA_SUPABASE_URL = 'https://nhyqztbojurmahufvgsq.supabase.co';
const FIDDA_SUPABASE_KEY = 'sb_publishable_yjSINtlWINtUVzCknqopRA_X_SlPPVE';

let fiddaSupabase = null;
let fiddaClientPromise = null;
window.fiddaSupabase = null;
window.FIDDA_DB_READY = false;
window.FIDDA_DB_ERROR = '';

const FIDDA_ADMIN_PAGE = !!document.body?.classList.contains('admin-body') || /(^|\/)admin(?:\.html)?$/i.test(location.pathname);
const FIDDA_CACHE_PRODUCTS = FIDDA_ADMIN_PAGE ? 'fiddaLiveProductsCache_v7' : 'fiddaLiveProductsCache_v7';
const FIDDA_CACHE_CATEGORIES = FIDDA_ADMIN_PAGE ? 'fiddaLiveCategoriesCache_v7' : 'fiddaLiveCategoriesCache_v7';
const FIDDA_CACHE_TIME = FIDDA_ADMIN_PAGE ? 'fiddaLiveDataCacheTime_v7' : 'fiddaLiveDataCacheTime_v7';
const FIDDA_ORDER_CACHE = 'fiddaOrdersCache_v6';
const FIDDA_LIVE_BROADCAST_CHANNEL = 'fidda-live-products-v2';
const FIDDA_LOCAL_SYNC_CHANNEL = 'fidda-fidda-admin-local-sync-v3';
let fiddaLocalSyncChannel=null;
function startFiddaLocalSync(){
  if(fiddaLocalSyncChannel || !('BroadcastChannel' in window)) return;
  try{
    fiddaLocalSyncChannel=new BroadcastChannel(FIDDA_LOCAL_SYNC_CHANNEL);
    fiddaLocalSyncChannel.onmessage=e=>{
      const m=e.data||{};
      if(m.sourceId===window.__fiddaLocalSourceId)return;
      if(m.type==='product-optimistic' || m.type==='product-rollback')
        window.dispatchEvent(new CustomEvent('fidda-local-product-sync',{detail:m}));
    };
  }catch(e){fiddaLocalSyncChannel=null;}
}
function broadcastFiddaLocalSync(message){
  if(!message)return;
  const sourceId=window.__fiddaLocalSourceId||(window.__fiddaLocalSourceId=Math.random().toString(36).slice(2)+Date.now());
  const msg={...message,sourceId,at:Date.now()};
  window.dispatchEvent(new CustomEvent('fidda-local-product-sync',{detail:msg}));
  try{startFiddaLocalSync();fiddaLocalSyncChannel?.postMessage(msg);}catch(e){}
}


function readLocalArray(key){ try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } }
function writeJson(key,value){ try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
function fiddaReadCache(){
  try{
    const products=readLocalArray(FIDDA_CACHE_PRODUCTS), categories=readLocalArray(FIDDA_CACHE_CATEGORIES);
    if(products.length){ window.FIDDA_PRODUCTS=products; window.FIDDA_CATEGORIES=categories; return true; }
  }catch{}
  return false;
}
function fiddaWriteCache(products,categories){
  writeJson(FIDDA_CACHE_PRODUCTS,products||[]); writeJson(FIDDA_CACHE_CATEGORIES,categories||[]);
  try{localStorage.setItem(FIDDA_CACHE_TIME,String(Date.now()));}catch{}
}
window.fiddaHasCache=fiddaReadCache();
window.addEventListener('storage',e=>{
  if(e.key===FIDDA_CACHE_PRODUCTS && e.newValue){ try{window.FIDDA_PRODUCTS=JSON.parse(e.newValue).map(rowToProduct);window.dispatchEvent(new CustomEvent('fidda-cache-products-changed'));}catch(err){} }
  if(e.key===FIDDA_CACHE_CATEGORIES && e.newValue){ try{window.FIDDA_CATEGORIES=JSON.parse(e.newValue).map(rowToCategory);window.dispatchEvent(new CustomEvent('fidda-cache-categories-changed'));}catch(err){} }
});


async function ensureFiddaSupabase(){
  if(fiddaSupabase) return fiddaSupabase;
  if(!fiddaClientPromise){
    fiddaClientPromise=(async()=>{
      if(!window.supabase?.createClient){
        await new Promise((resolve,reject)=>{
          const urls=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
          let i=0;
          const load=()=>{
            if(i>=urls.length) return reject(new Error('تعذر تحميل مكتبة Supabase.'));
            const s=document.createElement('script'); s.src=urls[i++];
            s.onload=()=>window.supabase?.createClient?resolve():load(); s.onerror=load; document.head.appendChild(s);
          }; load();
        });
      }
      fiddaSupabase=window.supabase.createClient(FIDDA_SUPABASE_URL,FIDDA_SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      window.fiddaSupabase=fiddaSupabase;
      startFiddaRealtime();
      return fiddaSupabase;
    })();
  }
  return fiddaClientPromise;
}

let fiddaProductsChannel=null, fiddaOrdersChannel=null, fiddaVisitsChannel=null, fiddaBroadcastChannel=null;
let fiddaProductsRealtimeStatus='DISCONNECTED', fiddaOrdersRealtimeStatus='DISCONNECTED', fiddaVisitsRealtimeStatus='DISCONNECTED', fiddaBroadcastStatus='DISCONNECTED';
let fiddaRealtimeReconnectTimer=null, fiddaRealtimeFallbackTimer=null, fiddaOrdersFallbackTimer=null, fiddaRecoveryBound=false, fiddaAuthHooked=false;
let fiddaReconnectDelay=300;
const FIDDA_MAX_RECONNECT_DELAY=4000;

function emitFiddaRealtimeStatus(table,status){
  window.dispatchEvent(new CustomEvent('fidda-realtime-status',{detail:{table,status}}));
  window[`fidda${table[0].toUpperCase()+table.slice(1)}RealtimeStatus`]=status;
}
function dispatchFiddaLiveBroadcast(message){ if(message?.type) window.dispatchEvent(new CustomEvent('fidda-live-broadcast',{detail:message})); }
function startFiddaBroadcast(){
  if(!fiddaSupabase||fiddaBroadcastChannel)return;
  const ch=fiddaSupabase.channel(FIDDA_LIVE_BROADCAST_CHANNEL,{config:{broadcast:{ack:false,self:false}}});
  fiddaBroadcastChannel=ch;
  ch.on('broadcast',{event:'products-change'},({payload})=>dispatchFiddaLiveBroadcast(payload||{}))
    .subscribe(status=>{
      fiddaBroadcastStatus=status; emitFiddaRealtimeStatus('broadcast',status);
      if(status==='SUBSCRIBED')fiddaReconnectDelay=1000;
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
        if(fiddaBroadcastChannel===ch)fiddaBroadcastChannel=null;
        setTimeout(startFiddaBroadcast,Math.min(fiddaReconnectDelay,10000));
      }
    });
}
function broadcastFiddaProductChange(payload){
  // Broadcast is only an acceleration hint for products/categories. Orders are never broadcast publicly.
  if(!payload||!fiddaSupabase)return;
  const msg={...payload,sourceId:window.__fiddaLiveSourceId||(window.__fiddaLiveSourceId=Math.random().toString(36).slice(2)+Date.now())};
  dispatchFiddaLiveBroadcast(msg);
  if(fiddaBroadcastChannel&&fiddaBroadcastStatus==='SUBSCRIBED') fiddaBroadcastChannel.send({type:'broadcast',event:'products-change',payload:msg}).catch(()=>{});
}

function stopFiddaOrdersRealtime(){
  if(fiddaSupabase&&fiddaOrdersChannel){try{fiddaSupabase.removeChannel(fiddaOrdersChannel);}catch{}}
  fiddaOrdersChannel=null; fiddaOrdersRealtimeStatus='DISCONNECTED'; emitFiddaRealtimeStatus('orders','DISCONNECTED');
}
function startFiddaOrdersRealtime(){
  if(!FIDDA_ADMIN_PAGE||!fiddaSupabase||fiddaOrdersChannel)return;
  fiddaSupabase.auth.getSession().then(({data})=>{
    if(!data?.session||fiddaOrdersChannel)return;
    const ch=fiddaSupabase.channel('fidda-admin-orders-live-v2'); fiddaOrdersChannel=ch; fiddaOrdersRealtimeStatus='CONNECTING'; emitFiddaRealtimeStatus('orders','CONNECTING');
    ch.on('postgres_changes',{event:'*',schema:'public',table:'orders'},payload=>window.dispatchEvent(new CustomEvent('fidda-orders-changed',{detail:payload})))
      .subscribe(status=>{
        fiddaOrdersRealtimeStatus=status; emitFiddaRealtimeStatus('orders',status);
        if(status==='SUBSCRIBED'){fiddaReconnectDelay=1000;window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'orders'}}));}
        else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
          if(fiddaOrdersChannel===ch)fiddaOrdersChannel=null;
          scheduleFiddaRealtimeReconnect();
        }
      });
  }).catch(()=>{});
}
function startFiddaProductsRealtime(){
  if(!fiddaSupabase||fiddaProductsChannel)return;
  const ch=fiddaSupabase.channel('fidda-store-products-live-v2'); fiddaProductsChannel=ch; fiddaProductsRealtimeStatus='CONNECTING'; emitFiddaRealtimeStatus('products','CONNECTING');
  ch.on('postgres_changes',{event:'*',schema:'public',table:'products'},payload=>window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:'products',eventType:payload.eventType,new:payload.new,old:payload.old}})))
   .on('postgres_changes',{event:'*',schema:'public',table:'categories'},payload=>window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:'categories',eventType:payload.eventType,new:payload.new,old:payload.old}})))
   .subscribe(status=>{
     fiddaProductsRealtimeStatus=status; emitFiddaRealtimeStatus('products',status);
     if(status==='SUBSCRIBED'){fiddaReconnectDelay=1000;window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'products'}}));}
     else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
       if(fiddaProductsChannel===ch)fiddaProductsChannel=null; scheduleFiddaRealtimeReconnect();
     }
   });
}
function startFiddaVisitsRealtime(){
  if(!FIDDA_ADMIN_PAGE||!fiddaSupabase||fiddaVisitsChannel)return;
  const ch=fiddaSupabase.channel('fidda-admin-visits-live-v2'); fiddaVisitsChannel=ch; fiddaVisitsRealtimeStatus='CONNECTING'; emitFiddaRealtimeStatus('visits','CONNECTING');
  ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'fidda_store_visits'},payload=>window.dispatchEvent(new CustomEvent('fidda-store-visits-changed',{detail:payload})))
   .subscribe(status=>{
     fiddaVisitsRealtimeStatus=status; emitFiddaRealtimeStatus('visits',status);
     if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){if(fiddaVisitsChannel===ch)fiddaVisitsChannel=null;scheduleFiddaRealtimeReconnect();}
   });
}
function scheduleFiddaRealtimeReconnect(){
  if(fiddaRealtimeReconnectTimer)return;
  const delay=Math.min(fiddaReconnectDelay,FIDDA_MAX_RECONNECT_DELAY); fiddaReconnectDelay=Math.min(Math.max(fiddaReconnectDelay*2,500),FIDDA_MAX_RECONNECT_DELAY);
  fiddaRealtimeReconnectTimer=setTimeout(()=>{fiddaRealtimeReconnectTimer=null;startFiddaRealtime();},delay);
}
async function fiddaRealtimeFallbackRefresh(){
  if(!fiddaSupabase)return false;
  try{
    const [pr,cr]=await Promise.all([
      fiddaSupabase.from('products').select('*').order('created_at',{ascending:false}),
      fiddaSupabase.from('categories').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})
    ]);
    if(pr.error)throw pr.error; if(cr.error)throw cr.error;
    const products=(pr.data||[]).map(rowToProduct), categories=(cr.data||[]).map(rowToCategory);
    window.FIDDA_PRODUCTS=products;window.FIDDA_CATEGORIES=categories;fiddaWriteCache(products,categories);window.FIDDA_DB_READY=true;
    window.dispatchEvent(new CustomEvent('fidda-db-ready',{detail:'realtime-fallback'})); return true;
  }catch(e){console.warn('FIDDA realtime fallback:',e);return false;}
}
function bindFiddaRealtimeRecovery(){
  if(fiddaRecoveryBound)return; fiddaRecoveryBound=true;
  let timer=null;
  const recover=()=>{clearTimeout(timer);timer=setTimeout(async()=>{
    if(document.visibilityState==='hidden')return;
    try{fiddaSupabase?.realtime?.connect?.();}catch{}
    startFiddaRealtime();
    await fiddaRealtimeFallbackRefresh().catch(()=>{});
    if(FIDDA_ADMIN_PAGE&&window.isFiddaAdmin?.()) await dbGetOrders().then(o=>{writeJson(FIDDA_ORDER_CACHE,o);window.dispatchEvent(new CustomEvent('fidda-orders-resynced',{detail:o}));}).catch(()=>{});
  },100);};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')recover()});
  window.addEventListener('online',recover);window.addEventListener('focus',recover);window.addEventListener('pageshow',recover);
}
function startFiddaRealtime(){
  if(!fiddaSupabase)return;
  startFiddaLocalSync();startFiddaBroadcast();startFiddaProductsRealtime();
  if(FIDDA_ADMIN_PAGE){startFiddaOrdersRealtime();startFiddaVisitsRealtime();}
  bindFiddaRealtimeRecovery();
  if(!fiddaRealtimeFallbackTimer){
    fiddaRealtimeFallbackTimer=setInterval(()=>{
      if(document.visibilityState==='hidden')return;
      if(fiddaProductsRealtimeStatus!=='SUBSCRIBED')fiddaRealtimeFallbackRefresh().catch(()=>{});
    },3000);
  }
  if(FIDDA_ADMIN_PAGE&&!fiddaOrdersFallbackTimer){
    fiddaOrdersFallbackTimer=setInterval(()=>{
      if(document.visibilityState==='hidden'||!window.isFiddaAdmin?.())return;
      if(fiddaOrdersRealtimeStatus!=='SUBSCRIBED')dbGetOrders().then(o=>{writeJson(FIDDA_ORDER_CACHE,o);window.dispatchEvent(new CustomEvent('fidda-orders-resynced',{detail:o}));}).catch(()=>{});
    },3000);
  }
}

async function fiddaDbInit(){
  if(window.__fiddaDbInitPromise)return window.__fiddaDbInitPromise;
  if(window.fiddaHasCache){window.FIDDA_DB_READY=true;window.dispatchEvent(new CustomEvent('fidda-db-ready',{detail:'cache'}));}
  window.__fiddaDbInitPromise=(async()=>{
    try{
      const db=await ensureFiddaSupabase(); startFiddaRealtime();
      const [pr,cr]=await Promise.all([
        db.from('products').select('*').order('created_at',{ascending:false}),
        db.from('categories').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})
      ]);
      if(pr.error)throw pr.error;if(cr.error)throw cr.error;
      let products=(pr.data||[]).map(rowToProduct),categories=(cr.data||[]).map(rowToCategory);
      if(!products.length){const local=readLocalArray('fiddaProducts');if(local.length){const {data,error}=await db.from('products').insert(local.map(productToRow)).select('*');if(error)throw error;products=(data||[]).map(rowToProduct);}}
      if(!categories.length){const local=readLocalArray('fiddaCategories');if(local.length){const {data,error}=await db.from('categories').insert(local.map(categoryToRow)).select('*');if(error)throw error;categories=(data||[]).map(rowToCategory);}}
      if(!categories.length){const {data,error}=await db.from('categories').insert(DEFAULT_CATEGORIES.map(categoryToRow)).select('*');if(error)throw error;categories=(data||[]).map(rowToCategory);}
      if(!products.length){const {data,error}=await db.from('products').insert(DEFAULT_PRODUCTS.map(productToRow)).select('*');if(error)throw error;products=(data||[]).map(rowToProduct);}
      window.FIDDA_PRODUCTS=products;window.FIDDA_CATEGORIES=categories;fiddaWriteCache(products,categories);window.FIDDA_DB_READY=true;window.FIDDA_DB_ERROR='';window.dispatchEvent(new CustomEvent('fidda-db-ready'));
    }catch(err){
      console.error('Supabase:',err);window.FIDDA_DB_ERROR=err?.message||String(err);
      window.FIDDA_PRODUCTS=readLocalArray('fiddaProducts').map(normalizeProduct);window.FIDDA_CATEGORIES=readLocalArray('fiddaCategories');
      if(!window.FIDDA_PRODUCTS.length)window.FIDDA_PRODUCTS=DEFAULT_PRODUCTS.map(normalizeProduct);if(!window.FIDDA_CATEGORIES.length)window.FIDDA_CATEGORIES=DEFAULT_CATEGORIES.slice();
      window.dispatchEvent(new CustomEvent('fidda-db-error',{detail:err}));
    }
  })();
  return window.__fiddaDbInitPromise;
}

function productToRow(p){return {id:Number(p.id),name:p.name,category:p.category,price:Number(p.price)||0,description:p.desc||'',material:p.material||'فضة',payment:p.payment||'الدفع عند الاستلام',images:Array.isArray(p.images)?p.images:[],stock:Math.max(0,Math.floor(Number(p.stock)||0)),custom_fields:Array.isArray(p.customFields)?p.customFields:[],featured:!!p.featured};}
function rowToProduct(r){return normalizeProduct({id:Number(r.id),name:r.name,category:r.category,price:r.price,desc:r.description,material:r.material,payment:r.payment,images:r.images||[],stock:r.stock,customFields:r.custom_fields||[],featured:r.featured});}
function categoryToRow(c){return {id:String(c.id),name:c.name,image:c.image||'',sort_order:Number(c.sort_order)||0};}
function rowToCategory(r){return {id:String(r.id),name:r.name,image:r.image||'',sort_order:Number(r.sort_order)||0};}

async function dbGetProduct(id){const db=await ensureFiddaSupabase();const {data,error}=await db.from('products').select('*').eq('id',id).single();if(error)throw error;return rowToProduct(data);}
async function dbSaveProduct(product){const db=await ensureFiddaSupabase();const row=productToRow(product);const previous=(window.FIDDA_PRODUCTS||[]).find(p=>Number(p.id)===Number(row.id));broadcastFiddaLocalSync({type:'product-optimistic',eventType:'UPDATE',new:row,old:previous?productToRow(previous):null});const {error}=await db.from('products').upsert(row,{onConflict:'id'});if(error){broadcastFiddaLocalSync({type:'product-rollback',eventType:'UPDATE',new:previous?productToRow(previous):null,old:row});throw error;}broadcastFiddaProductChange({type:'products',eventType:previous?'UPDATE':'INSERT',new:row,old:previous?productToRow(previous):null,at:Date.now()});return rowToProduct(row);}
async function dbDeleteProduct(id){const db=await ensureFiddaSupabase();const previous=(window.FIDDA_PRODUCTS||[]).find(p=>Number(p.id)===Number(id));const old=previous?productToRow(previous):{id:Number(id)};broadcastFiddaLocalSync({type:'product-optimistic',eventType:'DELETE',old});const {error}=await db.from('products').delete().eq('id',id);if(error){broadcastFiddaLocalSync({type:'product-rollback',eventType:'UPDATE',new:old,old:{id:Number(id)}});throw error;}broadcastFiddaProductChange({type:'products',eventType:'DELETE',old,at:Date.now()});}
async function dbSaveCategory(category){const db=await ensureFiddaSupabase();const {data,error}=await db.from('categories').upsert(categoryToRow(category),{onConflict:'id'}).select('*').single();if(error)throw error;broadcastFiddaProductChange({type:'categories',eventType:'UPDATE',new:data,at:Date.now()});return rowToCategory(data);}
async function dbDeleteCategory(id){const db=await ensureFiddaSupabase();const {error}=await db.from('categories').delete().eq('id',id);if(error)throw error;broadcastFiddaProductChange({type:'categories',eventType:'DELETE',old:{id:String(id)},at:Date.now()});}

function normalizeOrderRow(r){return {id:r.id,customer:r.customer||{},items:Array.isArray(r.items)?r.items:[],subtotal:r.subtotal??0,delivery:r.delivery??0,total:r.total??0,createdAt:r.created_at,updatedAt:r.updated_at||r.created_at,status:r.status||'جديد',statusHistory:Array.isArray(r.status_history)?r.status_history:[]};}
function emitLocalOrderChange(eventType,row){if(FIDDA_ADMIN_PAGE&&row)window.dispatchEvent(new CustomEvent('fidda-orders-changed',{detail:{eventType,new:row,source:'local'}}));}

async function dbGetOrders(){
  const db=await ensureFiddaSupabase(); const all=[]; const pageSize=1000; let from=0;
  while(true){
    const {data,error}=await db.from('orders').select('id,customer,items,subtotal,delivery,total,status,created_at,updated_at,status_history').order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+pageSize-1);
    if(error)throw error; const rows=data||[]; all.push(...rows); if(rows.length<pageSize)break; from+=pageSize;
  }
  return all.map(normalizeOrderRow);
}
async function dbUpdateOrderStatus(id,status){const db=await ensureFiddaSupabase();const {data,error}=await db.rpc('set_order_status',{p_id:id,p_status:status});if(error)throw error;emitLocalOrderChange('UPDATE',data);return data;}
async function dbUpdateOrder(id,customer,subtotal,delivery,total,status,expectedUpdatedAt=null){const db=await ensureFiddaSupabase();const {data,error}=await db.rpc('update_order',{p_id:id,p_customer:customer,p_subtotal:subtotal,p_delivery:delivery,p_total:total,p_status:status,p_expected_updated_at:expectedUpdatedAt});if(error)throw error;emitLocalOrderChange('UPDATE',data);return data;}
async function dbDeleteOrder(id){const db=await ensureFiddaSupabase();const {data,error}=await db.rpc('delete_order',{p_id:id});if(error)throw error;if(FIDDA_ADMIN_PAGE)window.dispatchEvent(new CustomEvent('fidda-orders-changed',{detail:{eventType:'DELETE',old:{id},source:'local'}}));return data||{id};}
async function dbCreateOrder(customer,items,subtotal,delivery,total){const db=await ensureFiddaSupabase();const {data,error}=await db.rpc('create_order',{p_customer:customer,p_items:items,p_subtotal:subtotal,p_delivery:delivery,p_total:total});if(error)throw error;emitLocalOrderChange('INSERT',data);return data;}
async function dbRecordVisit(visitorId){const db=await ensureFiddaSupabase();const {data,error}=await db.rpc('fidda_record_store_visit',{p_visitor_id:String(visitorId||'')});if(error)throw error;return data||{recorded:false,new_visit:false};}
async function dbGetVisitStats(){const db=await ensureFiddaSupabase();const {data,error}=await db.rpc('fidda_get_store_visit_stats');if(error)throw error;return data||{total:0,today:0,last7days:0,thisMonth:0};}

if(FIDDA_ADMIN_PAGE&&!fiddaAuthHooked){fiddaAuthHooked=true;ensureFiddaSupabase().then(db=>db.auth.onAuthStateChange((event,session)=>{if(session)startFiddaOrdersRealtime();else stopFiddaOrdersRealtime();})).catch(()=>{});}

window.ensureFiddaSupabase=ensureFiddaSupabase;window.fiddaDbInit=fiddaDbInit;window.dbGetProduct=dbGetProduct;window.dbSaveProduct=dbSaveProduct;window.dbDeleteProduct=dbDeleteProduct;window.dbSaveCategory=dbSaveCategory;window.dbDeleteCategory=dbDeleteCategory;window.dbGetOrders=dbGetOrders;window.dbUpdateOrderStatus=dbUpdateOrderStatus;window.dbUpdateOrder=dbUpdateOrder;window.dbDeleteOrder=dbDeleteOrder;window.dbCreateOrder=dbCreateOrder;window.dbRecordVisit=dbRecordVisit;window.dbGetVisitStats=dbGetVisitStats;window.startFiddaRealtime=startFiddaRealtime;
window.fiddaRealtimeState=()=>({admin:FIDDA_ADMIN_PAGE,products:fiddaProductsRealtimeStatus,orders:fiddaOrdersRealtimeStatus,visits:fiddaVisitsRealtimeStatus,broadcast:fiddaBroadcastStatus});
