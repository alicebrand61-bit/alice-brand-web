// Main Application Module for Alice Brand
const App = {
  currentView: 'home',
  products: [],
  categories: [],
  activeCategorySlug: null,
  searchQuery: '',
  sortOrder: 'newest',
  selectedModalProduct: null,
  selectedModalSize: 'M',
  selectedModalColor: null,
  settings: {},

  async init() {
    await this.fetchSettings();
    Auth.init();
    Cart.init();
    await Checkout.init();
    await this.fetchCategories();
    await this.fetchProducts();
    this.setupEventListeners();
    this.handleRouteFromUrl();

    if (window.lucide) {
      lucide.createIcons();
    }
  },

  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        this.settings = await res.json();
        this.applySettingsToDOM();
      }
    } catch (e) {
      console.error("Error fetching settings", e);
    }
  },

  applySettingsToDOM() {
    const logoImgs = document.querySelectorAll('.brand-logo-img');
    logoImgs.forEach(img => {
      if (this.settings.logo_url) img.src = this.settings.logo_url;
    });

    const waLinks = document.querySelectorAll('.dynamic-whatsapp-link');
    waLinks.forEach(a => {
      if (this.settings.whatsapp_number) {
        const cleanPhone = this.settings.whatsapp_number.replace('+', '').replace(/\s/g, '');
        a.href = `https://wa.me/${cleanPhone}`;
      }
    });

    const igLinks = document.querySelectorAll('.dynamic-instagram-link');
    igLinks.forEach(a => {
      if (this.settings.instagram_url) a.href = this.settings.instagram_url;
    });

    this.applyTypography();
    this.applyCmsTexts();
  },

  // Fuentes clasicas de Microsoft Word / del sistema. Ya estan instaladas en el
  // equipo del visitante, por lo que NO se piden a Google Fonts.
  SYSTEM_FONTS: {
    'Arial': "Arial, Helvetica, sans-serif",
    'Arial Black': "'Arial Black', Gadget, sans-serif",
    'Calibri': "Calibri, Candara, Segoe, 'Segoe UI', Optima, sans-serif",
    'Cambria': "Cambria, Georgia, serif",
    'Candara': "Candara, Calibri, Segoe, sans-serif",
    'Comic Sans MS': "'Comic Sans MS', 'Comic Sans', cursive",
    'Consolas': "Consolas, 'Courier New', monospace",
    'Constantia': "Constantia, Georgia, serif",
    'Corbel': "Corbel, 'Lucida Grande', sans-serif",
    'Courier New': "'Courier New', Courier, monospace",
    'Franklin Gothic Medium': "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif",
    'Garamond': "Garamond, Baskerville, 'Times New Roman', serif",
    'Georgia': "Georgia, 'Times New Roman', serif",
    'Impact': "Impact, Charcoal, sans-serif",
    'Lucida Sans': "'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
    'Palatino Linotype': "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    'Segoe UI': "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    'Tahoma': "Tahoma, Geneva, Verdana, sans-serif",
    'Times New Roman': "'Times New Roman', Times, serif",
    'Trebuchet MS': "'Trebuchet MS', 'Lucida Grande', sans-serif",
    'Verdana': "Verdana, Geneva, Tahoma, sans-serif"
  },

  // Devuelve la pila CSS de una fuente: si es una fuente de Word/sistema usa su
  // stack nativo, si no la trata como fuente de Google.
  buildFontStack(name, fallback) {
    if (this.SYSTEM_FONTS[name]) return this.SYSTEM_FONTS[name];
    return `'${name}', ${fallback}`;
  },

  // Carga desde Google Fonts la tipografia elegida en el panel de administracion
  // (omitiendo las de Word/sistema) y la aplica a toda la tienda con variables CSS.
  applyTypography() {
    const heading = (this.settings.font_heading || 'Cormorant Garamond').trim();
    const body = (this.settings.font_body || 'Plus Jakarta Sans').trim();

    const root = document.documentElement;
    root.style.setProperty('--font-heading', this.buildFontStack(heading, "Georgia, serif"));
    root.style.setProperty('--font-body', this.buildFontStack(body, "'Plus Jakarta Sans', sans-serif"));

    // Solo se piden a Google las fuentes que no estan instaladas en el sistema.
    const families = [...new Set([heading, body])]
      .filter(f => f && !this.SYSTEM_FONTS[f])
      .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400`);

    const link = document.getElementById('dynamic-google-fonts');
    if (link) {
      if (families.length) {
        link.href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
      } else {
        // Solo fuentes del sistema: se quita el atributo para no pedir nada.
        link.removeAttribute('href');
      }
    }
  },

  // Sustituye los textos marcados con data-cms por los valores guardados
  // en el panel de administracion (seccion "Textos de la Pagina").
  applyCmsTexts() {
    document.querySelectorAll('[data-cms]').forEach(el => {
      const key = el.getAttribute('data-cms');
      const value = this.settings[key];
      if (typeof value === 'string' && value.trim() !== '') {
        el.innerHTML = this.sanitizeCmsHtml(value);
      }
    });

    const aboutImg = document.getElementById('about-image');
    if (aboutImg && this.settings.about_image_url) {
      aboutImg.src = this.settings.about_image_url;
    }
  },

  // Permite formato basico (negrita, cursiva, saltos de linea) pero elimina
  // scripts, iframes y manejadores de eventos por seguridad.
  sanitizeCmsHtml(html) {
    const allowed = ['STRONG', 'B', 'EM', 'I', 'U', 'BR', 'SPAN', 'SMALL'];
    const tpl = document.createElement('template');
    tpl.innerHTML = html;

    const walk = (node) => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowed.includes(child.tagName)) {
            child.replaceWith(...child.childNodes);
            return;
          }
          [...child.attributes].forEach(attr => {
            if (attr.name !== 'class') child.removeAttribute(attr.name);
          });
          walk(child);
        }
      });
    };
    walk(tpl.content);
    return tpl.innerHTML;
  },

  handleRouteFromUrl() {
    const path = window.location.pathname;
    if (path.includes('/admin')) {
      this.navigate('admin');
    } else if (path.includes('/catalogo')) {
      this.navigate('catalog');
    }
  },

  navigate(viewName, filterCategory = null) {
    this.currentView = viewName;
    const views = ['home', 'catalog', 'about', 'contact', 'admin'];

    // Hide all view containers
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.toggle('hidden', v !== viewName);
    });

    // Control visibility of customer header and footer when in admin
    const customerHeader = document.getElementById('customer-header-container');
    const customerFooter = document.getElementById('customer-footer-container');
    const whatsappFloat = document.getElementById('whatsapp-floating-widget');

    if (viewName === 'admin') {
      if (customerHeader) customerHeader.classList.add('hidden');
      if (customerFooter) customerFooter.classList.add('hidden');
      if (whatsappFloat) whatsappFloat.classList.add('hidden');
      Admin.init();
    } else {
      if (customerHeader) customerHeader.classList.remove('hidden');
      if (customerFooter) customerFooter.classList.remove('hidden');
      if (whatsappFloat) whatsappFloat.classList.remove('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'catalog') {
      if (filterCategory) {
        this.filterByCategory(filterCategory);
      } else {
        this.renderProducts();
      }
    }

    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');

    if (window.lucide) lucide.createIcons();
  },

  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        this.categories = await res.json();
        this.renderCategoryPills();
      }
    } catch (e) {
      console.error("Error fetching categories", e);
    }
  },

  async fetchProducts() {
    try {
      let url = `/api/products?sort=${this.sortOrder}`;
      if (this.activeCategorySlug) url += `&category=${encodeURIComponent(this.activeCategorySlug)}`;
      if (this.searchQuery) url += `&search=${encodeURIComponent(this.searchQuery)}`;

      const res = await fetch(url);
      if (res.ok) {
        this.products = await res.json();
        this.renderProducts();
        this.renderFeaturedProducts();
      }
    } catch (e) {
      console.error("Error fetching products", e);
    }
  },

  renderCategoryPills() {
    const container = document.getElementById('category-filter-pills');
    if (!container) return;

    container.innerHTML = `
      <button onclick="App.filterByCategory(null)" 
        class="category-pill px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${!this.activeCategorySlug ? 'bg-vinotinto text-white shadow-md' : 'bg-white text-coffee/80 hover:bg-[#F5EFC6] border border-[#e2d8c3]'}">
        Todos
      </button>
    ` + this.categories.map(c => `
      <button onclick="App.filterByCategory('${c.slug}')" 
        class="category-pill px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${this.activeCategorySlug === c.slug ? 'bg-vinotinto text-white shadow-md' : 'bg-white text-coffee/80 hover:bg-[#F5EFC6] border border-[#e2d8c3]'}">
        ${c.name}
      </button>
    `).join('');
  },

  filterByCategory(slug) {
    this.activeCategorySlug = slug;
    this.renderCategoryPills();
    this.fetchProducts();
    if (this.currentView !== 'catalog') {
      this.navigate('catalog');
    }
  },

  handleSearch(query) {
    this.searchQuery = query.trim();
    this.fetchProducts();
  },

  handleSort(sort) {
    this.sortOrder = sort;
    this.fetchProducts();
  },

  renderProducts() {
    const grid = document.getElementById('catalog-products-grid');
    const countEl = document.getElementById('catalog-results-count');
    if (!grid) return;

    if (countEl) countEl.textContent = `${this.products.length} productos`;

    if (this.products.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <i data-lucide="package-search" class="w-16 h-16 mx-auto text-coffee/40 mb-4"></i>
          <h3 class="font-serif text-2xl font-semibold text-dark">No encontramos productos</h3>
          <p class="text-coffee/70 text-sm mt-1">Intenta con otra palabra clave o selecciona otra categoría.</p>
          <button onclick="App.filterByCategory(null)" class="mt-4 btn-sand px-6 py-2.5 rounded-full text-xs uppercase font-bold">Ver todos los productos</button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    grid.innerHTML = this.products.map(p => this.createProductCardHtml(p)).join('');
    if (window.lucide) lucide.createIcons();
  },

  renderFeaturedProducts() {
    const grid = document.getElementById('featured-products-grid');
    if (!grid) return;

    const featured = this.products.filter(p => p.featured).slice(0, 4);
    grid.innerHTML = (featured.length ? featured : this.products.slice(0, 4)).map(p => this.createProductCardHtml(p)).join('');
    if (window.lucide) lucide.createIcons();
  },

  createProductCardHtml(product) {
    const mainImg = product.images && product.images.length ? product.images[0] : 'https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=600';
    const secondImg = product.images && product.images.length > 1 ? product.images[1] : mainImg;

    return `
      <div class="product-card group relative bg-white rounded-2xl overflow-hidden border border-[#eae3d2] shadow-sm flex flex-col justify-between">
        <!-- Image Container -->
        <div class="product-image-container relative aspect-[3/4] bg-[#FAF8F5] cursor-pointer" onclick="App.openProductModal(${product.id})">
          <img src="${mainImg}" alt="${product.name}" class="w-full h-full object-cover group-hover:hidden transition-opacity duration-300" />
          <img src="${secondImg}" alt="${product.name}" class="w-full h-full object-cover hidden group-hover:block transition-all duration-500 scale-105" />
          
          <!-- Badges -->
          <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            ${product.is_new ? '<span class="bg-[#4D0E12] text-white text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full shadow-sm">NUEVO</span>' : ''}
            ${product.featured ? '<span class="bg-[#A5BCD6] text-dark text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full shadow-sm">DESTACADO</span>' : ''}
          </div>

          <!-- Quick Action Hover Overlay -->
          <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
            <button onclick="event.stopPropagation(); App.openProductModal(${product.id})" class="bg-white/95 text-dark hover:bg-white text-xs font-semibold py-2 px-4 rounded-full shadow-md flex items-center gap-1.5 transition-transform hover:scale-105">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Vista Rápida
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="text-[11px] font-semibold tracking-wider uppercase text-[#4D0E12] mb-1">${product.category_name || 'Boutique'}</div>
            <h3 class="font-serif text-lg font-bold text-dark group-hover:text-vinotinto transition-colors line-clamp-1 cursor-pointer" onclick="App.openProductModal(${product.id})">
              ${product.name}
            </h3>
            
            <!-- Sizes & Colors preview -->
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              <div class="flex gap-1">
                ${product.sizes.map(s => `<span class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-700">${s}</span>`).join('')}
              </div>
              <div class="flex items-center gap-1">
                ${product.colors.map(c => `<span class="w-2.5 h-2.5 rounded-full border border-gray-300" style="background-color: ${c.hex}" title="${c.name}"></span>`).join('')}
              </div>
            </div>
          </div>

          <!-- Price & Add Button -->
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span class="font-serif text-lg font-bold text-coffee">
              ${Cart.formatCOP(product.price_cop)}
            </span>
            <button onclick="App.quickAddToCart(${product.id})" class="btn-primary p-2.5 rounded-full text-white shadow-sm flex items-center justify-center hover:scale-110 transition-transform" title="Añadir a la Bolsa">
              <i data-lucide="shopping-bag" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  quickAddToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (product) {
      const defaultSize = product.sizes[0] || 'M';
      const defaultColor = product.colors[0] || { name: 'Vinotinto', hex: '#4D0E12' };
      Cart.addItem(product, defaultSize, defaultColor, 1);
    }
  },

  openProductModal(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    this.selectedModalProduct = p;
    this.selectedModalSize = p.sizes[0] || 'M';
    this.selectedModalColor = p.colors[0] || null;

    const modal = document.getElementById('product-detail-modal');
    if (!modal) return;

    document.getElementById('modal-prod-title').textContent = p.name;
    document.getElementById('modal-prod-category').textContent = p.category_name || 'Boutique Alice Brand';
    document.getElementById('modal-prod-price').textContent = Cart.formatCOP(p.price_cop);
    document.getElementById('modal-prod-desc').textContent = p.description;
    document.getElementById('modal-prod-stock').textContent = `${p.stock} disponibles en bodega`;

    const mainImg = document.getElementById('modal-prod-main-img');
    const thumbContainer = document.getElementById('modal-prod-thumbnails');
    
    if (mainImg) mainImg.src = p.images[0] || 'https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=800';
    if (thumbContainer) {
      thumbContainer.innerHTML = p.images.map((img, i) => `
        <img src="${img}" onclick="document.getElementById('modal-prod-main-img').src = '${img}'" 
          class="w-14 h-16 object-cover rounded-lg border-2 border-transparent hover:border-vinotinto cursor-pointer transition-all shadow-sm" />
      `).join('');
    }

    const sizeContainer = document.getElementById('modal-prod-sizes');
    if (sizeContainer) {
      sizeContainer.innerHTML = p.sizes.map((s, idx) => `
        <button type="button" onclick="App.selectModalSize('${s}', this)" 
          class="modal-size-btn px-4 py-2 rounded-lg border text-xs font-bold uppercase transition-all ${idx === 0 ? 'border-vinotinto bg-vinotinto text-white' : 'border-gray-300 text-gray-700 hover:border-vinotinto'}">
          ${s}
        </button>
      `).join('');
    }

    const colorContainer = document.getElementById('modal-prod-colors');
    if (colorContainer) {
      colorContainer.innerHTML = p.colors.map((c, idx) => `
        <button type="button" onclick="App.selectModalColor('${c.name}', '${c.hex}', this)" 
          class="modal-color-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${idx === 0 ? 'border-vinotinto bg-[#A5BCD6]/30 text-dark ring-2 ring-vinotinto' : 'border-gray-200 text-gray-600 hover:border-gray-400'}">
          <span class="w-3 h-3 rounded-full border border-black/20" style="background-color: ${c.hex}"></span>
          ${c.name}
        </button>
      `).join('');
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  },

  selectModalSize(size, btn) {
    this.selectedModalSize = size;
    document.querySelectorAll('.modal-size-btn').forEach(b => {
      b.classList.remove('border-vinotinto', 'bg-vinotinto', 'text-white');
      b.classList.add('border-gray-300', 'text-gray-700');
    });
    btn.classList.add('border-vinotinto', 'bg-vinotinto', 'text-white');
    btn.classList.remove('border-gray-300', 'text-gray-700');
  },

  selectModalColor(name, hex, btn) {
    this.selectedModalColor = { name, hex };
    document.querySelectorAll('.modal-color-btn').forEach(b => {
      b.classList.remove('border-vinotinto', 'bg-[#A5BCD6]/30', 'text-dark', 'ring-2', 'ring-vinotinto');
      b.classList.add('border-gray-200', 'text-gray-600');
    });
    btn.classList.add('border-vinotinto', 'bg-[#A5BCD6]/30', 'text-dark', 'ring-2', 'ring-vinotinto');
    btn.classList.remove('border-gray-200', 'text-gray-600');
  },

  addModalProductToCart() {
    if (!this.selectedModalProduct) return;
    const qty = parseInt(document.getElementById('modal-prod-qty').value) || 1;
    Cart.addItem(this.selectedModalProduct, this.selectedModalSize, this.selectedModalColor, qty);
    this.closeProductModal();
  },

  buyModalProductNow() {
    this.addModalProductToCart();
    Checkout.openModal();
  },

  closeProductModal() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
      <div class="flex-1 font-medium text-dark">${message}</div>
      <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 p-1">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  setupEventListeners() {
    const searchInputs = document.querySelectorAll('.app-search-input');
    searchInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
        if (this.currentView !== 'catalog' && e.target.value.trim().length > 0) {
          this.navigate('catalog');
        }
      });
    });

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
