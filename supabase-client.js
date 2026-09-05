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

// V56 STORE FIX — all helpers used by the store client are defined here.
// This file must be self-contained because it is loaded BEFORE products.js.
function readLocalArray(key){
  try{
    const value=localStorage.getItem(key);
    const parsed=value?JSON.parse(value):[];
    return Array.isArray(parsed)?parsed:[];
  }catch(e){ return []; }
}
function normalizeProduct(p){
  const rawSizes=Array.isArray(p?.sizes)?p.sizes:[];
  const sizes=rawSizes.map(x=>({
    size:String(x?.size??'').trim(),
    stock:Math.max(0,Math.floor(Number(x?.stock)||0))
  })).filter(x=>x.size);
  const sizeStock=sizes.reduce((a,x)=>a+x.stock,0);
  const baseStock=Math.max(0,Number.isFinite(Number(p?.stock))?Number(p.stock):0);
  return {
    ...p,
    id:Number(p?.id),
    sort_order:Number.isFinite(Number(p?.sort_order))?Number(p.sort_order):0,
    stock:sizes.length?sizeStock:baseStock,
    sizes,
    images:(Array.isArray(p?.images)&&p.images.length?p.images:[p?.image||'']).filter(Boolean),
    material:p?.material||'فضة',
    payment:p?.payment||'الدفع عند الاستلام',
    customFields:Array.isArray(p?.customFields)?p.customFields.filter(x=>x&&String(x.label||'').trim()&&String(x.value||'').trim()).map(x=>({label:String(x.label).trim(),value:String(x.value).trim()})):[],
    featured:!!p?.featured
  };
}
function rowToProduct(r){
  return normalizeProduct({
    id:Number(r?.id),
    name:r?.name||'',
    category:r?.category||'',
    price:r?.price,
    desc:r?.description??r?.desc??'',
    material:r?.material,
    payment:r?.payment,
    images:Array.isArray(r?.images)?r.images:(r?.image?[r.image]:[]),
    stock:r?.stock,
    customFields:Array.isArray(r?.custom_fields)?r.custom_fields:[],
    featured:r?.featured,
    sizes:Array.isArray(r?.sizes)?r.sizes:[],
    sort_order:r?.sort_order
  });
}
function rowToCategory(r){
  return {id:String(r?.id??''),name:r?.name||'',image:r?.image||'',sort_order:Number(r?.sort_order)||0};
}
function categoryToRow(c){
  return {id:String(c?.id??''),name:c?.name||'',image:c?.image||'',sort_order:Number(c?.sort_order)||0};
}

// Compatibility no-op: the public store only needs product Realtime.
// Older code may call this name during boot/reconnect.
function bindFiddaRealtimeRecovery(){
  if(fiddaRecoveryBound)return;
  fiddaRecoveryBound=true;
  const recover=()=>{
    if(document.visibilityState==='hidden')return;
    try{ fiddaSupabase?.realtime?.connect?.(); }catch(e){}
    if(!fiddaProductsChannel && fiddaSupabase) startFiddaRealtime();
  };
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')recover()});
  window.addEventListener('online',recover);
}

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


async function fiddaFetchCatalog(){
  const db=await ensureFiddaSupabase();
  // V58: direct public SELECT is the fast path. The previous V57 path called
  // one or more RPCs first and then sometimes repeated the same catalog query,
  // which could leave a fresh browser on "جار التحميل..." for too long.
  // The database remains the source of truth; RPC is only a fallback if SELECT
  // is unavailable in the current Supabase schema/RLS configuration.
  try{
    const [pr,cr]=await Promise.all([
      db.from('products').select('*').order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true,nullsFirst:false}).order('id',{ascending:true}),
      db.from('categories').select('*').order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true,nullsFirst:false}).order('id',{ascending:true})
    ]);
    if(!pr.error && !cr.error && Array.isArray(pr.data) && Array.isArray(cr.data)){
      return {products:pr.data.map(rowToProduct),categories:cr.data.map(rowToCategory)};
    }
    const firstError=pr.error||cr.error;
    console.warn('FIDDA direct catalog read failed; trying RPC fallback',firstError);
  }catch(e){ console.warn('FIDDA direct catalog read failed; trying RPC fallback',e); }

  const rpcNames=['fidda_get_public_catalog','fidda_catalog_v49'];
  let lastError=null;
  for(const fn of rpcNames){
    try{
      const {data,error}=await db.rpc(fn);
      if(!error && data && Array.isArray(data.products) && Array.isArray(data.categories)){
        return {products:data.products.map(rowToProduct),categories:data.categories.map(rowToCategory)};
      }
      if(error)lastError=error;
    }catch(e){lastError=e;}
  }
  throw lastError||new Error('تعذر قراءة كتالوج المنتجات');
}

async function fiddaDbInit(){
  if(window.__fiddaDbInitPromise)return window.__fiddaDbInitPromise;
  if(window.fiddaHasCache){
    window.FIDDA_DB_READY=true;
    window.dispatchEvent(new CustomEvent('fidda-db-ready',{detail:'cache'}));
  }
  window.__fiddaDbInitPromise=(async()=>{
    try{
      await ensureFiddaSupabase();
      // V58: get the catalog first. Realtime subscription is background work and
      // must never delay the first product render.
      const catalog=await fiddaFetchCatalog();
      const products=catalog.products,categories=catalog.categories;
      window.FIDDA_PRODUCTS=products;window.FIDDA_CATEGORIES=categories;fiddaWriteCache(products,categories);window.FIDDA_DB_READY=true;window.FIDDA_DB_ERROR='';
      window.dispatchEvent(new CustomEvent('fidda-db-ready'));
      // Start live synchronization only after the first authoritative render.
      startFiddaRealtime();
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
        // لا نعيد تحميل الكتالوج عند أول اشتراك؛ تم تحميله قبل فتح القناة.
        // عند إعادة الاتصال فقط نطلب مصالحة سريعة للتأكد من عدم تفويت حدث.
        if(fiddaProductsEverSubscribed){
          setTimeout(()=>fiddaRealtimeFallbackRefresh().catch(()=>{}),0);
          window.dispatchEvent(new CustomEvent('fidda-realtime-reconcile',{detail:{table:'products',reason:'reconnect'}}));
        }
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
    const catalog=await fiddaFetchCatalog();
    const products=catalog.products;
    const categories=catalog.categories;
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

window.ensureFiddaSupabase=ensureFiddaSupabase;
window.fiddaDbInit=fiddaDbInit;
window.fiddaFetchCatalog=fiddaFetchCatalog;
window.startFiddaRealtime=startFiddaRealtime;
window.rowToProduct=rowToProduct;
window.rowToCategory=rowToCategory;

