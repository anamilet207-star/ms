// js/script.js - Script principal

const CONFIG = {
    apiBaseUrl: '',
    cartKey: 'mabel_cart',
    sessionKey: 'mabel_session'
};

let appState = {
    cart: [],
    user: null,
    products: []
};

async function initApp() {
    console.log('🛍️ Inicializando Mabel Activewear...');
    
    loadStateFromStorage();
    updateCartCount();
    await checkUserSession();
    setupEventListeners();
    
    console.log('✅ Aplicación inicializada');
}

function loadStateFromStorage() {
    const savedCart = localStorage.getItem(CONFIG.cartKey);
    if (savedCart) {
        appState.cart = JSON.parse(savedCart);
    }
    
    const savedUser = localStorage.getItem(CONFIG.sessionKey);
    if (savedUser) {
        appState.user = JSON.parse(savedUser);
    }
}

function saveStateToStorage() {
    localStorage.setItem(CONFIG.cartKey, JSON.stringify(appState.cart));
    if (appState.user) {
        localStorage.setItem(CONFIG.sessionKey, JSON.stringify(appState.user));
    }
}

function updateCartCount() {
    const cartCountElements = document.querySelectorAll('.cart-count');
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    
    cartCountElements.forEach(element => {
        if (element) {
            element.textContent = totalItems;
            element.style.display = totalItems > 0 ? 'inline-block' : 'none';
        }
    });
}

async function checkUserSession() {
    try {
        const response = await fetch('/api/session');
        const data = await response.json();
        
        if (data.authenticated) {
            appState.user = data.user;
            updateUserUI(data.user);
        } else {
            appState.user = null;
            updateUserUI(null);
        }
    } catch (error) {
        console.error('Error verificando sesión:', error);
        appState.user = null;
        updateUserUI(null);
    }
}

function updateUserUI(user) {
    const userIcons = document.querySelectorAll('.user-icon');
    
    userIcons.forEach(icon => {
        if (user) {
            icon.innerHTML = '<i class="fas fa-user-check"></i>';
            icon.title = `Hola, ${user.nombre || user.email}`;
        } else {
            icon.innerHTML = '<i class="fas fa-user"></i>';
            icon.title = 'Iniciar Sesión';
        }
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Estilos CSS para notificaciones
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 9999;
                animation: slideInRight 0.3s ease;
                max-width: 350px;
                font-size: 14px;
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            
            .notification-success {
                background-color: #d4edda;
                color: #155724;
                border-left: 4px solid #28a745;
            }
            
            .notification-error {
                background-color: #f8d7da;
                color: #721c24;
                border-left: 4px solid #dc3545;
            }
            
            .notification-info {
                background-color: #d1ecf1;
                color: #0c5460;
                border-left: 4px solid #17a2b8;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                margin-left: auto;
                color: inherit;
                opacity: 0.7;
                transition: opacity 0.3s;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function setupEventListeners() {
    // Search functionality
    const searchIcon = document.querySelector('.search-icon');
    if (searchIcon) {
        searchIcon.addEventListener('click', toggleSearch);
    }
}

function toggleSearch() {
    showNotification('Función de búsqueda en desarrollo', 'info');
}

// Funciones para el carrito
function addToCart(product, quantity = 1) {
    const existingItem = appState.cart.find(item => item.id == product.id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        appState.cart.push({
            id: product.id,
            nombre: product.nombre,
            precio: parseFloat(product.precio),
            imagen: product.imagen,
            categoria: product.categoria,
            quantity: quantity,
            stock: product.stock
        });
    }
    
    saveStateToStorage();
    updateCartCount();
}

function getCart() {
    return [...appState.cart];
}

function clearCart() {
    appState.cart = [];
    saveStateToStorage();
    updateCartCount();
}

function removeFromCart(productId) {
    appState.cart = appState.cart.filter(item => item.id != productId);
    saveStateToStorage();
    updateCartCount();
}

function updateCartQuantity(productId, quantity) {
    const item = appState.cart.find(item => item.id == productId);
    if (item) {
        item.quantity = Math.max(0, quantity);
        if (item.quantity === 0) {
            removeFromCart(productId);
        } else {
            saveStateToStorage();
            updateCartCount();
        }
    }
}

// Exportar para uso global
window.MabelApp = {
    initApp,
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    showNotification,
    checkUserSession
};


// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);

// Manejar cambios en localStorage de otras pestañas
window.addEventListener('storage', (event) => {
    if (event.key === CONFIG.cartKey) {
        loadStateFromStorage();
        updateCartCount();
    }
    if (event.key === CONFIG.sessionKey) {
        loadStateFromStorage();
        updateUserUI(appState.user);
    }
});