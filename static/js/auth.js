// Auth Module for Alice Brand
const Auth = {
  token: localStorage.getItem('ab_token') || null,
  user: JSON.parse(localStorage.getItem('ab_user') || 'null'),

  init() {
    this.updateUI();
    if (this.token && !this.user) {
      this.fetchMe();
    }
    this.initRealGoogleGSI();
  },

  initRealGoogleGSI() {
    // Initialize Real Google Identity Services (GSI) if Client ID is configured
    setTimeout(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        const clientId = App.settings && App.settings.google_client_id ? App.settings.google_client_id : '';
        if (clientId && !clientId.includes('sample')) {
          try {
            google.accounts.id.initialize({
              client_id: clientId,
              callback: this.handleGoogleCredentialResponse.bind(this),
              auto_select: false
            });

            const btnContainer = document.getElementById('gsi-official-button');
            if (btnContainer) {
              google.accounts.id.renderButton(btnContainer, {
                theme: 'outline',
                size: 'large',
                width: 320,
                text: 'continue_with',
                shape: 'pill'
              });
            }
          } catch (e) {
            console.warn("GSI Initialization note:", e);
          }
        }
      }
    }, 1000);
  },

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;

    try {
      App.showToast('Verificando credenciales oficiales de Google...', 'info');
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          email: '',
          full_name: ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al autenticar con Google');

      this.setSession(data.access_token, data.user);
      App.showToast(`¡Bienvenida ${data.user.full_name}! Conectada con Google.`, 'success');
      this.closeGoogleModal();
      this.closeModal();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  isAuthenticated() {
    return !!this.token;
  },

  isAdmin() {
    return this.user && this.user.role === 'admin';
  },

  getAuthHeaders() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  },

  async fetchMe() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        this.user = await res.json();
        localStorage.setItem('ab_user', JSON.stringify(this.user));
        this.updateUI();
      } else {
        this.logout();
      }
    } catch (e) {
      console.error("Error fetching user session", e);
    }
  },

  async login(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al iniciar sesión');
      }
      this.setSession(data.access_token, data.user);
      App.showToast(`¡Bienvenido de nuevo, ${data.user.full_name}!`, 'success');
      this.closeModal();
      return true;
    } catch (err) {
      App.showToast(err.message, 'error');
      return false;
    }
  },

  async register(fullName, email, phone, password) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, phone, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al registrar la cuenta');
      }
      this.setSession(data.access_token, data.user);
      App.showToast(`¡Cuenta creada con éxito! Bienvenida a Alice Brand.`, 'success');
      this.closeModal();
      return true;
    } catch (err) {
      App.showToast(err.message, 'error');
      return false;
    }
  },

  async requestPhoneOtp(phone) {
    try {
      const res = await fetch('/api/auth/phone-otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error solicitando código OTP');
      
      App.showToast(data.message, 'success');
      App.showToast('Revisa los mensajes SMS en tu celular e ingresa el código.', 'info');
      return true;
    } catch (err) {
      App.showToast(err.message, 'error');
      return false;
    }
  },


  async verifyPhoneOtp(phone, code, fullName) {
    try {
      const res = await fetch('/api/auth/phone-otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, full_name: fullName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Código inválido o expirado');
      
      this.setSession(data.access_token, data.user);
      App.showToast(`¡Sesión iniciada con celular (+57)!`, 'success');
      this.closeModal();
      return true;
    } catch (err) {
      App.showToast(err.message, 'error');
      return false;
    }
  },

  openGoogleModal() {
    this.closeModal();
    const gModal = document.getElementById('google-auth-modal');
    if (gModal) {
      gModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeGoogleModal() {
    const gModal = document.getElementById('google-auth-modal');
    if (gModal) {
      gModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  async loginWithGoogle(email = 'camila.restrepo@gmail.com', fullName = 'Camila Restrepo') {
    try {
      App.showToast('Conectando con servidores de Google...', 'info');
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error en autenticación de Google');
      
      this.setSession(data.access_token, data.user);
      App.showToast(`¡Conectado exitosamente con Google (${email})!`, 'success');
      this.closeGoogleModal();
      this.closeModal();
      return true;
    } catch (err) {
      App.showToast(err.message, 'error');
      return false;
    }
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('ab_token', token);
    localStorage.setItem('ab_user', JSON.stringify(user));
    this.updateUI();
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('ab_token');
    localStorage.removeItem('ab_user');
    this.updateUI();
    App.showToast('Has cerrado sesión.', 'info');
    if (App.currentView === 'admin') {
      App.navigate('home');
    }
  },

  openModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.switchTab(tab);
    }
  },

  closeModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  switchTab(tab) {
    const loginForm = document.getElementById('auth-tab-login');
    const registerForm = document.getElementById('auth-tab-register');
    const phoneForm = document.getElementById('auth-tab-phone');
    const tabBtns = document.querySelectorAll('.auth-tab-btn');

    tabBtns.forEach(btn => {
      btn.classList.remove('border-[#4D0E12]', 'text-[#4D0E12]', 'font-semibold');
      btn.classList.add('text-gray-500');
      if (btn.dataset.tab === tab) {
        btn.classList.add('border-[#4D0E12]', 'text-[#4D0E12]', 'font-semibold');
        btn.classList.remove('text-gray-500');
      }
    });

    if (loginForm) loginForm.classList.toggle('hidden', tab !== 'login');
    if (registerForm) registerForm.classList.toggle('hidden', tab !== 'register');
    if (phoneForm) phoneForm.classList.toggle('hidden', tab !== 'phone');
  },

  updateUI() {
    const userBtn = document.getElementById('nav-user-btn');
    const userText = document.getElementById('nav-user-name');
    const adminLink = document.getElementById('nav-admin-link');
    const userBadge = document.getElementById('user-profile-badge');

    if (this.user) {
      // Se muestra el nombre real del cliente en vez de la palabra "Cliente".
      const fullName = (this.user.full_name || '').trim();
      if (userText) {
        // Primer nombre para no ensanchar el encabezado; el completo va en el
        // tooltip y el usuario sigue viendo su nombre, no la palabra "Cliente".
        userText.textContent = fullName ? fullName.split(' ')[0] : 'Mi cuenta';
        userText.title = fullName;
      }
      if (userBadge) {
        // El distintivo solo marca al administrador; el cliente ya ve su nombre.
        const esAdmin = this.user.role === 'admin';
        userBadge.textContent = esAdmin ? '👑 Admin' : '';
        userBadge.classList.toggle('hidden', !esAdmin);
      }
      // El acceso al panel solo se ofrece al administrador, y unicamente
      // desde el encabezado (se quito del pie de pagina).
      if (adminLink) adminLink.classList.toggle('hidden', this.user.role !== 'admin');
    } else {
      if (userText) userText.textContent = 'Ingresar';
      if (userBadge) userBadge.classList.add('hidden');
      if (adminLink) adminLink.classList.add('hidden');
    }
  }
};
