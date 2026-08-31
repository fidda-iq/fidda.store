// اتصال متجر فِضّة بقاعدة Supabase المشتركة
const FIDDA_SUPABASE_URL = 'https://nhyqztbojurmahufvgsq.supabase.co';
const FIDDA_SUPABASE_KEY = 'sb_publishable_yjSINtlWINtUVzCknqopRA_X_SlPPVE';
let fiddaSupabase = null;
window.fiddaSupabase = null;
window.FIDDA_DB_READY = false;
window.FIDDA_DB_ERROR = '';
let fiddaClientPromise = null;
async function ensureFiddaSupabase(){
  if (fiddaSupabase) return fiddaSupabase;
  if (window.supabase?.createClient) { fiddaSupabase=window.supabase.createClient(FIDDA_SUPABASE_URL,FIDDA_SUPABASE_KEY); window.fiddaSupabase=fiddaSupabase; startFiddaRealtime(); return fiddaSupabase; }
  if (!fiddaClientPromise) fiddaClientPromise=new Promise((resolve,reject)=>{
    const urls=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
    let i=0; const load=()=>{ if(i>=urls.length)return reject(new Error('تعذر تحميل مكتبة Supabase')); const sc=document.createElement('script'); sc.src=urls[i++]; sc.onload=()=>window.supabase?.createClient?resolve():load(); sc.onerror=load; document.head.appendChild(sc); }; load();
  });
  await fiddaClientPromise; fiddaSupabase=window.supabase.createClient(FIDDA_SUPABASE_URL,FIDDA_SUPABASE_KEY); window.fiddaSupabase=fiddaSupabase; startFiddaRealtime(); return fiddaSupabase;
}
const FIDDA_CACHE_PRODUCTS='fiddaProductsCache_v3';
const FIDDA_CACHE_CATEGORIES='fiddaCategoriesCache_v3';
const FIDDA_CACHE_TIME='fiddaDataCacheTime_v3';
const FIDDA_ADMIN_CACHE_PRODUCTS='fiddaAdminProductsCache_v1';
const FIDDA_ADMIN_CACHE_CATEGORIES='fiddaAdminCategoriesCache_v1';
const FIDDA_ADMIN_PAGE=location.pathname.toLowerCase().endsWith('/admin.html');

function fiddaReadCache(){try{const pk=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_PRODUCTS:FIDDA_CACHE_PRODUCTS;const ck=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_CATEGORIES:FIDDA_CACHE_CATEGORIES;const p=JSON.parse(localStorage.getItem(pk)||'[]');const c=JSON.parse(localStorage.getItem(ck)||'[]');if(Array.isArray(p)&&p.length){window.FIDDA_PRODUCTS=p;window.FIDDA_CATEGORIES=Array.isArray(c)?c:[];return true}}catch(e){}return false}
function fiddaWriteCache(products,categories){try{const pk=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_PRODUCTS:FIDDA_CACHE_PRODUCTS;const ck=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_CATEGORIES:FIDDA_CACHE_CATEGORIES;localStorage.setItem(pk,JSON.stringify(products));localStorage.setItem(ck,JSON.stringify(categories));if(!FIDDA_ADMIN_PAGE)localStorage.setItem(FIDDA_CACHE_TIME,String(Date.now()))}catch(e){}}

window.fiddaHasCache=fiddaReadCache();

async function fiddaDbInit(){
  if(window.__fiddaDbInitPromise) return window.__fiddaDbInitPromise;
  const cachedReady=!!window.fiddaHasCache;
  if(cachedReady){
    window.FIDDA_DB_READY=true;
    window.dispatchEvent(new CustomEvent('fidda-db-ready',{detail:'cache'}));
  }
  window.__fiddaDbInitPromise=(async()=>{
  try {
    const db=await ensureFiddaSupabase();
    // Realtime يبدأ قبل جلب البيانات حتى لا تفوت الإدارة أي طلب يصل أثناء التحميل الأولي.
    startFiddaRealtime();
    const [pr, cr] = await Promise.all([
      db.from('products').select(FIDDA_ADMIN_PAGE?'id,name,category,price,description,material,payment,stock,custom_fields,featured,created_at':'*').order('created_at',{ascending:false}),
      db.from('categories').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})
    ]);
    if(pr.error) throw pr.error;
    if(cr.error) throw cr.error;

    let products = (pr.data||[]).map(rowToProduct);
    let categories = (cr.data||[]).map(rowToCategory);

    // أول تشغيل: إن كانت القاعدة فارغة، ننقل البيانات الموجودة في هذا المتصفح إلى Supabase.
    if(!products.length){
      const local = readLocalArray('fiddaProducts');
      if(local.length){
        const {data,error}=await fiddaSupabase.from('products').insert(local.map(productToRow)).select('*');
        if(error) throw error;
        products=(data||[]).map(rowToProduct);
      }
    }
    if(!categories.length){
      const local = readLocalArray('fiddaCategories');
      if(local.length){
        const {data,error}=await fiddaSupabase.from('categories').insert(local.map(categoryToRow)).select('*');
        if(error) throw error;
        categories=(data||[]).map(rowToCategory);
      }
    }
    // إذا لم تكن هناك بيانات محلية أصلًا، يضيف النظام المنتجات والأقسام الافتراضية مرة واحدة.
    if(!categories.length){
      const {data,error}=await fiddaSupabase.from('categories').insert(DEFAULT_CATEGORIES.map(categoryToRow)).select('*');
      if(error) throw error; categories=(data||[]).map(rowToCategory);
    }
    if(!products.length){
      const {data,error}=await fiddaSupabase.from('products').insert(DEFAULT_PRODUCTS.map(productToRow)).select('*');
      if(error) throw error; products=(data||[]).map(rowToProduct);
    }

    window.FIDDA_PRODUCTS=products;
    window.FIDDA_CATEGORIES=categories;
    fiddaWriteCache(products,categories);
    window.FIDDA_DB_READY=true;
    window.dispatchEvent(new CustomEvent('fidda-db-ready'));
  } catch(err){
    console.error('Supabase:',err);
    window.FIDDA_DB_ERROR=err.message||String(err);
    // إبقاء المتجر يعمل محليًا إذا لم يتم تنفيذ SQL بعد.
    window.FIDDA_PRODUCTS=readLocalArray('fiddaProducts').map(normalizeProduct);
    window.FIDDA_CATEGORIES=readLocalArray('fiddaCategories');
    if(!window.FIDDA_PRODUCTS.length) window.FIDDA_PRODUCTS=DEFAULT_PRODUCTS.map(normalizeProduct);
    if(!window.FIDDA_CATEGORIES.length) window.FIDDA_CATEGORIES=DEFAULT_CATEGORIES.slice();
    window.dispatchEvent(new CustomEvent('fidda-db-error',{detail:err}));
  }
  })();
  return window.__fiddaDbInitPromise;
}
let fiddaRealtimeStarted=false;
let fiddaRealtimeAuthHooked=false;
let fiddaProductsChannel=null;
let fiddaOrdersChannel=null;
let fiddaProductsRealtimeStatus='DISCONNECTED';
let fiddaOrdersRealtimeStatus='DISCONNECTED';
let fiddaRealtimeReconnectTimer=null;
let fiddaRealtimeFallbackTimer=null;
let fiddaLiveBroadcastChannel=null;
let fiddaLiveBroadcastStatus='DISCONNECTED';
const FIDDA_LIVE_BROADCAST_CHANNEL='fidda-live-broadcast-v1';

function emitFiddaRealtimeStatus(table,status){
  window.dispatchEvent(new CustomEvent('fidda-realtime-status',{detail:{table,status}}));
}

function dispatchFiddaLiveBroadcast(message){
  if(!message||!message.type)return;
  window.dispatchEvent(new CustomEvent('fidda-live-broadcast',{detail:message}));
  // نفس الجهاز لا يحتاج BroadcastChannel، لكن الأحداث المحلية تستفيد من نفس المسار.
}
function startFiddaLiveBroadcast(){
  if(!fiddaSupabase||fiddaLiveBroadcastChannel)return;
  const channel=fiddaSupabase.channel(FIDDA_LIVE_BROADCAST_CHANNEL,{config:{broadcast:{ack:false,self:false}}});
  fiddaLiveBroadcastChannel=channel;
  channel
    .on('broadcast',{event:'change'},({payload})=>dispatchFiddaLiveBroadcast(payload||{}))
    .subscribe(status=>{
      fiddaLiveBroadcastStatus=status;
      emitFiddaRealtimeStatus('broadcast',status);
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        if(fiddaLiveBroadcastChannel===channel)fiddaLiveBroadcastChannel=null;
        setTimeout(startFiddaLiveBroadcast,700);
      }
    });
}
function broadcastFiddaLiveChange(payload){
  if(!payload||!fiddaSupabase)return;
  const message={...payload,sourceId:window.__fiddaLiveSourceId||(window.__fiddaLiveSourceId=Math.random().toString(36).slice(2)+Date.now())};
  dispatchFiddaLiveBroadcast(message);
  if(fiddaLiveBroadcastChannel&&fiddaLiveBroadcastStatus==='SUBSCRIBED'){
    fiddaLiveBroadcastChannel.send({type:'broadcast',event:'change',payload:message}).catch(()=>{});
  }
}

function stopFiddaOrdersRealtime(){
  if(!fiddaSupabase || !fiddaOrdersChannel)return;
  try{fiddaSupabase.removeChannel(fiddaOrdersChannel)}catch(e){}
  fiddaOrdersChannel=null;
  fiddaOrdersRealtimeStatus='DISCONNECTED';
  emitFiddaRealtimeStatus('orders','DISCONNECTED');
}

function startFiddaOrdersRealtime(){
  if(!fiddaSupabase || fiddaOrdersChannel)return;
  fiddaSupabase.auth.getSession().then(({data})=>{
    if(!data?.session || fiddaOrdersChannel)return;

    const channelName='fidda-orders-live';
    const channel=fiddaSupabase.channel(channelName);
    fiddaOrdersChannel=channel;
    fiddaOrdersRealtimeStatus='CONNECTING';
    emitFiddaRealtimeStatus('orders','CONNECTING');

    channel
      .on('postgres_changes',
        {event:'*',schema:'public',table:'orders'},
        payload=>window.dispatchEvent(new CustomEvent('fidda-orders-changed',{detail:payload}))
      )
      .subscribe((status)=>{
        fiddaOrdersRealtimeStatus=status;
        emitFiddaRealtimeStatus('orders',status);

        if(status==='SUBSCRIBED'){
          window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'orders'}}));
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
          if(fiddaOrdersChannel===channel) fiddaOrdersChannel=null;
          setTimeout(()=>startFiddaOrdersRealtime(),1500);
        }
      });
  }).catch(()=>{});
}

function scheduleFiddaRealtimeReconnect(){
  if(fiddaRealtimeReconnectTimer)return;
  fiddaRealtimeReconnectTimer=setTimeout(()=>{
    fiddaRealtimeReconnectTimer=null;
    startFiddaRealtime();
  },1500);
}

function startFiddaRealtime(){
  if(!fiddaSupabase)return;
  startFiddaLiveBroadcast();
  bindFiddaRealtimeRecovery();

  // قناة المنتجات والأقسام: تعمل في المتجر والإدارة معًا.
  if(!fiddaProductsChannel){
    const channel=fiddaSupabase.channel('fidda-store-live');
    fiddaProductsChannel=channel;
    fiddaProductsRealtimeStatus='CONNECTING';
    emitFiddaRealtimeStatus('products','CONNECTING');

    channel
      .on('postgres_changes',
        {event:'*',schema:'public',table:'products'},
        payload=>window.dispatchEvent(new CustomEvent('fidda-data-changed',{
          detail:{table:'products',eventType:payload.eventType,new:payload.new,old:payload.old}
        }))
      )
      .on('postgres_changes',
        {event:'*',schema:'public',table:'categories'},
        payload=>window.dispatchEvent(new CustomEvent('fidda-data-changed',{
          detail:{table:'categories',eventType:payload.eventType,new:payload.new,old:payload.old}
        }))
      )
      .subscribe((status)=>{
        fiddaProductsRealtimeStatus=status;
        emitFiddaRealtimeStatus('products',status);

        if(status==='SUBSCRIBED'){
          window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'products'}}));
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
          if(fiddaProductsChannel===channel) fiddaProductsChannel=null;
          scheduleFiddaRealtimeReconnect();
        }
      });
  }

  // الطلبات لا تُفتح إلا بعد تسجيل دخول المدير.
  if(!fiddaRealtimeAuthHooked){
    fiddaRealtimeAuthHooked=true;
    fiddaSupabase.auth.onAuthStateChange((event,session)=>{
      if(session && (event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')){
        startFiddaOrdersRealtime();
      }
      if(event==='SIGNED_OUT'||!session) stopFiddaOrdersRealtime();
    });
  }

  startFiddaOrdersRealtime();
  fiddaRealtimeStarted=true;

  // مزامنة احتياطية فقط عند انقطاع Realtime. عند الاتصال الطبيعي تعتمد المزامنة على الأحداث اللحظية.
  if(!fiddaRealtimeFallbackTimer){
    fiddaRealtimeFallbackTimer=setInterval(()=>{
      if(document.visibilityState==='hidden')return;
      const live=fiddaProductsRealtimeStatus==='SUBSCRIBED';
      if(!live) fiddaRealtimeFallbackRefresh().catch(()=>{});
    },3500);
  }
}

let fiddaRecoveryBound=false;
function recoverFiddaRealtimeNow(){
  if(!fiddaSupabase)return;
  try{fiddaSupabase.realtime?.connect?.()}catch(e){}
  startFiddaRealtime();
  // عند العودة من قفل الشاشة نعيد القراءة مرة واحدة فورًا حتى لو فاتت أحداث أثناء النوم.
  if(document.visibilityState!=='hidden') fiddaRealtimeFallbackRefresh().catch(()=>{});
}
function bindFiddaRealtimeRecovery(){
  if(fiddaRecoveryBound)return;
  fiddaRecoveryBound=true;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')recoverFiddaRealtimeNow()});
  window.addEventListener('online',recoverFiddaRealtimeNow);
  window.addEventListener('focus',recoverFiddaRealtimeNow);
  window.addEventListener('pageshow',recoverFiddaRealtimeNow);
}


function readLocalArray(k){try{const x=localStorage.getItem(k);return x?JSON.parse(x):[]}catch(e){return[]}}
function productToRow(p){return {id:Number(p.id),name:p.name,category:p.category,price:Number(p.price)||0,description:p.desc||'',material:p.material||'فضة',payment:p.payment||'الدفع عند الاستلام',images:Array.isArray(p.images)?p.images:[],stock:Math.max(0,Number(p.stock)||0),custom_fields:Array.isArray(p.customFields)?p.customFields:[],featured:!!p.featured}}
function rowToProduct(r){return normalizeProduct({id:Number(r.id),name:r.name,category:r.category,price:r.price,desc:r.description,material:r.material,payment:r.payment,images:r.images||[],stock:r.stock,customFields:r.custom_fields||[],featured:r.featured})}
function categoryToRow(c){return {id:String(c.id),name:c.name,image:c.image||'',sort_order:0}}
function rowToCategory(r){return {id:String(r.id),name:r.name,image:r.image||''}}
async function dbGetProduct(id){const db=await ensureFiddaSupabase();const {data,error}=await db.from('products').select('*').eq('id',id).single();if(error)throw error;return rowToProduct(data)}
async function dbSaveProduct(product){
  const db=await ensureFiddaSupabase();
  const row=productToRow(product);
  const {data,error}=await db.from('products').upsert(row,{onConflict:'id'}).select('*').single();
  if(error) throw error;
  const saved=rowToProduct(data);
  broadcastFiddaLiveChange({type:'products',eventType:'UPDATE',new:data,at:Date.now()});
  return saved;
}
async function dbDeleteProduct(id){
  const db=await ensureFiddaSupabase();
  const {error}=await db.from('products').delete().eq('id',id);
  if(error)throw error;
  broadcastFiddaLiveChange({type:'products',eventType:'DELETE',old:{id:Number(id)},at:Date.now()});
}
async function dbSaveCategory(category){
  const db=await ensureFiddaSupabase();
  const row=categoryToRow(category);
  const {data,error}=await db.from('categories').upsert(row,{onConflict:'id'}).select('*').single();
  if(error)throw error;
  const saved=rowToCategory(data);
  broadcastFiddaLiveChange({type:'categories',eventType:'UPDATE',new:data,at:Date.now()});
  return saved;
}
async function dbDeleteCategory(id){
  const db=await ensureFiddaSupabase();
  const {error}=await db.from('categories').delete().eq('id',id);
  if(error)throw error;
  broadcastFiddaLiveChange({type:'categories',eventType:'DELETE',old:{id:String(id)},at:Date.now()});
}
async function dbGetOrders(){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.from('orders').select('id,customer,items,subtotal,delivery,total,status,created_at,updated_at,status_history').order('created_at',{ascending:false}).limit(1000);
  if(error)throw error;
  return (data||[]).map(r=>({id:r.id,customer:r.customer||{},items:r.items||[],subtotal:r.subtotal??0,delivery:r.delivery??0,total:r.total??0,createdAt:r.created_at,updatedAt:r.updated_at||r.created_at,status:r.status||'جديد',statusHistory:Array.isArray(r.status_history)?r.status_history:[]}));
}
async function dbUpdateOrderStatus(id,status){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('set_order_status',{p_id:id,p_status:status});
  if(error)throw error;
  try{
    const {data:row}=await db.from('orders').select('id,customer,items,subtotal,delivery,total,status,created_at,updated_at,status_history').eq('id',id).single();
    if(row)broadcastFiddaLiveChange({type:'orders',eventType:'UPDATE',new:row,at:Date.now()});
  }catch(e){}
  return data;
}
async function dbUpdateOrder(id,customer,subtotal,delivery,total,status){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('update_order',{p_id:id,p_customer:customer,p_subtotal:subtotal,p_delivery:delivery,p_total:total,p_status:status});
  if(error)throw error;
  try{
    const {data:row}=await db.from('orders').select('id,customer,items,subtotal,delivery,total,status,created_at,updated_at,status_history').eq('id',id).single();
    if(row)broadcastFiddaLiveChange({type:'orders',eventType:'UPDATE',new:row,at:Date.now()});
  }catch(e){}
  return data;
}
async function dbDeleteOrder(id){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('delete_order',{p_id:id});
  if(error)throw error;
  broadcastFiddaLiveChange({type:'orders',eventType:'DELETE',old:{id},at:Date.now()});
  return data||{id};
}
async function dbCreateOrder(customer,items,subtotal,delivery,total){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('create_order',{p_customer:customer,p_items:items,p_subtotal:subtotal,p_delivery:delivery,p_total:total});
  if(error)throw error;
  try{
    const orderId=(data&&typeof data==='object'&&data.id)||data;
    if(orderId){
      const {data:row}=await db.from('orders').select('id,customer,items,subtotal,delivery,total,status,created_at,updated_at,status_history').eq('id',orderId).single();
      if(row)broadcastFiddaLiveChange({type:'orders',eventType:'INSERT',new:row,at:Date.now()});
    }
  }catch(e){}
  return data;
}


async function fiddaRealtimeFallbackRefresh(){
  if(!fiddaSupabase)return false;
  try{
    const [pr,cr]=await Promise.all([
      fiddaSupabase.from('products').select('*').order('created_at',{ascending:false}),
      fiddaSupabase.from('categories').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})
    ]);
    if(pr.error)throw pr.error;
    if(cr.error)throw cr.error;
    const products=(pr.data||[]).map(rowToProduct);
    const categories=(cr.data||[]).map(rowToCategory);
    window.FIDDA_PRODUCTS=products;
    window.FIDDA_CATEGORIES=categories;
    fiddaWriteCache(products,categories);
    window.FIDDA_DB_READY=true;
    window.dispatchEvent(new CustomEvent('fidda-db-ready',{detail:'realtime-fallback'}));
    return true;
  }catch(e){
    console.warn('FIDDA realtime fallback refresh failed',e);
    return false;
  }
}



// إحصاء زيارات المتجر — تسجيل موثوق وسريع مع إعادة المحاولة عند انقطاع الشبكة.
const FIDDA_VISITOR_ID_KEY='fiddaVisitorId_v3';
const FIDDA_VISIT_LAST_SENT_KEY='fiddaVisitLastSent_v3';
const FIDDA_VISIT_PENDING_KEY='fiddaVisitPending_v3';
function getFiddaVisitorId(){
  try{
    let id=localStorage.getItem(FIDDA_VISITOR_ID_KEY);
    if(!id){id=(crypto?.randomUUID?.()||('v_'+Math.random().toString(36).slice(2)+Date.now()));localStorage.setItem(FIDDA_VISITOR_ID_KEY,id)}
    return id;
  }catch(e){return 'v_'+Math.random().toString(36).slice(2)+Date.now()}
}
function fiddaVisitWasRecentlySent(){
  try{return Date.now()-Number(localStorage.getItem(FIDDA_VISIT_LAST_SENT_KEY)||0)<30*60*1000}catch(e){return false}
}
function markFiddaVisitSent(){try{localStorage.setItem(FIDDA_VISIT_LAST_SENT_KEY,String(Date.now()));localStorage.removeItem(FIDDA_VISIT_PENDING_KEY)}catch(e){}}
function markFiddaVisitPending(){try{localStorage.setItem(FIDDA_VISIT_PENDING_KEY,'1')}catch(e){}}
async function trackFiddaStoreVisit(force=false){
  if(location.pathname.toLowerCase().includes('/admin'))return null;
  if(!force && fiddaVisitWasRecentlySent() && localStorage.getItem(FIDDA_VISIT_PENDING_KEY)!=='1')return null;
  try{
    const db=await ensureFiddaSupabase();
    const visitorId=getFiddaVisitorId();
    const {data,error}=await db.rpc('fidda_record_store_visit',{p_visitor_id:visitorId});
    if(error)throw error;
    markFiddaVisitSent();
    window.dispatchEvent(new CustomEvent('fidda-visit-recorded',{detail:data||{}}));
    return data;
  }catch(e){
    markFiddaVisitPending();
    console.warn('FIDDA visit tracking:',e);
    return null;
  }
}
window.trackFiddaStoreVisit=trackFiddaStoreVisit;
function bootFiddaVisitTracking(){
  if(location.pathname.toLowerCase().includes('/admin'))return;
  // محاولة مبكرة، ثم محاولات قصيرة في حال تأخر تحميل Supabase أو عودة الاتصال.
  trackFiddaStoreVisit();
  [800,2500,6000].forEach(ms=>setTimeout(()=>trackFiddaStoreVisit(),ms));
}
bootFiddaVisitTracking();
document.addEventListener('DOMContentLoaded',bootFiddaVisitTracking,{once:true});
window.addEventListener('online',()=>trackFiddaStoreVisit());
window.addEventListener('pageshow',()=>trackFiddaStoreVisit());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')trackFiddaStoreVisit()});

window.ensureFiddaSupabase=ensureFiddaSupabase;window.fiddaDbInit=fiddaDbInit;window.dbGetProduct=dbGetProduct;window.dbSaveProduct=dbSaveProduct;window.dbDeleteProduct=dbDeleteProduct;window.dbSaveCategory=dbSaveCategory;window.dbDeleteCategory=dbDeleteCategory;window.dbGetOrders=dbGetOrders;window.dbUpdateOrderStatus=dbUpdateOrderStatus;window.dbUpdateOrder=dbUpdateOrder;window.dbDeleteOrder=dbDeleteOrder;window.dbCreateOrder=dbCreateOrder;

window.startFiddaRealtime=startFiddaRealtime;
