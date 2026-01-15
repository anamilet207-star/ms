// ================= WISHLIST MANAGER =================
class WishlistManager {
    constructor() {
        this.init();
    }

    async init() {
        this.setupWishlistButtons();
        await this.checkWishlistStatus();
    }

    setupWishlistButtons() {
        // Botón en página de detalle de producto
        const wishlistBtn = document.getElementById('add-to-wishlist');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const productId = wishlistBtn.dataset.productId;
                this.toggleWishlist(productId);
            });
        }

        // Botones en listado de productos
        document.querySelectorAll('.wishlist-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const productId = button.dataset.productId;
                this.toggleWishlist(productId);
            });
        });
    }

    async checkWishlistStatus() {
        try {
            const response = await fetch('/api/session');
            const session = await response.json();
            
            if (!session.authenticated) return;
            
            // Obtener productId de la URL o del botón
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id') || 
                             document.getElementById('add-to-wishlist')?.dataset.productId;
            
            if (!productId) return;
            
            // Verificar si está en wishlist
            const wishlistResponse = await fetch(`/api/wishlist/check/${productId}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!wishlistResponse.ok) return;
            
            const data = await wishlistResponse.json();
            
            this.updateWishlistButton(productId, data.in_wishlist);
            
        } catch (error) {
            console.error('Error verificando wishlist:', error);
        }
    }

    async toggleWishlist(productId) {
        try {
            // Verificar autenticación
            const response = await fetch('/api/session');
            const session = await response.json();
            
            if (!session.authenticated) {
                MabelApp.showNotification('Debes iniciar sesión para agregar productos a tu wishlist', 'error');
                setTimeout(() => {
                    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
                }, 1500);
                return;
            }
            
            // Verificar estado actual
            const checkResponse = await fetch(`/api/wishlist/check/${productId}`);
            const checkData = await checkResponse.json();
            
            if (checkData.in_wishlist) {
                // Eliminar de wishlist
                await this.removeFromWishlist(productId, session.user.id);
            } else {
                // Agregar a wishlist
                await this.addToWishlist(productId);
            }
            
        } catch (error) {
            console.error('Error toggling wishlist:', error);
            MabelApp.showNotification('Error al actualizar wishlist', 'error');
        }
    }

    async addToWishlist(productId) {
        try {
            const response = await fetch('/api/wishlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ producto_id: productId })
            });
            
            if (response.ok) {
                this.updateWishlistButton(productId, true);
                MabelApp.showNotification('Producto agregado a tu wishlist ❤️', 'success');
                
                // Actualizar contador en el header si existe
                this.updateWishlistCount();
                
            } else {
                const error = await response.json();
                MabelApp.showNotification(error.error || 'Error agregando a wishlist', 'error');
            }
            
        } catch (error) {
            console.error('Error agregando a wishlist:', error);
            MabelApp.showNotification('Error de conexión', 'error');
        }
    }

    async removeFromWishlist(productId, userId) {
        try {
            const response = await fetch(`/api/users/${userId}/wishlist/${productId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.updateWishlistButton(productId, false);
                MabelApp.showNotification('Producto eliminado de tu wishlist', 'info');
                
                // Actualizar contador en el header si existe
                this.updateWishlistCount();
                
            } else {
                const error = await response.json();
                MabelApp.showNotification(error.error || 'Error eliminando de wishlist', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando de wishlist:', error);
            MabelApp.showNotification('Error de conexión', 'error');
        }
    }

    updateWishlistButton(productId, isInWishlist) {
        // Actualizar botón en página de detalle
        const detailBtn = document.getElementById('add-to-wishlist');
        if (detailBtn && detailBtn.dataset.productId == productId) {
            if (isInWishlist) {
                detailBtn.innerHTML = '<i class="fas fa-heart"></i> En tu Wishlist';
                detailBtn.classList.add('in-wishlist');
                detailBtn.classList.remove('not-in-wishlist');
            } else {
                detailBtn.innerHTML = '<i class="far fa-heart"></i> Agregar a Wishlist';
                detailBtn.classList.add('not-in-wishlist');
                detailBtn.classList.remove('in-wishlist');
            }
        }
        
        // Actualizar botones en listados
        document.querySelectorAll(`.wishlist-btn[data-product-id="${productId}"]`).forEach(button => {
            if (isInWishlist) {
                button.innerHTML = '<i class="fas fa-heart"></i>';
                button.classList.add('in-wishlist');
                button.classList.remove('not-in-wishlist');
                button.title = 'Eliminar de wishlist';
            } else {
                button.innerHTML = '<i class="far fa-heart"></i>';
                button.classList.add('not-in-wishlist');
                button.classList.remove('in-wishlist');
                button.title = 'Agregar a wishlist';
            }
        });
    }

    async updateWishlistCount() {
        try {
            const sessionResponse = await fetch('/api/session');
            const session = await sessionResponse.json();
            
            if (!session.authenticated) return;
            
            const response = await fetch(`/api/users/${session.user.id}/wishlist`);
            const wishlist = await response.json();
            
            // Actualizar contador en el header
            const wishlistCountElements = document.querySelectorAll('.wishlist-count');
            wishlistCountElements.forEach(element => {
                if (element) {
                    element.textContent = wishlist.length || 0;
                    element.style.display = wishlist.length > 0 ? 'inline-block' : 'none';
                }
            });
            
        } catch (error) {
            console.error('Error actualizando contador wishlist:', error);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.product-detail') || document.querySelector('.product-card')) {
        window.wishlistManager = new WishlistManager();
    }
});