// ============================================
// NAVBAR - Componente dinámico
// ============================================

class MabelNavbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    background: white;
                    box-shadow: 0 2px 20px rgba(0,0,0,0.05);
                    transition: all 0.3s ease;
                }
                
                :host(.scrolled) {
                    background: rgba(255,255,255,0.95);
                    backdrop-filter: blur(10px);
                }
                
                .top-bar {
                    background: #000;
                    color: white;
                    padding: 10px 0;
                    font-size: 11px;
                    text-align: center;
                    letter-spacing: 1px;
                }
                
                .top-bar-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .top-bar-text {
                    flex: 1;
                    text-align: center;
                }
                
                .top-bar-links {
                    display: flex;
                    gap: 20px;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                
                .top-bar-links a {
                    color: white;
                    text-decoration: none;
                    font-size: 11px;
                    opacity: 0.8;
                    transition: opacity 0.3s;
                }
                
                .top-bar-links a:hover {
                    opacity: 1;
                }
                
                .main-header {
                    padding: 20px 0;
                }
                
                .header-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                /* Logo */
                .logo {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    text-decoration: none;
                    color: black;
                }
                
                .logo-icon {
                    width: 40px;
                    height: 40px;
                    background: black;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                }
                
                .logo-text {
                    display: flex;
                    flex-direction: column;
                }
                
                .logo-main {
                    font-size: 24px;
                    font-weight: 300;
                    letter-spacing: 2px;
                    line-height: 1;
                }
                
                .logo-sub {
                    font-size: 9px;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    opacity: 0.6;
                    margin-top: 2px;
                }
                
                /* Navegación principal */
                .main-nav {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                }
                
                .nav-menu {
                    display: flex;
                    gap: 40px;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                
                .nav-menu a {
                    color: black;
                    text-decoration: none;
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    padding: 10px 0;
                    position: relative;
                    transition: color 0.3s;
                }
                
                .nav-menu a:hover,
                .nav-menu a.active {
                    color: #666;
                }
                
                .nav-menu a::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 0;
                    height: 1px;
                    background: black;
                    transition: width 0.3s;
                }
                
                .nav-menu a:hover::after,
                .nav-menu a.active::after {
                    width: 100%;
                }
                
                /* Iconos */
                .header-icons {
                    display: flex;
                    gap: 25px;
                    align-items: center;
                }
                
                .icon-link {
                    color: black;
                    text-decoration: none;
                    font-size: 16px;
                    position: relative;
                    transition: color 0.3s;
                }
                
                .icon-link:hover {
                    color: #666;
                }
                
                .cart-count {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: black;
                    color: white;
                    font-size: 10px;
                    min-width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    display: none;
                }
                
                /* Búsqueda */
                .search-overlay {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    padding: 30px 40px;
                    border-top: 1px solid #eee;
                    display: none;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                
                .search-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                
                .search-input {
                    flex: 1;
                    padding: 15px 0;
                    border: none;
                    outline: none;
                    font-size: 16px;
                    color: black;
                    background: transparent;
                }
                
                .search-input::placeholder {
                    color: #999;
                }
                
                .search-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #999;
                    cursor: pointer;
                    padding: 5px;
                }
                
                .search-close:hover {
                    color: black;
                }
                
                /* Mobile menu */
                .mobile-toggle {
                    display: none;
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: black;
                    cursor: pointer;
                    padding: 10px;
                }
                
                /* Responsive */
                @media (max-width: 1024px) {
                    .nav-menu {
                        gap: 20px;
                    }
                    
                    .header-container {
                        padding: 0 20px;
                    }
                }
                
                @media (max-width: 768px) {
                    .mobile-toggle {
                        display: block;
                    }
                    
                    .main-nav {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: white;
                        flex-direction: column;
                        justify-content: center;
                        transform: translateX(-100%);
                        transition: transform 0.3s ease;
                        z-index: 1001;
                    }
                    
                    .main-nav.active {
                        transform: translateX(0);
                    }
                    
                    .nav-menu {
                        flex-direction: column;
                        align-items: center;
                        gap: 30px;
                    }
                    
                    .nav-menu a {
                        font-size: 18px;
                    }
                    
                    .header-container {
                        padding: 15px 20px;
                    }
                    
                    .top-bar {
                        font-size: 10px;
                    }
                    
                    .top-bar-content {
                        padding: 0 20px;
                        flex-direction: column;
                        gap: 5px;
                    }
                    
                    .top-bar-links {
                        gap: 15px;
                    }
                }
            </style>
            
            <!-- Top Bar -->
            <div class="top-bar">
                <div class="top-bar-content">
                    <div class="top-bar-text">
                        ENVÍO GRATIS EN PEDIDOS SUPERIORES A $50
                    </div>
                    <ul class="top-bar-links">
                        <li><a href="/envios">Envíos</a></li>
                        <li><a href="/devoluciones">Devoluciones</a></li>
                        <li><a href="/contacto">Contacto</a></li>
                    </ul>
                </div>
            </div>
            
            <!-- Header Principal -->
            <header class="main-header">
                <div class="header-container">
                    <!-- Logo -->
                    <a href="/" class="logo">
                        <div class="logo-icon">M</div>
                        <div class="logo-text">
                            <span class="logo-main">MABEL</span>
                            <span class="logo-sub">ACTIVEWEAR</span>
                        </div>
                    </a>
                    
                    <!-- Botón móvil -->
                    <button class="mobile-toggle" id="mobileToggle">
                        <i class="fas fa-bars"></i>
                    </button>
                    
                    <!-- Navegación -->
                    <nav class="main-nav" id="mainNav">
                        <ul class="nav-menu">
                            <li><a href="/shop" class="active">NOVEDADES</a></li>
                            <li><a href="/shop?category=leggings">LEGGINGS</a></li>
                            <li><a href="/shop?category=tops">TOPS</a></li>
                            <li><a href="/shop?category=sets">SETS</a></li>
                            <li><a href="/shop?category=accesorios">ACCESORIOS</a></li>
                            <li><a href="/ofertas">OFERTAS</a></li>
                        </ul>
                    </nav>
                    
                    <!-- Iconos -->
                    <div class="header-icons">
                        <a href="/account" class="icon-link" title="Mi Cuenta">
                            <i class="fas fa-user"></i>
                        </a>
                        <a href="#" class="icon-link" id="searchToggle" title="Buscar">
                            <i class="fas fa-search"></i>
                        </a>
                        <a href="/cart" class="icon-link" title="Carrito">
                            <i class="fas fa-shopping-bag"></i>
                            <span class="cart-count">0</span>
                        </a>
                    </div>
                </div>
                
                <!-- Overlay de búsqueda -->
                <div class="search-overlay" id="searchOverlay">
                    <div class="search-container">
                        <input type="text" 
                               class="search-input" 
                               id="searchInput" 
                               placeholder="¿Qué estás buscando?">
                        <button class="search-close" id="searchClose">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </header>
        `;
    }

    setupEventListeners() {
        // Toggle móvil
        const mobileToggle = this.shadowRoot.getElementById('mobileToggle');
        const mainNav = this.shadowRoot.getElementById('mainNav');
        
        if (mobileToggle && mainNav) {
            mobileToggle.addEventListener('click', () => {
                mainNav.classList.toggle('active');
                const icon = mobileToggle.querySelector('i');
                if (mainNav.classList.contains('active')) {
                    icon.className = 'fas fa-times';
                } else {
                    icon.className = 'fas fa-bars';
                }
            });
        }
        
        // Búsqueda
        const searchToggle = this.shadowRoot.getElementById('searchToggle');
        const searchOverlay = this.shadowRoot.getElementById('searchOverlay');
        const searchClose = this.shadowRoot.getElementById('searchClose');
        const searchInput = this.shadowRoot.getElementById('searchInput');
        
        if (searchToggle && searchOverlay) {
            searchToggle.addEventListener('click', (e) => {
                e.preventDefault();
                searchOverlay.style.display = 'block';
                setTimeout(() => {
                    searchOverlay.style.opacity = '1';
                    if (searchInput) searchInput.focus();
                }, 10);
            });
            
            searchClose.addEventListener('click', () => {
                searchOverlay.style.opacity = '0';
                setTimeout(() => {
                    searchOverlay.style.display = 'none';
                }, 300);
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        window.location.href = `/shop?search=${encodeURIComponent(query)}`;
                    }
                }
            });
        }
        
        // Scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                this.classList.add('scrolled');
            } else {
                this.classList.remove('scrolled');
            }
        });
        
        // Actualizar contador del carrito
        this.updateCartCount();
        
        // Escuchar actualizaciones del carrito
        document.addEventListener('cartUpdated', () => {
            this.updateCartCount();
        });
    }
    
    updateCartCount() {
        const cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        const cartCount = this.shadowRoot.querySelector('.cart-count');
        if (cartCount) {
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }
}


// Definir custom element
customElements.define('mabel-navbar', MabelFooter);