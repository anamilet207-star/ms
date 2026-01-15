// Notificaciones en tiempo real para wishlist
document.addEventListener('wishlistUpdated', (e) => {
    MabelApp.showNotification(`Wishlist actualizada: ${e.detail.action}`, 'info');
});

// Sincronización automática de direcciones
function syncAddresses() {
    if (navigator.onLine) {
        fetch('/api/users/current/addresses/sync', {
            method: 'POST',
            body: JSON.stringify(localStorage.getItem('pending_address_updates'))
        });
    }
}

// Exportar/Importar wishlist
function exportWishlist() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const blob = new Blob([JSON.stringify(wishlist, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mabel-wishlist.json';
    a.click();
}