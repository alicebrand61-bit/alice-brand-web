// Checkout & Colombian Payment Gateway Module for Alice Brand
const Checkout = {
  banks: [],
  currentOrder: null,
  currentTransaction: null,

  colombiaLocations: {
    "Antioquia": ["Medellín", "Envigado", "Rionegro", "Sabaneta", "Itagüí", "Bello", "Guarne", "La Ceja"],
    "Bogotá D.C.": ["Bogotá D.C."],
    "Atlántico": ["Barranquilla", "Puerto Colombia", "Soledad"],
    "Bolívar": ["Cartagena de Indias", "Turbaco", "Magangué"],
    "Valle del Cauca": ["Cali", "Palmira", "Buga", "Cartago", "Jamundí"],
    "Magdalena": ["Santa Marta", "Ciénaga", "El Rodadero"],
    "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "San Gil"],
    "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal"],
    "Caldas": ["Manizales", "Villamaría", "Chinchiná"],
    "Quindío": ["Armenia", "Circasia", "Salento", "Montenegro"],
    "Cundinamarca": ["Chía", "Cajicá", "Zipaquirá", "Facatativá", "Soacha"],
    "San Andrés y Providencia": ["San Andrés", "Providencia"]
  },

  async init() {
    this.populateDepartments();
    await this.loadBanks();
  },

  async loadBanks() {
    try {
      const res = await fetch('/api/payments/pse/banks');
      if (res.ok) {
        this.banks = await res.json();
        this.renderBankSelector();
      }
    } catch (e) {
      console.error("Error loading PSE banks", e);
    }
  },

  populateDepartments() {
    const deptSelect = document.getElementById('checkout-department');
    if (!deptSelect) return;

    deptSelect.innerHTML = '<option value="">Selecciona un departamento</option>' + 
      Object.keys(this.colombiaLocations).map(dept => `<option value="${dept}">${dept}</option>`).join('');

    deptSelect.addEventListener('change', (e) => {
      this.populateCities(e.target.value);
    });
  },

  populateCities(department) {
    const citySelect = document.getElementById('checkout-city');
    if (!citySelect) return;

    if (!department || !this.colombiaLocations[department]) {
      citySelect.innerHTML = '<option value="">Primero elige un departamento</option>';
      citySelect.disabled = true;
      return;
    }

    const cities = this.colombiaLocations[department];
    citySelect.disabled = false;
    citySelect.innerHTML = '<option value="">Selecciona una ciudad</option>' + 
      cities.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  renderBankSelector() {
    const select = document.getElementById('checkout-pse-bank');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecciona tu entidad financiera --</option>' + 
      this.banks.map(b => `<option value="${b.code}">${b.name}</option>`).join('');
  },

  openModal() {
    if (Cart.items.length === 0) {
      App.showToast('Tu bolsa de compras está vacía.', 'warning');
      return;
    }

    Cart.closeDrawer();
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.renderSummary();
      this.prefillUserData();
    }
  },

  closeModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  prefillUserData() {
    if (Auth.user) {
      const nameInput = document.getElementById('checkout-name');
      const emailInput = document.getElementById('checkout-email');
      const phoneInput = document.getElementById('checkout-phone');

      if (nameInput && !nameInput.value) nameInput.value = Auth.user.full_name || '';
      if (emailInput && !emailInput.value) emailInput.value = Auth.user.email || '';
      if (phoneInput && !phoneInput.value) phoneInput.value = Auth.user.phone || '';
    }
  },

  renderSummary() {
    const totals = Cart.getTotals();
    const listEl = document.getElementById('checkout-summary-items');
    const subtotalEl = document.getElementById('checkout-summary-subtotal');
    const shippingEl = document.getElementById('checkout-summary-shipping');
    const discountEl = document.getElementById('checkout-summary-discount');
    const totalEl = document.getElementById('checkout-summary-total');

    if (listEl) {
      listEl.innerHTML = Cart.items.map(item => `
        <div class="flex items-center justify-between text-xs py-2 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <img src="${item.image}" class="w-8 h-10 object-cover rounded" />
            <div>
              <p class="font-medium text-dark line-clamp-1">${item.name}</p>
              <p class="text-gray-500">Talla: ${item.selectedSize} · Cant: ${item.quantity}</p>
            </div>
          </div>
          <span class="font-semibold text-coffee">${Cart.formatCOP(item.price_cop * item.quantity)}</span>
        </div>
      `).join('');
    }

    if (subtotalEl) subtotalEl.textContent = Cart.formatCOP(totals.subtotal);
    if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'GRATIS' : Cart.formatCOP(totals.shipping);
    if (discountEl) discountEl.textContent = totals.discount > 0 ? `-${Cart.formatCOP(totals.discount)}` : '$0 COP';
    if (totalEl) totalEl.textContent = Cart.formatCOP(totals.total);
  },

  async handleCheckoutSubmit(e) {
    e.preventDefault();
    const totals = Cart.getTotals();

    const name = document.getElementById('checkout-name').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const department = document.getElementById('checkout-department').value;
    const city = document.getElementById('checkout-city').value;
    const address = document.getElementById('checkout-address').value.trim();
    const details = document.getElementById('checkout-details').value.trim();
    const bankCode = document.getElementById('checkout-pse-bank').value;
    const docType = document.getElementById('checkout-doc-type').value;
    const docNum = document.getElementById('checkout-doc-num').value.trim();
    const notes = document.getElementById('checkout-notes').value.trim();

    if (!department || !city || !address || !bankCode || !docNum) {
      App.showToast('Por favor completa todos los campos requeridos para la orden y el pago PSE.', 'warning');
      return;
    }

    const orderPayload = {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      department: department,
      city: city,
      address: address,
      address_details: details,
      items: Cart.items.map(item => ({
        product_id: item.id,
        product_name: item.name,
        product_image: item.image,
        size: item.selectedSize,
        color: item.selectedColor.name,
        quantity: item.quantity,
        unit_price_cop: item.price_cop
      })),
      subtotal_cop: totals.subtotal,
      shipping_cop: totals.shipping,
      discount_cop: totals.discount,
      total_cop: totals.total,
      payment_method: 'PSE / Wompi',
      pse_bank: bankCode,
      notes: notes
    };

    try {
      App.showToast('Registrando orden en el sistema...', 'info');

      // 1. Create order in Database
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Auth.getAuthHeaders()
        },
        body: JSON.stringify(orderPayload)
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.detail || 'Error creando la orden');
      }

      const orderData = await orderRes.json();
      this.currentOrder = orderData;

      // 2. Initiate PSE payment session with Colombian banks
      const pseRes = await fetch('/api/payments/pse/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: orderData.order_number,
          bank_code: bankCode,
          person_type: 'NATURAL',
          document_type: docType,
          document_number: docNum,
          payer_name: name,
          payer_email: email,
          payer_phone: phone
        })
      });

      if (!pseRes.ok) throw new Error('Error al conectar con la pasarela bancaria');

      const pseData = await pseRes.json();
      this.currentTransaction = pseData;

      // 3. Open Banking Gateway Verification Modal
      this.closeModal();
      this.openPseSimulatorModal(pseData, orderData);

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  openPseSimulatorModal(pseData, orderData) {
    const simModal = document.getElementById('pse-simulator-modal');
    if (!simModal) return;

    document.getElementById('sim-bank-name').textContent = pseData.bank_name;
    document.getElementById('sim-order-number').textContent = orderData.order_number;
    document.getElementById('sim-amount').textContent = Cart.formatCOP(orderData.total_cop);
    document.getElementById('sim-tx-id').textContent = pseData.transaction_id;
    document.getElementById('sim-customer-email').textContent = pseData.payer_email;

    simModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closePseSimulatorModal() {
    const simModal = document.getElementById('pse-simulator-modal');
    if (simModal) {
      simModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  async processSimulatorPayment(action) {
    if (!this.currentTransaction) return;

    try {
      const res = await fetch('/api/payments/pse/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: this.currentTransaction.transaction_id,
          action: action
        })
      });

      const data = await res.json();
      this.closePseSimulatorModal();

      if (action === 'APPROVE') {
        App.showToast('¡Pago aprobado por la entidad bancaria con éxito!', 'success');
        Cart.clear();
        this.openOrderSuccessModal(this.currentOrder, data.authorization_code);
      } else {
        App.showToast('La transacción bancaria fue cancelada o rechazada.', 'warning');
      }
    } catch (e) {
      App.showToast('Error procesando respuesta del banco.', 'error');
    }
  },

  openOrderSuccessModal(order, authCode) {
    const modal = document.getElementById('order-success-modal');
    if (!modal) return;

    document.getElementById('success-order-num').textContent = order.order_number;
    document.getElementById('success-total').textContent = Cart.formatCOP(order.total_cop);
    document.getElementById('success-bank').textContent = this.currentTransaction?.bank_name || 'PSE / Wompi';
    document.getElementById('success-auth-code').textContent = authCode || 'AUTH-OK-2026';
    document.getElementById('success-address').textContent = `${order.address}, ${order.city} - ${order.department}`;

    const waText = encodeURIComponent(`¡Hola Alice Brand! Acabo de realizar el pedido *#${order.order_number}* por un total de *${Cart.formatCOP(order.total_cop)}* mediante PSE/Bancolombia. ¿Podrían confirmarme el despacho? Muchas gracias.`);
    const waBtn = document.getElementById('success-wa-btn');
    if (waBtn) {
      waBtn.href = `https://wa.me/573023949733?text=${waText}`;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeOrderSuccessModal() {
    const modal = document.getElementById('order-success-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
};
