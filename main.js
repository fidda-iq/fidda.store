/* FIDDA V69 - visual background experiment only */
// الوظائف الأساسية للمتجر موجودة في products.js


/* FIDDA Mobile Navigation */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const menuBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  const closeBtn = document.getElementById('mobileDrawerClose');
  const mobileCount = document.getElementById('mobileCartCount');
  const drawerCount = document.querySelector('.drawer-cart-count');

  const syncMobileCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('fiddaCart') || '[]');
      const count = Array.isArray(cart) ? cart.reduce((sum, item) => sum + Number(item.qty || 0), 0) : 0;
      if (mobileCount) mobileCount.textContent = count;
      if (drawerCount) drawerCount.textContent = count;
    } catch (_) {
      if (mobileCount) mobileCount.textContent = '0';
      if (drawerCount) drawerCount.textContent = '0';
    }
  };

  const openDrawer = () => {
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'true');
      menuBtn.setAttribute('aria-label', 'إغلاق القائمة');
    }
    document.body.classList.add('drawer-open');
  };

  const closeDrawer = () => {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-label', 'فتح القائمة');
    }
    document.body.classList.remove('drawer-open');
  };

  menuBtn?.addEventListener('click', () => {
    drawer?.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  backdrop?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  drawer?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 45);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, {passive:true});
  syncMobileCart();
  window.addEventListener('storage', syncMobileCart);
  window.addEventListener('fidda-cart-changed', syncMobileCart);
});
