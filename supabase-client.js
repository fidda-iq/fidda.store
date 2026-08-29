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
    let i=0; const load=()=>{ if(i>=urls.length)return reject(new Error('تعذر تحميل مكتبة Supabase.')); const sc=document.createElement('script'); sc.src=urls[i++]; sc.onload=()=>window.supabase?.createClient?resolve():load(); sc.onerror=load; document.head.appendChild(sc); }; load();
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

function stopFiddaOrdersRealtime(){
  if(!fiddaSupabase || !fiddaOrdersChannel)return;
  try{fiddaSupabase.removeChannel(fiddaOrdersChannel)}catch(e){}
  fiddaOrdersChannel=null;
}

function startFiddaOrdersRealtime(){
  if(!fiddaSupabase || fiddaOrdersChannel)return;
  // الطلبات محمية بسياسات RLS ولا يجب إنشاء قناة الطلبات قبل وجود جلسة المدير.
  fiddaSupabase.auth.getSession().then(({data})=>{
    if(!data?.session || fiddaOrdersChannel)return;
    fiddaOrdersChannel=fiddaSupabase.channel('fidda-orders-live-'+Date.now())
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},payload=>window.dispatchEvent(new CustomEvent('fidda-orders-changed',{detail:payload})))
      .subscribe((status)=>{
        if(status==='SUBSCRIBED') window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'orders'}}));
      });
  }).catch(()=>{});
}

function startFiddaRealtime(){
  if(!fiddaSupabase)return;
  // قناة المنتجات عامة، لذلك يمكن تشغيلها فورًا في متجر الزبون.
  if(!fiddaProductsChannel){
    fiddaProductsChannel=fiddaSupabase.channel('fidda-store-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'products'},payload=>window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:'products',eventType:payload.eventType,new:payload.new,old:payload.old}})))
      .on('postgres_changes',{event:'*',schema:'public',table:'categories'},payload=>window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:'categories',eventType:payload.eventType,new:payload.new,old:payload.old}})))
      .subscribe((status)=>{
        if(status==='SUBSCRIBED') window.dispatchEvent(new CustomEvent('fidda-realtime-ready',{detail:{table:'products'}}));
      });
  }
  // الأهم: إذا بدأت الصفحة قبل تسجيل دخول المدير، نعيد إنشاء قناة الطلبات بعد SIGNED_IN.
  if(!fiddaRealtimeAuthHooked){
    fiddaRealtimeAuthHooked=true;
    fiddaSupabase.auth.onAuthStateChange((event,session)=>{
      if(session && (event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')){
        startFiddaOrdersRealtime();
      }
      if(event==='SIGNED_OUT' || !session) stopFiddaOrdersRealtime();
    });
  }
  startFiddaOrdersRealtime();
  fiddaRealtimeStarted=true;
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
  return rowToProduct(data);
}
async function dbDeleteProduct(id){const db=await ensureFiddaSupabase();const {error}=await db.from('products').delete().eq('id',id);if(error)throw error}
async function dbSaveCategory(category){const db=await ensureFiddaSupabase();const row=categoryToRow(category);const {data,error}=await db.from('categories').upsert(row,{onConflict:'id'}).select('*').single();if(error)throw error;return rowToCategory(data)}
async function dbDeleteCategory(id){const db=await ensureFiddaSupabase();const {error}=await db.from('categories').delete().eq('id',id);if(error)throw error}
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
  return data;
}
async function dbUpdateOrder(id,customer,subtotal,delivery,total,status){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('update_order',{p_id:id,p_customer:customer,p_subtotal:subtotal,p_delivery:delivery,p_total:total,p_status:status});
  if(error)throw error;
  return data;
}
async function dbDeleteOrder(id){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('delete_order',{p_id:id});
  if(error)throw error;
  return data||{id};
}
async function dbCreateOrder(customer,items,subtotal,delivery,total){
  const db=await ensureFiddaSupabase();
  const {data,error}=await db.rpc('create_order',{p_customer:customer,p_items:items,p_subtotal:subtotal,p_delivery:delivery,p_total:total});
  if(error)throw error;
  return data;
}

window.ensureFiddaSupabase=ensureFiddaSupabase;window.fiddaDbInit=fiddaDbInit;window.dbGetProduct=dbGetProduct;window.dbSaveProduct=dbSaveProduct;window.dbDeleteProduct=dbDeleteProduct;window.dbSaveCategory=dbSaveCategory;window.dbDeleteCategory=dbDeleteCategory;window.dbGetOrders=dbGetOrders;window.dbUpdateOrderStatus=dbUpdateOrderStatus;window.dbUpdateOrder=dbUpdateOrder;window.dbDeleteOrder=dbDeleteOrder;window.dbCreateOrder=dbCreateOrder;

window.startFiddaRealtime=startFiddaRealtime;
