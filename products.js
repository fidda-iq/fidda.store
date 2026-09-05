/* فِضّة FIDDA — متجر الزبائن | V41 cart counter final */
const DELIVERY_FEE = 5000;
const CART_KEY = 'fiddaCart';

const DEFAULT_CATEGORIES = [
  {id:'rings',name:'خواتم',image:'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80'},
  {id:'necklaces',name:'سلاسل',image:'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80'},
  {id:'bracelets',name:'أساور',image:'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80'},
  {id:'earrings',name:'أقراط',image:'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=900&q=80'}
];
const DEFAULT_PRODUCTS = [
  {id:1,name:'خاتم فضي كلاسيكي',category:'خواتم',price:35000,desc:'خاتم فضة بتصميم ناعم وأنيق للاستخدام اليومي',material:'فضة',payment:'الدفع عند الاستلام',images:[DEFAULT_CATEGORIES[0].image],stock:5,featured:true},
  {id:2,name:'سلسلة فضة ناعمة',category:'سلاسل',price:42000,desc:'سلسلة فضية رقيقة تضيف لمسة راقية لإطلالتك',material:'فضة',payment:'الدفع عند الاستلام',images:[DEFAULT_CATEGORIES[1].image],stock:4,featured:true},
  {id:3,name:'سوار فضة أنيق',category:'أساور',price:39000,desc:'سوار فضة بتفاصيل بسيطة وحضور فاخر',material:'فضة',payment:'الدفع عند الاستلام',images:[DEFAULT_CATEGORIES[2].image],stock:3,featured:true},
  {id:4,name:'أقراط فضية ناعمة',category:'أقراط',price:28000,desc:'أقراط خفيفة بتصميم عصري',material:'فضة',payment:'الدفع عند الاستلام',images:[DEFAULT_CATEGORIES[3].image],stock:2,featured:false}
];

function normalizeProduct(p){
  const rawSizes=Array.isArray(p?.sizes)?p.sizes:[];
  const sizes=rawSizes.map(x=>({size:String(x?.size??'').trim(),stock:Math.max(0,Math.floor(Number(x?.stock)||0))})).filter(x=>x.size);
  const sizeStock=sizes.reduce((a,x)=>a+x.stock,0);
  const baseStock=Math.max(0,Number.isFinite(Number(p?.stock))?Number(p.stock):0);
  const stock=sizes.length?sizeStock:baseStock;
  return {...p,sort_order:Number.isFinite(Number(p?.sort_order))?Number(p.sort_order):0,stock,sizes,images:(Array.isArray(p?.images)&&p.images.length?p.images:[p?.image||'']).filter(Boolean),material:p?.material||'فضة',payment:p?.payment||'الدفع عند الاستلام',customFields:Array.isArray(p?.customFields)?p.customFields.filter(x=>x&&String(x.label||'').trim()&&String(x.value||'').trim()).map(x=>({label:String(x.label).trim(),value:String(x.value).trim()})):[]};
}
function isRingCategory(p){const c=String(p?.category??'').replace(/\s+/g,'').trim();return c.includes('خواتم')||c.includes('خاتم')}
function productHasSizes(p){return isRingCategory(p)&&Array.isArray(p?.sizes)&&p.sizes.length>0}
function getSizeStock(p,size){const key=String(size??'').trim();if(!productHasSizes(p))return Math.max(0,Math.floor(Number(p?.stock)||0));return Math.max(0,Math.floor(Number(p.sizes.find(x=>String(x.size)===key)?.stock)||0))}
function getCartSizeQty(id,size){const key=cartId(id),sz=String(size||'');return getCart().filter(i=>cartId(i.id)===key&&String(i.size||'')===sz).reduce((a,i)=>a+(Number(i.qty)||0),0)}
function getVisibleSizeStock(p,size){return Math.max(0,getSizeStock(p,size)-getCartSizeQty(p?.id,size))}
function getRingTotalVisibleStock(p){if(!isRingCategory(p))return 0;return (Array.isArray(p?.sizes)?p.sizes:[]).reduce((a,x)=>a+getVisibleSizeStock(p,x.size),0)}
let __fiddaProductsSource=null,__fiddaProductsCache=null,__fiddaProductsRevision=0,__fiddaProductsCacheRevision=-1;
function invalidateProductsCache(){__fiddaProductsRevision++}
function setProductsState(list){window.FIDDA_PRODUCTS=Array.isArray(list)?list:[];invalidateProductsCache();return window.FIDDA_PRODUCTS}
function getProducts(){
  const source=Array.isArray(window.FIDDA_PRODUCTS)?window.FIDDA_PRODUCTS:DEFAULT_PRODUCTS;
  if(source===__fiddaProductsSource&&__fiddaProductsCache&&__fiddaProductsCacheRevision===__fiddaProductsRevision)return __fiddaProductsCache;
  __fiddaProductsSource=source;
  const seen=new Set(),unique=[];
  for(const raw of source){
    const p=normalizeProduct(raw),key=Number.isFinite(Number(p.id))?`id:${Number(p.id)}`:`pending:${String(p.name||'').trim().toLowerCase()}|${String(p.category||'').trim().toLowerCase()}`;
    if(seen.has(key))continue;seen.add(key);unique.push(p);
  }
  __fiddaProductsCache=unique.sort((a,b)=>{const ao=Number.isFinite(Number(a.sort_order))?Number(a.sort_order):0,bo=Number.isFinite(Number(b.sort_order))?Number(b.sort_order):0;return ao-bo || Number(a.id)-Number(b.id)});
  __fiddaProductsCacheRevision=__fiddaProductsRevision;
  return __fiddaProductsCache;
}
function getCategories(){return window.FIDDA_CATEGORIES||DEFAULT_CATEGORIES}
function saveProducts(x){return setProductsState((x||[]).map(normalizeProduct))}
function saveCategories(x){window.FIDDA_CATEGORIES=x||[];return window.FIDDA_CATEGORIES}
function formatPrice(n){return new Intl.NumberFormat('ar-IQ').format(Number(n)||0)+' د.ع'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function getCart(){try{const x=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(x)?x.filter(i=>i&&Number(i.qty)>0):[]}catch{return[]}}
function saveCart(cart){
  const safe=Array.isArray(cart)?cart.filter(i=>i&&cartId(i.id)&&Number(i.qty)>0).map(i=>({...i,id:i.id,qty:Math.max(1,Math.floor(Number(i.qty)||1))})):[];
  localStorage.setItem(CART_KEY,JSON.stringify(safe));
  updateCartCount();
  window.dispatchEvent(new CustomEvent('fidda-cart-changed',{detail:{count:safe.reduce((a,i)=>a+(Number(i.qty)||0),0)}}));
}
function broadcastOptimisticOrderStock(items,mode='reserve',token=''){
  const payload={type:'order-stock-optimistic',mode,token:token||('opt-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),items:(items||[]).map(i=>({id:Number(i.id),qty:Math.max(1,Math.floor(Number(i.qty)||1)),...(i.size?{size:String(i.size)}:{})})),at:Date.now()};
  try{localStorage.setItem('fiddaOrderStockSync_v1',JSON.stringify(payload));}catch(e){}
  try{window.fiddaStockChannel=window.fiddaStockChannel||('BroadcastChannel' in window?new BroadcastChannel('fidda-order-stock-live'):null);window.fiddaStockChannel?.postMessage(payload)}catch(e){}
  window.dispatchEvent(new CustomEvent('fidda-order-stock-optimistic',{detail:payload}));
  return payload.token;
}
function applyLocalOrderStock(items,direction){
  const ids=new Set((items||[]).map(i=>Number(i.id)));
  const list=getProducts().map(p=>{const matches=(items||[]).filter(i=>Number(i.id)===Number(p.id));if(!matches.length)return p;let next={...p};for(const item of matches){const qty=Math.max(1,Math.floor(Number(item.qty)||1));const size=String(item.size||'');if(productHasSizes(p)&&size){next.sizes=(next.sizes||[]).map(x=>String(x.size)===size?{...x,stock:Math.max(0,Number(x.stock||0)+(Number(direction)||0)*qty)}:x);next.stock=next.sizes.reduce((a,x)=>a+Math.max(0,Number(x.stock)||0),0)}else next.stock=Math.max(0,Number(next.stock||0)+(Number(direction)||0)*qty)}return normalizeProduct(next);});
  setProductsState(list);
  try{localStorage.setItem('fiddaProductsCache_v7',JSON.stringify(list));localStorage.setItem('fiddaDataCacheTime_v3',String(Date.now()));}catch(e){}
  syncVisibleStoreAfterDataRefresh();
}
function cartId(id){return String(id??'').trim()}
function sameProductId(a,b){return cartId(a)!==''&&cartId(a)===cartId(b)}
function getCartItem(id,size=''){const key=cartId(id),sz=String(size||'');return getCart().find(i=>cartId(i.id)===key&&String(i.size||'')===sz)}
function getCartQty(id,size=''){return Math.max(0,Number(getCartItem(id,size)?.qty)||0)}
// العدد الظاهر للزبون = المخزون الحالي ناقص الكمية الموجودة بالفعل في سلته.
// مثال: المخزون 10 + في السلة 3 => يظهر للزبون: متبقي 7 قطع.
function getCustomerVisibleStock(p){
  const stock=Math.max(0,Math.floor(Number(p?.stock)||0));
  const inCart=getCart().filter(i=>sameProductId(i.id,p?.id)).reduce((a,i)=>a+(Number(i.qty)||0),0);
  return Math.max(0,stock-inCart);
}
function getRemainingAddableStock(p,size=''){return productHasSizes(p)?getVisibleSizeStock(p,size):getCustomerVisibleStock(p)}
function syncCartToCurrentStock(){
  const products=getProducts(),cart=getCart();
  let changed=false;
  const next=cart.map(item=>{
    const p=products.find(x=>sameProductId(x.id,item.id));
    if(!p){changed=true;return null}
    const available=getRemainingAddableStock(p,String(item.size||''))+Math.max(0,Math.floor(Number(item.qty)||1));
    const max=Math.max(0,available);
    const qty=Math.min(Math.max(1,Math.floor(Number(item.qty)||1)),max);
    if(qty!==Number(item.qty)){changed=true;item={...item,qty}}
    return qty>0?item:null;
  }).filter(Boolean);
  if(changed){localStorage.setItem(CART_KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('fidda-cart-changed'))}
  return changed;
}

function showToast(message,type='normal'){
  let toast=document.querySelector('.toast');
  if(!toast){toast=document.createElement('div');toast.className='toast';document.body.appendChild(toast)}
  toast.textContent=message;toast.dataset.type=type;toast.classList.add('show');clearTimeout(window.__fiddaToastTimer);window.__fiddaToastTimer=setTimeout(()=>toast.classList.remove('show'),1900);
}
function updateCartCount(){
  const count=getCart().reduce((a,i)=>a+(Number(i.qty)||0),0);
  document.querySelectorAll('#cartCount,.header-cart-count,[data-cart-count]').forEach(e=>{e.textContent=String(count);e.setAttribute('data-count',String(count));});
  return count;
}
function productImages(p){return normalizeProduct(p).images}

/* تغيير السلة يحدث على العناصر نفسها؛ لا يتم إعادة تحميل الصفحة ولا إعادة رسم السلة. */
function updateCustomerStockUI(id,productOverride=null){
  const p=productOverride||getProducts().find(x=>sameProductId(x.id,id));if(!p)return;
  const visible=getCustomerVisibleStock(p),available=visible>0;
  document.querySelectorAll(`[data-stock-product="${CSS.escape(String(id))}"]`).forEach(el=>{
    el.className=`stock-badge ${available?'available':'unavailable'}`;
    el.innerHTML=available?`<i class="stock-dot"></i>متوفر`:`<i class="stock-dot"></i>غير متوفر`;
  });
  document.querySelectorAll(`[data-add-product="${CSS.escape(String(id))}"]`).forEach(btn=>{
    // لا نعطّل زر السلة بعد أول ضغطة؛ addToCart هو المسؤول عن فحص المخزون في كل ضغطة.
    // إبقاء الزر قابلاً للنقر يمنع توقف الإضافة عند القطعة الأولى بسبب تحديث واجهة المخزون.
    const canAdd=!isRingCategory(p) && available;
    btn.disabled=false;
    btn.classList.toggle('disabled',!canAdd);
    btn.setAttribute('aria-disabled',canAdd?'false':'true');
  });
  const detail=document.getElementById('detailStock');
  if(detail&&Number(detail.dataset.productId)===Number(id)){
    const selected=String(window.__detailSelectedSize||'');
    const selectedStock=productHasSizes(p)&&selected?getVisibleSizeStock(p,selected):visible;
    detail.className=`detail-stock ${selectedStock>0?'available':'unavailable'}`;
    detail.textContent=selectedStock>0?`متوفر — ${selectedStock} قطعة`:(selected?'هذا القياس غير متوفر حاليًا':'غير متوفر حاليًا');
    document.querySelectorAll(`[data-size-product="${CSS.escape(String(id))}"]`).forEach(btn=>{const av=getVisibleSizeStock(p,btn.dataset.sizeValue||'')>0;btn.classList.toggle('available',av);btn.classList.toggle('unavailable',!av);btn.disabled=!av});
  }
}
function updateAllCustomerStockUI(){const products=getProducts();products.forEach(p=>updateCustomerStockUI(p.id,p))}
function addToCart(id,qty=1,size=''){
  const p=getProducts().find(x=>sameProductId(x.id,id));if(!p)return false;const selectedSize=String(size||'').trim();
  if(productHasSizes(p)&&!selectedSize){showToast('اختر القياس أولاً','error');return false}
  const requested=Math.max(1,Math.floor(Number(qty)||1));
  // اقرأ السلة والمخزون لحظة الضغط، حتى تعمل الضغطة الأولى والثانية والثالثة بنفس الطريقة.
  const cart=getCart();
  const item=cart.find(i=>sameProductId(i.id,p.id)&&String(i.size||'')===selectedSize);
  const currentQty=item?Math.max(0,Math.floor(Number(item.qty)||0)):0;
  const available=Math.max(0,getRemainingAddableStock(p,selectedSize));
  if(available<requested){showToast(available?`المتاح${selectedSize?` من القياس ${selectedSize}`:''}: ${available} قطعة`:'هذه القطعة غير متوفرة','error');return false}
  if(item) item.qty=currentQty+requested;
  else cart.push({id:p.id,qty:requested,...(selectedSize?{size:selectedSize}:{})});
  saveCart(cart);
  updateCartCount();
  updateCustomerStockUI(p.id);
  updateDetailQuantity(p.id);
  updateDetailTotal();
  if(document.getElementById('cartPage'))renderCart();
  showToast('تمت إضافة القطعة إلى السلة');
  return true;
}
function removeFromCart(id,size=''){
  const key=cartId(id),sz=String(size||'');
  const before=getCart();
  const next=before.filter(i=>!(cartId(i.id)===key&&String(i.size||'')===sz));
  if(next.length===before.length)return;
  saveCart(next);
  updateCartCount();
  if(document.getElementById('cartPage'))renderCart();
  updateCustomerStockUI(id);
  updateCartSummary();
  updateDetailQuantity(window.__detailProductId);
  updateDetailTotal();
  showToast('تمت إزالة القطعة من السلة');
}
function setCartQty(id,sizeOrValue,valueMaybe){const hasSize=arguments.length>=3,size=hasSize?String(sizeOrValue||''):'',value=hasSize?valueMaybe:sizeOrValue;const cart=getCart(),item=getCartItem(id,size),p=getProducts().find(x=>sameProductId(x.id,id));if(!item||!p)return;const max=getRemainingAddableStock(p,size)+Number(item.qty||0);let qty=String(value??'').replace(/[^0-9]/g,'');if(qty==='')return;qty=Math.floor(Number(qty)||0);if(qty<=0){removeFromCart(id,size);return}if(qty>max){qty=max;showToast(max?`المتبقي من هذا القياس ${max} قطعة`:'لا توجد قطع إضافية متاحة لك')}if(qty<=0){removeFromCart(id,size);return}item.qty=qty;saveCart(cart);updateCartCount();renderCart();updateCustomerStockUI(id);updateDetailQuantity(id);updateCartSummary()}
function changeQty(id,sizeOrDelta,deltaMaybe){const hasSize=arguments.length>=3,size=hasSize?String(sizeOrDelta||''):'',delta=hasSize?deltaMaybe:sizeOrDelta,item=getCartItem(id,size);if(!item)return;setCartQty(id,size,Number(item.qty)+Number(delta||0))}
function updateCartRow(id,size=''){const key=encodeURIComponent(`${id}::${size}`),row=document.querySelector(`.cart-row[data-cart-key="${CSS.escape(key)}"]`);if(!row)return;const p=getProducts().find(x=>sameProductId(x.id,id)),item=getCartItem(id,size);if(!p||!item)return;const qty=row.querySelector('.cart-qty'),total=row.querySelector('.cart-row-total'),remaining=row.querySelector('.cart-remaining'),plus=row.querySelector('.cart-plus');const available=getRemainingAddableStock(p,size);if(qty){qty.value=item.qty;qty.max=available+Number(item.qty||0)}if(total)total.textContent=formatPrice(p.price*item.qty);if(remaining)remaining.textContent=`المتاح${size?` من القياس ${escapeHtml(size)}`:''}: ${available} قطعة`;if(plus)plus.disabled=available<=0}
function updateCartSummary(){const t=cartTotals();const s=document.getElementById('cartSubtotal'),d=document.getElementById('cartDelivery'),total=document.getElementById('cartTotal');if(s)s.textContent=formatPrice(t.subtotal);if(d)d.textContent=formatPrice(t.delivery);if(total)total.textContent=formatPrice(t.total)}

function sizeSelectorMarkup(p){if(!isRingCategory(p))return '';if(!productHasSizes(p))return `<div id="ringSizes" class="size-selector size-selector-empty" data-size-selector="${p.id}"><div class="size-selector-head"><span>Size:</span><small>قياسات الخاتم</small></div><div class="size-empty-note">لا توجد قياسات مضافة لهذا الخاتم بعد</div></div>`;return `<div id="ringSizes" class="size-selector" data-size-selector="${p.id}"><div class="size-selector-head"><span>Size:</span><small>اختر القياس</small></div><div class="size-options">${p.sizes.map(x=>{const av=getVisibleSizeStock(p,x.size)>0;return `<button type="button" class="size-option ${av?'available':'unavailable'}" data-size-product="${p.id}" data-size-value="${escapeHtml(x.size)}" ${av?'':'disabled'}>Size: ${escapeHtml(x.size)}</button>`}).join('')}</div></div>`}
function stockMarkup(p,featured=false){const visible=getCustomerVisibleStock(p);return `<span data-stock-product="${p.id}" class="stock-badge ${featured?'featured-stock ':''}${visible>0?'available':'unavailable'}">${visible>0?'متوفر':'غير متوفر'}</span>`}
function bagIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5h11l.8 11H5.7l.8-11Z"></path><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"></path><path d="M9 12.5v2M15 12.5v2"></path></svg>'}
function productCard(p,featured=false){const img=productImages(p)[0]||'',ring=isRingCategory(p),out=ring?getRingTotalVisibleStock(p)<=0:getRemainingAddableStock(p)<=0,multi=productImages(p).length>1;const actionLabel=ring?'عرض القياسات':'إضافة '+escapeHtml(p.name)+' إلى السلة';const actionMarkup=ring?`<a class="add-btn ring-action" href="product.html?id=${encodeURIComponent(p.id)}#ringSizes" aria-label="${actionLabel}" title="${actionLabel}"><span class="ring-size-label">Size</span></a>`:`<button type="button" class="add-btn" data-add-product="${escapeHtml(p.id)}" ${out?'disabled':''} aria-label="${actionLabel}" title="${actionLabel}">${bagIcon()}</button>`;return `<article class="product-card reveal ${out?'out-of-stock':''}"><a href="product.html?id=${encodeURIComponent(p.id)}" class="product-image"><img src="${escapeHtml(fiddaFastImageUrl(img,720,78))}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" fetchpriority="low"><span class="product-category">${escapeHtml(p.category)}</span>${multi?`<span class="image-count">◈ ${productImages(p).length}</span>`:''}</a><div class="product-info"><a href="product.html?id=${encodeURIComponent(p.id)}"><h3>${escapeHtml(p.name)}</h3></a>${stockMarkup(p,featured)}<div class="product-bottom"><strong>${formatPrice(p.price)}</strong>${actionMarkup}</div></div></article>`}
function renderProducts(list,id){
  const el=document.getElementById(id);
  if(!el)return;
  const featured=id==='featuredProducts';
  el.classList.toggle('featured-grid',featured);
  const items=Array.isArray(list)?list:[];
  if(items.length){
    el.innerHTML=items.map(p=>productCard(p,featured)).join('');
  }else if(featured){
    el.innerHTML='<div class="fidda-empty-products" role="status">لا توجد منتجات</div>';
  }else{
    el.innerHTML='<div class="fidda-coming-soon">قريباً...</div>';
  }
  initReveal();
  updateAllCustomerStockUI();
}
function renderRelatedProducts(currentId){const el=document.getElementById('relatedProducts');const section=document.getElementById('relatedProductsSection');if(!el)return;const current=getProducts().find(p=>Number(p.id)===Number(currentId));if(!current){if(section)section.classList.add('hidden');return}const all=getProducts().filter(p=>Number(p.id)!==Number(currentId));const sameCategory=all.filter(p=>p.category===current.category);const others=all.filter(p=>p.category!==current.category);const list=[...sameCategory,...others].slice(0,4);if(!list.length){el.innerHTML='';if(section)section.classList.add('hidden');return}if(section)section.classList.remove('hidden');el.innerHTML=list.map(productCard).join('');initReveal();updateAllCustomerStockUI()}

function renderHomeCategories(){const el=document.getElementById('homeCategories');if(!el)return;el.innerHTML=getCategories().map((c,i)=>`<a class="category-card reveal" style="background-image:url('${escapeHtml(c.image)}')" href="products.html?category=${encodeURIComponent(c.name)}"><span>0${i+1}</span><h3>${escapeHtml(c.name)}</h3><small>اكتشف المجموعة</small></a>`).join('');initReveal()}

function openImageLightbox(){const imgs=window.__detailImages||[];if(!imgs.length)return;let box=document.getElementById('fiddaImageLightbox');if(!box){box=document.createElement('div');box.id='fiddaImageLightbox';box.className='fidda-lightbox hidden';box.innerHTML='<div class="fidda-lightbox-backdrop" data-lightbox-close></div><button class="fidda-lightbox-close" type="button" data-lightbox-close aria-label="إغلاق">×</button><img id="fiddaLightboxImage" alt=""><div class="fidda-lightbox-count" id="fiddaLightboxCount"></div>';document.body.appendChild(box);box.querySelectorAll('[data-lightbox-close]').forEach(x=>x.addEventListener('click',closeImageLightbox));}box.classList.remove('hidden');document.body.classList.add('lightbox-open');updateLightboxImage()}
function closeImageLightbox(){const box=document.getElementById('fiddaImageLightbox');if(box)box.classList.add('hidden');document.body.classList.remove('lightbox-open')}
function updateLightboxImage(){const box=document.getElementById('fiddaImageLightbox'),imgs=window.__detailImages||[],i=Number(window.__detailIndex)||0;if(!box||!imgs.length)return;const img=box.querySelector('#fiddaLightboxImage');if(img)img.src=imgs[i]||'';const c=box.querySelector('#fiddaLightboxCount');if(c)c.textContent=`${i+1} / ${imgs.length}`}
function changeLightboxImage(delta){const imgs=window.__detailImages||[];if(!imgs.length)return;window.__detailIndex=((Number(window.__detailIndex)||0)+Number(delta)+imgs.length)%imgs.length;setDetailImage(window.__detailIndex)}
function renderProductDetail(){
  const el=document.getElementById('productDetail');if(!el)return;const id=Number(new URLSearchParams(location.search).get('id')),p=getProducts().find(x=>Number(x.id)===id),relatedSection=document.getElementById('relatedProductsSection');
  if(!p){el.innerHTML='<div class="empty-state"><h2>المنتج غير موجود</h2><a class="btn btn-dark" href="products.html">العودة للمتجر</a></div>';if(relatedSection)relatedSection.classList.add('hidden');return}
  if(relatedSection)relatedSection.classList.remove('hidden');const imgs=productImages(p),visible=getCustomerVisibleStock(p),out=getRemainingAddableStock(p)<=0;
  el.innerHTML=`<div class="detail-gallery reveal"><div class="gallery-main"><button class="gallery-open" type="button" aria-label="تبديل الصور أو فتح الصورة بحجم كبير" title="انقر يمينًا أو يسارًا للتبديل — الوسط لفتح الصورة"><img id="detailMainImage" src="${escapeHtml(fiddaFastImageUrl(imgs[0]||'',1200,82))}" alt="${escapeHtml(p.name)}" decoding="async" fetchpriority="high"></button><span class="gallery-position" id="galleryPosition">1 / ${imgs.length||1}</span></div><div class="gallery-thumbs">${imgs.map((im,i)=>`<button class="gallery-thumb ${i===0?'active':''}" type="button" data-index="${i}" onclick="setDetailImage(${i})"><img src="${escapeHtml(fiddaFastImageUrl(im,240,72))}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div></div><div class="detail-content reveal"><p class="eyebrow">${escapeHtml(p.category)}</p><h1>${escapeHtml(p.name)}</h1><div class="detail-price">${formatPrice(p.price)}</div><div id="detailStock" data-product-id="${p.id}" class="detail-stock ${out?'unavailable':'available'}">${out?'غير متوفر حاليًا':`متوفر — ${visible} قطعة`}</div>${sizeSelectorMarkup(p)}<p class="detail-desc">${escapeHtml(p.desc||'')}</p><div class="quantity-row" aria-label="اختيار الكمية"><button type="button" onclick="changeDetailQty(-1)" aria-label="تقليل الكمية">−</button><input id="detailQty" class="quantity-input" type="text" inputmode="numeric" pattern="[0-9]*" value="1" autocomplete="off" aria-label="الكمية" oninput="this.value=this.value.replace(/[^0-9]/g,'');setDetailQty(this.value)" onblur="if(!this.value)this.value=1;setDetailQty(this.value)"><button type="button" onclick="changeDetailQty(1)" aria-label="زيادة الكمية">+</button></div><div class="detail-total"><span>إجمالي القطعة</span><strong id="detailTotal">${formatPrice(p.price)}</strong><small>بدون أجور التوصيل</small></div><button id="detailAddButton" class="btn btn-dark full" type="button" ${out?'disabled':''} onclick="addDetailToCart(${p.id})">${out?'غير متوفر':bagIcon()+'<span>أضف إلى السلة</span>'}</button><div class="details-list"><div><b>الخامة</b><span>${escapeHtml(p.material)}</span></div><div><b>الدفع</b><span>${escapeHtml(p.payment)}</span></div>${p.customFields.map(f=>`<div><b>${escapeHtml(f.label)}</b><span>${escapeHtml(f.value)}</span></div>`).join('')}</div></div>`;
  window.__detailImages=imgs;window.__detailIndex=0;window.__detailProductId=id;window.__detailSelectedSize='';
  const galleryOpen=el.querySelector('.gallery-open');
  if(galleryOpen){let startX=0,startY=0,moved=false;galleryOpen.addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY;moved=false;galleryOpen.setPointerCapture?.(e.pointerId)});galleryOpen.addEventListener('pointerup',e=>{const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){moved=true;changeDetailImage(dx<0?1:-1);return}if(moved)return;const r=galleryOpen.getBoundingClientRect(),x=e.clientX-r.left;if(x<r.width*.28)changeDetailImage(-1);else if(x>r.width*.72)changeDetailImage(1);else openImageLightbox()});galleryOpen.addEventListener('click',e=>e.preventDefault());}
  const lightbox=document.getElementById('fiddaImageLightbox');
  if(lightbox){let sx=0,sy=0;lightbox.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});lightbox.addEventListener('pointerup',e=>{const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))changeLightboxImage(dx<0?1:-1)})}
el.querySelectorAll('[data-size-value]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.disabled)return;window.__detailSelectedSize=String(btn.dataset.sizeValue||'');el.querySelectorAll('[data-size-value]').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');updateDetailQuantity(id);updateCustomerStockUI(id)}));initReveal();updateDetailQuantity(id);renderRelatedProducts(id);if(location.hash==='#ringSizes'){requestAnimationFrame(()=>document.getElementById('ringSizes')?.scrollIntoView({behavior:'smooth',block:'center'}))}
}
function setDetailImage(index){const imgs=window.__detailImages||[];if(!imgs.length)return;index=(index+imgs.length)%imgs.length;window.__detailIndex=index;const img=document.getElementById('detailMainImage');if(img){img.classList.add('fade-image');setTimeout(()=>{img.src=imgs[index];img.classList.remove('fade-image')},100)}document.querySelectorAll('.gallery-thumb').forEach(x=>x.classList.toggle('active',Number(x.dataset.index)===index));const pos=document.getElementById('galleryPosition');if(pos)pos.textContent=`${index+1} / ${imgs.length}`;updateLightboxImage()}
function changeDetailImage(delta){setDetailImage((window.__detailIndex||0)+delta)}
function updateDetailTotal(){const id=window.__detailProductId,p=getProducts().find(x=>sameProductId(x.id,id)),qty=Math.max(1,Number(document.getElementById('detailQty')?.value)||1),total=document.getElementById('detailTotal');if(p&&total)total.textContent=formatPrice(Number(p.price)*qty)}
function setDetailQty(value){const e=document.getElementById('detailQty'),id=window.__detailProductId,p=getProducts().find(x=>sameProductId(x.id,id));if(!e||!p)return;const max=getRemainingAddableStock(p,String(window.__detailSelectedSize||''));let qty=String(value??'').replace(/[^0-9]/g,'');if(qty==='')return;qty=Math.floor(Number(qty)||0);if(qty<=0)qty=1;if(qty>max){qty=max;showToast(max?`المتبقي لك ${max} قطعة`:'لا توجد قطع إضافية متاحة لك');}if(max>0)e.value=qty;updateDetailTotal()}
function changeDetailQty(delta){const e=document.getElementById('detailQty');if(!e)return;setDetailQty(Number(e.value||1)+Number(delta||0))}
function updateDetailQuantity(id){if(!sameProductId(id,window.__detailProductId))return;const p=getProducts().find(x=>sameProductId(x.id,id)),e=document.getElementById('detailQty'),btn=document.getElementById('detailAddButton');if(!p)return;const max=getRemainingAddableStock(p,String(window.__detailSelectedSize||''));if(e){e.max=max;if(max>0)e.value=Math.min(max,Math.max(1,Number(e.value||1)));else e.value=1;}if(btn){btn.disabled=max<=0;btn.innerHTML=max>0?bagIcon()+'<span>أضف إلى السلة</span>':'غير متوفر'}updateDetailTotal()}
function addDetailToCart(id){const qty=Number(document.getElementById('detailQty')?.value||1),p=getProducts().find(x=>sameProductId(x.id,id)),size=String(window.__detailSelectedSize||'');if(productHasSizes(p)&&!size){showToast('اختر القياس أولاً','error');return}if(addToCart(id,qty,size)){showToast('تمت إضافة القطعة إلى السلة — يمكنك متابعة التسوق');}}

function cartTotals(){const products=getProducts();let subtotal=0;getCart().forEach(i=>{const p=products.find(x=>sameProductId(x.id,i.id));if(p)subtotal+=p.price*(Number(i.qty)||0)});const delivery=getCart().length?DELIVERY_FEE:0;return{subtotal,delivery,total:subtotal+delivery}}
function trashIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 7.5h13M9 7.5V5.5h6v2M8 10.5v7M12 10.5v7M16 10.5v7M7 7.5l1 12h8l1-12"/></svg>'}
function renderCart(){
  const el=document.getElementById('cartPage');if(!el)return;const cart=getCart(),products=getProducts();
  if(!cart.length){el.innerHTML='<div class="empty-state cart-empty"><div class="empty-cart-icon">♡</div><h2>السلة فارغة</h2><p>أضف القطع التي أعجبتك لتظهر هنا.</p><a class="btn btn-dark" href="products.html">ابدأ التسوق</a></div>';return}
  const rows=cart.map(i=>{const p=products.find(x=>sameProductId(x.id,i.id));if(!p)return'';const size=String(i.size||''),available=getRemainingAddableStock(p,size),key=encodeURIComponent(`${p.id}::${size}`);return `<div class="cart-row reveal" data-cart-key="${key}"><a class="cart-product-link" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${escapeHtml(fiddaFastImageUrl(productImages(p)[0]||'',360,74))}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async"></a><div class="cart-item-info"><a href="product.html?id=${encodeURIComponent(p.id)}"><h3>${escapeHtml(p.name)}</h3></a>${size?`<span class="cart-item-size">Size: ${escapeHtml(size)}</span>`:''}<span class="cart-item-price">${formatPrice(p.price)}</span><small class="cart-remaining">المتاح${size?` من القياس ${escapeHtml(size)}`:''}: ${available} قطعة</small></div><div class="qty-control"><button class="cart-minus" data-cart-action="minus" data-id="${p.id}" data-size="${escapeHtml(size)}" type="button">−</button><input class="cart-qty" data-cart-action="input" data-id="${p.id}" data-size="${escapeHtml(size)}" type="text" inputmode="numeric" value="${i.qty}" min="1" max="${available+Number(i.qty||0)}"><button class="cart-plus" data-cart-action="plus" data-id="${p.id}" data-size="${escapeHtml(size)}" type="button" ${available<=0?'disabled':''}>+</button></div><strong class="cart-row-total">${formatPrice(p.price*i.qty)}</strong><button class="remove-btn" data-cart-action="remove" data-id="${p.id}" data-size="${escapeHtml(size)}" type="button" aria-label="إزالة ${escapeHtml(p.name)}">${trashIcon()}</button></div>`}).join('');
  const t=cartTotals();el.innerHTML=`<div class="cart-layout"><div class="cart-items">${rows}</div><aside class="cart-summary reveal"><p class="eyebrow">YOUR SELECTION</p><h2>ملخص الطلب</h2><div class="summary-line"><span>مجموع المنتجات</span><b id="cartSubtotal">${formatPrice(t.subtotal)}</b></div><div class="summary-line"><span>التوصيل</span><b id="cartDelivery">${formatPrice(t.delivery)}</b></div><div class="summary-total"><span>الإجمالي النهائي</span><b id="cartTotal">${formatPrice(t.total)}</b></div><div class="summary-line"><span>طريقة الدفع</span><span>الدفع عند الاستلام</span></div><a class="btn btn-dark full" href="checkout.html">متابعة الطلب</a></aside></div>`;
  el.querySelectorAll('[data-cart-action]').forEach(btn=>{btn.addEventListener('click',()=>{const id=Number(btn.dataset.id),size=String(btn.dataset.size||''),action=btn.dataset.cartAction,item=getCartItem(id,size);if(!item)return;if(action==='remove')return removeFromCart(id,size);if(action==='plus')return changeQty(id,size,1);if(action==='minus')return changeQty(id,size,-1);});if(btn.dataset.cartAction==='input')btn.addEventListener('input',()=>setCartQty(Number(btn.dataset.id),String(btn.dataset.size||''),btn.value))});
  initReveal();updateAllCustomerStockUI()
}

function renderCheckout(){
  const el=document.getElementById('orderSummary');if(!el)return;const cart=getCart(),products=getProducts();
  if(!cart.length){if(!document.getElementById('orderSuccess')?.classList.contains('hidden'))return;location.replace('cart.html');return}
  const t=cartTotals();el.innerHTML=`<p class="eyebrow">YOUR ORDER</p><h2>ملخص الطلب</h2>${cart.map(i=>{const p=products.find(x=>sameProductId(x.id,i.id));return p?`<a class="summary-product" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${escapeHtml(productImages(p)[0]||'')}" alt=""><div><b>${escapeHtml(p.name)}</b><small>الكمية: ${i.qty}${i.size?` · Size: ${escapeHtml(i.size)}`:''}</small></div><strong>${formatPrice(p.price*i.qty)}</strong></a>`:''}).join('')}<div class="summary-line"><span>مجموع المنتجات</span><b>${formatPrice(t.subtotal)}</b></div><div class="summary-line"><span>التوصيل</span><b>${formatPrice(t.delivery)}</b></div><div class="summary-total"><span>الإجمالي النهائي</span><b>${formatPrice(t.total)}</b></div>`
}
const FIDDA_CUSTOMER_ID_KEY='fiddaCustomerId_v1';
function getFiddaCustomerId(){
  try{
    let id=localStorage.getItem(FIDDA_CUSTOMER_ID_KEY);
    if(!id){
      const raw=(crypto?.randomUUID?.()||('c_'+Math.random().toString(36).slice(2)+Date.now()));
      id='FID-C-'+raw.replace(/[^a-zA-Z0-9]/g,'').slice(-12).toUpperCase();
      localStorage.setItem(FIDDA_CUSTOMER_ID_KEY,id);
    }
    return id;
  }catch(e){return 'FID-C-'+Math.random().toString(36).slice(2,14).toUpperCase()}
}
window.getFiddaCustomerId=getFiddaCustomerId;
function normalizeIraqiPhone(v){return String(v||'').replace(/\D/g,'')}
function isValidIraqiPhone(v){return /^07\d{9}$/.test(normalizeIraqiPhone(v))}
async function notifyFiddaNewOrder(orderId){
  if(!orderId)return;
  try{
    const endpoint=`${FIDDA_SUPABASE_URL}/functions/v1/notify-new-order`;
    await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':FIDDA_SUPABASE_KEY,'Authorization':`Bearer ${FIDDA_SUPABASE_KEY}`,'X-FIDDA-PUSH-TOKEN':'bMDnTtpyDEGfRZxkGPqIANrWZumUyv_U606JKyC6frk'},body:JSON.stringify({order_id:String(orderId)})});
  }catch(e){console.warn('FIDDA push notification:',e)}
}

function setupCheckout(){
  const f=document.getElementById('checkoutForm');if(!f)return;const phone=f.elements.phone;
  if(phone){phone.inputMode='numeric';phone.maxLength=11;phone.pattern='07[0-9]{9}';phone.addEventListener('input',()=>{phone.value=phone.value.replace(/\D/g,'').slice(0,11);phone.setCustomValidity(isValidIraqiPhone(phone.value)?'':'أدخل رقم هاتف عراقي صحيح من 11 رقمًا يبدأ بـ 07')})}
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!f.reportValidity())return;
    if(!window.FIDDA_DB_READY){showToast('جارٍ الاتصال بالمتجر، حاول بعد لحظات','error');return}
    const cart=getCart(),products=getProducts();if(!cart.length){location.replace('cart.html');return}
    for(const item of cart){const p=products.find(x=>sameProductId(x.id,item.id));const available=p?getRemainingAddableStock(p,String(item.size||''))+Number(item.qty||0):0;if(!p||available<Number(item.qty)){showToast(p?`لم تعد الكمية المطلوبة من ${p.name}${item.size?` (Size: ${item.size})`:''} متوفرة`:'إحدى القطع لم تعد متوفرة','error');await refreshStoreData();renderCheckout();return}}
    const customer=Object.fromEntries(new FormData(f).entries());customer.phone=normalizeIraqiPhone(customer.phone);customer.customer_id=getFiddaCustomerId();delete customer.instagram;const t=cartTotals();
    const items=cart.map(i=>{const p=products.find(x=>sameProductId(x.id,i.id));return{id:Number(p.id),qty:Number(i.qty),...(i.size?{size:String(i.size)}:{}),name:p.name,price:Number(p.price),image:productImages(p)[0]||'',category:p.category,material:p.material||'فضة'}});
    const button=f.querySelector('button[type="submit"]');if(button){button.disabled=true;button.dataset.original=button.textContent;button.textContent='جارٍ تأكيد الطلب...'}
    // لا نحجز أو ننقص المخزون عند مجرد فتح/إضافة القطعة إلى السلة.
    // إنقاص المخزون يتم فقط داخل create_order عند تثبيت الطلب بنجاح.
    try{
      const result=await dbCreateOrder(customer,items,t.subtotal,t.delivery,t.total);
      // الإشعار منفصل عن تثبيت الطلب؛ فشل الإشعار لا يجعل الطلب يبدو فاشلًا.
      notifyFiddaNewOrder(result.id).catch(()=>{});
      // المعاملة نجحت في PostgreSQL، لذلك يمكن عكس نقص المخزون محليًا فورًا؛ Realtime سيؤكد القيمة النهائية لاحقًا.
      applyLocalOrderStock(items,-1);
      localStorage.removeItem(CART_KEY);updateCartCount();f.classList.add('hidden');const success=document.getElementById('orderSuccess');success.classList.remove('hidden');success.innerHTML=`<div class="success-icon">✓</div><p class="eyebrow">ORDER CONFIRMED</p><h2>تم استلام طلبك بنجاح</h2><p>رقم الطلب: <b>${escapeHtml(result.id)}</b></p><p>الإجمالي: <b>${formatPrice(t.total)}</b> شامل التوصيل.</p><p>سنتواصل معك لتأكيد الطلب وتجهيزه.</p>`;const modal=document.getElementById('orderSuccessModal');const details=document.getElementById('successDetails');if(modal&&details){details.className='success-details';details.innerHTML=`<div class="detail-row"><span>رقم الطلب</span><b>${escapeHtml(result.id)}</b></div><div class="detail-row"><span>الإجمالي</span><b>${formatPrice(t.total)} شامل التوصيل</b></div>`;modal.classList.remove('hidden');document.body.style.overflow='hidden';}
    }catch(err){
      console.error('FIDDA create order failed:',err);
      // لم يتم تثبيت الطلب، لذلك لا نلمس المخزون المحلي.
      const msg=String(err?.message||err?.details||err?.hint||'');
      const code=String(err?.code||'');
      let userMsg='تعذر إرسال الطلب. حاول مرة أخرى.';
      if(msg.includes('غير متوفرة')) userMsg='الكمية لم تعد متوفرة. حدّث السلة وحاول مرة أخرى';
      else if(msg.includes('رقم الهاتف')) userMsg='رقم الهاتف غير صالح. تحقق منه وحاول مرة أخرى';
      else if(/Failed to fetch|NetworkError|fetch/i.test(msg)) userMsg='تعذر الاتصال بالخادم. تأكد من الاتصال بالإنترنت وحاول مرة أخرى';
      else if(msg) userMsg=`تعذر إرسال الطلب: ${msg}`;
      console.error('FIDDA create order error code:',code,'message:',msg);
      showToast(userMsg,'error');
      if(button){button.disabled=false;button.textContent=button.dataset.original||'تأكيد الطلب'}
    }
  })
}

function initReveal(){const els=document.querySelectorAll('.reveal:not([data-reveal-bound])');if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('revealed'));return}const observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('revealed');observer.unobserve(x.target)}}),{threshold:.08});els.forEach(e=>{e.dataset.revealBound='1';observer.observe(e)})}

let storeRefreshBusy=false;
async function refreshStoreData({quiet=true}={}){
  if(!window.fiddaSupabase||storeRefreshBusy)return false;storeRefreshBusy=true;
  try{
    const catalog=await fiddaFetchCatalog();
    const nextProducts=catalog.products;
    const nextCategories=catalog.categories;
    const oldP=JSON.stringify(window.FIDDA_PRODUCTS||[]),oldC=JSON.stringify(window.FIDDA_CATEGORIES||[]);
    setProductsState(nextProducts);window.FIDDA_CATEGORIES=nextCategories;window.FIDDA_DB_READY=true;
    try{localStorage.setItem('fiddaProductsCache_v7',JSON.stringify(nextProducts));localStorage.setItem('fiddaCategoriesCache_v3',JSON.stringify(nextCategories));localStorage.setItem('fiddaDataCacheTime_v3',String(Date.now()))}catch(e){}
    __lastStoreRefresh=Date.now();
    if(oldP!==JSON.stringify(nextProducts)||oldC!==JSON.stringify(nextCategories))syncVisibleStoreAfterDataRefresh();
    return true;
  }catch(e){console.error('Supabase refresh:',e);if(!quiet)showToast('تعذر تحديث بيانات المتجر','error');return false}finally{storeRefreshBusy=false}
}
function syncVisibleStoreAfterDataRefresh(){
  const cartChanged=syncCartToCurrentStock();
  updateCartCount();updateAllCustomerStockUI();
  if(cartChanged&&document.getElementById('cartPage'))renderCart();
  if(document.getElementById('homeCategories'))renderHomeCategories();
  if(document.getElementById('featuredProducts'))renderProducts(getProducts().filter(p=>p.featured),'featuredProducts');
  if(document.getElementById('allProducts'))applyProductsPageFilters();
  if(document.getElementById('productDetail')){refreshProductDetailDataOnly();renderRelatedProducts(window.__detailProductId); }
  if(document.getElementById('orderSummary'))renderCheckout();
}
function refreshProductDetailDataOnly(){const id=Number(new URLSearchParams(location.search).get('id')),p=getProducts().find(x=>Number(x.id)===id);if(!p)return;const stock=document.getElementById('detailStock'),btn=document.getElementById('detailAddButton');const visible=getCustomerVisibleStock(p),remaining=getRemainingAddableStock(p);if(stock){stock.className=`detail-stock ${visible?'available':'unavailable'}`;stock.textContent=visible?`متوفر — ${visible} قطعة`:'غير متوفر حاليًا'}if(btn){btn.disabled=remaining<=0;btn.innerHTML=remaining>0?bagIcon()+'<span>أضف إلى السلة</span>':'الحد الأقصى في السلة'}updateDetailQuantity(id);updateDetailTotal()}
function applyProductsPageFilters(){const f=document.getElementById('categoryFilters'),s=document.getElementById('searchInput');if(!f||!s)return;const current=f.dataset.current||'الكل',q=s.value.trim().toLowerCase();renderProducts(getProducts().filter(p=>(current==='الكل'||p.category===current)&&(!q||p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q))),'allProducts')}
function setupProductsPage(){const f=document.getElementById('categoryFilters'),s=document.getElementById('searchInput');if(!f||!s)return;const params=new URLSearchParams(location.search),requested=params.get('category')||'الكل';f.innerHTML='<button type="button" class="filter-btn" data-category="الكل">الكل</button>'+getCategories().map(c=>`<button type="button" class="filter-btn" data-category="${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>`).join('');const valid=getCategories().some(c=>c.name===requested),current=valid?requested:'الكل';f.dataset.current=current;f.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.category===current);b.onclick=()=>{f.dataset.current=b.dataset.category;f.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));applyProductsPageFilters()}});if(!s.dataset.bound){s.dataset.bound='1';s.addEventListener('input',applyProductsPageFilters)}applyProductsPageFilters()}

function renderStoreImmediately(){
  updateCartCount();
  if(document.getElementById('allProducts'))setupProductsPage();
  renderHomeCategories();
  renderProductDetail();
  renderCart();
  renderCheckout();
  if(document.getElementById('featuredProducts'))renderProducts(getProducts().filter(p=>p.featured),'featuredProducts');
  updateAllCustomerStockUI();
}
function scheduleStoreRefresh(){
  if(window.__fiddaStoreRefreshScheduled)return;
  window.__fiddaStoreRefreshScheduled=true;
  Promise.resolve().then(async()=>{
    window.__fiddaStoreRefreshScheduled=false;
    await refreshStoreData();
  });
}
function bootStore(){
  // صفحة الإدارة لا تحتاج تشغيل واجهة المتجر أو مؤقتات التحديث الثقيلة.
  if(document.body?.classList.contains('admin-body') || location.pathname.toLowerCase().endsWith('/admin.html')) return;
  // لا ننتظر الشبكة إطلاقًا: الواجهة والسلة تظهر من الذاكرة/الكاش فورًا.
  // مؤشرات التحميل أصبحت داخل أماكن العناصر نفسها، وليست طبقة فوق الصفحة.
  // عند تنفيذ render* يتم استبدال المؤشر مباشرة بالعناصر الفعلية.
  renderStoreImmediately();
  // التحديث من Supabase يحدث في الخلفية.
  if(window.fiddaDbInit)fiddaDbInit().catch(e=>console.error(e));
}
window.addEventListener('fidda-cart-changed',()=>{updateCartCount();updateAllCustomerStockUI();updateCartSummary();updateDetailQuantity(window.__detailProductId);if(document.getElementById('orderSummary'))renderCheckout()});

// مزامنة فورية للمخزون عند إلغاء/إعادة فتح طلب من لوحة الإدارة على نفس الجهاز.
// قاعدة البيانات + Supabase Realtime تبقى المصدر الأساسي، وهذا التحديث يجعل الواجهة تتغير فورًا دون انتظار الشبكة.
function handleAdminStockBroadcast(payload){
  if(location.pathname.toLowerCase().endsWith('/admin.html'))return;
  if(!payload||payload.type!=='order-stock-optimistic'||!Array.isArray(payload.items))return;
  const mode=String(payload.mode||'');
  if(mode==='release' || mode==='rollback-from-cancel'){
    applyLocalOrderStock(payload.items,1);
  }else if(mode==='reserve-from-cancel'){
    applyLocalOrderStock(payload.items,-1);
  }
}
window.addEventListener('fidda-order-stock-optimistic',e=>handleAdminStockBroadcast(e.detail||{}));
try{
  if('BroadcastChannel' in window){
    const ch=window.__fiddaStoreStockChannel||new BroadcastChannel('fidda-order-stock-live');
    ch.onmessage=e=>handleAdminStockBroadcast(e.data||{});
    window.__fiddaStoreStockChannel=ch;
  }
}catch(e){}
window.addEventListener('storage',e=>{
  if(e.key==='fiddaOrderStockSync_v1'&&e.newValue){try{handleAdminStockBroadcast(JSON.parse(e.newValue))}catch(err){}}
});
window.addEventListener('storage',e=>{
  if(e.key===CART_KEY){ updateCartCount(); updateAllCustomerStockUI(); updateCartSummary(); updateDetailQuantity(window.__detailProductId); if(document.getElementById('cartPage'))renderCart(); if(document.getElementById('orderSummary'))renderCheckout(); }
});
window.addEventListener('fidda-db-ready',syncVisibleStoreAfterDataRefresh);
// تصحيح لحظي واحد بعد إعادة اتصال Realtime فقط؛ لا يوجد polling دوري.
window.addEventListener('fidda-realtime-reconcile',event=>{
  // V59: reconnect فقط يرسل إشارة للمصالحة؛ لا نكرر طلبات الشبكة إذا كان الحدث قد طُبّق لحظيًا.
});
const FIDDA_LIVE_SYNC_KEY='fiddaLiveSync_v2';
function persistLiveProducts(list){
  setProductsState((list||[]).map(normalizeProduct));
  try{
    localStorage.setItem('fiddaProductsCache_v7',JSON.stringify(window.FIDDA_PRODUCTS));
    localStorage.setItem('fiddaDataCacheTime_v3',String(Date.now()));
  }catch(e){}
}
function publishLiveProducts(list){
  persistLiveProducts(list);
  try{localStorage.setItem(FIDDA_LIVE_SYNC_KEY,JSON.stringify({type:'products',at:Date.now(),products:window.FIDDA_PRODUCTS}));}catch(e){}
  syncVisibleStoreAfterDataRefresh();
}
// عند تغيّر حالة أي طلب في Supabase، نعيد قراءة المنتجات فورًا.
// هذا يوفر مسارًا فوريًا حتى لو لم يكن جدول products مضافًا إلى Realtime بعد.
window.addEventListener('fidda-orders-changed',event=>{
  // لا ننتظر الطلبات لإعادة قراءة products: حدث products نفسه يحدّث المخزون فور وصوله.
  // هذا المستمع موجود فقط للتوافق مع النسخ القديمة ولا يفرض أي تأخير زمني.
});
window.addEventListener('fidda-data-changed',event=>{
  const payload=event.detail||{};
  if(payload.table==='products'&&payload.new){
    const next=rowToProduct(payload.new);
    const current=getProducts();
    const idx=current.findIndex(p=>Number(p.id)===Number(next.id));
    if(payload.eventType!=='DELETE' && idx>=0 && JSON.stringify(current[idx])===JSON.stringify(next)) return;
    if(payload.eventType==='UPDATE' && idx>=0){
      const prev=current[idx];
      // أغلب أحداث Realtime أثناء الطلبات تغيّر المخزون فقط؛ حدّث الواجهة المستهدفة
      // دون إعادة بناء شبكة المنتجات كاملة. هذا يجعل وصول المخزون شبه لحظي.
      const stockOnly = prev.name===next.name && prev.category===next.category && Number(prev.price)===Number(next.price) &&
        prev.desc===next.desc && prev.material===next.material && prev.payment===next.payment &&
        JSON.stringify(prev.images||[])===JSON.stringify(next.images||[]) &&
        JSON.stringify(prev.customFields||[])===JSON.stringify(next.customFields||[]) && !!prev.featured===!!next.featured &&
        Number(prev.stock)!==Number(next.stock);
      current[idx]=next;
      persistLiveProducts(current);
      if(stockOnly){
        updateCustomerStockUI(next.id);
        updateCartRow(next.id);
        refreshProductDetailDataOnly();
        updateCartSummary();
      }else{
        syncVisibleStoreAfterDataRefresh();
      }
      return;
    }
    let list=current.filter(p=>payload.eventType!=='DELETE'||Number(p.id)!==Number(next.id));
    if(payload.eventType==='INSERT'){
      // إذا كان هناك منتج تفاؤلي مؤقت (id=null) من نفس عملية الإضافة، استبدله بالصف السلطوي
      // بدل عرض المنتج مرتين عند وصول Realtime.
      list=list.filter(p=>Number.isFinite(Number(p.id)) || !(String(p.name||'').trim()===String(next.name||'').trim() && String(p.category||'').trim()===String(next.category||'').trim()));
    }
    if(payload.eventType==='INSERT'||payload.eventType==='UPDATE'){
      const i=list.findIndex(p=>Number(p.id)===Number(next.id));
      if(i>=0)list[i]=next; else list.unshift(next);
    }
    persistLiveProducts(list);
    syncVisibleStoreAfterDataRefresh();
    return;
  }
  if(payload.table==='products'&&payload.eventType==='DELETE'&&payload.old){
    const id=Number(payload.old.id);
    persistLiveProducts(getProducts().filter(p=>Number(p.id)!==id));
    syncVisibleStoreAfterDataRefresh();
    return;
  }
  if(payload.table==='categories'&&payload.new){
    const next=rowToCategory(payload.new);
    let list=getCategories().filter(c=>payload.eventType!=='DELETE'||String(c.id)!==String(next.id));
    if(payload.eventType==='INSERT'||payload.eventType==='UPDATE'){
      const idx=list.findIndex(c=>String(c.id)===String(next.id));
      if(idx>=0)list[idx]=next; else list.push(next);
    }
    window.FIDDA_CATEGORIES=list;
    try{localStorage.setItem('fiddaCategoriesCache_v3',JSON.stringify(list));}catch(e){}
    syncVisibleStoreAfterDataRefresh();
    return;
  }
  if(payload.table==='categories'&&payload.eventType==='DELETE'&&payload.old){
    const id=String(payload.old.id);
    window.FIDDA_CATEGORIES=getCategories().filter(c=>String(c.id)!==id);
    try{localStorage.setItem('fiddaCategoriesCache_v3',JSON.stringify(window.FIDDA_CATEGORIES));}catch(e){}
    syncVisibleStoreAfterDataRefresh();
    return;
  }
  scheduleStoreRefresh();
});
window.addEventListener('storage',event=>{
  if(event.key!==FIDDA_LIVE_SYNC_KEY||!event.newValue)return;
  try{
    const data=JSON.parse(event.newValue);
    if(data.type==='products'&&Array.isArray(data.products)){
      persistLiveProducts(data.products);
      syncVisibleStoreAfterDataRefresh();
    }
  }catch(e){}
});

function bindStoreCartActions(){
  if(window.__fiddaCartActionsBound)return;
  window.__fiddaCartActionsBound=true;
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-add-product]');
    if(!btn)return;
    event.preventDefault();
    event.stopPropagation();
    const id=btn.getAttribute('data-add-product');
    // كل ضغطة هي عملية مستقلة. لا يوجد قفل يمنع الضغطة التالية.
    addToCart(id,1);
  },true);
}
document.addEventListener('DOMContentLoaded',()=>{setupCheckout();bindStoreCartActions();bootStore()});

function initOrderSuccessModal(){const m=document.getElementById('orderSuccessModal');if(!m)return;m.querySelectorAll('[data-close-success]').forEach(el=>el.addEventListener('click',()=>{m.classList.add('hidden');document.body.style.overflow='';}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.classList.contains('hidden')){m.classList.add('hidden');document.body.style.overflow=''}})}
document.addEventListener('DOMContentLoaded',initOrderSuccessModal);

document.addEventListener('keydown',e=>{const box=document.getElementById('fiddaImageLightbox');if(!box||box.classList.contains('hidden'))return;if(e.key==='Escape')closeImageLightbox();if(e.key==='ArrowLeft')changeLightboxImage(-1);if(e.key==='ArrowRight')changeLightboxImage(1)});
