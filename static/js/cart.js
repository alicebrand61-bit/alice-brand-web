// Cart Module for Alice Brand
const Cart = {
  items: JSON.parse(localStorage.getItem('ab_cart') || '[]'),
  FREE_SHIPPING_THRESHOLD: 200000.0, // $200.000 COP
  STANDARD_SHIPPING_COST: 15000.0, // $15.000 COP
  appliedCoupon: null,

  init() {
    this.render();
    this.updateBadge();
  },

  formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' COP';
  },

  addItem(product, size = 'M', color = null, quantity = 1) {
    const colorObj = color || (product.colors && product.colors.length ? product.colors[0] : { name: 'Estándar', hex: '#4D6E12' });
    const existingIndex = this.items.findIndex(
      item => item.id === product.id && item.selectedSize === size && item.selectedColor.name === colorObj.name
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price_cop: product.price_cop,
        image: product.images && product.images.length ? product.images[0] : '',
        selectedSize: size,
        selectedColor: colorObj,
        quantity: quantity,
        maxStock: product.stock || 99
      });
    }

    this.save();
    this.render();
    this.updateBadge();
    this.openDrawer();
    App.showToast(`¡"${product.name}" añadido a tu bolsa!`, 'success');
  },

  removeItem(index) {
    if (this.items[index]) {
      const removed = this.items.splice(index, 1)[0];
      this.save();
      this.render();
      this.updateBadge();
      App.showToast(`Eliminaste "${removed.name}" de la bolsa.`, 'info');
    }
  },

  updateQuantity(index, newQty) {
    if (this.items[index]) {
      if (newQty <= 0) {
        this.removeItem(index);
      } else {
        this.items[index].quantity = Math.min(newQty, this.items[index].maxStock || 99);
        this.save();
        this.render();
        this.updateBadge();
      }
    }
  },

  clear() {
    this.items = [];
    this.appliedCoupon = null;
    this.save();
    this.render();
    this.updateBadge();
  },

  save() {
    localStorage.setItem('ab_cart', JSON.stringify(this.items));
  },

  getTotals() {
    const subtotal = this.items.reduce((sum, item) => sum + (item.price_cop * item.quantity), 0);
    const shipping = subtotal >= this.FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : this.STANDARD_SHIPPING_COST;
    
    let discount = 0;
    if (this.appliedCoupon) {
      if (this.appliedCoupon.type === 'percent') {
        discount = subtotal * (this.appliedCoupon.value / 100);
      } else {
        discount = this.appliedCoupon.value;
      }
    }

    const total = Math.max(0, subtotal + shipping - discount);

    return {
      subtotal,
      shipping,
      discount,
      total,
      itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0)
    };
  },

  applyCoupon(code) {
    const clean = code.trim().toUpperCase();
    if (clean === 'ALICE10') {
      this.appliedCoupon = { code: clean, type: 'percent', value: 10, label: '10% OFF Bienvenida' };
      App.showToast('¡Cupón del 10% aplicado correctamente!', 'success');
    } else if (clean === 'VERANO20') {
      this.appliedCoupon = { code: clean, type: 'percent', value: 20, label: '20% OFF Colección Caribe' };
      App.showToast('¡Cupón del 20% aplicado correctamente!', 'success');
    } else {
      App.showToast('El código promocional no es válido.', 'error');
      return false;
    }
    this.render();
    return true;
  },

  removeCoupon() {
    this.appliedCoupon = null;
    this.render();
  },

  updateBadge() {
    const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
    const badges = document.querySelectorAll('.cart-badge-count');
    badges.forEach(b => {
      b.textContent = count;
      b.classList.toggle('hidden', count === 0);
    });
  },

  openDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const panel = document.getElementById('cart-drawer-panel');
    if (backdrop && panel) {
      backdrop.classList.add('active');
      panel.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const panel = document.getElementById('cart-drawer-panel');
    if (backdrop && panel) {
      backdrop.classList.remove('active');
      panel.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  render() {
    const container = document.getElementById('cart-items-container');
    const emptyState = document.getElementById('cart-empty-state');
    const footer = document.getElementById('cart-drawer-footer');
    const totals = this.getTotals();

    if (!container) return;

    if (this.items.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (footer) footer.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (footer) footer.classList.remove('hidden');

    // Free shipping progress bar
    const freeShippingProgress = document.getElementById('free-shipping-progress');
    const freeShippingText = document.getElementById('free-shipping-text');
    if (freeShippingProgress && freeShippingText) {
      const percentage = Math.min(100, (totals.subtotal / this.FREE_SHIPPING_THRESHOLD) * 100);
      freeShippingProgress.style.width = `${percentage}%`;
      
      if (totals.subtotal >= this.FREE_SHIPPING_THRESHOLD) {
        freeShippingText.innerHTML = `<span class="text-olive-700 font-semibold flex items-center gap-1">✨ ¡Tienes ENVÍO GRATIS a todo Colombia!</span>`;
      } else {
        const remaining = this.FREE_SHIPPING_THRESHOLD - totals.subtotal;
        freeShippingText.innerHTML = `Agrega <strong>${this.formatCOP(remaining)}</strong> más para obtener <strong>Envío Gratis</strong>`;
      }
    }

    // Render items
    container.innerHTML = this.items.map((item, idx) => `
      <div class="flex gap-4 p-4 border-b border-[#ece6d8] hover:bg-[#FAF8F5]/80 transition-colors">
        <img src="${item.image}" alt="${item.name}" class="w-20 h-24 object-cover rounded-lg bg-sand/30 border border-[#e4dccb]" />
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start">
              <h4 class="font-serif font-semibold text-dark text-base leading-tight">${item.name}</h4>
              <button onclick="Cart.removeItem(${idx})" class="text-gray-400 hover:text-red-600 transition-colors p-1" title="Eliminar">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
            <div class="flex items-center gap-2 mt-1 text-xs text-coffee/80">
              <span class="bg-[#F5EFC6] px-2 py-0.5 rounded font-medium text-coffee">Talla: ${item.selectedSize}</span>
              <span class="flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full border border-gray-300" style="background-color: ${item.selectedColor.hex}"></span>
                ${item.selectedColor.name}
              </span>
            </div>
          </div>

          <div class="flex justify-between items-center mt-2">
            <div class="flex items-center border border-[#d6cbba] rounded-md bg-white">
              <button onclick="Cart.updateQuantity(${idx}, ${item.quantity - 1})" class="px-2.5 py-1 text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium">−</button>
              <span class="px-3 py-1 text-xs font-semibold text-dark">${item.quantity}</span>
              <button onclick="Cart.updateQuantity(${idx}, ${item.quantity + 1})" class="px-2.5 py-1 text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium">+</button>
            </div>
            <div class="text-right">
              <span class="font-serif font-bold text-olive-800 text-sm">${this.formatCOP(item.price_cop * item.quantity)}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Update Totals elements
    const subtotalEl = document.getElementById('cart-subtotal');
    const shippingEl = document.getElementById('cart-shipping');
    const discountRow = document.getElementById('cart-discount-row');
    const discountEl = document.getElementById('cart-discount');
    const totalEl = document.getElementById('cart-total');

    if (subtotalEl) subtotalEl.textContent = this.formatCOP(totals.subtotal);
    if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? '¡GRATIS!' : this.formatCOP(totals.shipping);
    
    if (discountRow && discountEl) {
      if (totals.discount > 0) {
        discountRow.classList.remove('hidden');
        discountEl.textContent = `-${this.formatCOP(totals.discount)}`;
      } else {
        discountRow.classList.add('hidden');
      }
    }

    if (totalEl) totalEl.textContent = this.formatCOP(totals.total);

    if (window.lucide) lucide.createIcons();
  }
};
