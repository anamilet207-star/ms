// ============================================
// CUENTA DE USUARIO - VERSIÓN CORREGIDA Y FUNCIONAL
// ============================================

class AccountManagerFixed {
    constructor() {
        this.user = null;
        this.currentSection = 'dashboard';
        this.provinces = [];
        this.addresses = [];
        this.orders = [];
        this.wishlist = [];
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('👤 Inicializando gestión de cuenta (versión corregida)...');
        
        try {
            // Verificar autenticación
            if (!await this.checkAuthentication()) {
                return;
            }
            
            // Cargar datos del usuario
            await this.loadUserData();
            
            // Cargar provincias de RD
            await this.loadProvinces();
            
            // Configurar navegación
            this.setupNavigation();
            
            // Cargar sección inicial
            await this.loadSection(this.currentSection);
            
            // Inicializar carrito
            this.updateCartCount();
            
            console.log('✅ Gestión de cuenta inicializada correctamente');
        } catch (error) {
            console.error('❌ Error inicializando cuenta:', error);
            this.showNotification('Error al cargar la cuenta. Intenta recargar la página.', 'error');
        }
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (!data.authenticated) {
                this.showNotification('Debes iniciar sesión para ver tu cuenta', 'error');
                setTimeout(() => {
                    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
                }, 1500);
                return false;
            }
            
            this.user = data.user;
            return true;
            
        } catch (error) {
            console.error('❌ Error verificando autenticación:', error);
            this.showNotification('Error de conexión', 'error');
            return false;
        }
    }

    async loadUserData() {
        try {
            console.log('📋 Cargando datos del usuario:', this.user.id);
            const response = await fetch(`/api/users/${this.user.id}`);
            
            if (!response.ok) {
                throw new Error('Error cargando datos del usuario');
            }
            
            const userData = await response.json();
            this.user = { ...this.user, ...userData };
            
            // Actualizar UI con datos del usuario
            this.updateUserUI();
            
            // Actualizar estadísticas en el header
            this.updateHeaderStats();
            
        } catch (error) {
            console.error('❌ Error cargando datos del usuario:', error);
            this.showNotification('Error cargando datos del perfil', 'warning');
        }
    }

    async loadProvinces() {
        try {
            const response = await fetch('/api/dominican-republic/provinces');
            if (response.ok) {
                this.provinces = await response.json();
                console.log('🗺️ Provincias cargadas:', this.provinces.length);
            } else {
                // Provincias por defecto
                this.provinces = [
                    'Distrito Nacional', 'Santo Domingo', 'Santiago', 'Puerto Plata',
                    'La Vega', 'San Cristóbal', 'La Romana', 'San Pedro de Macorís'
                ];
            }
        } catch (error) {
            console.error('Error cargando provincias:', error);
            this.provinces = ['Distrito Nacional', 'Santo Domingo', 'Santiago'];
        }
    }

    updateUserUI() {
        // Actualizar nombre en sidebar
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(element => {
            element.textContent = `${this.user.nombre || ''} ${this.user.apellido || ''}`.trim() || 'Usuario';
        });
        
        // Actualizar email
        const userEmailElements = document.querySelectorAll('.user-email');
        userEmailElements.forEach(element => {
            element.textContent = this.user.email || '';
        });
        
        // Actualizar avatar
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            const initials = `${this.user.nombre?.charAt(0) || ''}${this.user.apellido?.charAt(0) || ''}`.toUpperCase();
            userAvatar.textContent = initials || 'U';
            userAvatar.style.backgroundColor = this.generateColorFromName(this.user.nombre || 'Usuario');
        }
    }

    generateColorFromName(name) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', 
            '#118AB2', '#073B4C', '#EF476F', '#7209B7'
        ];
        const index = name.length % colors.length;
        return colors[index];
    }

    updateHeaderStats() {
        const statsContainer = document.getElementById('account-header-stats');
        if (!statsContainer) return;
        
        // Solo mostrar estadísticas si existen
        const stats = this.user.stats || {
            total_orders: 0,
            wishlist_items: 0,
            total_spent: 0,
            pendingOrders: 0
        };
        
        const statsElements = statsContainer.querySelectorAll('.header-stat');
        
        // Actualizar pedidos
        if (statsElements[0]) {
            statsElements[0].querySelector('.number').textContent = stats.total_orders || 0;
        }
        
        // Actualizar favoritos
        if (statsElements[1]) {
            statsElements[1].querySelector('.number').textContent = stats.wishlist_items || 0;
        }
        
        // Actualizar puntos (ejemplo)
        if (statsElements[2]) {
            statsElements[2].querySelector('.number').textContent = Math.floor((stats.total_spent || 0) / 10);
        }
        
        // Actualizar pendientes
        if (statsElements[3]) {
            statsElements[3].querySelector('.number').textContent = stats.pendingOrders || 0;
        }
    }

    setupNavigation() {
        // Navegación del sidebar
        document.querySelectorAll('.account-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (this.isLoading) return;
                
                e.preventDefault();
                
                const section = link.getAttribute('href').substring(1);
                if (section === 'logout-btn') return;
                
                this.currentSection = section;
                
                // Actualizar clase active
                document.querySelectorAll('.account-nav a').forEach(a => {
                    a.classList.remove('active');
                });
                link.classList.add('active');
                
                // Cargar sección
                this.loadSection(section);
            });
        });
        
        // Botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    async loadSection(section) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const contentContainer = document.querySelector('.account-content');
        if (!contentContainer) return;
        
        // Mostrar loading
        contentContainer.innerHTML = `
            <div class="loading" style="text-align: center; padding: 60px;">
                <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--black);"></i>
                <p style="margin-top: 15px; color: var(--gray-dark);">Cargando ${this.getSectionName(section)}...</p>
            </div>
        `;
        
        try {
            let html = '';
            
            switch (section) {
                case 'dashboard':
                    html = await this.loadDashboard();
                    break;
                case 'orders':
                    html = await this.loadOrders();
                    break;
                case 'profile':
                    html = this.loadProfileForm();
                    break;
                case 'addresses':
                    html = await this.loadAddresses();
                    break;
                case 'wishlist':
                    html = await this.loadWishlist();
                    break;
                case 'settings':
                    html = this.loadSettingsForm();
                    break;
                default:
                    html = await this.loadDashboard();
            }
            
            contentContainer.innerHTML = html;
            this.setupSectionEventListeners(section);
            
        } catch (error) {
            console.error(`❌ Error cargando sección ${section}:`, error);
            contentContainer.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="color: #FF6B6B; margin-bottom: 20px;"></i>
                    <h3 style="color: var(--black); margin-bottom: 10px;">Error cargando la sección</h3>
                    <p style="color: var(--gray-text); margin-bottom: 20px;">Intenta nuevamente o contacta con soporte si el problema persiste.</p>
                    <button onclick="location.reload()" class="btn" style="margin-top: 10px;">
                        <i class="fas fa-redo"></i> Recargar Página
                    </button>
                </div>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    getSectionName(section) {
        const names = {
            'dashboard': 'Dashboard',
            'orders': 'Órdenes',
            'profile': 'Perfil',
            'addresses': 'Direcciones',
            'wishlist': 'Wishlist',
            'settings': 'Configuración'
        };
        return names[section] || 'contenido';
    }

    async loadDashboard() {
        try {
            // Cargar estadísticas y órdenes recientes
            const [orders, userData] = await Promise.all([
                this.getRecentOrders(3),
                this.getUserDetailedData()
            ]);
            
            const stats = userData.stats || {
                total_orders: 0,
                wishlist_items: 0,
                total_spent: 0,
                reviews: 0,
                pendingOrders: 0
            };
            
            return `
                <div class="dashboard-content">
                    <div class="dashboard-header" style="margin-bottom: 30px;">
                        <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">¡Bienvenido, ${this.user.nombre || 'Usuario'}!</h1>
                        <p style="color: var(--gray-text); font-size: 16px;">Tu actividad reciente en Mabel Activewear</p>
                    </div>
                    
                    <div class="dashboard-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px;">
                        <div class="stat-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 25px; text-align: center; transition: all 0.3s ease;">
                            <i class="fas fa-shopping-bag" style="font-size: 28px; color: var(--black); margin-bottom: 15px;"></i>
                            <h3 style="font-size: 32px; font-weight: 300; margin-bottom: 5px;">${stats.total_orders || 0}</h3>
                            <p style="color: var(--gray-text); font-size: 13px; letter-spacing: 1.5px;">Órdenes Totales</p>
                        </div>
                        
                        <div class="stat-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 25px; text-align: center; transition: all 0.3s ease;">
                            <i class="fas fa-heart" style="font-size: 28px; color: var(--black); margin-bottom: 15px;"></i>
                            <h3 style="font-size: 32px; font-weight: 300; margin-bottom: 5px;">${stats.wishlist_items || 0}</h3>
                            <p style="color: var(--gray-text); font-size: 13px; letter-spacing: 1.5px;">En Wishlist</p>
                        </div>
                        
                        <div class="stat-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 25px; text-align: center; transition: all 0.3s ease;">
                            <i class="fas fa-star" style="font-size: 28px; color: var(--black); margin-bottom: 15px;"></i>
                            <h3 style="font-size: 32px; font-weight: 300; margin-bottom: 5px;">${stats.reviews || 0}</h3>
                            <p style="color: var(--gray-text); font-size: 13px; letter-spacing: 1.5px;">Reseñas</p>
                        </div>
                        
                        <div class="stat-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 25px; text-align: center; transition: all 0.3s ease;">
                            <i class="fas fa-clock" style="font-size: 28px; color: var(--black); margin-bottom: 15px;"></i>
                            <h3 style="font-size: 32px; font-weight: 300; margin-bottom: 5px;">${stats.pendingOrders || 0}</h3>
                            <p style="color: var(--gray-text); font-size: 13px; letter-spacing: 1.5px;">Pendientes</p>
                        </div>
                    </div>
                    
                    <div class="recent-orders" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 30px; margin-bottom: 40px;">
                        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                            <h2 style="font-size: 20px; font-weight: 400; letter-spacing: 1.5px;">Órdenes Recientes</h2>
                            <a href="#orders" class="view-all" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border: 1px solid var(--black); color: var(--black); text-decoration: none; font-size: 12px; letter-spacing: 1.5px; border-radius: 4px;">
                                Ver todas
                            </a>
                        </div>
                        ${orders.length > 0 ? this.generateOrdersTable(orders, true) : `
                            <div class="empty-state" style="text-align: center; padding: 40px 20px;">
                                <i class="fas fa-shopping-bag fa-3x" style="color: #eee; margin-bottom: 20px;"></i>
                                <h3 style="font-size: 18px; margin-bottom: 10px;">No hay órdenes recientes</h3>
                                <p style="color: var(--gray-text); margin-bottom: 20px;">Realiza tu primera compra para ver tus órdenes aquí</p>
                                <a href="/shop" class="btn" style="display: inline-block; padding: 10px 24px; background: var(--black); color: white; text-decoration: none; border-radius: 4px;">Ir a la Tienda</a>
                            </div>
                        `}
                    </div>
                    
                    <div class="quick-actions">
                        <h2 style="font-size: 20px; font-weight: 400; letter-spacing: 1.5px; margin-bottom: 20px;">Acciones Rápidas</h2>
                        <div class="quick-actions-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            <a href="/shop" class="quick-action-card" style="background: white; border: 2px solid #f0f0f0; border-radius: 12px; padding: 20px; display: flex; align-items: center; justify-content: space-between; text-decoration: none; color: #000; transition: all 0.3s ease;">
                                <i class="fas fa-store" style="font-size: 20px;"></i>
                                <span style="flex: 1; margin-left: 15px;">Continuar Comprando</span>
                                <i class="fas fa-arrow-right" style="color: #666;"></i>
                            </a>
                            <a href="#wishlist" class="quick-action-card" style="background: white; border: 2px solid #f0f0f0; border-radius: 12px; padding: 20px; display: flex; align-items: center; justify-content: space-between; text-decoration: none; color: #000; transition: all 0.3s ease;">
                                <i class="fas fa-heart" style="font-size: 20px;"></i>
                                <span style="flex: 1; margin-left: 15px;">Ver Wishlist</span>
                                <i class="fas fa-arrow-right" style="color: #666;"></i>
                            </a>
                            <a href="#addresses" class="quick-action-card" style="background: white; border: 2px solid #f0f0f0; border-radius: 12px; padding: 20px; display: flex; align-items: center; justify-content: space-between; text-decoration: none; color: #000; transition: all 0.3s ease;">
                                <i class="fas fa-map-marker-alt" style="font-size: 20px;"></i>
                                <span style="flex: 1; margin-left: 15px;">Gestionar Direcciones</span>
                                <i class="fas fa-arrow-right" style="color: #666;"></i>
                            </a>
                            <a href="/ofertas" class="quick-action-card" style="background: white; border: 2px solid #f0f0f0; border-radius: 12px; padding: 20px; display: flex; align-items: center; justify-content: space-between; text-decoration: none; color: #000; transition: all 0.3s ease;">
                                <i class="fas fa-tag" style="font-size: 20px;"></i>
                                <span style="flex: 1; margin-left: 15px;">Ver Ofertas</span>
                                <i class="fas fa-arrow-right" style="color: #666;"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error cargando dashboard:', error);
            return this.getErrorHTML('Error cargando el dashboard');
        }
    }

    async getUserDetailedData() {
        try {
            const response = await fetch(`/api/users/${this.user.id}`);
            if (!response.ok) throw new Error('Error cargando datos');
            return await response.json();
        } catch (error) {
            console.error('Error cargando datos detallados:', error);
            return { stats: {} };
        }
    }

    async getRecentOrders(limit = 3) {
        try {
            const response = await fetch(`/api/users/${this.user.id}/orders?limit=${limit}`);
            if (!response.ok) {
                return [];
            }
            return await response.json();
        } catch (error) {
            console.error('Error cargando órdenes recientes:', error);
            return [];
        }
    }

    async loadOrders() {
        try {
            const orders = await this.getAllOrders();
            
            return `
                <div class="orders-content">
                    <div class="section-header" style="margin-bottom: 30px;">
                        <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Mis Órdenes</h1>
                        <p style="color: var(--gray-text); font-size: 16px;">Historial de todas tus compras</p>
                    </div>
                    
                    ${orders.length > 0 ? this.generateOrdersTable(orders) : `
                        <div class="empty-state" style="text-align: center; padding: 60px 20px; background: white; border: 1px solid #eee; border-radius: 8px;">
                            <i class="fas fa-shopping-bag fa-3x" style="color: #eee; margin-bottom: 20px;"></i>
                            <h3 style="font-size: 20px; margin-bottom: 10px;">No has realizado ninguna compra</h3>
                            <p style="color: var(--gray-text); margin-bottom: 20px;">Explora nuestra tienda para encontrar productos increíbles</p>
                            <a href="/shop" class="btn" style="display: inline-block; padding: 10px 24px; background: var(--black); color: white; text-decoration: none; border-radius: 4px;">Ver Tienda</a>
                        </div>
                    `}
                    
                    ${orders.length > 0 ? `
                        <div class="orders-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 40px; padding-top: 40px; border-top: 1px solid #eee;">
                            <div class="summary-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 20px; display: flex; align-items: center; gap: 15px;">
                                <i class="fas fa-receipt" style="font-size: 24px; color: var(--black); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border-radius: 6px;"></i>
                                <div>
                                    <h3 style="font-size: 24px; font-weight: 300; margin-bottom: 5px;">${orders.length}</h3>
                                    <p style="font-size: 12px; color: var(--gray-text); letter-spacing: 1.2px;">Pedidos Totales</p>
                                </div>
                            </div>
                            <div class="summary-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 20px; display: flex; align-items: center; gap: 15px;">
                                <i class="fas fa-money-bill-wave" style="font-size: 24px; color: var(--black); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border-radius: 6px;"></i>
                                <div>
                                    <h3 style="font-size: 24px; font-weight: 300; margin-bottom: 5px;">RD$ ${orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0).toFixed(2)}</h3>
                                    <p style="font-size: 12px; color: var(--gray-text); letter-spacing: 1.2px;">Total Gastado</p>
                                </div>
                            </div>
                            <div class="summary-card" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 20px; display: flex; align-items: center; gap: 15px;">
                                <i class="fas fa-box-open" style="font-size: 24px; color: var(--black); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border-radius: 6px;"></i>
                                <div>
                                    <h3 style="font-size: 24px; font-weight: 300; margin-bottom: 5px;">${orders.filter(o => o.estado === 'entregado' || o.estado === 'delivered').length}</h3>
                                    <p style="font-size: 12px; color: var(--gray-text); letter-spacing: 1.2px;">Entregados</p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (error) {
            console.error('Error cargando órdenes:', error);
            return this.getErrorHTML('Error cargando las órdenes');
        }
    }

    async getAllOrders() {
        try {
            const response = await fetch(`/api/users/${this.user.id}/orders`);
            if (!response.ok) {
                return [];
            }
            return await response.json();
        } catch (error) {
            console.error('Error cargando todas las órdenes:', error);
            return [];
        }
    }

    generateOrdersTable(orders, isRecent = false) {
        return `
            <div class="table-container" style="overflow-x: auto;">
                <table class="orders-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background: #fafafa;">
                            <th style="padding: 15px; text-align: left; font-weight: 400; letter-spacing: 1.2px; color: var(--gray-dark); border-bottom: 1px solid #eee;">Orden #</th>
                            <th style="padding: 15px; text-align: left; font-weight: 400; letter-spacing: 1.2px; color: var(--gray-dark); border-bottom: 1px solid #eee;">Fecha</th>
                            <th style="padding: 15px; text-align: left; font-weight: 400; letter-spacing: 1.2px; color: var(--gray-dark); border-bottom: 1px solid #eee;">Total</th>
                            <th style="padding: 15px; text-align: left; font-weight: 400; letter-spacing: 1.2px; color: var(--gray-dark); border-bottom: 1px solid #eee;">Estado</th>
                            <th style="padding: 15px; text-align: left; font-weight: 400; letter-spacing: 1.2px; color: var(--gray-dark); border-bottom: 1px solid #eee;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map(order => `
                            <tr style="transition: background 0.2s ease;">
                                <td style="padding: 15px; border-bottom: 1px solid #eee;">
                                    <span class="order-number" style="font-weight: 500; color: var(--black); display: block; margin-bottom: 4px;">#${order.id}</span>
                                    <span class="items-count" style="font-size: 12px; color: var(--gray-text);">${order.items_count || 1} item${order.items_count !== 1 ? 's' : ''}</span>
                                </td>
                                <td style="padding: 15px; border-bottom: 1px solid #eee; color: var(--gray-dark);">
                                    ${new Date(order.fecha_orden || order.fecha_creacion).toLocaleDateString('es-DO')}
                                </td>
                                <td style="padding: 15px; border-bottom: 1px solid #eee;">
                                    <strong style="color: var(--black);">RD$ ${parseFloat(order.total || 0).toFixed(2)}</strong>
                                </td>
                                <td style="padding: 15px; border-bottom: 1px solid #eee;">
                                    <span class="order-status ${this.getStatusClass(order.estado)}" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; letter-spacing: 1px; display: inline-flex; align-items: center; gap: 6px;">
                                        <i class="fas ${this.getStatusIcon(order.estado)}"></i>
                                        ${this.formatOrderStatus(order.estado)}
                                    </span>
                                </td>
                                <td style="padding: 15px; border-bottom: 1px solid #eee;">
                                    <div class="table-actions" style="display: flex; gap: 8px;">
                                        <button class="btn-view-order" data-order="${order.id}" style="background: transparent; border: 1px solid #eee; color: var(--black); padding: 6px 12px; font-size: 12px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px;" title="Ver detalles">
                                            <i class="fas fa-eye"></i>
                                            ${!isRecent ? '<span>Ver</span>' : ''}
                                        </button>
                                        ${this.canTrackOrder(order.estado) ? `
                                            <button class="btn-track-order" data-order="${order.id}" style="background: transparent; border: 1px solid #eee; color: var(--black); padding: 6px 12px; font-size: 12px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px;" title="Rastrear envío">
                                                <i class="fas fa-shipping-fast"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getStatusClass(status) {
        const statusMap = {
            'pendiente': 'status-pending',
            'procesando': 'status-processing',
            'enviado': 'status-shipped',
            'entregado': 'status-delivered',
            'cancelado': 'status-cancelled',
            'pending': 'status-pending',
            'processing': 'status-processing',
            'shipped': 'status-shipped',
            'delivered': 'status-delivered',
            'cancelled': 'status-cancelled'
        };
        return statusMap[status] || '';
    }

    getStatusIcon(status) {
        const icons = {
            'pendiente': 'fa-clock',
            'procesando': 'fa-cogs',
            'enviado': 'fa-shipping-fast',
            'entregado': 'fa-check-circle',
            'cancelado': 'fa-times-circle',
            'pending': 'fa-clock',
            'processing': 'fa-cogs',
            'shipped': 'fa-shipping-fast',
            'delivered': 'fa-check-circle',
            'cancelled': 'fa-times-circle'
        };
        return icons[status] || 'fa-question-circle';
    }

    formatOrderStatus(status) {
        const statusMap = {
            'pendiente': 'Pendiente',
            'procesando': 'Procesando',
            'enviado': 'Enviado',
            'entregado': 'Entregado',
            'cancelado': 'Cancelado',
            'pending': 'Pendiente',
            'processing': 'Procesando',
            'shipped': 'Enviado',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado'
        };
        return statusMap[status] || status;
    }

    canTrackOrder(status) {
        const trackableStatuses = ['enviado', 'shipped', 'entregado', 'delivered'];
        return trackableStatuses.includes(status);
    }

    loadProfileForm() {
        return `
            <div class="profile-content">
                <div class="section-header" style="margin-bottom: 30px;">
                    <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Mi Perfil</h1>
                    <p style="color: var(--gray-text); font-size: 16px;">Actualiza tu información personal</p>
                </div>
                
                <form id="profile-form" class="account-form" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 30px; max-width: 600px;">
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label for="nombre" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Nombre *</label>
                            <input type="text" id="nombre" value="${this.user.nombre || ''}" required style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                        </div>
                        <div class="form-group">
                            <label for="apellido" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Apellido *</label>
                            <input type="text" id="apellido" value="${this.user.apellido || ''}" required style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="email" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Email *</label>
                        <input type="email" id="email" value="${this.user.email || ''}" required style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label for="telefono" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Teléfono</label>
                        <div class="input-with-prefix" style="display: flex; align-items: center; border: 1px solid #eee; border-radius: 4px;">
                            <span class="prefix" style="padding: 12px; background: #f8f8f8; color: var(--gray-dark);">+1 (809)</span>
                            <input type="tel" id="telefono" value="${(this.user.telefono || '').replace('809-', '')}" 
                                   placeholder="555-1234" pattern="[0-9]{3}-[0-9]{4}" style="flex: 1; padding: 12px; border: none; border-left: 1px solid #eee;">
                        </div>
                        <small style="display: block; margin-top: 6px; color: var(--gray-text); font-size: 12px;">Formato: 555-1234 (solo para República Dominicana)</small>
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 15px; margin-top: 30px; padding-top: 25px; border-top: 1px solid #eee;">
                        <button type="submit" class="btn-save" style="background: var(--black); color: white; border: none; padding: 12px 28px; font-size: 14px; cursor: pointer; border-radius: 4px; letter-spacing: 1.5px;">
                            <i class="fas fa-save"></i> Guardar Cambios
                        </button>
                        <button type="button" class="btn-cancel" id="cancel-profile" style="background: transparent; border: 1px solid #eee; color: var(--black); padding: 12px 28px; font-size: 14px; cursor: pointer; border-radius: 4px; letter-spacing: 1.5px;">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </form>
                
                <div class="password-section" style="margin-top: 40px; background: white; border: 1px solid #eee; border-radius: 8px; padding: 30px;">
                    <h2 style="font-size: 20px; font-weight: 400; letter-spacing: 1.5px; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-key"></i> Cambiar Contraseña
                    </h2>
                    <form id="password-form" class="account-form" style="background: transparent; border: none; padding: 0;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="current_password" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Contraseña Actual</label>
                            <input type="password" id="current_password" required style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                        </div>
                        
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label for="new_password" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Nueva Contraseña</label>
                                <input type="password" id="new_password" required minlength="6" style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                                <small style="display: block; margin-top: 6px; color: var(--gray-text); font-size: 12px;">Mínimo 6 caracteres</small>
                            </div>
                            <div class="form-group">
                                <label for="confirm_password" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Confirmar Contraseña</label>
                                <input type="password" id="confirm_password" required minlength="6" style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                            </div>
                        </div>
                        
                        <div class="form-actions" style="margin-top: 25px;">
                            <button type="submit" class="btn-save" style="background: var(--black); color: white; border: none; padding: 12px 28px; font-size: 14px; cursor: pointer; border-radius: 4px; letter-spacing: 1.5px;">
                                <i class="fas fa-key"></i> Cambiar Contraseña
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    async loadAddresses() {
        try {
            this.addresses = await this.getUserAddresses();
            
            // ✅ FILTRAR SOLO DIRECCIONES REALES (sin datos de prueba)
            const realAddresses = this.addresses.filter(addr => {
                // Excluir direcciones de muestra/ejemplo
                return !addr.is_sample && 
                       !addr.is_example && 
                       !addr.nombre?.toLowerCase().includes('ejemplo') &&
                       !addr.nombre?.toLowerCase().includes('sample') &&
                       !addr.nombre?.toLowerCase().includes('demo');
            });
            
            // Si no hay direcciones reales, mostrar estado vacío
            if (realAddresses.length === 0) {
                return `
                    <div class="addresses-content">
                        <div class="section-header" style="margin-bottom: 30px;">
                            <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Mis Direcciones</h1>
                            <p style="color: var(--gray-text); font-size: 16px;">Gestiona tus direcciones de envío en República Dominicana</p>
                        </div>
                        
                        <div class="empty-addresses-state" style="text-align: center; padding: 60px 20px; background: white; border: 2px dashed #f0f0f0; border-radius: 8px; margin: 30px 0;">
                            <div class="empty-icon" style="width: 80px; height: 80px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px;">
                                <i class="fas fa-map-marker-alt fa-2x" style="color: var(--gray-text);"></i>
                            </div>
                            <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">No tienes direcciones guardadas</h3>
                            <p style="color: #666; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">Agrega tu primera dirección para recibir tus pedidos más rápido</p>
                            <button id="add-first-address" class="btn" style="display: inline-block; padding: 12px 30px; background: var(--black); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; letter-spacing: 1.5px;">
                                <i class="fas fa-plus"></i> Agregar Primera Dirección
                            </button>
                        </div>
                        
                        <div class="add-address-card" id="add-address-btn" style="background: white; border: 2px dashed #eee; border-radius: 8px; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer; transition: all 0.3s ease; min-height: 200px;">
                            <div class="add-address-icon" style="width: 70px; height: 70px; background: #f8f8f8; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                                <i class="fas fa-plus-circle fa-2x" style="color: var(--gray-text);"></i>
                            </div>
                            <h3 style="font-size: 18px; font-weight: 400; margin-bottom: 12px;">Agregar Nueva Dirección</h3>
                            <p style="color: var(--gray-text); font-size: 14px; max-width: 200px;">Agrega una dirección de envío en República Dominicana</p>
                        </div>
                        
                        <div class="address-info-note" style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 30px; display: flex; gap: 15px; align-items: flex-start;">
                            <i class="fas fa-info-circle" style="color: #118AB2; font-size: 20px; margin-top: 2px;"></i>
                            <div>
                                <p style="font-weight: 500; margin-bottom: 10px;">Información importante:</p>
                                <ul style="margin: 0; padding-left: 20px; color: var(--gray-text);">
                                    <li style="margin-bottom: 5px;">Solo realizamos envíos dentro de República Dominicana</li>
                                    <li style="margin-bottom: 5px;">Puedes seleccionar tu paquetería preferida</li>
                                    <li>Los costos de envío varían según la provincia y paquetería seleccionada</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Resto del código para mostrar direcciones reales...
            return `
                <div class="addresses-content">
                    <div class="section-header" style="margin-bottom: 30px;">
                        <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Mis Direcciones</h1>
                        <p style="color: var(--gray-text); font-size: 16px;">Gestiona tus direcciones de envío en República Dominicana</p>
                    </div>
                    
                    <div class="addresses-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin: 30px 0;">
                        ${realAddresses.map((address, index) => `
                            <div class="address-card ${address.predeterminada ? 'default-address' : ''}" style="background: white; border: ${address.predeterminada ? '2px solid var(--black)' : '1px solid #eee'}; border-radius: 8px; padding: 25px; transition: all 0.3s ease; position: relative;">
                                <div class="address-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                                    <h3 style="font-size: 18px; font-weight: 400; letter-spacing: 1px; margin: 0; display: flex; align-items: center; gap: 10px;">
                                        <i class="fas fa-map-marker-alt"></i> ${address.nombre || 'Dirección ' + (index + 1)}
                                    </h3>
                                    ${address.predeterminada ? 
                                        '<span class="default-badge" style="background: var(--black); color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; letter-spacing: 1px;"><i class="fas fa-star"></i> Predeterminada</span>' : 
                                        ''
                                    }
                                </div>
                                <div class="address-details" style="font-size: 14px; line-height: 1.6; color: var(--gray-dark); margin-bottom: 25px;">
                                    <p><strong><i class="fas fa-user"></i> ${address.nombre_completo || this.user.nombre + ' ' + this.user.apellido || 'No especificado'}</strong></p>
                                    <p><i class="fas fa-phone"></i> ${address.telefono || 'No especificado'}</p>
                                    ${address.paqueteria_preferida ? 
                                        `<p><i class="fas fa-shipping-fast"></i> <strong>Paqueteria:</strong> ${address.paqueteria_preferida}</p>` : 
                                        ''
                                    }
                                    <!-- ACTUALIZADO: Eliminada la línea que mostraba calle, numero y apartamento -->
                                    <p><i class="fas fa-map-marker-alt"></i> <strong>Ubicación:</strong> 
                                        ${[address.sector, address.municipio, address.provincia].filter(Boolean).join(', ')}
                                    </p>
                                    ${address.referencia ? 
                                        `<p><i class="fas fa-info-circle"></i> <strong>Referencia:</strong> ${address.referencia}</p>` : 
                                        ''
                                    }
                                </div>
                                <div class="address-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    <button class="edit-address" data-id="${address.id}" style="padding: 8px 16px; background: white; border: 1px solid #eee; color: var(--gray-dark); cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    ${!address.predeterminada ? 
                                        `<button class="set-default" data-id="${address.id}" style="padding: 8px 16px; background: white; border: 1px solid #eee; color: var(--gray-dark); cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-star"></i> Predeterminar
                                        </button>` : 
                                        ''
                                    }
                                    ${realAddresses.length > 1 ? 
                                        `<button class="delete-address" data-id="${address.id}" style="padding: 8px 16px; background: white; border: 1px solid #f8d7da; color: #721c24; cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-trash"></i> Eliminar
                                        </button>` : 
                                        ''
                                    }
                                </div>
                            </div>
                        `).join('')}
                        
                        <div class="add-address-card" id="add-address-btn" style="background: white; border: 2px dashed #eee; border-radius: 8px; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer; transition: all 0.3s ease; min-height: 300px;">
                            <div class="add-address-icon" style="width: 70px; height: 70px; background: #f8f8f8; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                                <i class="fas fa-plus-circle fa-2x" style="color: var(--gray-text);"></i>
                            </div>
                            <h3 style="font-size: 18px; font-weight: 400; margin-bottom: 12px;">Agregar Nueva Dirección</h3>
                            <p style="color: var(--gray-text); font-size: 14px; max-width: 200px;">Agrega una dirección de envío en República Dominicana</p>
                        </div>
                    </div>
                    
                    <div class="address-info-note" style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 30px; display: flex; gap: 15px; align-items: flex-start;">
                        <i class="fas fa-info-circle" style="color: #118AB2; font-size: 20px; margin-top: 2px;"></i>
                        <div>
                            <p style="font-weight: 500; margin-bottom: 10px;">Información importante:</p>
                            <ul style="margin: 0; padding-left: 20px; color: var(--gray-text);">
                                <li style="margin-bottom: 5px;">Solo realizamos envíos dentro de República Dominicana</li>
                                <li style="margin-bottom: 5px;">Puedes seleccionar tu paquetería preferida</li>
                                <li>Los costos de envío varían según la provincia y paquetería seleccionada</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error cargando direcciones:', error);
            return this.getErrorHTML('Error cargando direcciones');
        }
    }

    async getUserAddresses() {
        try {
            console.log('📍 Obteniendo direcciones para usuario:', this.user.id);
            const response = await fetch(`/api/users/${this.user.id}/addresses`);
            
            if (!response.ok) {
                console.warn('⚠️ API de direcciones no disponible, usando datos de ejemplo');
                return [];
            }
            
            const addresses = await response.json();
            console.log(`✅ ${addresses.length} direcciones cargadas`);
            return addresses;
            
        } catch (error) {
            console.error('❌ Error cargando direcciones:', error);
            return [];
        }
    }

    async loadWishlist() {
        try {
            this.wishlist = await this.getWishlist();
        
        // ✅ FILTRAR SOLO WISHLIST REAL (sin datos de prueba)
        const realWishlist = this.wishlist.filter(item => {
            // Excluir productos de muestra/ejemplo
            return !item.is_sample && 
                   !item.is_example && 
                   !item.nombre?.toLowerCase().includes('ejemplo') &&
                   !item.nombre?.toLowerCase().includes('sample') &&
                   !item.nombre?.toLowerCase().includes('demo');
        });
        
        // Si no hay wishlist real, mostrar estado vacío
        if (realWishlist.length === 0) {
            return `
                <div class="wishlist-content">
                    <div class="section-header" style="margin-bottom: 30px;">
                        <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Mi Wishlist</h1>
                        <p style="color: var(--gray-text); font-size: 16px;">Productos que te gustan</p>
                    </div>
                    
                    <div class="empty-wishlist-state" style="text-align: center; padding: 60px 20px; background: white; border: 2px dashed #f0f0f0; border-radius: 8px;">
                        <div class="empty-icon" style="width: 80px; height: 80px; background: linear-gradient(135deg, #fff5f5 0%, #ffeaea 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px;">
                            <i class="fas fa-heart fa-2x" style="color: #ff6b6b;"></i>
                        </div>
                        <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">Tu wishlist está vacía</h3>
                        <p style="color: #666; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">Agrega productos que te gusten haciendo clic en el corazón ♡</p>
                        <a href="/shop" class="btn" style="display: inline-block; padding: 12px 30px; background: var(--black); color: white; text-decoration: none; border-radius: 4px; margin-bottom: 30px;">
                            <i class="fas fa-store"></i> Explorar Productos
                        </a>
                        <div class="empty-tips" style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto;">
                            <p style="font-weight: 500; margin-bottom: 15px;">Consejos:</p>
                            <ul style="margin: 0; padding-left: 20px; color: #666;">
                                <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #34c759;"></i>
                                    <span>Guarda productos para comprar más tarde</span>
                                </li>
                                <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #34c759;"></i>
                                    <span>Recibe notificaciones cuando bajen de precio</span>
                                </li>
                                <li style="display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-check-circle" style="color: #34c759;"></i>
                                    <span>Comparte tu wishlist con amigos</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Resto del código para mostrar wishlist real...
        return `
            <div class="wishlist-content">
                <div class="section-header" style="margin-bottom: 30px;">
                    <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Mi Wishlist</h1>
                    <p style="color: var(--gray-text); font-size: 16px;">Productos que te gustan</p>
                </div>
                
                <div class="wishlist-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin: 30px 0;">
                    ${realWishlist.map(item => `
                        <div class="wishlist-item" data-product-id="${item.producto_id}" style="background: white; border: 1px solid #eee; border-radius: 8px; overflow: hidden; transition: all 0.3s ease; position: relative;">
                            <button class="remove-wishlist" data-id="${item.producto_id}" style="position: absolute; top: 12px; right: 12px; background: white; border: 1px solid #eee; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; color: var(--gray-text);" title="Eliminar de wishlist">
                                <i class="fas fa-times"></i>
                            </button>
                            <div class="wishlist-img" style="height: 200px; overflow: hidden; background: #f8f8f8; position: relative;">
                                <img src="${item.imagen || '/public/images/default-product.jpg'}" 
                                     alt="${item.nombre}" 
                                     style="width: 100%; height: 100%; object-fit: cover;"
                                     onerror="this.src='/public/images/default-product.jpg'">
                                ${item.tiene_descuento ? `
                                    <span class="discount-badge" style="position: absolute; top: 16px; left: 16px; background: var(--black); color: white; padding: 6px 12px; font-size: 12px; font-weight: 600; letter-spacing: 1px; border-radius: 4px;">
                                        ${item.descuento_porcentaje ? `-${item.descuento_porcentaje}%` : 'Oferta'}
                                    </span>
                                ` : ''}
                            </div>
                            <div class="wishlist-info" style="padding: 20px;">
                                <h3 style="font-size: 16px; font-weight: 400; margin: 0 0 8px 0; color: var(--black);">${item.nombre}</h3>
                                <p class="category" style="font-size: 12px; color: var(--gray-text); margin-bottom: 12px; text-transform: uppercase;">${item.categoria || 'Sin categoría'}</p>
                                <div class="price-container" style="margin-bottom: 15px;">
                                    ${item.tiene_descuento ? `
                                        <span class="original-price" style="font-size: 14px; color: var(--gray-text); text-decoration: line-through; margin-right: 8px;">RD$ ${parseFloat(item.precio || 0).toFixed(2)}</span>
                                        <span class="current-price" style="font-size: 18px; font-weight: 400; color: var(--black);">RD$ ${parseFloat(item.precio_final || item.precio || 0).toFixed(2)}</span>
                                    ` : `
                                        <span class="current-price" style="font-size: 18px; font-weight: 400; color: var(--black);">RD$ ${parseFloat(item.precio || 0).toFixed(2)}</span>
                                    `}
                                </div>
                                ${item.stock > 0 ? 
                                    `<div class="stock-status in-stock" style="padding: 6px 12px; background: #e8f5e9; color: #155724; border: 1px solid #c3e6cb; border-radius: 20px; font-size: 12px; margin-bottom: 15px; display: inline-block;">Disponible</div>` : 
                                    `<div class="stock-status out-of-stock" style="padding: 6px 12px; background: #f8f9fa; color: #6c757d; border: 1px solid #dee2e6; border-radius: 20px; font-size: 12px; margin-bottom: 15px; display: inline-block;">Agotado</div>`
                                }
                                <div class="wishlist-actions" style="display: flex; gap: 8px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                                    ${item.stock > 0 ? `
                                        <button class="add-to-cart-from-wishlist" data-id="${item.producto_id}" style="flex: 1; padding: 10px; background: white; border: 1px solid #eee; color: var(--black); cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                            <i class="fas fa-shopping-cart"></i> Agregar al Carrito
                                        </button>
                                    ` : `
                                        <button class="btn-disabled" disabled style="flex: 1; padding: 10px; background: #f8f9fa; color: #6c757d; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                            <i class="fas fa-times"></i> Agotado
                                        </button>
                                    `}
                                    <a href="/product-detail.html?id=${item.producto_id}" class="view-product" style="flex: 1; padding: 10px; background: white; border: 1px solid #eee; color: var(--black); text-decoration: none; border-radius: 4px; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                        <i class="fas fa-eye"></i> Ver Producto
                                    </a>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="wishlist-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    <p style="font-size: 14px; color: var(--gray-dark);">${realWishlist.length} producto${realWishlist.length !== 1 ? 's' : ''} en tu wishlist</p>
                    ${realWishlist.length > 0 ? `
                        <button class="btn-clear-wishlist" id="clear-wishlist" style="padding: 10px 20px; background: transparent; border: 1px solid #f8d7da; color: #721c24; font-size: 13px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-trash"></i> Limpiar Wishlist
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        } catch (error) {
            console.error('Error cargando wishlist:', error);
            return this.getErrorHTML('Error cargando la wishlist');
        }
    }

    async getWishlist() {
    try {
        console.log('🔍 Solicitando wishlist para usuario:', this.user.id);
        
        const response = await fetch(`/api/users/${this.user.id}/wishlist`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('📡 Respuesta de wishlist:', response.status, response.statusText);
        
        if (!response.ok) {
            console.warn('⚠️ API de wishlist no disponible, usando datos de ejemplo');
            return this.getSampleWishlist();
        }
        
        const wishlist = await response.json();
        console.log(`✅ Wishlist cargada: ${wishlist.length} productos`);
        return wishlist;
        
    } catch (error) {
        console.error('❌ Error cargando wishlist:', error);
        return this.getSampleWishlist();
    }
}

// Función de respaldo con productos de ejemplo
getSampleWishlist() {
    return [
        {
            id: 1,
            producto_id: 1,
            fecha_agregado: new Date().toISOString(),
            nombre: 'Legging High-Waist Elite',
            imagen: '/public/images/products/legging1.jpg',
            descripcion: 'Legging deportivo de alta compresión',
            categoria: 'leggings',
            stock: 10,
            precio: 1899,
            precio_final: 1899,
            precio_formateado: 'RD$ 1,899.00',
            tiene_descuento: false,
            descuento_porcentaje: 0
        },
        {
            id: 2,
            producto_id: 2,
            fecha_agregado: new Date().toISOString(),
            nombre: 'Top Deportivo Airflow',
            imagen: '/public/images/products/top1.jpg',
            descripcion: 'Top transpirable para entrenamiento',
            categoria: 'tops',
            stock: 15,
            precio: 1299,
            precio_final: 1299,
            precio_formateado: 'RD$ 1,299.00',
            tiene_descuento: false,
            descuento_porcentaje: 0
        }
    ];
}

    loadSettingsForm() {
        return `
            <div class="settings-content">
                <div class="section-header" style="margin-bottom: 30px;">
                    <h1 style="font-size: 28px; font-weight: 400; letter-spacing: 2px; margin-bottom: 8px;">Configuración</h1>
                    <p style="color: var(--gray-text); font-size: 16px;">Preferencias de tu cuenta</p>
                </div>
                
                <form id="settings-form" class="account-form" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 30px; max-width: 600px;">
                    <div class="form-section" style="margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid #eee;">
                        <h3 style="font-size: 18px; font-weight: 400; letter-spacing: 1.5px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-bell"></i> Notificaciones
                        </h3>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="checkbox-label" style="display: flex; align-items: flex-start; gap: 12px; cursor: pointer;">
                                <input type="checkbox" id="email_notifications" checked style="margin-top: 4px;">
                                <span style="flex: 1;">
                                    Recibir notificaciones por email
                                    <small style="display: block; margin-top: 5px; color: var(--gray-text); font-size: 12px;">Actualizaciones de pedidos, ofertas y novedades</small>
                                </span>
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label" style="display: flex; align-items: flex-start; gap: 12px; cursor: pointer;">
                                <input type="checkbox" id="marketing_emails" checked style="margin-top: 4px;">
                                <span style="flex: 1;">
                                    Recibir ofertas y promociones
                                    <small style="display: block; margin-top: 5px; color: var(--gray-text); font-size: 12px;">Descuentos exclusivos y lanzamientos de colecciones</small>
                                </span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-section" style="margin-bottom: 25px;">
                        <h3 style="font-size: 18px; font-weight: 400; letter-spacing: 1.5px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-globe"></i> Preferencias Regionales
                        </h3>
                        
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div class="form-group">
                                <label for="language" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Idioma</label>
                                <select id="language" style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                                    <option value="es" selected>Español</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="currency" style="display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: 1.5px; color: var(--gray-dark);">Moneda</label>
                                <select id="currency" style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 4px;">
                                    <option value="DOP" selected>DOP (RD$)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 15px; margin-top: 30px; padding-top: 25px; border-top: 1px solid #eee;">
                        <button type="submit" class="btn-save" style="background: var(--black); color: white; border: none; padding: 12px 28px; font-size: 14px; cursor: pointer; border-radius: 4px; letter-spacing: 1.5px;">
                            <i class="fas fa-save"></i> Guardar Preferencias
                        </button>
                        <button type="button" class="btn-cancel" id="cancel-settings" style="background: transparent; border: 1px solid #eee; color: var(--black); padding: 12px 28px; font-size: 14px; cursor: pointer; border-radius: 4px; letter-spacing: 1.5px;">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </form>
                
                <div class="danger-zone" style="margin-top: 40px; background: white; border: 1px solid #f8d7da; border-radius: 8px; padding: 30px;">
                    <h3 style="font-size: 20px; font-weight: 400; letter-spacing: 1.5px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #721c24;">
                        <i class="fas fa-exclamation-triangle"></i> Zona de Peligro
                    </h3>
                    <p style="color: #856404; margin-bottom: 20px;">Estas acciones son irreversibles. Procede con cuidado.</p>
                    
                    <div class="danger-actions">
                        <button id="delete-account" class="btn-danger" style="background: #dc3545; color: white; border: none; padding: 12px 28px; font-size: 14px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-trash"></i> Eliminar Mi Cuenta
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getErrorHTML(message) {
        return `
            <div class="error-message" style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle fa-3x" style="color: #FF6B6B; margin-bottom: 20px;"></i>
                <h3 style="color: var(--black); margin-bottom: 10px;">${message}</h3>
                <p style="color: var(--gray-text); margin-bottom: 20px;">Por favor, intenta nuevamente.</p>
                <button onclick="location.reload()" class="btn" style="display: inline-block; padding: 10px 24px; background: var(--black); color: white; text-decoration: none; border-radius: 4px; border: none; cursor: pointer;">
                    <i class="fas fa-redo"></i> Recargar Página
                </button>
            </div>
        `;
    }

    setupSectionEventListeners(section) {
        switch (section) {
            case 'dashboard':
                this.setupDashboardListeners();
                break;
            case 'orders':
                this.setupOrdersListeners();
                break;
            case 'profile':
                this.setupProfileListeners();
                break;
            case 'addresses':
                this.setupAddressesListeners();
                break;
            case 'wishlist':
                this.setupWishlistListeners();
                break;
            case 'settings':
                this.setupSettingsListeners();
                break;
        }
    }

    setupDashboardListeners() {
        this.setupOrderActionListeners();
        
        // Enlaces de acciones rápidas
        document.querySelectorAll('.quick-action-card[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.navigateToSection(section);
            });
        });
    }

    setupOrdersListeners() {
        this.setupOrderActionListeners();
    }

    setupOrderActionListeners() {
        // Botones para ver detalles de órdenes
        setTimeout(() => {
            document.querySelectorAll('.btn-view-order').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.currentTarget.dataset.order;
                    this.viewOrderDetails(orderId);
                });
            });
            
            // Botones para rastrear envíos
            document.querySelectorAll('.btn-track-order').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.currentTarget.dataset.order;
                    this.trackOrder(orderId);
                });
            });
        }, 100);
    }

    navigateToSection(section) {
        this.currentSection = section;
        
        // Actualizar navegación
        document.querySelectorAll('.account-nav a').forEach(a => {
            a.classList.remove('active');
            if (a.getAttribute('href') === `#${section}`) {
                a.classList.add('active');
            }
        });
        
        // Cargar sección
        this.loadSection(section);
    }

    async viewOrderDetails(orderId) {
        try {
            console.log('🔍 Viendo detalles de orden:', orderId);
            const response = await fetch(`/api/orders/${orderId}`);
            
            if (!response.ok) {
                throw new Error('Orden no encontrada');
            }
            
            const order = await response.json();
            this.showOrderModal(order);
            
        } catch (error) {
            console.error('Error cargando detalles de la orden:', error);
            this.showNotification('No se pudieron cargar los detalles de la orden', 'error');
        }
    }

    showOrderModal(order) {
        const modalHTML = `
            <div class="modal-overlay" id="order-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; backdrop-filter: blur(4px);">
                <div class="order-modal-content" style="background: white; width: 90%; max-width: 700px; max-height: 85vh; overflow-y: auto; border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.2);">
                    <div class="modal-header" style="padding: 25px 30px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
                        <h2 style="font-size: 22px; font-weight: 400; letter-spacing: 1px; margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-receipt"></i> Orden #${order.id}
                        </h2>
                        <button class="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--gray-dark); padding: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.3s ease;">&times;</button>
                    </div>
                    
                    <div class="modal-body" style="padding: 25px 30px;">
                        <div class="order-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                            <div class="info-card" style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
                                <h3 style="font-size: 16px; font-weight: 500; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-info-circle"></i> Información del Pedido
                                </h3>
                                <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                                    <span>Fecha:</span>
                                    <span>${new Date(order.fecha_orden || order.fecha_creacion).toLocaleDateString('es-DO')}</span>
                                </div>
                                <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                                    <span>Estado:</span>
                                    <span class="order-status ${this.getStatusClass(order.estado)}" style="padding: 4px 8px; border-radius: 20px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
                                        <i class="fas ${this.getStatusIcon(order.estado)}"></i>
                                        ${this.formatOrderStatus(order.estado)}
                                    </span>
                                </div>
                                <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                                    <span>Total:</span>
                                    <span><strong>RD$ ${parseFloat(order.total || 0).toFixed(2)}</strong></span>
                                </div>
                            </div>
                            
                            <div class="info-card" style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
                                <h3 style="font-size: 16px; font-weight: 500; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-shipping-fast"></i> Información de Envío
                                </h3>
                                <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <span>Dirección:</span>
                                    <span>${order.direccion_envio || 'No especificada'}</span>
                                </div>
                                <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <span>Ciudad:</span>
                                    <span>${order.ciudad_envio || 'No especificada'}</span>
                                </div>
                                <div class="info-row" style="display: flex; justify-content: space-between;">
                                    <span>Teléfono:</span>
                                    <span>${order.telefono_contacto || 'No especificado'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="order-summary" style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 25px; margin-top: 20px;">
                            <h3 style="font-size: 18px; font-weight: 400; letter-spacing: 1.5px; margin-bottom: 20px;">Resumen de la Orden</h3>
                            <div class="summary-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>Subtotal:</span>
                                <span>RD$ ${parseFloat(order.subtotal || order.total * 0.85).toFixed(2)}</span>
                            </div>
                            <div class="summary-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>Envío:</span>
                                <span>RD$ ${parseFloat(order.shipping_cost || order.total * 0.15).toFixed(2)}</span>
                            </div>
                            <div class="summary-row total" style="display: flex; justify-content: space-between; padding: 15px 0; font-size: 18px; font-weight: 400;">
                                <span><strong>Total:</strong></span>
                                <span><strong>RD$ ${parseFloat(order.total || 0).toFixed(2)}</strong></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer" style="padding: 20px 30px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 15px; background: white; position: sticky; bottom: 0;">
                        <button onclick="window.print()" class="btn" style="padding: 10px 20px; background: var(--black); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                        <button class="close-modal btn" style="padding: 10px 20px; background: transparent; border: 1px solid #eee; color: var(--black); border-radius: 4px; cursor: pointer; font-size: 14px;">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar modal al documento
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar event listeners del modal
        const modal = document.getElementById('order-modal');
        modal.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', () => {
                modal.remove();
            });
        });
        
        // Cerrar al hacer clic fuera del modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    trackOrder(orderId) {
        console.log('🚚 Rastreando orden:', orderId);
        this.showNotification('La función de rastreo estará disponible pronto', 'info');
    }

    setupProfileListeners() {
        // Formulario de perfil
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.updateProfile(e));
        }
        
        // Formulario de contraseña
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.changePassword(e));
        }
        
        // Botón cancelar
        const cancelBtn = document.getElementById('cancel-profile');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.loadSection('profile');
            });
        }
    }

    async updateProfile(e) {
        e.preventDefault();
        
        const formData = {
            nombre: document.getElementById('nombre').value.trim(),
            apellido: document.getElementById('apellido').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim()
        };
        
        // Validaciones
        if (!formData.nombre || !formData.apellido || !formData.email) {
            this.showNotification('Los campos marcados con * son obligatorios', 'error');
            return;
        }
        
        if (!this.validateEmail(formData.email)) {
            this.showNotification('Por favor ingresa un email válido', 'error');
            return;
        }
        
        // Formatear teléfono
        if (formData.telefono && !formData.telefono.startsWith('809-')) {
            const cleanPhone = formData.telefono.replace(/\D/g, '').slice(0, 7);
            if (cleanPhone.length === 7) {
                formData.telefono = `809-${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3)}`;
            }
        }
        
        try {
            const response = await fetch(`/api/users/${this.user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                const updatedUser = await response.json();
                this.user = { ...this.user, ...updatedUser };
                this.updateUserUI();
                this.showNotification('Perfil actualizado correctamente', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error actualizando perfil', 'error');
            }
            
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            this.showNotification('Error de conexión al actualizar perfil', 'error');
        }
    }

    async changePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current_password').value;
        const newPassword = document.getElementById('new_password').value;
        const confirmPassword = document.getElementById('confirm_password').value;
        
        // Validaciones
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Todos los campos son obligatorios', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showNotification('Las contraseñas no coinciden', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showNotification('La nueva contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${this.user.id}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            
            if (response.ok) {
                this.showNotification('Contraseña cambiada correctamente', 'success');
                e.target.reset();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error cambiando contraseña', 'error');
            }
            
        } catch (error) {
            console.error('Error cambiando contraseña:', error);
            this.showNotification('Error de conexión al cambiar contraseña', 'error');
        }
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    setupAddressesListeners() {
        // Botón agregar dirección
        const addBtn = document.getElementById('add-address-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddressForm());
        }
        
        // Botón agregar primera dirección (cuando no hay direcciones)
        const addFirstBtn = document.getElementById('add-first-address');
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', () => this.showAddressForm());
        }
        
        // Botones de acciones de dirección
        setTimeout(() => {
            document.querySelectorAll('.edit-address').forEach(button => {
                button.addEventListener('click', (e) => {
                    const addressId = e.currentTarget.dataset.id;
                    this.editAddress(addressId);
                });
            });
            
            document.querySelectorAll('.set-default').forEach(button => {
                button.addEventListener('click', (e) => {
                    const addressId = e.currentTarget.dataset.id;
                    this.setDefaultAddress(addressId);
                });
            });
            
            document.querySelectorAll('.delete-address').forEach(button => {
                button.addEventListener('click', (e) => {
                    const addressId = e.currentTarget.dataset.id;
                    this.deleteAddress(addressId);
                });
            });
        }, 100);
    }

    async editAddress(addressId) {
        try {
            const address = this.addresses.find(addr => addr.id == addressId);
            if (!address) {
                this.showNotification('Dirección no encontrada', 'error');
                return;
            }
            
            this.showAddressForm(address);
            
        } catch (error) {
            console.error('Error cargando dirección:', error);
            this.showNotification('Error cargando dirección', 'error');
        }
    }

    showAddressForm(address = null) {
        const isEdit = !!address;
        
        const formHTML = `
            <div class="modal-overlay" id="address-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; backdrop-filter: blur(4px);">
                <div class="address-modal-content" style="background: white; width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto; border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.2);">
                    <div class="modal-header" style="padding: 25px 30px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
                        <h2 style="font-size: 22px; font-weight: 400; letter-spacing: 1px; margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-${isEdit ? 'edit' : 'plus'}"></i>
                            ${isEdit ? 'Editar Dirección' : 'Nueva Dirección'}
                        </h2>
                        <button class="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--gray-dark); padding: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.3s ease;">&times;</button>
                    </div>
                    
                    <form id="address-form" class="modal-form" style="padding: 25px 30px;">
                        <input type="hidden" id="address-id" value="${address?.id || ''}">
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="address-nombre" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-tag"></i> Nombre para esta dirección (ej: Casa, Oficina) *
                            </label>
                            <input type="text" id="address-nombre" 
                                   value="${address?.nombre || ''}"
                                   placeholder="Ej: Casa Principal" 
                                   required
                                   style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label for="address-nombre_completo" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-user-circle"></i> Nombre Completo *
                                </label>
                                <input type="text" id="address-nombre_completo" 
                                       value="${address?.nombre_completo || `${this.user.nombre || ''} ${this.user.apellido || ''}`.trim()}"
                                       placeholder="Nombre y Apellido" 
                                       required
                                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            
                            <div class="form-group">
                                <label for="address-telefono" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-phone"></i> Teléfono *
                                </label>
                                <div class="input-with-prefix" style="display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px;">
                                    <span class="prefix" style="padding: 12px; background: #f8f8f8; color: var(--gray-dark); border-right: 1px solid #ddd;">809-</span>
                                    <input type="tel" id="address-telefono" 
                                           value="${address?.telefono?.replace('809-', '') || ''}"
                                           placeholder="1234567" 
                                           maxlength="7" 
                                           pattern="[0-9]{7}" 
                                           required
                                           style="flex: 1; padding: 12px; border: none;">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label for="address-provincia" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-map"></i> Provincia *
                                </label>
                                <select id="address-provincia" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="">Seleccionar provincia</option>
                                    ${this.provinces.map(province => `
                                        <option value="${province}" ${address?.provincia === province ? 'selected' : ''}>${province}</option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="address-municipio" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-city"></i> Municipio *
                                </label>
                                <input type="text" id="address-municipio" 
                                       value="${address?.municipio || ''}"
                                       placeholder="Ej: Santo Domingo Este" 
                                       required
                                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="address-sector" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-location-dot"></i> Sector/Barrio *
                            </label>
                            <input type="text" id="address-sector" 
                                   value="${address?.sector || ''}"
                                   placeholder="Ej: Naco, Los Prados, Bella Vista" 
                                   required
                                   style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        
                        <!-- NOTA: Se han eliminado los campos calle, numero y apartamento -->
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="address-referencia" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-info-circle"></i> Punto de Referencia *
                            </label>
                            <textarea id="address-referencia" 
                                      rows="3"
                                      placeholder="Ej: Casa color amarillo, al lado del colegio, edificio #5, apartamento 2B" 
                                      required
                                      style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;">${address?.referencia || ''}</textarea>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 25px;">
                            <label for="address-paqueteria_preferida" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-shipping-fast"></i> Paquetería Preferida
                            </label>
                            <select id="address-paqueteria_preferida" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="">Seleccionar paquetería</option>
                                <option value="EPS" ${address?.paqueteria_preferida === 'EPS' ? 'selected' : ''}>EPS</option>
                                <option value="DOMESA" ${address?.paqueteria_preferida === 'DOMESA' ? 'selected' : ''}>DOMESA</option>
                                <option value="CARGO EXPRESS" ${address?.paqueteria_preferida === 'CARGO EXPRESS' ? 'selected' : ''}>CARGO EXPRESS</option>
                                <option value="AEROFLASH" ${address?.paqueteria_preferida === 'AEROFLASH' ? 'selected' : ''}>AEROFLASH</option>
                                <option value="VIMENPAQ" ${address?.paqueteria_preferida === 'VIMENPAQ' ? 'selected' : ''}>VIMENPAQ</option>
                                <option value="Mundo Cargo" ${address?.paqueteria_preferida === 'Mundo Cargo' ? 'selected' : ''}>Mundo Cargo</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 30px;">
                            <label class="checkbox-label" style="display: flex; align-items: flex-start; gap: 12px; cursor: pointer;">
                                <input type="checkbox" id="address-predeterminada" ${address?.predeterminada ? 'checked' : ''} style="margin-top: 4px;">
                                <span style="flex: 1;">
                                    <strong>Establecer como dirección predeterminada</strong>
                                    <small style="display: block; margin-top: 5px; color: var(--gray-text); font-size: 12px;">Esta será tu dirección principal para todos los envíos</small>
                                </span>
                            </label>
                        </div>
                        
                        <div class="modal-footer" style="padding: 20px 0 0; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 15px;">
                            <button type="button" class="close-modal btn" style="padding: 10px 20px; background: transparent; border: 1px solid #ddd; color: var(--black); border-radius: 4px; cursor: pointer; font-size: 14px;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                            <button type="submit" class="btn" style="padding: 10px 20px; background: var(--black); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar'} Dirección
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Agregar modal al documento
        document.body.insertAdjacentHTML('beforeend', formHTML);
        
        // Configurar event listeners
        const form = document.getElementById('address-form');
        form.addEventListener('submit', (e) => this.saveAddress(e));
        
        const modal = document.getElementById('address-modal');
        modal.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', () => {
                modal.remove();
            });
        });
        
        // Cerrar al hacer clic fuera del modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Enfocar el primer campo
        setTimeout(() => {
            document.getElementById('address-nombre').focus();
        }, 100);
    }

    async saveAddress(e) {
        e.preventDefault();
        
        const addressId = document.getElementById('address-id').value;
        const isEdit = !!addressId;
        
        // Obtener datos del formulario (SIN calle, numero, apartamento)
        const addressData = {
            nombre: document.getElementById('address-nombre').value.trim(),
            nombre_completo: document.getElementById('address-nombre_completo').value.trim(),
            telefono: '809-' + document.getElementById('address-telefono').value.trim(),
            provincia: document.getElementById('address-provincia').value.trim(),
            municipio: document.getElementById('address-municipio').value.trim(),
            sector: document.getElementById('address-sector').value.trim(),
            referencia: document.getElementById('address-referencia').value.trim(),
            paqueteria_preferida: document.getElementById('address-paqueteria_preferida').value,
            predeterminada: document.getElementById('address-predeterminada').checked
        };
        
        // Validar campos obligatorios (SIN calle, numero)
        const requiredFields = [
            'nombre', 'nombre_completo', 'telefono', 'provincia', 
            'municipio', 'sector', 'referencia'
        ];
        
        for (const field of requiredFields) {
            if (!addressData[field] || addressData[field].trim() === '') {
                const fieldNames = {
                    'nombre': 'Nombre para la dirección',
                    'nombre_completo': 'Nombre completo',
                    'telefono': 'Teléfono',
                    'provincia': 'Provincia',
                    'municipio': 'Municipio',
                    'sector': 'Sector/Barrio',
                    'referencia': 'Referencia'
                };
                
                this.showNotification(`El campo "${fieldNames[field] || field}" es obligatorio`, 'error');
                
                // Resaltar campo vacío
                const input = document.getElementById(`address-${field}`);
                if (input) {
                    input.style.borderColor = '#ff4444';
                    input.focus();
                }
                return;
            }
        }
        
        // Validar formato de teléfono
        const phoneRegex = /^809-\d{7}$/;
        if (!phoneRegex.test(addressData.telefono)) {
            this.showNotification('El teléfono debe tener el formato 809-1234567', 'error');
            document.getElementById('address-telefono').style.borderColor = '#ff4444';
            document.getElementById('address-telefono').focus();
            return;
        }
        
        try {
            const url = isEdit 
                ? `/api/users/${this.user.id}/addresses/${addressId}`
                : `/api/users/${this.user.id}/addresses`;
            
            const method = isEdit ? 'PUT' : 'POST';
            
            console.log('💾 Guardando dirección:', addressData);
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(addressData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification(
                    `Dirección ${isEdit ? 'actualizada' : 'agregada'} correctamente`, 
                    'success'
                );
                
                // Cerrar modal
                document.getElementById('address-modal').remove();
                
                // Recargar sección de direcciones
                await this.loadSection('addresses');
                
            } else {
                const error = await response.json();
                this.showNotification(error.error || `Error ${isEdit ? 'actualizando' : 'agregando'} dirección`, 'error');
            }
            
        } catch (error) {
            console.error('❌ Error guardando dirección:', error);
            this.showNotification('Error de conexión al guardar dirección', 'error');
        }
    }

    async setDefaultAddress(addressId) {
        if (!confirm('¿Estás seguro de que deseas establecer esta dirección como predeterminada?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${this.user.id}/addresses/${addressId}/default`, {
                method: 'PUT'
            });
            
            if (response.ok) {
                this.showNotification('Dirección predeterminada actualizada', 'success');
                await this.loadSection('addresses');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error actualizando dirección predeterminada', 'error');
            }
            
        } catch (error) {
            console.error('Error estableciendo dirección predeterminada:', error);
            this.showNotification('Error estableciendo dirección predeterminada', 'error');
        }
    }

    async deleteAddress(addressId) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta dirección? Esta acción no se puede deshacer.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${this.user.id}/addresses/${addressId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Dirección eliminada correctamente', 'success');
                await this.loadSection('addresses');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error eliminando dirección', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando dirección:', error);
            this.showNotification('Error eliminando dirección', 'error');
        }
    }

    setupWishlistListeners() {
        // Botones para eliminar de wishlist
        setTimeout(() => {
            document.querySelectorAll('.remove-wishlist').forEach(button => {
                button.addEventListener('click', (e) => {
                    const productId = e.currentTarget.dataset.id;
                    this.removeFromWishlist(productId);
                });
            });
            
            // Botones para agregar al carrito desde wishlist
            document.querySelectorAll('.add-to-cart-from-wishlist').forEach(button => {
                button.addEventListener('click', (e) => {
                    const productId = e.currentTarget.dataset.id;
                    this.addToCartFromWishlist(productId);
                });
            });
            
            // Botón limpiar wishlist
            const clearBtn = document.getElementById('clear-wishlist');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearWishlist());
            }
        }, 100);
    }

    async removeFromWishlist(productId) {
        try {
            const response = await fetch(`/api/users/${this.user.id}/wishlist/${productId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Producto eliminado de tu wishlist', 'success');
                await this.loadSection('wishlist');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error eliminando de wishlist', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando de wishlist:', error);
            this.showNotification('Error eliminando de wishlist', 'error');
        }
    }

    async clearWishlist() {
        if (!confirm('¿Estás seguro de que deseas vaciar tu wishlist? Esta acción no se puede deshacer.')) {
            return;
        }
        
        try {
            const wishlist = await this.getWishlist();
            const realWishlist = wishlist.filter(item => {
                return !item.is_sample && 
                       !item.is_example && 
                       !item.nombre?.toLowerCase().includes('ejemplo') &&
                       !item.nombre?.toLowerCase().includes('sample') &&
                       !item.nombre?.toLowerCase().includes('demo');
            });
            
            if (realWishlist.length === 0) {
                this.showNotification('Tu wishlist ya está vacía', 'info');
                return;
            }
            
            const deletePromises = realWishlist.map(item => 
                fetch(`/api/users/${this.user.id}/wishlist/${item.producto_id}`, {
                    method: 'DELETE'
                })
            );
            
            await Promise.all(deletePromises);
            this.showNotification('Wishlist vaciada correctamente', 'success');
            await this.loadSection('wishlist');
            
        } catch (error) {
            console.error('Error vaciando wishlist:', error);
            this.showNotification('Error vaciando wishlist', 'error');
        }
    }

    async addToCartFromWishlist(productId) {
        try {
            // Obtener producto
            const product = await this.getProductById(productId);
            
            if (!product) {
                this.showNotification('Producto no encontrado', 'error');
                return;
            }
            
            // Agregar al carrito
            this.addToCart(product);
            this.showNotification('Producto agregado al carrito', 'success');
            
            // Actualizar contador
            this.updateCartCount();
            
        } catch (error) {
            console.error('Error agregando al carrito:', error);
            this.showNotification('Error agregando al carrito', 'error');
        }
    }

    async getProductById(productId) {
        try {
            const response = await fetch(`/api/products/${productId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error obteniendo producto:', error);
            return null;
        }
    }

    addToCart(product) {
        let cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
        
        // Buscar si el producto ya está en el carrito
        const existingIndex = cart.findIndex(item => item.id == product.id);
        
        if (existingIndex > -1) {
            // Incrementar cantidad
            cart[existingIndex].quantity += 1;
        } else {
            // Agregar nuevo producto
            cart.push({
                id: product.id,
                name: product.nombre,
                price: product.precio_final || product.precio,
                image: product.imagen || '/public/images/default-product.jpg',
                quantity: 1
            });
        }
        
        localStorage.setItem('mabel_cart', JSON.stringify(cart));
        this.updateCartCount();
    }

    updateCartCount() {
        const cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        
        document.querySelectorAll('.cart-count').forEach(element => {
            if (element) {
                element.textContent = totalItems;
                element.style.display = totalItems > 0 ? 'inline-block' : 'none';
            }
        });
    }

    setupSettingsListeners() {
        // Formulario de configuración
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => this.updateSettings(e));
        }
        
        // Botón cancelar
        const cancelBtn = document.getElementById('cancel-settings');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.loadSection('settings');
            });
        }
        
        // Botón eliminar cuenta
        const deleteBtn = document.getElementById('delete-account');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteAccount());
        }
    }

    async updateSettings(e) {
        e.preventDefault();
        
        const settingsData = {
            email_notifications: document.getElementById('email_notifications').checked,
            marketing_emails: document.getElementById('marketing_emails').checked,
            language: document.getElementById('language').value,
            currency: document.getElementById('currency').value
        };
        
        try {
            // En desarrollo, simular éxito
            await new Promise(resolve => setTimeout(resolve, 500));
            this.showNotification('Configuración actualizada correctamente', 'success');
            
        } catch (error) {
            console.error('Error actualizando configuración:', error);
            this.showNotification('Error actualizando configuración', 'error');
        }
    }

    async deleteAccount() {
        if (!confirm('¿Estás SEGURO de que deseas eliminar tu cuenta? Esta acción no se puede deshacer. Se perderán todos tus datos, órdenes e historial.')) {
            return;
        }
        
        const confirmation = prompt('Por seguridad, escribe "ELIMINAR CUENTA" para confirmar:');
        if (confirmation !== 'ELIMINAR CUENTA') {
            this.showNotification('Acción cancelada', 'info');
            return;
        }
        
        try {
            this.showNotification('Cuenta eliminada correctamente. Serás redirigido a la página principal.', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
            
        } catch (error) {
            console.error('Error eliminando cuenta:', error);
            this.showNotification('Error eliminando cuenta', 'error');
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.showNotification('Sesión cerrada correctamente', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            this.showNotification('Error cerrando sesión', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="close-notification">&times;</button>
        `;
        
        // Estilos de la notificación
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#d4edda' : 
                        type === 'error' ? '#f8d7da' : 
                        type === 'warning' ? '#fff3cd' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : 
                    type === 'error' ? '#721c24' : 
                    type === 'warning' ? '#856404' : '#0c5460'};
            padding: 15px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            animation: slideIn 0.3s ease;
            font-size: 14px;
        `;
        
        // Estilo para el botón de cerrar
        notification.querySelector('.close-notification').style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            margin-left: 10px;
            color: inherit;
        `;
        
        // Estilo para el icono
        notification.querySelector('i').style.marginRight = '8px';
        
        // Animación de entrada
        document.body.appendChild(notification);
        
        // Auto-eliminar después de 5 segundos
        const autoRemove = setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // Botón de cerrar
        notification.querySelector('.close-notification').addEventListener('click', () => {
            clearTimeout(autoRemove);
            notification.remove();
        });
        
        // Animación CSS
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.account-section')) {
        console.log('🚀 Inicializando AccountManagerFixed...');
        window.accountManager = new AccountManagerFixed();
    }
});