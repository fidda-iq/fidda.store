// اتصال متجر فِضّة بقاعدة Supabase المشتركة — مسار خفيف وسريع
const FIDDA_SUPABASE_URL = 'https://nhyqztbojurmahufvgsq.supabase.co';
const FIDDA_SUPABASE_KEY = 'sb_publishable_yjSINtlWINtUVzCknqopRA_X_SlPPVE';
let fiddaSupabase = null;
window.fiddaSupabase = null;
window.FIDDA_DB_READY = false;
window.FIDDA_DB_ERROR = '';
let fiddaClientPromise = null;
let fiddaRealtimeStarted = false;
let fiddaProductsChannel = null;
let fiddaProductsRealtimeStatus = 'DISCONNECTED';
let fiddaRealtimeReconnectTimer = null;
let fiddaRecoveryBound = false;
let fiddaProductsEverSubscribed = false;

const FIDDA_CACHE_PRODUCTS='fiddaProductsCache_v7';
const FIDDA_CACHE_CATEGORIES='fiddaCategoriesCache_v3';
const FIDDA_CACHE_TIME='fiddaDataCacheTime_v3';
const FIDDA_ADMIN_CACHE_PRODUCTS='fiddaAdminProductsCache_v7';
const FIDDA_ADMIN_CACHE_CATEGORIES='fiddaAdminCategoriesCache_v1';
const FIDDA_ADMIN_PAGE=!!document.body?.classList.contains('admin-body') || location.pathname.toLowerCase().endsWith('/admin.html');

function fiddaReadCache(){try{const pk=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_PRODUCTS:FIDDA_CACHE_PRODUCTS;const ck=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_CATEGORIES:FIDDA_CACHE_CATEGORIES;const p=JSON.parse(localStorage.getItem(pk)||'[]');const c=JSON.parse(localStorage.getItem(ck)||'[]');if(Array.isArray(p)&&p.length){window.FIDDA_PRODUCTS=p;window.FIDDA_CATEGORIES=Array.isArray(c)?c:[];return true}}catch(e){}return false}
function fiddaWriteCache(products,categories){try{const pk=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_PRODUCTS:FIDDA_CACHE_PRODUCTS;const ck=FIDDA_ADMIN_PAGE?FIDDA_ADMIN_CACHE_CATEGORIES:FIDDA_CACHE_CATEGORIES;localStorage.setItem(pk,JSON.stringify(products));localStorage.setItem(ck,JSON.stringify(categories));if(!FIDDA_ADMIN_PAGE)localStorage.setItem(FIDDA_CACHE_TIME,String(Date.now()))}catch(e){}}
window.fiddaHasCache=fiddaReadCache();

function emitFiddaRealtimeStatus(table,status){window.dispatchEvent(new CustomEvent('fidda-realtime-status',{detail:{table,status}}))}

function loadSupabaseLibrary(){
  if(window.supabase?.createClient)return Promise.resolve();
  if(fiddaClientPromise)return fiddaClientPromise;
  fiddaClientPromise=new Promise((resolve,reject)=>{
    const urls=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
    let i=0;
    const next=()=>{
      if(window.supabase?.createClient)return resolve();
      if(i>=urls.length)return reject(new Error('تعذر تحميل مكتبة Supabase'));
      const sc=document.createElement('script');sc.async=true;sc.src=urls[i++];
      sc.onload=()=>window.supabase?.createClient?resolve():next();sc.onerror=next;document.head.appendChild(sc);
    };next();
  });
  return fiddaClientPromise;
}

async function ensureFiddaSupabase(){
  if(fiddaSupabase)return fiddaSupabase;
  await loadSupabaseLibrary();
  if(!fiddaSupabase){
    fiddaSupabase=window.supabase.createClient(FIDDA_SUPABASE_URL,FIDDA_SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    window.fiddaSupabase=fiddaSupabase;
  }
  return fiddaSupabase;
}

async function fiddaDbInit(){
  if(window.__fiddaDbInitPromise)return window.__fiddaDbInitPromise;
  if(window.fiddaHasCache){
    window.FIDDA_DB_READY=true;
    window.dispatchEvent(new CustomEvent('fidda-db-ready',{detail:'cache'}));
  }
  window.__fiddaDbInitPromise=(async()=>{
    try{
      const db=await ensureFiddaSupabase();
      // المتجر يحتاج قناة المنتجات فقط. لا نفتح قناة الطلبات/الزيارات هنا.
      startFiddaRealtime();
      const {data:catalog,error:catalogError}=await db.rpc('fidda_get_public_catalog');
      if(catalogError)throw catalogError;
      let products=(Array.isArray(catalog?.products)?catalog.products:[]).map(rowToProduct),categories=(Array.isArray(catalog?.categories)?catalog.categories:[]).map(rowToCategory);
      // هذا المسار القديم يُستخدم فقط إذا كانت قاعدة البيانات فارغة تمامًا.
      if(!products.length){const local=readLocalArray('fiddaProducts');if(local.length){const {data,error}=await db.from('products').insert(local.map(productToRow)).select('*');if(error)throw error;products=(data||[]).map(rowToProduct)}}
      if(!categories.length){const local=readLocalArray('fiddaCategories');if(local.length){const {data,error}=await db.from('categories').insert(local.map(categoryToRow)).select('*');if(error)throw error;categories=(data||[]).map(rowToCategory)}}
      if(!categories.length){const {data,error}=await db.from('categories').insert(DEFAULT_CATEGORIES.map(categoryToRow)).select('*');if(error)throw error;categories=(data||[]).map(rowToCategory)}
      if(!products.length){const {data,error}=await db.from('products').insert(DEFAULT_PRODUCTS.map(productToRow)).select('*');if(error)throw error;products=(data||[]).map(rowToProduct)}
      window.FIDDA_PRODUCTS=products;window.FIDDA_CATEGORIES=categories;fiddaWriteCache(products,categories);window.FIDDA_DB_READY=true;window.FIDDA_DB_ERROR='';
      window.dispatchEvent(new CustomEvent('fidda-db-ready'));
    }catch(err){
      console.error('Supabase:',err);window.FIDDA_DB_ERROR=err.message||String(err);
      window.FIDDA_PRODUCTS=readLocalArray('fiddaProducts').map(normalizeProduct);window.FIDDA_CATEGORIES=readLocalArray('fiddaCategories');
      if(!window.FIDDA_PRODUCTS.length)window.FIDDA_PRODUCTS=DEFAULT_PRODUCTS.map(normalizeProduct);
      if(!window.FIDDA_CATEGORIES.length)window.FIDDA_CATEGORIES=DEFAULT_CATEGORIES.slice();
      window.dispatchEvent(new CustomEvent('fidda-db-error',{detail:err}));
    }
  })();
  return window.__fiddaDbInitPromise;
}

function startFiddaRealtime(){
  if(!fiddaSupabase||fiddaProductsChannel)return;
  bindFiddaRealtimeRecovery();
  const channel=fiddaSupabase.channel('fidda:catalog');
  fiddaProductsChannel=channel;fiddaProductsRealtimeStatus='CONNECTING';emitFiddaRealtimeStatus('products','CONNECTING');
  channel.on('broadcast',{event:'catalog_change'},payload=>{
      const p=payload?.payload||payload||{};
      window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:p.table,eventType:p.eventType||payload?.event,new:p.new,old:p.old,source:'broadcast'}}));
    });
  channel.on('broadcast',{event:'catalog_stock'},payload=>{
    const p=payload?.payload||payload||{};
    if(p.type==='order-stock-optimistic')window.dispatchEvent(new CustomEvent('fidda-order-stock-optimistic',{detail:p}));
  });
  // Postgres Realtime: يصل تغير المخزون/القياسات/الترتيب فورًا للزبائن.
  for(const event of ['INSERT','UPDATE','DELETE']){
    channel.on('postgres_changes',{event,schema:'public',table:'products'},payload=>{
      window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:'products',eventType:event,new:payload.new,old:payload.old,source:'postgres_changes'}}));
    });
  }
  channel.subscribe(status=>{
      fiddaProductsRealtimeStatus=status;emitFiddaRealtimeStatus('products',status);
      if(status==='SUBSCRIBED'){
        window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'products'}}));
        if(fiddaProductsEverSubscribed)window.dispatchEvent(new CustomEvent('fidda-realtime-reconcile',{detail:{table:'products',reason:'reconnect'}}));
        fiddaProductsEverSubscribed=true;
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        if(fiddaProductsChannel===channel)fiddaProductsChannel=null;
        if(!fiddaRealtimeReconnectTimer)fiddaRealtimeReconnectTimer=setTimeout(()=>{fiddaRealtimeReconnectTimer=null;startFiddaRealtime()},1200);
      }
    });
  fiddaRealtimeStarted=true;
}

async function fiddaRealtimeFallbackRefresh(){
  if(!fiddaSupabase)return false;
  try{
    const {data:catalog,error}=await fiddaSupabase.rpc('fidda_get_public_catalog');
    if(error)throw error;
    const products=(Array.isArray(catalog?.products)?catalog.products:[]).map(rowToProduct);
    const categories=(Array.isArray(catalog?.categories)?catalog.categories:[]).map(rowToCategory);
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


// إحصاء زيارات المتجر — تسجيل خفيف وفوري، والإحصائيات تُحدّث في لوحة الإدارة عبر Realtime.
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
