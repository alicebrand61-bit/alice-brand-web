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
  sections: [],
  heroSlides: [],
  heroIndex: 0,
  heroTimer: null,
  // Marcador propio para productos sin foto (antes se colaba una imagen de archivo).
  PLACEHOLDER_IMG: '/static/images/placeholder-producto.svg',

  async init() {
    await this.fetchSettings();
    await this.fetchSections();
    await this.fetchHeroSlides();
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
    const alto = parseInt(this.settings.logo_height, 10);
    logoImgs.forEach(img => {
      if (this.settings.logo_url) img.src = this.settings.logo_url;
      // El alto se fija desde el panel; el ancho se ajusta solo.
      if (alto > 0) {
        img.style.height = `${alto}px`;
        // 'auto' colapsaba el SVG a 0 de ancho dentro del encabezado flexible.
        img.style.width = '';
        img.style.flexShrink = '0';
      }
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

    // Los nombres del menu cambian de ancho: hay que recalcular que cabe.
    // Dos cuadros, igual que al dibujarlo: en el primero el texto recien
    // puesto aun no tiene su ancho definitivo.
    requestAnimationFrame(() => requestAnimationFrame(() => this.fitNavCategories()));
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

    // Lineas del pie que quedan vacias: se oculta la fila entera (con su icono
    // o su vineta), para que no queden huecos ni iconos sueltos.
    document.querySelectorAll('[data-cms-item]').forEach(el => {
      const key = el.getAttribute('data-cms-item');
      if (!(key in this.settings)) return;
      el.classList.toggle('hidden', !(this.settings[key] || '').trim());
    });

    // Imagenes editables de la pagina. Si la clave quedo vacia se oculta la
    // foto en vez de dejar la que venia de fabrica.
    document.querySelectorAll('[data-cms-image]').forEach(img => {
      const key = img.getAttribute('data-cms-image');
      if (!(key in this.settings)) return;

      const url = (this.settings[key] || '').trim();
      img.classList.toggle('hidden', !url);
      if (url) img.src = url;
    });
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

  // ------------------------------------------------------------------
  // SECCIONES DE LA PORTADA (se crean/ocultan/ordenan desde el panel)
  // ------------------------------------------------------------------

  async fetchSections() {
    try {
      const res = await fetch('/api/sections');
      if (!res.ok) return;
      this.sections = await res.json();
      this.applySections();
    } catch (e) {
      console.error('Error cargando las secciones', e);
    }
  },

  applySections() {
    const home = document.getElementById('view-home');
    if (!home) return;

    const visibles = new Map(this.sections.map(sec => [sec.section_key, sec]));

    // Secciones fijas: se muestran u ocultan y se colocan en su posicion.
    home.querySelectorAll('[data-section]').forEach(el => {
      const sec = visibles.get(el.dataset.section);
      el.classList.toggle('hidden', !sec);
      if (sec) el.style.order = sec.position;
    });

    this.renderCustomSections();

    if (window.lucide) lucide.createIcons();
  },

  // Inserta en la portada las secciones creadas desde el panel.
  renderCustomSections() {
    const home = document.getElementById('view-home');
    if (!home) return;

    home.querySelectorAll('[data-custom-section]').forEach(el => el.remove());

    this.sections.filter(sec => sec.is_custom).forEach(sec => {
      const el = document.createElement('section');
      el.setAttribute('data-custom-section', sec.section_key);
      el.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full';
      el.style.order = sec.position;
      el.innerHTML = this.buildCustomSectionHtml(sec);
      home.appendChild(el);
    });
  },

  buildCustomSectionHtml(sec) {
    const esc = (v) => this.sanitizeCmsHtml(v || '');
    const hasImage = !!(sec.image_url && sec.image_url.trim());

    const cta = (sec.cta_text && sec.cta_text.trim())
      ? `<div class="pt-2">
           <a href="${this.safeUrl(sec.cta_link)}" class="btn-primary inline-flex px-7 py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
             ${esc(sec.cta_text)}
           </a>
         </div>`
      : '';

    const texto = `
      <div class="space-y-4 ${hasImage ? '' : 'max-w-3xl mx-auto text-center'}">
        ${sec.subtitle ? `<span class="text-xs font-bold uppercase tracking-widest text-[#4D0E12]">${esc(sec.subtitle)}</span>` : ''}
        <h2 class="text-3xl sm:text-4xl font-serif font-bold text-dark">${esc(sec.title)}</h2>
        ${sec.body ? `<p class="text-sm text-coffee/85 leading-relaxed font-light whitespace-pre-line">${esc(sec.body)}</p>` : ''}
        ${cta}
      </div>`;

    if (!hasImage) return texto;

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <img src="${this.safeUrl(sec.image_url)}" alt="${(sec.title || '').replace(/"/g, '&quot;')}"
             class="rounded-3xl shadow-xl border-4 border-white w-full object-cover" />
        ${texto}
      </div>`;
  },

  // Solo se aceptan enlaces http(s), rutas internas o anclas.
  safeUrl(url) {
    const value = (url || '').trim();
    if (!value) return 'javascript:void(0)';
    if (/^(https?:\/\/|\/|#)/i.test(value)) return value.replace(/"/g, '&quot;');
    return 'javascript:void(0)';
  },

  // ------------------------------------------------------------------
  // CARRUSEL DE LA PORTADA
  // Las diapositivas se administran desde el panel. El enlace de cada una
  // se guarda como referencia (slug de categoria o clave de seccion), no
  // como URL fija, para que siga funcionando si esa seccion cambia.
  // ------------------------------------------------------------------

  async fetchHeroSlides() {
    try {
      const res = await fetch('/api/hero-slides');
      if (!res.ok) return;
      this.heroSlides = await res.json();
      this.renderHeroCarousel();
    } catch (e) {
      console.error('Error cargando el carrusel', e);
    }
  },

  renderHeroCarousel() {
    const track = document.getElementById('hero-carousel-track');
    const dots = document.getElementById('hero-dots');
    const prev = document.getElementById('hero-prev');
    const next = document.getElementById('hero-next');
    if (!track) return;

    this.stopHeroAutoplay();
    this.heroIndex = 0;

    const slides = this.heroSlides;

    // Sin diapositivas: se muestra un aviso discreto en vez de un hueco.
    if (!slides.length) {
      track.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <img src="${this.PLACEHOLDER_IMG}" alt="" class="w-24 opacity-60" />
          <p class="text-sm text-coffee/70 font-light max-w-sm">
            Aún no hay fotos en la portada. Agrégalas desde el panel, en
            <strong class="font-semibold">Portada (Carrusel)</strong>.
          </p>
        </div>`;
      if (dots) dots.innerHTML = '';
      if (prev) prev.classList.add('hidden');
      if (next) next.classList.add('hidden');
      return;
    }

    track.innerHTML = slides.map((sl, i) => {
      const img = (sl.image_url || '').trim();
      const tieneTexto = (sl.title || '').trim() || (sl.subtitle || '').trim() || (sl.cta_text || '').trim();
      const clickable = sl.link_type && sl.link_type !== 'none';

      const overlay = tieneTexto ? `
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent"></div>
        <div class="absolute bottom-14 inset-x-0 px-6 sm:px-12 text-white max-w-3xl mx-auto text-center space-y-3">
          ${(sl.subtitle || '').trim() ? `<span class="text-[11px] uppercase tracking-widest text-[#F5EFC6] font-semibold">${this.sanitizeCmsHtml(sl.subtitle)}</span>` : ''}
          ${(sl.title || '').trim() ? `<h2 class="text-3xl sm:text-5xl font-serif font-bold leading-tight">${this.sanitizeCmsHtml(sl.title)}</h2>` : ''}
          ${(sl.cta_text || '').trim() ? `<span class="inline-flex btn-primary px-7 py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">${this.sanitizeCmsHtml(sl.cta_text)}</span>` : ''}
        </div>` : '';

      return `
        <div class="hero-slide absolute inset-0 transition-opacity duration-700 ${i === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}"
             data-slide="${i}" ${clickable ? `role="link" tabindex="0" onclick="App.openHeroSlide(${sl.id})" onkeydown="if(event.key==='Enter')App.openHeroSlide(${sl.id})"` : ''}
             style="${clickable ? 'cursor:pointer' : ''}">
          <img src="${img ? this.safeUrl(img) : this.PLACEHOLDER_IMG}"
               onerror="this.src='${this.PLACEHOLDER_IMG}'"
               alt="${(sl.title || 'Alice Brand').replace(/"/g, '&quot;')}"
               class="w-full h-full ${img ? 'object-cover' : 'object-contain p-16 opacity-60'} object-center" />
          ${overlay}
        </div>`;
    }).join('');

    // Flechas y puntos solo tienen sentido con mas de una foto
    const varias = slides.length > 1;
    if (prev) prev.classList.toggle('hidden', !varias);
    if (next) next.classList.toggle('hidden', !varias);
    if (prev) prev.classList.toggle('flex', varias);
    if (next) next.classList.toggle('flex', varias);

    if (dots) {
      dots.innerHTML = varias ? slides.map((_, i) => `
        <button type="button" onclick="App.goToHeroSlide(${i})" aria-label="Ir a la foto ${i + 1}"
          class="hero-dot h-2 rounded-full transition-all ${i === 0 ? 'w-7 bg-[#4D0E12]' : 'w-2 bg-white/70 hover:bg-white'}"></button>`).join('') : '';
    }

    if (window.lucide) lucide.createIcons();
    this.startHeroAutoplay();
  },

  goToHeroSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    if (!slides.length) return;

    this.heroIndex = (index + slides.length) % slides.length;

    slides.forEach((el, i) => {
      const activa = i === this.heroIndex;
      el.classList.toggle('opacity-100', activa);
      el.classList.toggle('z-10', activa);
      el.classList.toggle('opacity-0', !activa);
      el.classList.toggle('z-0', !activa);
      el.classList.toggle('pointer-events-none', !activa);
    });

    document.querySelectorAll('.hero-dot').forEach((d, i) => {
      const activa = i === this.heroIndex;
      d.classList.toggle('w-7', activa);
      d.classList.toggle('bg-[#4D0E12]', activa);
      d.classList.toggle('w-2', !activa);
      d.classList.toggle('bg-white/70', !activa);
    });
  },

  nextHeroSlide() { this.goToHeroSlide(this.heroIndex + 1); },
  prevHeroSlide() { this.goToHeroSlide(this.heroIndex - 1); },

  startHeroAutoplay() {
    this.stopHeroAutoplay();
    if (this.heroSlides.length < 2) return;
    // Se respeta a quien pidio menos animacion en su sistema.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.heroTimer = setInterval(() => this.nextHeroSlide(), 5500);
  },

  stopHeroAutoplay() {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = null;
    }
  },

  // Resuelve el destino de una diapositiva en el momento del clic, para que
  // apunte a la seccion o categoria tal como existe ahora.
  openHeroSlide(slideId) {
    const sl = this.heroSlides.find(x => x.id === slideId);
    if (!sl) return;

    const valor = (sl.link_value || '').trim();

    switch (sl.link_type) {
      case 'catalog':
        this.navigate('catalog');
        break;

      case 'category': {
        // Si la categoria ya no existe, se abre el catalogo completo.
        const existe = this.categories.some(c => c.slug === valor);
        this.navigate('catalog', existe ? valor : null);
        break;
      }

      case 'section': {
        const destino = document.querySelector(
          `[data-section="${valor}"], [data-custom-section="${valor}"]`
        );
        if (destino) {
          this.navigate('home');
          setTimeout(() => destino.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        } else {
          this.navigate('home');
        }
        break;
      }

      case 'url': {
        const url = this.safeUrl(valor);
        if (url && url !== 'javascript:void(0)') window.open(url, '_blank', 'noopener');
        break;
      }
    }
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
        this.renderCategoryCards();
        this.renderNavCategories();
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

  // Tarjetas de categoria de la portada. Antes estaban escritas a mano en el
  // HTML con imagenes fijas; ahora salen de la base y se editan en el panel.
  // El menu superior se arma con las categorias existentes, para que una
  // categoria nueva aparezca ahi y una eliminada desaparezca sola.
  //
  // Para que el encabezado NUNCA se desborde, tras dibujarlo se mide el
  // espacio real disponible y las categorias que no caben se mueven al
  // desplegable "Mas". Asi da igual cuantas categorias haya o que tan largo
  // sea su nombre: siempre cabe.
  renderNavCategories() {
    const desktop = document.getElementById('nav-categories-desktop');
    const mobile = document.getElementById('nav-categories-mobile');

    // Columna "Categorias" del pie de pagina: las mismas categorias reales.
    const footer = document.getElementById('footer-categories');
    if (footer) {
      footer.innerHTML = this.categories.map(c => `
        <li><a href="javascript:void(0)" onclick="App.navigate('catalog', '${c.slug}')"
          class="hover:text-[#F5EFC6] transition-colors">${this.sanitizeCmsHtml(c.name)}</a></li>`).join('')
        + `<li><a href="javascript:void(0)" onclick="App.navigate('about')"
             class="hover:text-[#F5EFC6] transition-colors">${this.sanitizeCmsHtml(this.settings.nav_about_label || 'Sobre Nosotros')}</a></li>`;
    }

    // En el menu movil caben todas, una debajo de otra.
    if (mobile) {
      mobile.innerHTML = this.categories.map(c => `
        <a href="javascript:void(0)" onclick="App.navigate('catalog', '${c.slug}')"
           class="block py-2 hover:text-[#4D0E12]">${this.sanitizeCmsHtml(c.name)}</a>`).join('');
    }

    if (!desktop) return;

    desktop.innerHTML = this.categories.map((c, i) => `
      <a href="javascript:void(0)" onclick="App.navigate('catalog', '${c.slug}')"
         data-nav-cat="${i}" title="${(c.name || '').replace(/"/g, '&quot;')}"
         class="hover:text-[#4D0E12] transition-colors whitespace-nowrap flex-shrink-0 truncate max-w-[190px]">${this.sanitizeCmsHtml(c.name)}</a>`).join('')
      + `
      <span id="nav-more-wrap" class="relative flex-shrink-0 hidden">
        <button type="button" onclick="App.toggleNavMore(event)"
          class="hover:text-[#4D0E12] transition-colors uppercase tracking-widest inline-flex items-center gap-1 whitespace-nowrap">
          Más <span aria-hidden="true">&#9662;</span>
        </button>
        <div id="nav-more-menu"
          class="hidden absolute right-0 top-full mt-2 min-w-[220px] max-w-[280px] bg-white border border-[#e4dccb] rounded-2xl shadow-xl py-2 z-50"></div>
      </span>`;

    // Se mide cuando el navegador ya calculo los anchos definitivos. Hacen
    // falta dos cuadros: en el primero el texto recien insertado aun no tiene
    // ancho final y la medida sale equivocada.
    requestAnimationFrame(() => requestAnimationFrame(() => this.fitNavCategories()));

    // Red de seguridad por si las fuentes cargan despues y cambian los anchos.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.fitNavCategories());
    }
  },

  // Mueve al desplegable "Mas" las categorias que no quepan en la barra.
  fitNavCategories(pasada) {
    const desktop = document.getElementById('nav-categories-desktop');
    const nav = document.querySelector('header nav');
    const wrap = document.getElementById('nav-more-wrap');
    const menu = document.getElementById('nav-more-menu');
    if (!desktop || !nav || !wrap || !menu) return;

    // En movil el menu esta oculto: no hay nada que medir.
    if (nav.offsetParent === null && nav.clientWidth === 0) return;

    const enlaces = [...desktop.querySelectorAll('[data-nav-cat]')];
    if (!enlaces.length) return;

    // Se parte de todo visible y se va recogiendo desde el final.
    enlaces.forEach(a => a.classList.remove('hidden'));
    wrap.classList.add('hidden');
    menu.innerHTML = '';

    const desbordado = () => nav.scrollWidth > nav.clientWidth + 1;

    const ocultas = [];
    for (let i = enlaces.length - 1; i >= 0 && desbordado(); i--) {
      enlaces[i].classList.add('hidden');
      ocultas.unshift(this.categories[+enlaces[i].dataset.navCat]);
      wrap.classList.remove('hidden');
    }

    if (ocultas.length) {
      menu.innerHTML = ocultas.map(c => `
        <a href="javascript:void(0)" onclick="App.navigate('catalog', '${c.slug}')"
           class="block px-4 py-2 normal-case tracking-normal text-xs hover:bg-[#FAF8F5] hover:text-[#4D0E12] transition-colors">
          ${this.sanitizeCmsHtml(c.name)}
        </a>`).join('');
    } else {
      wrap.classList.add('hidden');
    }

    // Segunda pasada: mostrar el boton "Mas" cambia los anchos, asi que se
    // vuelve a comprobar una vez. El contador evita repetirlo sin fin.
    if (desbordado() && (pasada || 0) < 2) {
      requestAnimationFrame(() => this.fitNavCategories((pasada || 0) + 1));
    }
  },

  toggleNavMore(e) {
    e.stopPropagation();
    const menu = document.getElementById('nav-more-menu');
    if (!menu) return;
    menu.classList.toggle('hidden');

    if (!menu.classList.contains('hidden')) {
      const cerrar = () => {
        menu.classList.add('hidden');
        document.removeEventListener('click', cerrar);
      };
      document.addEventListener('click', cerrar);
    }
  },

  renderCategoryCards() {
    const grid = document.getElementById('category-showcase-grid');
    if (!grid) return;

    if (!this.categories.length) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = this.categories.map(c => {
      const img = (c.image_url || '').trim() || this.PLACEHOLDER_IMG;
      const tagline = (c.tagline || '').trim();
      return `
        <div onclick="App.navigate('catalog', '${c.slug}')" class="lookbook-item group cursor-pointer h-96 shadow-md border border-[#e4dccb]">
          <img src="${this.safeUrl(img)}" onerror="this.src='${this.PLACEHOLDER_IMG}'"
               alt="${(c.name || '').replace(/"/g, '&quot;')}" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div>
          <div class="absolute bottom-6 inset-x-6 text-white">
            ${tagline ? `<span class="text-[11px] uppercase tracking-widest text-[#F5EFC6] font-semibold">${this.sanitizeCmsHtml(tagline)}</span>` : ''}
            <h3 class="text-2xl font-serif font-bold mt-1">${this.sanitizeCmsHtml(c.name)}</h3>
            ${c.description ? `<p class="text-xs text-white/80 mt-1 line-clamp-2">${this.sanitizeCmsHtml(c.description)}</p>` : ''}
            <span class="inline-flex items-center gap-1 text-xs font-bold text-[#A5BCD6] mt-3 group-hover:underline">
              Ver Colección <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </span>
          </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
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
    const mainImg = product.images && product.images.length ? product.images[0] : App.PLACEHOLDER_IMG;
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
    
    if (mainImg) mainImg.src = p.images[0] || App.PLACEHOLDER_IMG;
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

  // Al cambiar el tamano de la ventana se recalcula que cabe en el menu.
  setupNavResize() {
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => this.fitNavCategories(), 150);
    });
  },

  setupHeroCarouselControls() {
    const prev = document.getElementById('hero-prev');
    const next = document.getElementById('hero-next');
    const car = document.getElementById('hero-carousel');

    if (prev) prev.addEventListener('click', () => { this.prevHeroSlide(); this.startHeroAutoplay(); });
    if (next) next.addEventListener('click', () => { this.nextHeroSlide(); this.startHeroAutoplay(); });

    if (car) {
      car.addEventListener('mouseenter', () => this.stopHeroAutoplay());
      car.addEventListener('mouseleave', () => this.startHeroAutoplay());

      // Deslizar con el dedo en celular
      let x0 = null;
      car.addEventListener('touchstart', e => { x0 = e.changedTouches[0].clientX; }, { passive: true });
      car.addEventListener('touchend', e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 45) dx < 0 ? this.nextHeroSlide() : this.prevHeroSlide();
        x0 = null;
      }, { passive: true });
    }

    document.addEventListener('keydown', e => {
      if (this.currentView !== 'home' || this.heroSlides.length < 2) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') this.prevHeroSlide();
      if (e.key === 'ArrowRight') this.nextHeroSlide();
    });
  },

  setupEventListeners() {
    this.setupHeroCarouselControls();
    this.setupNavResize();

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
