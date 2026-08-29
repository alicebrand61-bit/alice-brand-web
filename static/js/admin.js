// Admin Dashboard Module for Alice Brand
const Admin = {
  currentTab: 'stats',
  products: [],
  orders: [],
  settings: {},

  async init() {
    if (!Auth.isAdmin()) {
      this.showAdminLoginGate();
      return;
    }

    this.hideAdminLoginGate();
    await this.loadStats();
    await this.loadProducts();
    await this.loadOrders();
    await this.loadSettings();
    this.switchTab('stats');
  },

  showAdminLoginGate() {
    const gate = document.getElementById('admin-login-gate');
    const content = document.getElementById('admin-dashboard-content');
    if (gate) gate.classList.remove('hidden');
    if (content) content.classList.add('hidden');
  },

  hideAdminLoginGate() {
    const gate = document.getElementById('admin-login-gate');
    const content = document.getElementById('admin-dashboard-content');
    if (gate) gate.classList.add('hidden');
    if (content) content.classList.remove('hidden');
  },

  async handleAdminLogin(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('admin-login-email').value.trim();
    const pass = document.getElementById('admin-login-pass').value;

    if (!email || !pass) {
      App.showToast('Por favor ingresa tu correo y contraseña de administrador.', 'warning');
      return;
    }

    App.showToast('Autenticando credenciales de administrador...', 'info');
    const success = await Auth.login(email, pass);
    if (success) {
      if (Auth.isAdmin()) {
        this.init();
      } else {
        App.showToast('Esta cuenta no tiene permisos de administrador.', 'error');
        Auth.logout();
      }
    }
  },

  async handleAdminChangePassword(e) {
    if (e) e.preventDefault();
    const currentPassword = document.getElementById('admin-current-pass').value;
    const newPassword = document.getElementById('admin-new-pass').value;
    const confirmPassword = document.getElementById('admin-confirm-pass').value;

    if (newPassword !== confirmPassword) {
      App.showToast('La nueva contraseña y su confirmación no coinciden.', 'warning');
      return;
    }

    if (newPassword.length < 6) {
      App.showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'warning');
      return;
    }

    try {
      App.showToast('Actualizando contraseña de administrador...', 'info');
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al cambiar contraseña');

      App.showToast('¡Contraseña actualizada con éxito! Úsala en tu próximo inicio de sesión.', 'success');
      document.getElementById('admin-change-pass-form').reset();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },


  switchTab(tab) {
    this.currentTab = tab;
    const tabs = ['stats', 'products', 'orders', 'brand', 'hero', 'categories', 'typography', 'content', 'sections', 'gateway'];

    tabs.forEach(t => {
      const section = document.getElementById(`admin-tab-${t}`);
      const btn = document.getElementById(`admin-nav-${t}`);
      if (section) section.classList.toggle('hidden', t !== tab);
      if (btn) {
        btn.classList.toggle('bg-vinotinto', t === tab);
        btn.classList.toggle('text-white', t === tab);
        btn.classList.toggle('text-gray-300', t !== tab);
      }
    });

    if (tab === 'orders') this.renderOrdersTable();
    if (tab === 'products') this.renderProductsTable();
    if (tab === 'stats') this.loadStats();
    if (tab === 'brand') this.loadSettings();
    if (tab === 'typography') this.loadTypographyTab();
    if (tab === 'content') this.loadContentTab();
    if (tab === 'hero') this.loadHeroTab();
    if (tab === 'categories') this.loadCategoriesTab();
    if (tab === 'sections') this.loadSectionsTab();
    else if (this.editingSectionId !== null) this.cancelSectionEdit();
    if (tab !== 'hero' && this.editingSlideId !== null) this.cancelHeroEdit();

    if (window.lucide) lucide.createIcons();
  },

  async loadStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: Auth.getAuthHeaders()
      });
      if (!res.ok) throw new Error('No se pudieron cargar las estadísticas.');
      const data = await res.json();
      
      const revEl = document.getElementById('admin-stat-revenue');
      const ordersEl = document.getElementById('admin-stat-orders');
      const prodEl = document.getElementById('admin-stat-products');
      const custEl = document.getElementById('admin-stat-customers');

      if (revEl) revEl.textContent = Cart.formatCOP(data.total_revenue_cop);
      if (ordersEl) ordersEl.textContent = data.total_orders;
      if (prodEl) prodEl.textContent = data.total_products;
      if (custEl) custEl.textContent = data.total_customers;

      const lowStockEl = document.getElementById('admin-low-stock-list');
      if (lowStockEl) {
        if (data.low_stock_products.length === 0) {
          lowStockEl.innerHTML = '<p class="text-xs text-gray-500 italic p-3">Todos los productos cuentan con inventario suficiente.</p>';
        } else {
          lowStockEl.innerHTML = data.low_stock_products.map(p => `
            <div class="flex items-center justify-between p-3 bg-red-50/80 border border-red-200 rounded-xl text-xs">
              <div>
                <span class="font-bold text-red-900 block">${p.name}</span>
                <span class="text-red-700 text-[11px]">${Cart.formatCOP(p.price_cop)}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="bg-red-200 text-red-900 font-bold px-2 py-1 rounded text-xs">${p.stock} unid.</span>
                <button onclick="Admin.openEditProductModal(${p.id})" class="btn-primary px-2.5 py-1 rounded text-[11px] font-bold">Reponer</button>
              </div>
            </div>
          `).join('');
        }
      }

    } catch (e) {
      console.error(e);
    }
  },

  async loadProducts() {
    try {
      const res = await fetch('/api/products?sort=newest');
      if (res.ok) {
        this.products = await res.json();
        this.renderProductsTable();
      }
    } catch (e) {
      console.error(e);
    }
  },

  async loadOrders() {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: Auth.getAuthHeaders()
      });
      if (res.ok) {
        this.orders = await res.json();
        this.renderOrdersTable();
      }
    } catch (e) {
      console.error(e);
    }
  },

  async loadSettings() {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: Auth.getAuthHeaders()
      });
      if (res.ok) {
        this.settings = await res.json();
        this.populateSettingsForm();
      }
    } catch (e) {
      console.error(e);
    }
  },

  populateSettingsForm() {
    const s = this.settings;
    if (document.getElementById('settings-brand-name')) document.getElementById('settings-brand-name').value = s.brand_name || 'Alice Brand';
    if (document.getElementById('settings-brand-slogan')) document.getElementById('settings-brand-slogan').value = s.brand_slogan || '';
    if (document.getElementById('settings-whatsapp')) document.getElementById('settings-whatsapp').value = s.whatsapp_number || '+573023949733';
    if (document.getElementById('settings-instagram')) document.getElementById('settings-instagram').value = s.instagram_url || '';
    if (document.getElementById('settings-google-client-id')) document.getElementById('settings-google-client-id').value = s.google_client_id || '';
    if (document.getElementById('settings-wompi-pub-key')) document.getElementById('settings-wompi-pub-key').value = s.wompi_public_key || '';
    if (document.getElementById('settings-wompi-secret')) document.getElementById('settings-wompi-secret').value = s.wompi_integrity_secret || '';
    
    const preview = document.getElementById('admin-logo-preview');
    if (preview && s.logo_url) {
      preview.src = s.logo_url;
    }
  },

  async handleLogoUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      App.showToast('Subiendo nuevo logotipo desde tu PC...', 'info');
      const res = await fetch('/api/admin/logo-upload', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: formData
      });
      if (!res.ok) throw new Error('Error al subir el logotipo');
      const data = await res.json();
      
      const preview = document.getElementById('admin-logo-preview');
      if (preview) preview.src = data.logo_url;
      
      // Update store settings in real time
      await App.fetchSettings();
      App.showToast('¡Logotipo actualizado con éxito en toda la boutique!', 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  // ------------------------------------------------------------------
  // TIPOGRAFIA: fuentes de Microsoft Word (sistema) + Google Fonts
  // ------------------------------------------------------------------

  // Fuentes clasicas de Microsoft Word, ya instaladas en el equipo del visitante.
  WORD_FONTS: [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS',
    'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium',
    'Garamond', 'Georgia', 'Impact', 'Lucida Sans', 'Palatino Linotype',
    'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
  ],

  // Seleccion popular de Google Fonts (se puede escribir cualquier otra a mano).
  GOOGLE_FONTS: [
    'Cormorant Garamond', 'Playfair Display', 'Plus Jakarta Sans', 'Poppins',
    'Outfit', 'Montserrat', 'Lato', 'Open Sans', 'Roboto', 'Raleway',
    'Nunito', 'Inter', 'Work Sans', 'Merriweather', 'Lora', 'Libre Baskerville',
    'Cinzel', 'Marcellus', 'Josefin Sans', 'Quicksand', 'Dancing Script',
    'Great Vibes', 'Bodoni Moda', 'DM Serif Display', 'Prata', 'Italiana'
  ],

  loadTypographyTab() {
    this.buildFontSelect('heading');
    this.buildFontSelect('body');

    const s = this.settings;
    const headingInput = document.getElementById('settings-font-heading');
    const bodyInput = document.getElementById('settings-font-body');
    if (headingInput) headingInput.value = s.font_heading || 'Cormorant Garamond';
    if (bodyInput) bodyInput.value = s.font_body || 'Plus Jakarta Sans';

    this.syncFontSelectFromInput('heading');
    this.syncFontSelectFromInput('body');
    this.updateFontPreview();
  },

  buildFontSelect(kind) {
    const select = document.getElementById(`settings-font-${kind}-select`);
    if (!select || select.dataset.built === '1') return;

    const wordGroup = this.WORD_FONTS
      .map(f => `<option value="${f}">${f}</option>`).join('');
    const googleGroup = this.GOOGLE_FONTS
      .map(f => `<option value="${f}">${f}</option>`).join('');

    select.innerHTML = `
      <optgroup label="Fuentes de Microsoft Word (instaladas en el equipo)">${wordGroup}</optgroup>
      <optgroup label="Google Fonts (se descargan automaticamente)">${googleGroup}</optgroup>
      <option value="__custom__">Otra fuente (escribirla abajo)...</option>
    `;
    select.dataset.built = '1';
  },

  // Si el nombre guardado esta en la lista lo marca; si no, deja "Otra fuente".
  syncFontSelectFromInput(kind) {
    const select = document.getElementById(`settings-font-${kind}-select`);
    const input = document.getElementById(`settings-font-${kind}`);
    if (!select || !input) return;

    const current = (input.value || '').trim();
    const known = [...this.WORD_FONTS, ...this.GOOGLE_FONTS].includes(current);
    select.value = known ? current : '__custom__';
  },

  onFontSelectChange(kind) {
    const select = document.getElementById(`settings-font-${kind}-select`);
    const input = document.getElementById(`settings-font-${kind}`);
    if (!select || !input) return;

    if (select.value !== '__custom__') {
      input.value = select.value;
    }
    input.focus();
    this.updateFontPreview();
  },

  // Vista previa inmediata dentro del panel, sin necesidad de guardar.
  updateFontPreview() {
    const heading = (document.getElementById('settings-font-heading')?.value || '').trim();
    const body = (document.getElementById('settings-font-body')?.value || '').trim();

    // Carga anticipada de las fuentes de Google usadas en la vista previa.
    const families = [heading, body]
      .filter(f => f && !App.SYSTEM_FONTS[f])
      .filter((f, i, arr) => arr.indexOf(f) === i)
      .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700`);

    let preview = document.getElementById('admin-font-preview-link');
    if (!preview) {
      preview = document.createElement('link');
      preview.id = 'admin-font-preview-link';
      preview.rel = 'stylesheet';
      document.head.appendChild(preview);
    }
    if (families.length) {
      preview.href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
    } else {
      preview.removeAttribute('href');
    }

    const hEl = document.getElementById('font-preview-heading');
    const bEl = document.getElementById('font-preview-body');
    if (hEl) hEl.style.fontFamily = App.buildFontStack(heading || 'Cormorant Garamond', 'Georgia, serif');
    if (bEl) bEl.style.fontFamily = App.buildFontStack(body || 'Plus Jakarta Sans', 'sans-serif');
  },

  async handleSaveTypography(e) {
    e.preventDefault();
    const heading = document.getElementById('settings-font-heading').value.trim();
    const body = document.getElementById('settings-font-body').value.trim();

    if (!heading || !body) {
      App.showToast('Debes indicar una fuente para los titulos y otra para el texto.', 'error');
      return;
    }

    await this.saveSettingsPayload(
      { font_heading: heading, font_body: body },
      'Guardando tipografia...',
      'Tipografia actualizada en toda la tienda!'
    );
  },

  // ------------------------------------------------------------------
  // TEXTOS EDITABLES DE LA PAGINA (CMS)
  // ------------------------------------------------------------------

  CMS_FIELDS: [
    'announcement_bar_text',
    'hero_tag', 'hero_title', 'hero_subtitle', 'hero_cta_text',
    'hero_bg_image_url', 'hero_side_image_url',
    'about_title', 'about_subtitle', 'about_story_heading',
    'about_story_p1', 'about_story_p2', 'about_image_url',
    'whatsapp_assistance_title', 'whatsapp_assistance_desc',
    'footer_about'
  ],

  loadContentTab() {
    this.CMS_FIELDS.forEach(key => {
      const el = document.getElementById(`cms-${key}`);
      if (el) el.value = this.settings[key] || '';
    });
  },

  async handleSaveContent(e) {
    e.preventDefault();
    const payload = {};
    this.CMS_FIELDS.forEach(key => {
      const el = document.getElementById(`cms-${key}`);
      if (el) payload[key] = el.value.trim();
    });

    await this.saveSettingsPayload(
      payload,
      'Guardando textos de la pagina...',
      'Textos actualizados correctamente!'
    );
  },

  // Helper compartido: envia ajustes al backend y refresca la tienda.
  async saveSettingsPayload(payload, loadingMsg, successMsg) {
    try {
      App.showToast(loadingMsg, 'info');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('No se pudieron guardar los cambios.');

      Object.assign(this.settings, payload);
      await App.fetchSettings();
      App.showToast(successMsg, 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ------------------------------------------------------------------
  // SECCIONES DE LA PORTADA (crear / activar / reordenar / eliminar)
  // ------------------------------------------------------------------

  sections: [],

  async loadSectionsTab() {
    try {
      const res = await fetch('/api/admin/sections', { headers: Auth.getAuthHeaders() });
      if (!res.ok) throw new Error('No se pudieron cargar las secciones.');
      this.sections = await res.json();
      this.renderSectionsList();
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  renderSectionsList() {
    const list = document.getElementById('admin-sections-list');
    if (!list) return;

    if (this.sections.length === 0) {
      list.innerHTML = '<p class="text-xs text-gray-500 p-4">No hay secciones registradas.</p>';
      return;
    }

    list.innerHTML = this.sections.map((sec, i) => {
      const activa = sec.enabled;
      const fija = !sec.is_custom;
      return `
        <div class="flex items-center gap-3 p-3 rounded-2xl border ${activa ? 'border-[#e4dccb] bg-white' : 'border-gray-200 bg-gray-50 opacity-70'}">
          <div class="flex flex-col gap-0.5">
            <button type="button" onclick="Admin.moveSection(${i}, -1)" ${i === 0 ? 'disabled' : ''}
              class="w-6 h-5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center" title="Subir">
              <i data-lucide="chevron-up" class="w-3 h-3"></i>
            </button>
            <button type="button" onclick="Admin.moveSection(${i}, 1)" ${i === this.sections.length - 1 ? 'disabled' : ''}
              class="w-6 h-5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center" title="Bajar">
              <i data-lucide="chevron-down" class="w-3 h-3"></i>
            </button>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-sm text-dark truncate">${this.escapeHtml(sec.title)}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${fija ? 'bg-[#A5BCD6]/50 text-dark' : 'bg-[#F5EFC6] text-[#4D0E12]'}">
                ${fija ? 'FIJA' : 'PERSONALIZADA'}
              </span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${activa ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}">
                ${activa ? 'VISIBLE' : 'OCULTA'}
              </span>
            </div>
            ${sec.subtitle ? `<p class="text-[11px] text-gray-500 truncate">${this.escapeHtml(sec.subtitle)}</p>` : ''}
          </div>

          <label class="flex items-center gap-2 cursor-pointer flex-shrink-0" title="Mostrar u ocultar en la portada">
            <input type="checkbox" ${activa ? 'checked' : ''} onchange="Admin.toggleSection(${sec.id}, this.checked)"
              class="w-4 h-4 accent-[#4D0E12] cursor-pointer" />
            <span class="text-[11px] font-semibold text-coffee">Activa</span>
          </label>

          <button type="button" onclick="Admin.editSection(${sec.id})"
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#A5BCD6]/30 text-[#4D0E12] hover:bg-[#A5BCD6]/60"
            title="${fija ? 'Editar los textos de esta seccion' : 'Editar esta seccion'}">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>

          <button type="button" onclick="Admin.deleteSection(${sec.id})"
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${fija ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100'}"
            ${fija ? 'disabled title="Las secciones fijas solo se pueden ocultar"' : 'title="Eliminar seccion"'}>
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  },

  async toggleSection(sectionId, enabled) {
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) throw new Error('No se pudo actualizar la seccion.');

      const updated = await res.json();
      const idx = this.sections.findIndex(s => s.id === sectionId);
      if (idx !== -1) this.sections[idx] = updated;

      this.renderSectionsList();
      await App.fetchSections();
      App.showToast(enabled ? 'Seccion activada en la portada.' : 'Seccion ocultada de la portada.', 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
      this.loadSectionsTab();
    }
  },

  async moveSection(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= this.sections.length) return;

    const reordered = [...this.sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.sections = reordered;
    this.renderSectionsList();

    try {
      const res = await fetch('/api/admin/sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify({ ordered_ids: reordered.map(s => s.id) })
      });
      if (!res.ok) throw new Error('No se pudo guardar el nuevo orden.');

      await this.loadSectionsTab();
      await App.fetchSections();
    } catch (e) {
      App.showToast(e.message, 'error');
      this.loadSectionsTab();
    }
  },

  async deleteSection(sectionId) {
    const sec = this.sections.find(s => s.id === sectionId);
    if (!sec) return;
    if (!confirm(`Eliminar definitivamente la seccion "${sec.title}"? Esta accion no se puede deshacer.`)) return;

    try {
      const res = await fetch(`/api/admin/sections/${sectionId}`, {
        method: 'DELETE',
        headers: Auth.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar la seccion.');

      await this.loadSectionsTab();
      await App.fetchSections();
      App.showToast(data.message, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  // Id de la seccion que se esta editando (null = se esta creando una nueva).
  editingSectionId: null,

  // Campos del formulario y su input correspondiente.
  SECTION_FORM_FIELDS: {
    title: 'new-section-title',
    subtitle: 'new-section-subtitle',
    body: 'new-section-body',
    image_url: 'new-section-image',
    cta_text: 'new-section-cta-text',
    cta_link: 'new-section-cta-link'
  },

  readSectionForm() {
    const payload = {};
    Object.entries(this.SECTION_FORM_FIELDS).forEach(([campo, id]) => {
      const el = document.getElementById(id);
      payload[campo] = el ? el.value.trim() : '';
    });
    return payload;
  },

  // Carga una seccion en el formulario para editarla.
  editSection(sectionId) {
    const sec = this.sections.find(s => s.id === sectionId);
    if (!sec) return;

    // Las secciones fijas tienen sus textos en la pestana "Textos de la Pagina".
    if (!sec.is_custom) {
      App.showToast('Los textos de las secciones fijas se editan en "Textos de la Pagina".', 'info');
      this.switchTab('content');
      return;
    }

    this.editingSectionId = sectionId;
    Object.entries(this.SECTION_FORM_FIELDS).forEach(([campo, id]) => {
      const el = document.getElementById(id);
      if (el) el.value = sec[campo] || '';
    });

    const heading = document.getElementById('section-form-heading');
    const hint = document.getElementById('section-form-hint');
    const submit = document.getElementById('section-form-submit');
    const cancel = document.getElementById('section-form-cancel');
    const aviso = document.getElementById('section-form-editing-hint');

    if (heading) heading.innerHTML = '2. Editar secci&oacute;n';
    if (submit) submit.innerHTML = 'Guardar Cambios';
    if (cancel) cancel.classList.remove('hidden');
    if (aviso) {
      aviso.textContent = `Editando la seccion "${sec.title}". Usa Cancelar para volver a crear una nueva.`;
      aviso.classList.remove('hidden');
    }

    document.getElementById('section-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('new-section-title')?.focus();
  },

  // Vuelve el formulario al modo "crear seccion nueva".
  cancelSectionEdit() {
    this.editingSectionId = null;
    document.getElementById('section-form')?.reset();

    const heading = document.getElementById('section-form-heading');
    const submit = document.getElementById('section-form-submit');
    const cancel = document.getElementById('section-form-cancel');
    const aviso = document.getElementById('section-form-editing-hint');

    if (heading) heading.innerHTML = '2. Crear una secci&oacute;n nueva';
    if (submit) submit.innerHTML = 'Crear Secci&oacute;n';
    if (cancel) cancel.classList.add('hidden');
    if (aviso) aviso.classList.add('hidden');
  },

  // Un solo submit sirve para crear y para guardar cambios.
  async handleSectionFormSubmit(e) {
    e.preventDefault();
    const payload = this.readSectionForm();

    if (!payload.title) {
      App.showToast('La seccion necesita un titulo.', 'error');
      return;
    }

    const editando = this.editingSectionId !== null;
    const url = editando
      ? `/api/admin/sections/${this.editingSectionId}`
      : '/api/admin/sections';
    if (!editando) payload.enabled = true;

    try {
      App.showToast(editando ? 'Guardando los cambios...' : 'Creando la nueva seccion...', 'info');
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudieron guardar los cambios.');

      this.cancelSectionEdit();
      await this.loadSectionsTab();
      await App.fetchSections();
      App.showToast(
        editando
          ? `Seccion "${data.title}" actualizada!`
          : `Seccion "${data.title}" creada y publicada en la portada!`,
        'success'
      );
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async handleSaveSettings(e) {
    e.preventDefault();
    const payload = {
      brand_name: document.getElementById('settings-brand-name').value.trim(),
      brand_slogan: document.getElementById('settings-brand-slogan').value.trim(),
      whatsapp_number: document.getElementById('settings-whatsapp').value.trim(),
      instagram_url: document.getElementById('settings-instagram').value.trim(),
      google_client_id: document.getElementById('settings-google-client-id').value.trim(),
      wompi_public_key: document.getElementById('settings-wompi-pub-key').value.trim(),
      wompi_integrity_secret: document.getElementById('settings-wompi-secret').value.trim()
    };

    try {
      App.showToast('Guardando configuración de marca y pasarela...', 'info');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error guardando ajustes');

      App.showToast('¡Configuración guardada exitosamente!', 'success');
      await App.fetchSettings();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  renderProductsTable() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;

    if (this.products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-gray-500">No hay productos registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = this.products.map(p => `
      <tr class="border-b border-gray-100 hover:bg-gray-50/80 transition-colors text-xs">
        <td class="p-3.5">
          <img src="${p.images[0] || Admin.PLACEHOLDER_IMG}" class="w-12 h-14 object-cover rounded-lg shadow-sm border border-gray-200" />
        </td>
        <td class="p-3.5 font-medium text-dark">
          <div class="font-bold text-sm text-dark">${p.name}</div>
          <div class="text-[11px] text-gray-400 font-mono">${p.slug}</div>
          <div class="flex gap-1 mt-1">
            ${p.sizes.map(s => `<span class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">${s}</span>`).join('')}
          </div>
        </td>
        <td class="p-3.5 text-coffee font-bold text-sm">${Cart.formatCOP(p.price_cop)}</td>
        <td class="p-3.5">
          <div class="flex items-center gap-1.5">
            <button onclick="Admin.quickAdjustStock(${p.id}, -1)" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center">-</button>
            <span class="px-2.5 py-1 text-xs rounded-full font-bold min-w-[50px] text-center ${p.stock > 5 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              ${p.stock}
            </span>
            <button onclick="Admin.quickAdjustStock(${p.id}, 1)" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center">+</button>
          </div>
        </td>
        <td class="p-3.5">
          <span class="bg-[#A5BCD6]/40 text-dark text-[11px] px-2.5 py-1 rounded-full font-semibold">${p.category_name || 'General'}</span>
        </td>
        <td class="p-3.5 text-right">
          <div class="flex justify-end gap-1.5">
            <button onclick="Admin.openEditProductModal(${p.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="Admin.deleteProduct(${p.id})" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  async quickAdjustStock(productId, delta) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify({ stock: newStock })
      });
      if (res.ok) {
        product.stock = newStock;
        this.renderProductsTable();
        App.showToast(`Stock de "${product.name}" actualizado a ${newStock}`, 'info', 1500);
      }
    } catch (e) {
      App.showToast('Error ajustando stock', 'error');
    }
  },

  renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-500">No hay órdenes registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = this.orders.map(o => `
      <tr class="border-b border-gray-100 hover:bg-gray-50/80 transition-colors text-xs">
        <td class="p-3.5 font-mono font-bold text-vinotinto">${o.order_number}</td>
        <td class="p-3.5">
          <div class="font-bold text-dark">${o.customer_name}</div>
          <div class="text-[11px] text-gray-500">${o.customer_phone} · ${o.customer_email}</div>
          <div class="text-[11px] text-coffee/80 mt-0.5">${o.address}, ${o.city} (${o.department})</div>
        </td>
        <td class="p-3.5">
          <span class="text-xs font-semibold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
            ${o.pse_bank || 'PSE Débito / Wompi'}
          </span>
          <div class="text-[10px] text-gray-400 font-mono mt-1">${o.pse_transaction_id || '-'}</div>
        </td>
        <td class="p-3.5 font-bold text-coffee text-sm">${Cart.formatCOP(o.total_cop)}</td>
        <td class="p-3.5">
          <select onchange="Admin.updateOrderStatus(${o.id}, this.value)" class="text-xs font-bold rounded-lg border border-gray-300 p-2 bg-white shadow-sm focus:ring-1 focus:ring-vinotinto">
            <option value="Pendiente" ${o.order_status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
            <option value="Pagado" ${o.order_status === 'Pagado' ? 'selected' : ''}>💳 Pagado (PSE)</option>
            <option value="En Preparación" ${o.order_status === 'En Preparación' ? 'selected' : ''}>📦 En Preparación</option>
            <option value="Enviado" ${o.order_status === 'Enviado' ? 'selected' : ''}>🚚 Enviado</option>
            <option value="Entregado" ${o.order_status === 'Entregado' ? 'selected' : ''}>✅ Entregado</option>
          </select>
        </td>
        <td class="p-3.5 text-gray-500">${o.created_at ? o.created_at.split(' ')[0] : 'Hoy'}</td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  openCreateProductModal() {
    document.getElementById('product-modal-title').textContent = 'Crear Nuevo Vestido / Accesorio';
    document.getElementById('product-form-id').value = '';
    document.getElementById('prod-form-name').value = '';
    document.getElementById('prod-form-desc').value = '';
    document.getElementById('prod-form-price').value = '';
    document.getElementById('prod-form-stock').value = '15';
    document.getElementById('prod-form-images').value = '';
    document.getElementById('prod-form-featured').checked = false;
    document.getElementById('prod-form-new').checked = true;
    this.renderProductImages();

    const modal = document.getElementById('admin-product-modal');
    if (modal) modal.classList.add('active');
  },

  openEditProductModal(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('product-modal-title').textContent = `Editar: ${p.name}`;
    document.getElementById('product-form-id').value = p.id;
    document.getElementById('prod-form-name').value = p.name;
    document.getElementById('prod-form-desc').value = p.description;
    document.getElementById('prod-form-price').value = p.price_cop;
    document.getElementById('prod-form-category').value = p.category_id || '1';
    document.getElementById('prod-form-stock').value = p.stock;
    document.getElementById('prod-form-images').value = p.images.join('\n');
    document.getElementById('prod-form-featured').checked = p.featured;
    document.getElementById('prod-form-new').checked = p.is_new;
    this.renderProductImages();

    const modal = document.getElementById('admin-product-modal');
    if (modal) modal.classList.add('active');
  },

  closeProductModal() {
    const modal = document.getElementById('admin-product-modal');
    if (modal) modal.classList.remove('active');
  },

  PLACEHOLDER_IMG: '/static/images/placeholder-producto.svg',

  // ------------------------------------------------------------------
  // IMAGENES DEL PRODUCTO (quitar una por una o todas, incluidas las
  // que venian de fabrica en el catalogo original)
  // ------------------------------------------------------------------

  getProductImages() {
    const area = document.getElementById('prod-form-images');
    if (!area) return [];
    return area.value.split('\n').map(s => s.trim()).filter(Boolean);
  },

  setProductImages(urls) {
    const area = document.getElementById('prod-form-images');
    if (area) area.value = urls.join('\n');
    this.renderProductImages();
  },

  // Dibuja una miniatura por imagen con su boton para quitarla.
  renderProductImages() {
    const cont = document.getElementById('prod-images-preview');
    if (!cont) return;

    const urls = this.getProductImages();

    if (urls.length === 0) {
      cont.innerHTML = `
        <div class="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
          <img src="${this.PLACEHOLDER_IMG}" class="w-10 h-12 object-cover rounded-lg opacity-70" alt="" />
          <p class="text-[11px] text-gray-500">
            Este producto no tiene imagenes. Se mostrara un marcador de posicion hasta que subas una foto.
          </p>
        </div>`;
      return;
    }

    cont.innerHTML = `
      <div class="flex flex-wrap gap-2">
        ${urls.map((url, i) => `
          <div class="relative group">
            <img src="${url.replace(/"/g, '&quot;')}" onerror="this.src='${this.PLACEHOLDER_IMG}'"
                 class="w-16 h-20 object-cover rounded-lg border border-gray-200 shadow-sm" alt="" />
            ${i === 0 ? '<span class="absolute bottom-0 inset-x-0 bg-[#4D0E12] text-white text-[8px] text-center font-bold py-0.5 rounded-b-lg">PRINCIPAL</span>' : ''}
            <button type="button" onclick="Admin.removeProductImage(${i})" title="Quitar esta imagen"
              class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow hover:bg-red-700">
              &times;
            </button>
          </div>`).join('')}
      </div>
      <button type="button" onclick="Admin.removeAllProductImages()"
        class="mt-2 text-[11px] font-bold text-red-600 hover:underline">
        Quitar todas las imagenes de este producto
      </button>`;
  },

  removeProductImage(index) {
    const urls = this.getProductImages();
    urls.splice(index, 1);
    this.setProductImages(urls);
  },

  removeAllProductImages() {
    this.setProductImages([]);
    App.showToast('Imagenes quitadas. Recuerda guardar el producto.', 'info');
  },

  // Vacia de una sola vez las imagenes de TODO el catalogo.
  async clearCatalogImages() {
    const total = this.products.length;
    if (!confirm(
      `Quitar las imagenes de los ${total} productos del catalogo?\n\n` +
      'Los productos, precios y descripciones se conservan: solo se borran las fotos ' +
      'para que puedas subir las tuyas. Esta accion no se puede deshacer.'
    )) return;

    try {
      App.showToast('Vaciando las imagenes del catalogo...', 'info');
      const res = await fetch('/api/admin/products/clear-images', {
        method: 'POST',
        headers: Auth.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudieron quitar las imagenes.');

      await this.loadProducts();
      this.renderProductsTable();
      await App.fetchProducts();
      App.showToast(data.message, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  // ------------------------------------------------------------------
  // CARRUSEL DE LA PORTADA
  // ------------------------------------------------------------------

  heroSlides: [],
  editingSlideId: null,

  async loadHeroTab() {
    try {
      // Las categorias y secciones alimentan el desplegable de destinos.
      const [slidesRes, catsRes, secsRes] = await Promise.all([
        fetch('/api/admin/hero-slides', { headers: Auth.getAuthHeaders() }),
        fetch('/api/admin/categories', { headers: Auth.getAuthHeaders() }),
        fetch('/api/admin/sections', { headers: Auth.getAuthHeaders() })
      ]);
      if (!slidesRes.ok) throw new Error('No se pudo cargar el carrusel.');

      this.heroSlides = await slidesRes.json();
      if (catsRes.ok) this.categories = await catsRes.json();
      if (secsRes.ok) this.sections = await secsRes.json();

      this.buildHeroLinkSelect();
      this.renderHeroList();
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  // El desplegable se arma con lo que existe hoy, asi que una categoria o
  // seccion nueva aparece aqui sin tocar nada.
  buildHeroLinkSelect(seleccion) {
    const select = document.getElementById('hero-form-link');
    if (!select) return;

    const cats = this.categories.map(c =>
      `<option value="category:${c.slug}">${this.escapeHtml(c.name)}</option>`).join('');
    const secs = this.sections.map(sec =>
      `<option value="section:${sec.section_key}">${this.escapeHtml(sec.title)}</option>`).join('');

    select.innerHTML = `
      <option value="none:">Sin enlace (solo foto)</option>
      <option value="catalog:">Catalogo completo</option>
      ${cats ? `<optgroup label="Ir a una categoria">${cats}</optgroup>` : ''}
      ${secs ? `<optgroup label="Ir a una seccion de la portada">${secs}</optgroup>` : ''}
      <option value="url:">Enlace externo...</option>`;

    if (seleccion) select.value = seleccion;
    this.onHeroLinkChange();
  },

  onHeroLinkChange() {
    const select = document.getElementById('hero-form-link');
    const urlField = document.getElementById('hero-form-url');
    if (!select || !urlField) return;
    urlField.classList.toggle('hidden', !select.value.startsWith('url:'));
  },

  renderHeroList() {
    const list = document.getElementById('admin-hero-list');
    if (!list) return;

    if (!this.heroSlides.length) {
      list.innerHTML = `
        <p class="text-xs text-gray-500 p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50">
          El carrusel esta vacio. Agrega tu primera foto en el formulario de abajo.
        </p>`;
      return;
    }

    list.innerHTML = this.heroSlides.map((sl, i) => {
      const img = (sl.image_url || '').trim();
      return `
        <div class="flex items-center gap-3 p-3 rounded-2xl border ${sl.enabled ? 'border-[#e4dccb] bg-white' : 'border-gray-200 bg-gray-50 opacity-70'}">
          <div class="flex flex-col gap-0.5">
            <button type="button" onclick="Admin.moveHeroSlide(${i}, -1)" ${i === 0 ? 'disabled' : ''}
              class="w-6 h-5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center" title="Subir">
              <i data-lucide="chevron-up" class="w-3 h-3"></i>
            </button>
            <button type="button" onclick="Admin.moveHeroSlide(${i}, 1)" ${i === this.heroSlides.length - 1 ? 'disabled' : ''}
              class="w-6 h-5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center" title="Bajar">
              <i data-lucide="chevron-down" class="w-3 h-3"></i>
            </button>
          </div>

          <div class="relative flex-shrink-0">
            <img src="${img || Admin.PLACEHOLDER_IMG}" onerror="this.src='${Admin.PLACEHOLDER_IMG}'"
                 class="w-24 h-16 object-cover rounded-lg border border-gray-200 bg-white" alt="" />
            ${img ? `<button type="button" onclick="Admin.removeHeroSlideImage(${sl.id})" title="Quitar solo la imagen"
                      class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow hover:bg-red-700">&times;</button>` : ''}
          </div>

          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm text-dark truncate">
              ${sl.title ? this.escapeHtml(sl.title) : `<span class="text-gray-400 font-normal">Foto ${i + 1} (sin texto)</span>`}
            </div>
            <div class="text-[11px] text-gray-500 truncate">${this.describeHeroLink(sl)}</div>
          </div>

          <label class="flex items-center gap-2 cursor-pointer flex-shrink-0" title="Mostrar u ocultar en el carrusel">
            <input type="checkbox" ${sl.enabled ? 'checked' : ''} onchange="Admin.toggleHeroSlide(${sl.id}, this.checked)"
              class="w-4 h-4 accent-[#4D0E12] cursor-pointer" />
            <span class="text-[11px] font-semibold text-coffee">Activa</span>
          </label>

          <button type="button" onclick="Admin.editHeroSlide(${sl.id})" title="Editar esta foto"
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#A5BCD6]/30 text-[#4D0E12] hover:bg-[#A5BCD6]/60">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>

          <button type="button" onclick="Admin.deleteHeroSlide(${sl.id})" title="Eliminar esta foto del carrusel"
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-50 text-red-600 hover:bg-red-100">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  describeHeroLink(sl) {
    const v = (sl.link_value || '').trim();
    switch (sl.link_type) {
      case 'catalog': return 'Lleva al catalogo completo';
      case 'category': {
        const c = this.categories.find(x => x.slug === v);
        return c ? `Lleva a la categoria: ${this.escapeHtml(c.name)}`
                 : 'La categoria enlazada ya no existe (abrira el catalogo)';
      }
      case 'section': {
        const sec = this.sections.find(x => x.section_key === v);
        return sec ? `Lleva a la seccion: ${this.escapeHtml(sec.title)}`
                   : 'La seccion enlazada ya no existe';
      }
      case 'url': return `Enlace externo: ${this.escapeHtml(v)}`;
      default: return 'Sin enlace';
    }
  },

  previewHeroImage() {
    const url = document.getElementById('hero-form-image')?.value.trim();
    const prev = document.getElementById('hero-form-preview');
    if (prev) prev.src = url || Admin.PLACEHOLDER_IMG;
  },

  async handleHeroImageUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);

    try {
      App.showToast('Subiendo la foto...', 'info');
      const res = await fetch('/api/admin/upload', {
        method: 'POST', headers: Auth.getAuthHeaders(), body: formData
      });
      if (!res.ok) throw new Error('No se pudo subir la foto.');
      const data = await res.json();

      const field = document.getElementById('hero-form-image');
      if (field) field.value = data.url;
      this.previewHeroImage();
      App.showToast('Foto lista. Ahora guardala en el carrusel.', 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  readHeroForm() {
    const sel = document.getElementById('hero-form-link').value;
    const [tipo, ...resto] = sel.split(':');
    let valor = resto.join(':');
    if (tipo === 'url') valor = document.getElementById('hero-form-url').value.trim();

    return {
      image_url: document.getElementById('hero-form-image').value.trim(),
      title: document.getElementById('hero-form-title').value.trim(),
      subtitle: document.getElementById('hero-form-subtitle').value.trim(),
      cta_text: document.getElementById('hero-form-cta').value.trim(),
      link_type: tipo,
      link_value: valor
    };
  },

  editHeroSlide(slideId) {
    const sl = this.heroSlides.find(x => x.id === slideId);
    if (!sl) return;

    this.editingSlideId = slideId;
    document.getElementById('hero-form-image').value = sl.image_url || '';
    document.getElementById('hero-form-title').value = sl.title || '';
    document.getElementById('hero-form-subtitle').value = sl.subtitle || '';
    document.getElementById('hero-form-cta').value = sl.cta_text || '';

    this.buildHeroLinkSelect(`${sl.link_type}:${sl.link_type === 'url' ? '' : (sl.link_value || '')}`);
    if (sl.link_type === 'url') {
      document.getElementById('hero-form-link').value = 'url:';
      document.getElementById('hero-form-url').value = sl.link_value || '';
      this.onHeroLinkChange();
    }
    this.previewHeroImage();

    document.getElementById('hero-form-heading').innerHTML = '2. Editar foto del carrusel';
    document.getElementById('hero-form-submit').innerHTML = 'Guardar Cambios';
    document.getElementById('hero-form-cancel').classList.remove('hidden');
    const aviso = document.getElementById('hero-form-editing-hint');
    aviso.textContent = 'Editando una foto del carrusel. Usa Cancelar para volver a agregar una nueva.';
    aviso.classList.remove('hidden');

    document.getElementById('hero-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  cancelHeroEdit() {
    this.editingSlideId = null;
    document.getElementById('hero-form')?.reset();
    this.buildHeroLinkSelect();
    this.previewHeroImage();

    const h = document.getElementById('hero-form-heading');
    const b = document.getElementById('hero-form-submit');
    const c = document.getElementById('hero-form-cancel');
    const a = document.getElementById('hero-form-editing-hint');
    if (h) h.innerHTML = '2. Agregar una foto';
    if (b) b.innerHTML = 'Agregar al Carrusel';
    if (c) c.classList.add('hidden');
    if (a) a.classList.add('hidden');
  },

  async handleHeroFormSubmit(e) {
    e.preventDefault();
    const payload = this.readHeroForm();

    if (!payload.image_url) {
      App.showToast('Elige o sube una foto para el carrusel.', 'error');
      return;
    }
    if (payload.link_type === 'url' && !payload.link_value) {
      App.showToast('Escribe la direccion del enlace externo.', 'error');
      return;
    }

    const editando = this.editingSlideId !== null;
    const url = editando ? `/api/admin/hero-slides/${this.editingSlideId}` : '/api/admin/hero-slides';
    if (!editando) payload.enabled = true;

    try {
      App.showToast(editando ? 'Guardando los cambios...' : 'Agregando la foto al carrusel...', 'info');
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo guardar.');

      this.cancelHeroEdit();
      await this.loadHeroTab();
      await App.fetchHeroSlides();
      App.showToast(editando ? 'Foto actualizada.' : 'Foto agregada al carrusel.', 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async toggleHeroSlide(slideId, enabled) {
    await this.saveHeroSlide(slideId, { enabled },
      enabled ? 'Foto visible en el carrusel.' : 'Foto oculta del carrusel.');
  },

  // Quita solo la imagen, conservando la diapositiva y su enlace.
  async removeHeroSlideImage(slideId) {
    if (!confirm('Quitar solo la imagen de esta diapositiva?\n\nLa diapositiva se conserva; para borrarla entera usa la papelera.')) return;
    await this.saveHeroSlide(slideId, { image_url: '' }, 'Imagen quitada de la diapositiva.');
  },

  async saveHeroSlide(slideId, cambios, mensaje) {
    try {
      const res = await fetch(`/api/admin/hero-slides/${slideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify(cambios)
      });
      if (!res.ok) throw new Error('No se pudo actualizar la diapositiva.');

      await this.loadHeroTab();
      await App.fetchHeroSlides();
      App.showToast(mensaje, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  async moveHeroSlide(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= this.heroSlides.length) return;

    const reordenado = [...this.heroSlides];
    [reordenado[index], reordenado[target]] = [reordenado[target], reordenado[index]];
    this.heroSlides = reordenado;
    this.renderHeroList();

    try {
      const res = await fetch('/api/admin/hero-slides/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify({ ordered_ids: reordenado.map(s => s.id) })
      });
      if (!res.ok) throw new Error('No se pudo guardar el nuevo orden.');
      await this.loadHeroTab();
      await App.fetchHeroSlides();
    } catch (e) {
      App.showToast(e.message, 'error');
      this.loadHeroTab();
    }
  },

  async deleteHeroSlide(slideId) {
    if (!confirm('Eliminar esta foto del carrusel?\n\nEsta accion no se puede deshacer.')) return;

    try {
      const res = await fetch(`/api/admin/hero-slides/${slideId}`, {
        method: 'DELETE', headers: Auth.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar.');

      if (this.editingSlideId === slideId) this.cancelHeroEdit();
      await this.loadHeroTab();
      await App.fetchHeroSlides();
      App.showToast(data.message, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  // ------------------------------------------------------------------
  // CATEGORIAS DE LA PORTADA (las tres tarjetas grandes del inicio)
  // ------------------------------------------------------------------

  categories: [],

  async loadCategoriesTab() {
    try {
      const res = await fetch('/api/admin/categories', { headers: Auth.getAuthHeaders() });
      if (!res.ok) throw new Error('No se pudieron cargar las categorias.');
      this.categories = await res.json();
      this.renderCategoriesList();
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  renderCategoriesList() {
    const cont = document.getElementById('admin-categories-list');
    if (!cont) return;

    cont.innerHTML = this.categories.map(c => {
      const img = (c.image_url || '').trim();
      return `
        <div class="p-4 rounded-2xl border border-[#e4dccb] bg-[#FAF8F5] space-y-3">
          <div class="flex items-start gap-4">
            <div class="relative flex-shrink-0">
              <img id="cat-preview-${c.id}" src="${img || Admin.PLACEHOLDER_IMG}"
                   onerror="this.src='${Admin.PLACEHOLDER_IMG}'"
                   class="w-24 h-28 object-cover rounded-xl border border-gray-200 shadow-sm bg-white" alt="" />
              ${img ? `<button type="button" onclick="Admin.removeCategoryImage(${c.id})" title="Quitar esta imagen"
                        class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow hover:bg-red-700">&times;</button>` : ''}
            </div>

            <div class="flex-1 min-w-0 space-y-2 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label class="block font-semibold text-coffee mb-1">Nombre de la categoria</label>
                  <input type="text" id="cat-name-${c.id}" value="${(c.name || '').replace(/"/g, '&quot;')}"
                    class="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#4D0E12]" />
                </div>
                <div>
                  <label class="block font-semibold text-coffee mb-1">Antetitulo (texto pequeno de arriba)</label>
                  <input type="text" id="cat-tagline-${c.id}" value="${(c.tagline || '').replace(/"/g, '&quot;')}"
                    placeholder="ej. Boutique" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#4D0E12]" />
                </div>
              </div>

              <div>
                <label class="block font-semibold text-coffee mb-1">Descripcion</label>
                <textarea id="cat-desc-${c.id}" rows="2"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#4D0E12]">${(c.description || '').replace(/</g, '&lt;')}</textarea>
              </div>

              <div>
                <label class="block font-semibold text-coffee mb-1">URL de la imagen (vacio = sin foto)</label>
                <input type="text" id="cat-image-${c.id}" value="${(img).replace(/"/g, '&quot;')}"
                  oninput="Admin.previewCategoryImage(${c.id})" placeholder="https://... o /uploads/..."
                  class="w-full p-2 border border-gray-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-[#4D0E12]" />
              </div>

              <div class="flex items-center justify-between gap-2 flex-wrap pt-1">
                <label class="btn-sand px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5">
                  <i data-lucide="upload" class="w-3.5 h-3.5"></i> Subir Foto
                  <input type="file" accept="image/*" class="hidden" onchange="Admin.handleCategoryImageUpload(${c.id}, this)" />
                </label>
                <div class="flex items-center gap-2">
                  <button type="button" onclick="Admin.deleteCategory(${c.id})" title="Eliminar esta categoria por completo"
                    class="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-red-200 text-red-600 hover:bg-red-50 transition-colors inline-flex items-center gap-1.5">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar
                  </button>
                  <button type="button" onclick="Admin.saveCategory(${c.id})"
                    class="btn-primary px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider shadow">
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  previewCategoryImage(categoryId) {
    const url = document.getElementById(`cat-image-${categoryId}`)?.value.trim();
    const preview = document.getElementById(`cat-preview-${categoryId}`);
    if (preview) preview.src = url || Admin.PLACEHOLDER_IMG;
  },

  removeCategoryImage(categoryId) {
    const input = document.getElementById(`cat-image-${categoryId}`);
    if (input) input.value = '';
    this.previewCategoryImage(categoryId);
    this.saveCategory(categoryId);
  },

  async handleCategoryImageUpload(categoryId, input) {
    if (!input.files || input.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);

    try {
      App.showToast('Subiendo la imagen de la categoria...', 'info');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: formData
      });
      if (!res.ok) throw new Error('No se pudo subir la imagen.');
      const data = await res.json();

      const field = document.getElementById(`cat-image-${categoryId}`);
      if (field) field.value = data.url;
      this.previewCategoryImage(categoryId);
      await this.saveCategory(categoryId);
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  async saveCategory(categoryId) {
    const payload = {
      name: document.getElementById(`cat-name-${categoryId}`)?.value.trim(),
      tagline: document.getElementById(`cat-tagline-${categoryId}`)?.value.trim(),
      description: document.getElementById(`cat-desc-${categoryId}`)?.value.trim(),
      image_url: document.getElementById(`cat-image-${categoryId}`)?.value.trim()
    };

    if (!payload.name) {
      App.showToast('La categoria debe tener un nombre.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo guardar la categoria.');

      const idx = this.categories.findIndex(c => c.id === categoryId);
      if (idx !== -1) this.categories[idx] = data;
      this.renderCategoriesList();

      await App.fetchCategories();
      App.showToast(`Categoria "${data.name}" actualizada.`, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  async handleCreateCategory(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('new-cat-name').value.trim(),
      tagline: document.getElementById('new-cat-tagline').value.trim(),
      description: document.getElementById('new-cat-desc').value.trim(),
      image_url: ''
    };
    if (!payload.name) {
      App.showToast('La categoria necesita un nombre.', 'error');
      return;
    }

    try {
      App.showToast('Creando la categoria...', 'info');
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo crear la categoria.');

      e.target.reset();
      await this.loadCategoriesTab();
      await App.fetchCategories();
      App.showToast(`Categoria "${data.name}" creada.`, 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async deleteCategory(categoryId) {
    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) return;

    if (!confirm(
      `Eliminar la categoria "${cat.name}"?\n\n` +
      'Sus productos NO se borran: quedan sin categoria y los puedes reasignar. ' +
      'La tarjeta desaparece de la portada. Esta accion no se puede deshacer.'
    )) return;

    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE', headers: Auth.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar la categoria.');

      await this.loadCategoriesTab();
      await App.fetchCategories();
      await App.fetchProducts();
      App.showToast(data.message, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  async clearCategoryImages() {
    if (!confirm(
      'Quitar la foto de todas las categorias?\n\n' +
      'Los nombres y descripciones se conservan: solo se borran las imagenes ' +
      'para que puedas subir las tuyas.'
    )) return;

    try {
      App.showToast('Vaciando las imagenes de las categorias...', 'info');
      const res = await fetch('/api/admin/categories/clear-images', {
        method: 'POST',
        headers: Auth.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudieron quitar las imagenes.');

      await this.loadCategoriesTab();
      await App.fetchCategories();
      App.showToast(data.message, 'success');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  },

  async handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('product-form-id').value;
    const name = document.getElementById('prod-form-name').value.trim();
    const description = document.getElementById('prod-form-desc').value.trim();
    const price_cop = parseFloat(document.getElementById('prod-form-price').value);
    const category_id = parseInt(document.getElementById('prod-form-category').value);
    const stock = parseInt(document.getElementById('prod-form-stock').value);
    const imagesStr = document.getElementById('prod-form-images').value.trim();
    const featured = document.getElementById('prod-form-featured').checked;
    const is_new = document.getElementById('prod-form-new').checked;

    const images = imagesStr.split('\n').map(s => s.trim()).filter(Boolean);

    const payload = {
      name,
      description,
      price_cop,
      category_id,
      sizes: ["S", "M", "L"],
      colors: [
        { name: "Vinotinto", hex: "#4D0E12" },
        { name: "Azul Cielo", hex: "#A5BCD6" },
        { name: "Arena Suave", hex: "#F5EFC6" }
      ],
      // Se respeta la lista tal cual: un producto puede quedarse sin imagenes.
      images,
      stock,
      featured,
      is_new
    };

    try {
      const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al guardar el producto');

      App.showToast(id ? '¡Producto actualizado con éxito!' : '¡Nuevo producto creado!', 'success');
      this.closeProductModal();
      await this.loadProducts();
      App.fetchProducts();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async deleteProduct(productId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto del catálogo?')) return;

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: Auth.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al eliminar producto');

      App.showToast('Producto eliminado del catálogo.', 'info');
      await this.loadProducts();
      App.fetchProducts();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify({ order_status: newStatus })
      });
      if (!res.ok) throw new Error('Error actualizando estado');

      App.showToast(`Orden #${orderId} actualizada a "${newStatus}"`, 'success');
      await this.loadOrders();
      await this.loadStats();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async handleImageUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      App.showToast('Subiendo imagen del producto...', 'info');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: formData
      });
      if (!res.ok) throw new Error('Error subiendo imagen');
      const data = await res.json();
      
      const imagesArea = document.getElementById('prod-form-images');
      if (imagesArea) {
        imagesArea.value = (imagesArea.value ? imagesArea.value + '\n' : '') + data.url;
        this.renderProductImages();
      }
      App.showToast('¡Imagen subida exitosamente!', 'success');
    } catch (e) {
      App.showToast('Error al subir el archivo.', 'error');
    }
  }
};
