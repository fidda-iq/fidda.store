/* فِضّة FIDDA — متجر الزبائن */
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
  const stock=Math.max(0,Number.isFinite(Number(p?.stock))?Number(p.stock):0);
  return {...p,stock,images:(Array.isArray(p?.images)&&p.images.length?p.images:[p?.image||'']).filter(Boolean),material:p?.material||'فضة',payment:p?.payment||'الدفع عند الاستلام',customFields:Array.isArray(p?.customFields)?p.customFields.filter(x=>x&&String(x.label||'').trim()&&String(x.value||'').trim()).map(x=>({label:String(x.label).trim(),value:String(x.value).trim()})):[]};
}
function getProducts(){return (window.FIDDA_PRODUCTS||DEFAULT_PRODUCTS).map(normalizeProduct)}
function getCategories(){return window.FIDDA_CATEGORIES||DEFAULT_CATEGORIES}
function saveProducts(x){window.FIDDA_PRODUCTS=(x||[]).map(normalizeProduct);return window.FIDDA_PRODUCTS}
function saveCategories(x){window.FIDDA_CATEGORIES=x||[];return window.FIDDA_CATEGORIES}
function formatPrice(n){return new Intl.NumberFormat('ar-IQ').format(Number(n)||0)+' د.ع'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function getCart(){try{const x=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(x)?x.filter(i=>i&&Number(i.qty)>0):[]}catch{return[]}}
function saveCart(cart){localStorage.setItem(CART_KEY,JSON.stringify(cart));window.dispatchEvent(new CustomEvent('fidda-cart-changed'))}
function broadcastOptimisticOrderStock(items,mode='reserve',token=''){
  const payload={type:'order-stock-optimistic',mode,token:token||('opt-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),items:(items||[]).map(i=>({id:Number(i.id),qty:Math.max(1,Math.floor(Number(i.qty)||1))})),at:Date.now()};
  try{localStorage.setItem('fiddaOrderStockSync_v1',JSON.stringify(payload));}catch(e){}
  try{window.fiddaStockChannel=window.fiddaStockChannel||('BroadcastChannel' in window?new BroadcastChannel('fidda-order-stock-live'):null);window.fiddaStockChannel?.postMessage(payload)}catch(e){}
  window.dispatchEvent(new CustomEvent('fidda-order-stock-optimistic',{detail:payload}));
  return payload.token;
}
function applyLocalOrderStock(items,direction){
  const ids=new Set((items||[]).map(i=>Number(i.id)));
  const list=getProducts().map(p=>{const item=(items||[]).find(i=>Number(i.id)===Number(p.id));if(!item)return p;const qty=Math.max(1,Math.floor(Number(item.qty)||1));return normalizeProduct({...p,stock:Math.max(0,Number(p.stock||0)+(Number(direction)||0)*qty)});});
  window.FIDDA_PRODUCTS=list;
  try{localStorage.setItem('fiddaProductsCache_v3',JSON.stringify(list));localStorage.setItem('fiddaDataCacheTime_v3',String(Date.now()));}catch(e){}
  syncVisibleStoreAfterDataRefresh();
}
function getCartItem(id){return getCart().find(i=>Number(i.id)===Number(id))}
function getCartQty(id){return Math.max(0,Number(getCartItem(id)?.qty)||0)}
// العدد الظاهر للزبون = المخزون الحالي ناقص الكمية الموجودة بالفعل في سلته.
// مثال: المخزون 10 + في السلة 3 => يظهر للزبون: متبقي 7 قطع.
function getCustomerVisibleStock(p){
  const stock=Math.max(0,Math.floor(Number(p?.stock)||0));
  const inCart=getCartQty(p?.id);
  return Math.max(0,stock-inCart);
}
function getRemainingAddableStock(p){
  return getCustomerVisibleStock(p);
}
function syncCartToCurrentStock(){
  const products=getProducts(),cart=getCart();
  let changed=false;
  const next=cart.map(item=>{
    const p=products.find(x=>Number(x.id)===Number(item.id));
    if(!p){changed=true;return null}
    const max=Math.max(0,Math.floor(Number(p.stock)||0));
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
function updateCartCount(){const count=getCart().reduce((a,i)=>a+(Number(i.qty)||0),0);document.querySelectorAll('#cartCount').forEach(e=>e.textContent=count)}
function productImages(p){return normalizeProduct(p).images}

/* تغيير السلة يحدث على العناصر نفسها؛ لا يتم إعادة تحميل الصفحة ولا إعادة رسم السلة. */
function updateCustomerStockUI(id){
  const p=getProducts().find(x=>Number(x.id)===Number(id));if(!p)return;
  const visible=getCustomerVisibleStock(p),available=visible>0;
  document.querySelectorAll(`[data-stock-product="${CSS.escape(String(id))}"]`).forEach(el=>{
    el.className=`stock-badge ${available?'available':'unavailable'}`;
    el.innerHTML=available?`<i class="stock-dot"></i>متوفر <b class="stock-number">${visible}</b> قطعة`:`<i class="stock-dot"></i>غير متوفر`;
  });
  document.querySelectorAll(`[data-add-product="${CSS.escape(String(id))}"]`).forEach(btn=>{btn.disabled=!available;btn.classList.toggle('disabled',!available)});
  const detail=document.getElementById('detailStock');
  if(detail&&Number(detail.dataset.productId)===Number(id)){
    detail.className=`detail-stock ${available?'available':'unavailable'}`;
    detail.textContent=available?`متوفر — ${visible} قطعة`:'غير متوفر حاليًا';
  }
}
function updateAllCustomerStockUI(){getProducts().forEach(p=>updateCustomerStockUI(p.id))}
function addToCart(id,qty=1){
  const p=getProducts().find(x=>Number(x.id)===Number(id));if(!p)return false;
  const available=getRemainingAddableStock(p),requested=Math.max(1,Math.floor(Number(qty)||1));
  if(available<requested){showToast(available?`المتاح لك الآن ${available} قطعة`:'لا توجد قطع إضافية متاحة لك');return false}
  const cart=getCart(),item=cart.find(i=>Number(i.id)===Number(id));
  if(item)item.qty+=requested;else cart.push({id:Number(id),qty:requested});
  saveCart(cart);updateCartCount();updateCartRow(id);updateCustomerStockUI(id);updateDetailQuantity(id);showToast('تمت إضافة القطعة إلى السلة');return true;
}
function removeFromCart(id){saveCart(getCart().filter(i=>Number(i.id)!==Number(id)));updateCartCount();removeCartRow(id);updateCustomerStockUI(id);updateCartSummary();showToast('تمت إزالة القطعة من السلة')}
function setCartQty(id,value){
  const cart=getCart(),item=cart.find(i=>Number(i.id)===Number(id)),p=getProducts().find(x=>Number(x.id)===Number(id));if(!item||!p)return;
  const max=Math.max(0,Math.floor(Number(p.stock)||0));
  let qty=String(value??'').replace(/[^0-9]/g,'');
  if(qty==='')return;
  qty=Math.floor(Number(qty)||0);
  if(qty<=0){removeFromCart(id);return}
  if(qty>max){qty=max;showToast(max?`المتبقي لك ${max} قطعة`:'لا توجد قطع إضافية متاحة لك');}
  if(qty<=0){removeFromCart(id);return}
  item.qty=qty;saveCart(cart);updateCartCount();updateCartRow(id);updateCustomerStockUI(id);updateDetailQuantity(id);updateCartSummary();
}
function changeQty(id,delta){
  const item=getCartItem(id);if(!item)return;setCartQty(id,Number(item.qty)+Number(delta||0));
}
function updateCartRow(id){
  const row=document.querySelector(`.cart-row[data-cart-id="${CSS.escape(String(id))}"]`);if(!row)return;
  const p=getProducts().find(x=>Number(x.id)===Number(id)),item=getCartItem(id);if(!p||!item)return;
  const qty=row.querySelector('.cart-qty'),total=row.querySelector('.cart-row-total'),remaining=row.querySelector('.cart-remaining'),plus=row.querySelector('.cart-plus');
  if(qty){qty.value=item.qty;qty.max=Math.max(0,Math.floor(Number(p.stock)||0));}if(total)total.textContent=formatPrice(p.price*item.qty);if(remaining)remaining.textContent=`المتاح للإضافة: ${getRemainingAddableStock(p)} قطعة`;if(plus)plus.disabled=getRemainingAddableStock(p)<=0;
}
function removeCartRow(id){document.querySelector(`.cart-row[data-cart-id="${CSS.escape(String(id))}"]`)?.remove();if(!getCart().length)renderCart()}
function updateCartSummary(){const t=cartTotals();const s=document.getElementById('cartSubtotal'),d=document.getElementById('cartDelivery'),total=document.getElementById('cartTotal');if(s)s.textContent=formatPrice(t.subtotal);if(d)d.textContent=formatPrice(t.delivery);if(total)total.textContent=formatPrice(t.total)}

function stockMarkup(p,featured=false){const visible=getCustomerVisibleStock(p);return `<span data-stock-product="${p.id}" class="stock-badge ${featured?'featured-stock ':''}${visible>0?'available':'unavailable'}">${visible>0?`متوفر <b class="stock-number">${visible}</b> قطعة`:'غير متوفر'}</span>`}
function bagIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5h11l.8 11H5.7l.8-11Z"></path><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"></path><path d="M9 12.5v2M15 12.5v2"></path></svg>'}
function productCard(p,featured=false){const img=productImages(p)[0]||'',out=getRemainingAddableStock(p)<=0;return `<article class="product-card reveal ${out?'out-of-stock':''}"><a href="product.html?id=${encodeURIComponent(p.id)}" class="product-image"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy"><span class="product-category">${escapeHtml(p.category)}</span>${productImages(p).length>1?`<span class="image-count">◈ ${productImages(p).length}</span>`:''}</a><div class="product-info"><a href="product.html?id=${encodeURIComponent(p.id)}"><h3>${escapeHtml(p.name)}</h3></a>${stockMarkup(p,featured)}<div class="product-bottom"><strong>${formatPrice(p.price)}</strong><button class="add-btn" data-add-product="${p.id}" ${out?'disabled':''} onclick="event.preventDefault();addToCart(${Number(p.id)},1)" aria-label="إضافة ${escapeHtml(p.name)} إلى السلة" title="إضافة إلى السلة">${bagIcon()}</button></div></div></article>`}
function renderProducts(list,id){const el=document.getElementById(id);if(!el)return;const featured=id==='featuredProducts';el.classList.toggle('featured-grid',featured);el.innerHTML=(list||[]).length?(list||[]).map(p=>productCard(p,featured)).join(''):'<div class="fidda-coming-soon">قريباً...</div>';initReveal();updateAllCustomerStockUI()}
function renderRelatedProducts(currentId){const el=document.getElementById('relatedProducts');const section=document.getElementById('relatedProductsSection');if(!el)return;const current=getProducts().find(p=>Number(p.id)===Number(currentId));if(!current){if(section)section.classList.add('hidden');return}const all=getProducts().filter(p=>Number(p.id)!==Number(currentId));const sameCategory=all.filter(p=>p.category===current.category);const others=all.filter(p=>p.category!==current.category);const list=[...sameCategory,...others].slice(0,4);if(!list.length){el.innerHTML='';if(section)section.classList.add('hidden');return}if(section)section.classList.remove('hidden');el.innerHTML=list.map(productCard).join('');initReveal();updateAllCustomerStockUI()}
function renderHomeCategories(){const el=document.getElementById('homeCategories');if(!el)return;el.innerHTML=getCategories().map((c,i)=>`<a class="category-card reveal" style="background-image:url('${escapeHtml(c.image)}')" href="products.html?category=${encodeURIComponent(c.name)}"><span>0${i+1}</span><h3>${escapeHtml(c.name)}</h3><small>اكتشف المجموعة</small></a>`).join('');initReveal()}

function renderProductDetail(){
  const el=document.getElementById('productDetail');if(!el)return;
  const id=Number(new URLSearchParams(location.search).get('id')),p=getProducts().find(x=>Number(x.id)===id);
  const relatedSection=document.getElementById('relatedProductsSection');
  if(!p){el.innerHTML='<div class="empty-state"><h2>المنتج غير موجود</h2><a class="btn btn-dark" href="products.html">العودة للمتجر</a></div>';if(relatedSection)relatedSection.classList.add('hidden');return}
  if(relatedSection)relatedSection.classList.remove('hidden');
  const imgs=productImages(p),visible=getCustomerVisibleStock(p),out=getRemainingAddableStock(p)<=0;
  el.innerHTML=`<div class="detail-gallery reveal"><div class="gallery-main"><img id="detailMainImage" src="${escapeHtml(imgs[0]||'')}" alt="${escapeHtml(p.name)}"><button class="gallery-arrow prev" type="button" onclick="changeDetailImage(1)" aria-label="الصورة التالية">›</button><button class="gallery-arrow next" type="button" onclick="changeDetailImage(-1)" aria-label="الصورة السابقة">‹</button><span class="gallery-position" id="galleryPosition">1 / ${imgs.length||1}</span></div><div class="gallery-thumbs">${imgs.map((im,i)=>`<button class="gallery-thumb ${i===0?'active':''}" type="button" data-index="${i}" onclick="setDetailImage(${i})"><img src="${escapeHtml(im)}" alt=""></button>`).join('')}</div></div><div class="detail-content reveal"><p class="eyebrow">${escapeHtml(p.category)}</p><h1>${escapeHtml(p.name)}</h1><div class="detail-price">${formatPrice(p.price)}</div><div id="detailStock" data-product-id="${p.id}" class="detail-stock ${out?'unavailable':'available'}">${out?'غير متوفر حاليًا':`متوفر — ${visible} قطعة`}</div><p class="detail-desc">${escapeHtml(p.desc||'')}</p><div class="quantity-row" aria-label="اختيار الكمية"><button type="button" onclick="changeDetailQty(-1)" aria-label="تقليل الكمية">−</button><input id="detailQty" class="quantity-input" type="text" inputmode="numeric" pattern="[0-9]*" value="1" autocomplete="off" aria-label="الكمية" oninput="this.value=this.value.replace(/[^0-9]/g,'');setDetailQty(this.value)" onblur="if(!this.value)this.value=1;setDetailQty(this.value)"><button type="button" onclick="changeDetailQty(1)" aria-label="زيادة الكمية">+</button></div><div class="detail-total"><span>إجمالي القطعة</span><strong id="detailTotal">${formatPrice(p.price)}</strong><small>بدون أجور التوصيل</small></div><button id="detailAddButton" class="btn btn-dark full" type="button" ${out?'disabled':''} onclick="addDetailToCart(${p.id})">${out?'غير متوفر':'أضف إلى السلة'}</button><div class="details-list"><div><b>الخامة</b><span>${escapeHtml(p.material)}</span></div><div><b>الدفع</b><span>${escapeHtml(p.payment)}</span></div>${p.customFields.map(f=>`<div><b>${escapeHtml(f.label)}</b><span>${escapeHtml(f.value)}</span></div>`).join('')}</div></div>`;
  window.__detailImages=imgs;window.__detailIndex=0;window.__detailProductId=id;initReveal();updateDetailQuantity(id);renderRelatedProducts(id);
}
function setDetailImage(index){const imgs=window.__detailImages||[];if(!imgs.length)return;index=(index+imgs.length)%imgs.length;window.__detailIndex=index;const img=document.getElementById('detailMainImage');if(img){img.classList.add('fade-image');setTimeout(()=>{img.src=imgs[index];img.classList.remove('fade-image')},100)}document.querySelectorAll('.gallery-thumb').forEach(x=>x.classList.toggle('active',Number(x.dataset.index)===index));const pos=document.getElementById('galleryPosition');if(pos)pos.textContent=`${index+1} / ${imgs.length}`}
function changeDetailImage(delta){setDetailImage((window.__detailIndex||0)+delta)}
function updateDetailTotal(){const id=window.__detailProductId,p=getProducts().find(x=>Number(x.id)===Number(id)),qty=Math.max(1,Number(document.getElementById('detailQty')?.value)||1),total=document.getElementById('detailTotal');if(p&&total)total.textContent=formatPrice(Number(p.price)*qty)}
function setDetailQty(value){const e=document.getElementById('detailQty'),id=window.__detailProductId,p=getProducts().find(x=>Number(x.id)===Number(id));if(!e||!p)return;const max=getRemainingAddableStock(p);let qty=String(value??'').replace(/[^0-9]/g,'');if(qty==='')return;qty=Math.floor(Number(qty)||0);if(qty<=0)qty=1;if(qty>max){qty=max;showToast(max?`المتبقي لك ${max} قطعة`:'لا توجد قطع إضافية متاحة لك');}if(max>0)e.value=qty;updateDetailTotal()}
function changeDetailQty(delta){const e=document.getElementById('detailQty');if(!e)return;setDetailQty(Number(e.value||1)+Number(delta||0))}
function updateDetailQuantity(id){if(Number(id)!==Number(window.__detailProductId))return;const p=getProducts().find(x=>Number(x.id)===Number(id)),e=document.getElementById('detailQty'),btn=document.getElementById('detailAddButton');if(!p)return;const max=getRemainingAddableStock(p);if(e){e.max=max;if(max>0)e.value=Math.min(max,Math.max(1,Number(e.value||1)));else e.value=1;}if(btn){btn.disabled=max<=0;btn.textContent=max>0?'أضف إلى السلة':'غير متوفر'}updateDetailTotal()}
function addDetailToCart(id){const qty=Number(document.getElementById('detailQty')?.value||1);if(addToCart(id,qty)){showToast('تمت إضافة القطعة إلى السلة — يمكنك متابعة التسوق');}}

function cartTotals(){const products=getProducts();let subtotal=0;getCart().forEach(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));if(p)subtotal+=p.price*(Number(i.qty)||0)});const delivery=getCart().length?DELIVERY_FEE:0;return{subtotal,delivery,total:subtotal+delivery}}
function trashIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 7.5h13M9 7.5V5.5h6v2M8 10.5v7M12 10.5v7M16 10.5v7M7 7.5l1 12h8l1-12"/></svg>'}
function renderCart(){
  const el=document.getElementById('cartPage');if(!el)return;const cart=getCart(),products=getProducts();
  if(!cart.length){el.innerHTML='<div class="empty-state cart-empty"><div class="empty-cart-icon">♡</div><h2>السلة فارغة</h2><p>أضف القطع التي أعجبتك لتظهر هنا.</p><a class="btn btn-dark" href="products.html">ابدأ التسوق</a></div>';return}
  const rows=cart.map(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));if(!p)return'';const remaining=getRemainingAddableStock(p);return `<div class="cart-row reveal" data-cart-id="${p.id}"><a class="cart-product-link" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="فتح ${escapeHtml(p.name)}"><img src="${escapeHtml(productImages(p)[0]||'')}" alt="${escapeHtml(p.name)}"></a><div class="cart-item-info"><a href="product.html?id=${encodeURIComponent(p.id)}"><h3>${escapeHtml(p.name)}</h3></a><span class="cart-item-price">${formatPrice(p.price)}</span><small class="cart-remaining">المتاح لك الآن: ${remaining} قطعة</small></div><div class="qty-control" aria-label="تعديل الكمية"><button class="cart-minus" type="button" onclick="changeQty(${p.id},-1)" aria-label="تقليل الكمية">−</button><input class="cart-qty" type="text" inputmode="numeric" pattern="[0-9]*" value="${i.qty}" min="1" max="${Math.max(0,Math.floor(Number(p.stock)||0))}" autocomplete="off" aria-label="الكمية" oninput="this.value=this.value.replace(/[^0-9]/g,'');setCartQty(${p.id},this.value)" onblur="if(!this.value)this.value=${i.qty};setCartQty(${p.id},this.value)"><button class="cart-plus" type="button" onclick="changeQty(${p.id},1)" ${remaining<=0?'disabled':''} aria-label="زيادة الكمية">+</button></div><strong class="cart-row-total">${formatPrice(p.price*i.qty)}</strong><button class="remove-btn" type="button" onclick="removeFromCart(${p.id})" aria-label="إزالة ${escapeHtml(p.name)}" title="إزالة المنتج">${trashIcon()}</button></div>`}).join('');
  const t=cartTotals();el.innerHTML=`<div class="cart-layout"><div class="cart-items">${rows}</div><aside class="cart-summary reveal"><p class="eyebrow">YOUR SELECTION</p><h2>ملخص الطلب</h2><div class="summary-line"><span>مجموع المنتجات</span><b id="cartSubtotal">${formatPrice(t.subtotal)}</b></div><div class="summary-line"><span>التوصيل</span><b id="cartDelivery">${formatPrice(t.delivery)}</b></div><div class="summary-total"><span>الإجمالي النهائي</span><b id="cartTotal">${formatPrice(t.total)}</b></div><div class="summary-line"><span>طريقة الدفع</span><span>الدفع عند الاستلام</span></div><a class="btn btn-dark full" href="checkout.html">متابعة الطلب</a></aside></div>`;initReveal();updateAllCustomerStockUI()
}

function renderCheckout(){
  const el=document.getElementById('orderSummary');if(!el)return;const cart=getCart(),products=getProducts();
  if(!cart.length){if(!document.getElementById('orderSuccess')?.classList.contains('hidden'))return;location.replace('cart.html');return}
  const t=cartTotals();el.innerHTML=`<p class="eyebrow">YOUR ORDER</p><h2>ملخص الطلب</h2>${cart.map(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));return p?`<a class="summary-product" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${escapeHtml(productImages(p)[0]||'')}" alt=""><div><b>${escapeHtml(p.name)}</b><small>الكمية: ${i.qty}</small></div><strong>${formatPrice(p.price*i.qty)}</strong></a>`:''}).join('')}<div class="summary-line"><span>مجموع المنتجات</span><b>${formatPrice(t.subtotal)}</b></div><div class="summary-line"><span>التوصيل</span><b>${formatPrice(t.delivery)}</b></div><div class="summary-total"><span>الإجمالي النهائي</span><b>${formatPrice(t.total)}</b></div>`
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
    await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':FIDDA_SUPABASE_KEY,'Authorization':`Bearer ${FIDDA_SUPABASE_KEY}`},body:JSON.stringify({order_id:String(orderId)})});
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
    for(const item of cart){const p=products.find(x=>Number(x.id)===Number(item.id));if(!p||p.stock<Number(item.qty)){showToast(p?`لم تعد الكمية المطلوبة من ${p.name} متوفرة`:'إحدى القطع لم تعد متوفرة','error');await refreshStoreData();renderCheckout();return}}
    const customer=Object.fromEntries(new FormData(f).entries());customer.phone=normalizeIraqiPhone(customer.phone);customer.customer_id=getFiddaCustomerId();delete customer.instagram;const t=cartTotals();
    const items=cart.map(i=>{const p=products.find(x=>Number(x.id)===Number(i.id));return{id:Number(p.id),qty:Number(i.qty),name:p.name,price:Number(p.price),image:productImages(p)[0]||'',category:p.category,material:p.material||'فضة'}});
    const button=f.querySelector('button[type="submit"]');if(button){button.disabled=true;button.dataset.original=button.textContent;button.textContent='جارٍ تأكيد الطلب...'}
    // لا نحجز أو ننقص المخزون عند مجرد فتح/إضافة القطعة إلى السلة.
    // إنقاص المخزون يتم فقط داخل create_order عند تثبيت الطلب بنجاح.
    try{
      const result=await dbCreateOrder(customer,items,t.subtotal,t.delivery,t.total);
      // الإشعار منفصل عن تثبيت الطلب؛ فشل الإشعار لا يجعل الطلب يبدو فاشلًا.
      notifyFiddaNewOrder(result.id).catch(()=>{});
      localStorage.removeItem(CART_KEY);updateCartCount();f.classList.add('hidden');const success=document.getElementById('orderSuccess');success.classList.remove('hidden');success.innerHTML=`<div class="success-icon">✓</div><p class="eyebrow">ORDER CONFIRMED</p><h2>تم استلام طلبك بنجاح</h2><p>رقم الطلب: <b>${escapeHtml(result.id)}</b></p><p>الإجمالي: <b>${formatPrice(t.total)}</b> شامل التوصيل.</p><p>سنتواصل معك لتأكيد الطلب وتجهيزه.</p>`;const modal=document.getElementById('orderSuccessModal');const details=document.getElementById('successDetails');if(modal&&details){details.className='success-details';details.innerHTML=`<div class="detail-row"><span>رقم الطلب</span><b>${escapeHtml(result.id)}</b></div><div class="detail-row"><span>الإجمالي</span><b>${formatPrice(t.total)} شامل التوصيل</b></div>`;modal.classList.remove('hidden');document.body.style.overflow='hidden';}refreshStoreData().catch(e=>console.error('Background store refresh:',e));
    }catch(err){
      console.error(err);
      // لم يتم تثبيت الطلب، لذلك لا نلمس المخزون المحلي إطلاقًا.
      showToast(String(err?.message||'').includes('غير متوفرة')?'الكمية لم تعد متوفرة حدّث السلة وحاول مرة أخرى':'تعذر إرسال الطلب. حاول مرة أخرى','error');
      if(button){button.disabled=false;button.textContent=button.dataset.original||'تأكيد الطلب'}
    }
  })
}

function initReveal(){const els=document.querySelectorAll('.reveal:not([data-reveal-bound])');if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('revealed'));return}const observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('revealed');observer.unobserve(x.target)}}),{threshold:.08});els.forEach(e=>{e.dataset.revealBound='1';observer.observe(e)})}

let storeRefreshTimer=null,storeRefreshBusy=false;
async function refreshStoreData({quiet=true}={}){
  if(!window.fiddaSupabase||storeRefreshBusy)return false;storeRefreshBusy=true;
  try{
    const [pr,cr]=await Promise.all([fiddaSupabase.from('products').select('*').order('created_at',{ascending:false}),fiddaSupabase.from('categories').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})]);
    if(pr.error)throw pr.error;if(cr.error)throw cr.error;
    const nextProducts=(pr.data||[]).map(rowToProduct),nextCategories=(cr.data||[]).map(rowToCategory);
    const oldP=JSON.stringify(window.FIDDA_PRODUCTS||[]),oldC=JSON.stringify(window.FIDDA_CATEGORIES||[]);
    window.FIDDA_PRODUCTS=nextProducts;window.FIDDA_CATEGORIES=nextCategories;window.FIDDA_DB_READY=true;
    try{localStorage.setItem('fiddaProductsCache_v3',JSON.stringify(nextProducts));localStorage.setItem('fiddaCategoriesCache_v3',JSON.stringify(nextCategories));localStorage.setItem('fiddaDataCacheTime_v3',String(Date.now()))}catch(e){}
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
function refreshProductDetailDataOnly(){const id=Number(new URLSearchParams(location.search).get('id')),p=getProducts().find(x=>Number(x.id)===id);if(!p)return;const stock=document.getElementById('detailStock'),btn=document.getElementById('detailAddButton');const visible=getCustomerVisibleStock(p),remaining=getRemainingAddableStock(p);if(stock){stock.className=`detail-stock ${visible?'available':'unavailable'}`;stock.textContent=visible?`متوفر — ${visible} قطعة`:'غير متوفر حاليًا'}if(btn){btn.disabled=remaining<=0;btn.textContent=remaining>0?'أضف إلى السلة':'الحد الأقصى في السلة'}updateDetailQuantity(id);updateDetailTotal()}
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
  if(location.pathname.toLowerCase().endsWith('/admin.html')) return;
  // لا ننتظر الشبكة إطلاقًا: الواجهة والسلة تظهر من الذاكرة/الكاش فورًا.
  const CART_RESET_VERSION='fidda-cart-reset-v3';
  if(localStorage.getItem(CART_RESET_VERSION)!=='1'){
    localStorage.removeItem(CART_KEY);
    localStorage.setItem(CART_RESET_VERSION,'1');
  }
  renderStoreImmediately();
  // التحديث من Supabase يحدث في الخلفية.
  if(window.fiddaDbInit)fiddaDbInit().catch(e=>console.error(e));
  if(!storeRefreshTimer){
    storeRefreshTimer=setInterval(()=>{if(document.visibilityState==='visible')scheduleStoreRefresh()},60000);
  }
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
window.addEventListener('fidda-db-ready',syncVisibleStoreAfterDataRefresh);
const FIDDA_LIVE_SYNC_KEY='fiddaLiveSync_v2';
function persistLiveProducts(list){
  window.FIDDA_PRODUCTS=(list||[]).map(normalizeProduct);
  try{
    localStorage.setItem('fiddaProductsCache_v3',JSON.stringify(window.FIDDA_PRODUCTS));
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
window.addEventListener('fidda-live-broadcast',event=>{
  const payload=event.detail||{};
  if(payload.type==='products'||payload.type==='categories'){
    window.dispatchEvent(new CustomEvent('fidda-data-changed',{detail:{table:payload.type,eventType:payload.eventType,new:payload.new,old:payload.old,source:'broadcast'}}));
  }else if(payload.type==='orders'){
    window.dispatchEvent(new CustomEvent('fidda-orders-changed',{detail:{eventType:payload.eventType,new:payload.new,old:payload.old,source:'broadcast'}}));
  }
});
window.addEventListener('fidda-data-changed',event=>{
  const payload=event.detail||{};
  if(payload.table==='products'&&payload.new){
    const next=rowToProduct(payload.new);
    const current=getProducts();
    const idx=current.findIndex(p=>Number(p.id)===Number(next.id));
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
let __lastStoreRefresh=0;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-__lastStoreRefresh>45000){__lastStoreRefresh=Date.now();scheduleStoreRefresh()}});
document.addEventListener('DOMContentLoaded',()=>{setupCheckout();bootStore()});

function initOrderSuccessModal(){const m=document.getElementById('orderSuccessModal');if(!m)return;m.querySelectorAll('[data-close-success]').forEach(el=>el.addEventListener('click',()=>{m.classList.add('hidden');document.body.style.overflow='';}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.classList.contains('hidden')){m.classList.add('hidden');document.body.style.overflow=''}})}
document.addEventListener('DOMContentLoaded',initOrderSuccessModal);
