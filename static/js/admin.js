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

  async quickAdminLogin() {
    App.showToast('Iniciando sesión como Administrador...', 'info');
    const success = await Auth.login('admin@alicebrand.com', 'admin123');
    if (success) {
      this.init();
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    const tabs = ['stats', 'products', 'orders', 'brand', 'gateway'];

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
          <img src="${p.images[0] || 'https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=100'}" class="w-12 h-14 object-cover rounded-lg shadow-sm border border-gray-200" />
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
    document.getElementById('prod-form-images').value = 'https://images.unsplash.com/photo-1576426863848-c21f53c60b19?auto=format&fit=crop&w=1000&q=85';
    document.getElementById('prod-form-featured').checked = false;
    document.getElementById('prod-form-new').checked = true;

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

    const modal = document.getElementById('admin-product-modal');
    if (modal) modal.classList.add('active');
  },

  closeProductModal() {
    const modal = document.getElementById('admin-product-modal');
    if (modal) modal.classList.remove('active');
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
      images: images.length ? images : ['https://images.unsplash.com/photo-1576426863848-c21f53c60b19?auto=format&fit=crop&w=1000&q=85'],
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
      }
      App.showToast('¡Imagen subida exitosamente!', 'success');
    } catch (e) {
      App.showToast('Error al subir el archivo.', 'error');
    }
  }
};
