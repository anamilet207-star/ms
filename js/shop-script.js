// js/shop-script.js - Gestor de tienda COMPLETO Y ACTUALIZADO
document.addEventListener('DOMContentLoaded', function() {
    console.log('🛍️ Inicializando tienda...');
    
    // Verificar si estamos en la página de tienda
    if (!document.querySelector('.products-grid')) {
        console.log('❌ No es página de tienda');
        return;
    }
    
    // Inicializar ShopManager
    window.shopManager = new class ShopManager {
        constructor() {
            this.products = [];
            this.filteredProducts = [];
            this.wishlist = [];
            this.discountedProducts = [];
            this.categories = [];
            this.filters = {
                category: '',
                sortBy: 'newest',
                minPrice: 0,
                maxPrice: 1000,
                inStockOnly: false,
                onlyDiscounted: false
            };
            this.currentPage = 1;
            this.productsPerPage = 12;
            this.selectedSize = null;
            this.selectedColor = null;
            this.init();
        }
        
        async init() {
            console.log('🔄 Inicializando ShopManager...');
            
            // Cargar todos los datos en paralelo
            await Promise.all([
                this.loadProducts(),
                this.loadWishlist(),
                this.loadCategories(),
                this.loadDiscountedProducts()
            ]);
            
            this.setupEventListeners();
            this.updateProductsGrid();
            this.updateCartCount();
            this.updateCategoryFilter();
            this.updateWishlistButtons();
            
            console.log('✅ ShopManager inicializado');
        }
        
        async loadProducts() {
            try {
                console.log('📦 Cargando productos desde API...');
                const response = await fetch('/api/products');
                
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                
                this.products = await response.json();
                this.filteredProducts = [...this.products];
                
                console.log(`✅ ${this.products.length} productos cargados`);
                
                // Procesar arrays que vengan como strings
                this.products.forEach(product => {
                    product.tallas = this.processArrayField(product.tallas);
                    product.colores = this.processArrayField(product.colores);
                    
                    // Calcular precio con descuento
                    product.precio_final = this.calculateDiscountedPrice(product);
                    product.tiene_descuento = product.precio_final < parseFloat(product.precio);
                });
                
                // Ocultar loading
                const loadingElement = document.getElementById('loading');
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                
            } catch (error) {
                console.error('❌ Error cargando productos:', error);
                const loadingElement = document.getElementById('loading');
                if (loadingElement) {
                    loadingElement.innerHTML = `
                        <div style="text-align: center; padding: 40px; grid-column: 1/-1;">
                            <i class="fas fa-exclamation-triangle fa-2x" style="color: #ccc; margin-bottom: 20px;"></i>
                            <h3 style="margin-bottom: 10px; font-weight: 300;">Error cargando productos</h3>
                            <p style="color: var(--gray-text); margin-bottom: 20px;">${error.message}</p>
                            <button onclick="location.reload()" class="btn btn-small">
                                <i class="fas fa-redo"></i> Reintentar
                            </button>
                        </div>
                    `;
                }
            }
        }
        
        loadWishlist() {
            this.wishlist = JSON.parse(localStorage.getItem('mabel_wishlist')) || [];
            console.log(`💖 ${this.wishlist.length} productos en wishlist`);
        }
        
        async loadDiscountedProducts() {
            try {
                const response = await fetch('/api/products/ofertas');
                if (response.ok) {
                    this.discountedProducts = await response.json();
                    console.log(`🎁 ${this.discountedProducts.length} productos en oferta`);
                }
            } catch (error) {
                console.error('Error cargando ofertas:', error);
            }
        }
        
        async loadCategories() {
            try {
                const response = await fetch('/api/categories');
                if (response.ok) {
                    this.categories = await response.json();
                    console.log(`🏷️ ${this.categories.length} categorías cargadas`);
                }
            } catch (error) {
                console.error('Error cargando categorías:', error);
                // Si falla la API, extraer categorías de los productos
                this.categories = [...new Set(this.products
                    .filter(p => p.activo !== false)
                    .map(p => p.categoria)
                    .filter(Boolean))];
            }
        }
        
        processArrayField(fieldValue) {
            if (!fieldValue) return [];
            
            // Si ya es array, devolverlo
            if (Array.isArray(fieldValue)) return fieldValue;
            
            // Si es string JSON, parsearlo
            if (typeof fieldValue === 'string') {
                if (fieldValue.startsWith('[') && fieldValue.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(fieldValue);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch (error) {
                        console.warn('No se pudo parsear JSON array:', fieldValue);
                    }
                }
                
                // Si es string separado por comas
                if (fieldValue.includes(',')) {
                    return fieldValue.split(',')
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
                }
                
                // Si es un solo elemento
                return [fieldValue];
            }
            
            return [];
        }
        
        updateCategoryFilter() {
            const categoryFilter = document.getElementById('category-filter');
            if (!categoryFilter) return;
            
            // Limpiar opciones existentes (excepto la primera)
            while (categoryFilter.options.length > 1) {
                categoryFilter.remove(1);
            }
            
            // Agregar categorías
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = this.formatCategoryName(category);
                categoryFilter.appendChild(option);
            });
            
            // Establecer categoría de URL si existe
            const urlParams = new URLSearchParams(window.location.search);
            const categoryParam = urlParams.get('category');
            if (categoryParam && this.categories.includes(categoryParam)) {
                categoryFilter.value = categoryParam;
                this.filters.category = categoryParam;
                this.applyFilters();
            }
            
            // Establecer filtro de ofertas si estamos en /ofertas
            if (window.location.pathname.includes('ofertas')) {
                this.filters.onlyDiscounted = true;
                this.applyFilters();
            }
        }
        
        formatCategoryName(category) {
            const categoryMap = {
                'leggings': 'Leggings',
                'tops': 'Tops',
                'sets': 'Sets',
                'shorts': 'Shorts',
                'accesorios': 'Accesorios',
                'sports-bras': 'Sports Bras',
                'jackets': 'Chaquetas',
                'pants': 'Pantalones',
                'new-collection': 'Nueva Colección',
                'sale': 'Ofertas'
            };
            
            return categoryMap[category] || 
                   category.charAt(0).toUpperCase() + category.slice(1);
        }
        
        calculateDiscountedPrice(product) {
            let precioFinal = parseFloat(product.precio) || 0;
            
            // Aplicar descuento porcentual
            if (product.descuento_porcentaje > 0) {
                const descuento = precioFinal * (product.descuento_porcentaje / 100);
                precioFinal = precioFinal - descuento;
            }
            // Aplicar precio con descuento fijo
            else if (product.descuento_precio > 0) {
                precioFinal = parseFloat(product.descuento_precio);
            }
            
            return parseFloat(precioFinal.toFixed(2));
        }
        
        applyFilters() {
            let filtered = [...this.products];
            
            // Filtrar por categoría
            if (this.filters.category) {
                filtered = filtered.filter(product => 
                    product.categoria === this.filters.category
                );
            }
            
            // Filtrar solo productos con descuento
            if (this.filters.onlyDiscounted) {
                filtered = filtered.filter(product => 
                    product.descuento_porcentaje > 0 || product.descuento_precio > 0
                );
            }
            
            // Filtrar por stock
            if (this.filters.inStockOnly) {
                filtered = filtered.filter(product => 
                    product.stock > 0
                );
            }
            
            // Filtrar por precio
            filtered = filtered.filter(product => {
                const price = product.precio_final || parseFloat(product.precio) || 0;
                return price >= this.filters.minPrice && 
                       price <= this.filters.maxPrice;
            });
            
            // Ordenar
            filtered.sort((a, b) => {
                const priceA = a.precio_final || parseFloat(a.precio) || 0;
                const priceB = b.precio_final || parseFloat(b.precio) || 0;
                
                switch (this.filters.sortBy) {
                    case 'price-low':
                        return priceA - priceB;
                    case 'price-high':
                        return priceB - priceA;
                    case 'name':
                        return a.nombre.localeCompare(b.nombre);
                    case 'popular':
                        return (b.vistas || 0) - (a.vistas || 0);
                    default: // 'newest'
                        return (b.id || 0) - (a.id || 0);
                }
            });
            
            this.filteredProducts = filtered;
            this.currentPage = 1;
            
            return filtered;
        }
        
        updateProductsGrid() {
            const productsGrid = document.getElementById('productsGrid');
            const noProducts = document.getElementById('no-products');
            
            if (!productsGrid) return;
            
            const products = this.applyFilters();
            
            if (products.length === 0) {
                productsGrid.innerHTML = '';
                if (noProducts) {
                    noProducts.style.display = 'block';
                    noProducts.innerHTML = `
                        <i class="fas fa-search fa-3x"></i>
                        <h3>No se encontraron productos</h3>
                        <p>Intenta con otros filtros o categorías</p>
                        <button onclick="window.shopManager.resetFilters()" class="btn btn-small" style="margin-top: 15px;">
                            Limpiar filtros
                        </button>
                    `;
                }
                return;
            }
            
            if (noProducts) noProducts.style.display = 'none';
            
            // Calcular productos para la página actual
            const startIndex = (this.currentPage - 1) * this.productsPerPage;
            const endIndex = startIndex + this.productsPerPage;
            const paginatedProducts = products.slice(startIndex, endIndex);
            
            // Generar tarjetas de productos
            productsGrid.innerHTML = paginatedProducts.map(product => {
                const precioOriginal = parseFloat(product.precio) || 0;
                const precioFinal = product.precio_final || precioOriginal;
                const tieneDescuento = product.tiene_descuento || false;
                const porcentajeDescuento = product.descuento_porcentaje || 0;
                
                return `
                <div class="shop-product-card" data-id="${product.id}">
                    <div class="shop-product-image">
                        <a href="/product-detail.html?id=${product.id}">
                            <img src="${product.imagen || '/public/images/default-product.jpg'}" 
                                 alt="${product.nombre}"
                                 onerror="this.src='/public/images/default-product.jpg'"
                                 loading="lazy">
                        </a>
                        ${product.stock <= 0 ? 
                            '<span class="shop-product-badge out-of-stock">AGOTADO</span>' : 
                            product.stock <= 5 ? 
                            '<span class="shop-product-badge low-stock">ÚLTIMAS UNIDADES</span>' : ''}
                        
                        ${tieneDescuento ? 
                            `<span class="shop-product-badge sale">-${porcentajeDescuento}%</span>` : ''}
                        
                        <div class="product-hover-actions">
                            <button class="btn-quick-view" onclick="window.shopManager.quickView(${product.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-add-wishlist" onclick="window.shopManager.toggleWishlist(${product.id})">
                                <i class="${this.wishlist.some(w => w.id == product.id) ? 'fas' : 'far'} fa-heart"></i>
                            </button>
                        </div>
                    </div>
                    <div class="shop-product-info">
                        <span class="shop-product-category">${this.formatCategoryName(product.categoria)}</span>
                        <h3 class="shop-product-name">
                            <a href="/product-detail.html?id=${product.id}">${product.nombre}</a>
                        </h3>
                        <div class="shop-product-price">
                            <span class="current-price">$${precioFinal.toFixed(2)}</span>
                            ${tieneDescuento ? 
                                `<span class="original-price">$${precioOriginal.toFixed(2)}</span>` : ''}
                        </div>
                        
                        <div class="shop-product-specs">
                            ${product.tallas && product.tallas.length > 0 ? 
                                `<span class="spec-item"><i class="fas fa-ruler"></i> ${this.formatArrayDisplay(product.tallas)}</span>` : ''}
                            ${product.colores && product.colores.length > 0 ? 
                                `<span class="spec-item"><i class="fas fa-palette"></i> ${product.colores.length} colores</span>` : ''}
                        </div>
                        
                        <div class="shop-product-actions">
                            <button class="btn btn-primary add-to-cart-btn" 
                                    onclick="window.shopManager.addToCart(${product.id})"
                                    ${product.stock <= 0 ? 'disabled' : ''}>
                                <i class="fas fa-shopping-bag"></i>
                                ${product.stock <= 0 ? 'Agotado' : 'Agregar al Carrito'}
                            </button>
                            <a href="/product-detail.html?id=${product.id}" class="btn btn-outline">
                                Ver Detalles
                            </a>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            
            // Agregar paginación si es necesario
            this.renderPagination(products.length);
            
            // Actualizar contador de productos
            this.updateProductCount(products.length);
        }
        
        formatArrayDisplay(array) {
            if (!array || array.length === 0) return '';
            if (array.length <= 3) return array.join(', ');
            return `${array.slice(0, 3).join(', ')}...`;
        }
        
        renderPagination(totalProducts) {
            const totalPages = Math.ceil(totalProducts / this.productsPerPage);
            
            if (totalPages <= 1) {
                // Remover paginación existente
                const existingPagination = document.querySelector('.pagination');
                if (existingPagination) existingPagination.remove();
                return;
            }
            
            // Crear o actualizar paginación
            let paginationContainer = document.querySelector('.pagination');
            if (!paginationContainer) {
                paginationContainer = document.createElement('div');
                paginationContainer.className = 'pagination';
                document.querySelector('.products-section .container').appendChild(paginationContainer);
            }
            
            let paginationHTML = '';
            
            // Botón anterior
            if (this.currentPage > 1) {
                paginationHTML += `
                    <button class="page-btn prev" onclick="window.shopManager.changePage(${this.currentPage - 1})">
                        <i class="fas fa-chevron-left"></i> Anterior
                    </button>
                `;
            }
            
            // Números de página
            const maxVisiblePages = 5;
            let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                paginationHTML += `
                    <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="window.shopManager.changePage(${i})">
                        ${i}
                    </button>
                `;
            }
            
            // Botón siguiente
            if (this.currentPage < totalPages) {
                paginationHTML += `
                    <button class="page-btn next" onclick="window.shopManager.changePage(${this.currentPage + 1})">
                        Siguiente <i class="fas fa-chevron-right"></i>
                    </button>
                `;
            }
            
            paginationContainer.innerHTML = paginationHTML;
        }
        
        changePage(page) {
            if (page < 1 || page > Math.ceil(this.filteredProducts.length / this.productsPerPage)) {
                return;
            }
            
            this.currentPage = page;
            this.updateProductsGrid();
            
            // Scroll suave hacia arriba
            window.scrollTo({
                top: document.querySelector('.products-grid').offsetTop - 100,
                behavior: 'smooth'
            });
        }
        
        updateProductCount(count) {
            const countElement = document.getElementById('product-count');
            if (countElement) {
                countElement.textContent = `${count} productos`;
            }
        }
        
        setupEventListeners() {
            // Filtro de categoría
            const categoryFilter = document.getElementById('category-filter');
            if (categoryFilter) {
                categoryFilter.addEventListener('change', (e) => {
                    this.filters.category = e.target.value;
                    this.updateProductsGrid();
                    this.updateURL();
                });
            }
            
            // Filtro de orden
            const sortFilter = document.getElementById('sort-filter');
            if (sortFilter) {
                sortFilter.addEventListener('change', (e) => {
                    this.filters.sortBy = e.target.value;
                    this.updateProductsGrid();
                });
            }
            
            // Checkbox solo en stock
            const stockFilter = document.getElementById('stock-filter');
            if (stockFilter) {
                stockFilter.addEventListener('change', (e) => {
                    this.filters.inStockOnly = e.target.checked;
                    this.updateProductsGrid();
                });
            }
            
            // Checkbox solo ofertas
            const discountFilter = document.getElementById('discount-filter');
            if (discountFilter) {
                discountFilter.addEventListener('change', (e) => {
                    this.filters.onlyDiscounted = e.target.checked;
                    this.updateProductsGrid();
                });
            }
            
            // Botón filtrar
            const filterBtn = document.getElementById('filter-btn');
            if (filterBtn) {
                filterBtn.addEventListener('click', () => {
                    this.updateProductsGrid();
                });
            }
            
            // Botón reset
            const resetBtn = document.getElementById('reset-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.resetFilters();
                });
            }
            
            // Búsqueda por URL
            const urlParams = new URLSearchParams(window.location.search);
            const searchParam = urlParams.get('search');
            if (searchParam) {
                this.handleSearch(searchParam);
            }
            
            // Escuchar eventos de modal
            document.addEventListener('click', (e) => {
                // Cerrar modal al hacer clic fuera
                if (e.target.classList.contains('modal')) {
                    e.target.remove();
                }
                
                // Cerrar modal con botón X
                if (e.target.classList.contains('modal-close') || 
                    e.target.closest('.modal-close')) {
                    const modal = e.target.closest('.modal');
                    if (modal) modal.remove();
                }
            });
            
            // Tecla ESC para cerrar modales
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const modal = document.querySelector('.modal');
                    if (modal) modal.remove();
                }
            });
        }
        
        handleSearch(query) {
            if (!query.trim()) {
                this.filteredProducts = [...this.products];
            } else {
                const searchTerm = query.toLowerCase();
                this.filteredProducts = this.products.filter(product =>
                    product.nombre.toLowerCase().includes(searchTerm) ||
                    product.descripcion?.toLowerCase().includes(searchTerm) ||
                    product.categoria.toLowerCase().includes(searchTerm) ||
                    product.material?.toLowerCase().includes(searchTerm) ||
                    product.sku?.toLowerCase().includes(searchTerm)
                );
            }
            
            this.applyFilters();
        }
        
        resetFilters() {
            this.filters = {
                category: '',
                sortBy: 'newest',
                minPrice: 0,
                maxPrice: 1000,
                inStockOnly: false,
                onlyDiscounted: false
            };
            
            const categoryFilter = document.getElementById('category-filter');
            const sortFilter = document.getElementById('sort-filter');
            const stockFilter = document.getElementById('stock-filter');
            const discountFilter = document.getElementById('discount-filter');
            
            if (categoryFilter) categoryFilter.value = '';
            if (sortFilter) sortFilter.value = 'newest';
            if (stockFilter) stockFilter.checked = false;
            if (discountFilter) discountFilter.checked = false;
            
            this.updateProductsGrid();
            this.updateURL();
            this.showNotification('Filtros limpiados', 'info');
        }
        
        updateURL() {
            const url = new URL(window.location);
            
            if (this.filters.category) {
                url.searchParams.set('category', this.filters.category);
            } else {
                url.searchParams.delete('category');
            }
            
            window.history.replaceState({}, '', url);
        }
        
        updateWishlistButtons() {
            document.querySelectorAll('.shop-product-card').forEach(card => {
                const productId = card.dataset.id;
                const heartIcon = card.querySelector('.btn-add-wishlist i');
                
                if (heartIcon && this.wishlist.some(item => item.id == productId)) {
                    heartIcon.classList.remove('far');
                    heartIcon.classList.add('fas');
                }
            });
        }
        
        quickView(productId) {
            const product = this.products.find(p => p.id == productId);
            if (!product) return;
            
            const precioFinal = this.calculateDiscountedPrice(product);
            const precioOriginal = parseFloat(product.precio);
            const tieneDescuento = precioFinal < precioOriginal;
            
            const modal = document.createElement('div');
            modal.className = 'modal quick-view-modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Vista Rápida</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="quick-view-content">
                            <div class="quick-view-image">
                                <img src="${product.imagen || '/public/images/default-product.jpg'}" 
                                     alt="${product.nombre}">
                            </div>
                            <div class="quick-view-info">
                                <h4>${product.nombre}</h4>
                                <p class="quick-view-category">${this.formatCategoryName(product.categoria)}</p>
                                
                                <div class="quick-view-price">
                                    <span class="current-price">$${precioFinal.toFixed(2)}</span>
                                    ${tieneDescuento ? 
                                        `<span class="original-price">$${precioOriginal.toFixed(2)}</span>` : ''}
                                </div>
                                
                                <p class="quick-view-description">
                                    ${product.descripcion || 'Sin descripción disponible.'}
                                </p>
                                
                                ${product.tallas && product.tallas.length > 0 ? `
                                    <div class="quick-view-option">
                                        <strong>Tallas disponibles:</strong>
                                        <span>${product.tallas.join(', ')}</span>
                                    </div>
                                ` : ''}
                                
                                ${product.colores && product.colores.length > 0 ? `
                                    <div class="quick-view-option">
                                        <strong>Colores disponibles:</strong>
                                        <span>${product.colores.join(', ')}</span>
                                    </div>
                                ` : ''}
                                
                                <div class="quick-view-option">
                                    <strong>Stock:</strong>
                                    <span class="${product.stock <= 0 ? 'out-of-stock' : product.stock <= 5 ? 'low-stock' : 'in-stock'}">
                                        ${product.stock <= 0 ? 'Agotado' : `${product.stock} disponibles`}
                                    </span>
                                </div>
                                
                                <div class="quick-view-actions">
                                    <button class="btn btn-primary" onclick="window.shopManager.addToCart(${product.id})"
                                            ${product.stock <= 0 ? 'disabled' : ''}>
                                        <i class="fas fa-shopping-bag"></i>
                                        ${product.stock <= 0 ? 'Agotado' : 'Agregar al Carrito'}
                                    </button>
                                    <a href="/product-detail.html?id=${product.id}" class="btn btn-outline">
                                        Ver Detalles Completos
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        addToCart(productId, talla = null, color = null) {
            const product = this.products.find(p => p.id == productId);
            if (!product) {
                this.showNotification('Producto no encontrado', 'error');
                return;
            }
            
            if (product.stock <= 0) {
                this.showNotification('Producto agotado', 'error');
                return;
            }
            
            // Verificar si necesita selección de talla/color
            const needsTalla = product.tallas && product.tallas.length > 1 && !talla;
            const needsColor = product.colores && product.colores.length > 1 && !color;
            
            if (needsTalla || needsColor) {
                this.showSizeColorModal(productId, talla, color);
                return;
            }
            
            // Obtener carrito actual
            let cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
            
            // Verificar si ya existe (misma talla y color)
            const existingIndex = cart.findIndex(item => 
                item.id == productId && 
                item.talla === talla && 
                item.color === color
            );
            
            const precioFinal = this.calculateDiscountedPrice(product);
            
            if (existingIndex >= 0) {
                // Actualizar cantidad
                const nuevaCantidad = cart[existingIndex].quantity + 1;
                const stockDisponible = product.stock;
                
                if (nuevaCantidad > stockDisponible) {
                    this.showNotification(`Solo quedan ${stockDisponible} unidades disponibles`, 'error');
                    return;
                }
                
                cart[existingIndex].quantity = nuevaCantidad;
                this.showNotification(`Cantidad actualizada: ${product.nombre}`, 'success');
            } else {
                // Agregar nuevo item
                cart.push({
                    id: product.id,
                    nombre: product.nombre,
                    precio: precioFinal,
                    precio_original: parseFloat(product.precio),
                    imagen: product.imagen || '/public/images/default-product.jpg',
                    categoria: product.categoria,
                    quantity: 1,
                    talla: talla,
                    color: color,
                    stock: product.stock,
                    sku: product.sku || `SKU-${product.id}`,
                    agregado: new Date().toISOString()
                });
                this.showNotification(`"${product.nombre}" agregado al carrito`, 'success');
            }
            
            // Guardar en localStorage
            localStorage.setItem('mabel_cart', JSON.stringify(cart));
            
            // Actualizar contador del carrito
            this.updateCartCount();
            
            // Animar botón del carrito
            this.animateCartButton();
        }
        
        showSizeColorModal(productId, preselectedTalla = null, preselectedColor = null) {
            const product = this.products.find(p => p.id == productId);
            if (!product) return;
            
            const precioFinal = this.calculateDiscountedPrice(product);
            const precioOriginal = parseFloat(product.precio);
            const tieneDescuento = precioFinal < precioOriginal;
            
            const modal = document.createElement('div');
            modal.className = 'modal size-color-modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Seleccionar opciones</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="product-selection">
                            <div class="product-info-mini">
                                <img src="${product.imagen || '/public/images/default-product.jpg'}" 
                                     alt="${product.nombre}">
                                <div>
                                    <h4>${product.nombre}</h4>
                                    <div class="price-info">
                                        <span class="current-price">$${precioFinal.toFixed(2)}</span>
                                        ${tieneDescuento ? 
                                            `<span class="original-price">$${precioOriginal.toFixed(2)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="selection-options">
                                ${product.tallas && product.tallas.length > 1 ? `
                                    <div class="option-group">
                                        <label>Talla *</label>
                                        <div class="size-options">
                                            ${product.tallas.map(talla => `
                                                <button class="size-option ${preselectedTalla === talla ? 'selected' : ''}" 
                                                        data-size="${talla}">
                                                    ${talla}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${product.colores && product.colores.length > 1 ? `
                                    <div class="option-group">
                                        <label>Color *</label>
                                        <div class="color-options">
                                            ${product.colores.map(color => {
                                                const colorValue = this.getColorValue(color);
                                                return `
                                                <div class="color-option ${preselectedColor === color ? 'selected' : ''}" 
                                                     data-color="${color}"
                                                     style="background-color: ${colorValue}"
                                                     title="${color}">
                                                    ${preselectedColor === color ? '<span class="color-check">✓</span>' : ''}
                                                </div>
                                            `}).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="add-to-cart-selected" disabled>
                            Agregar al Carrito
                        </button>
                        <button class="btn btn-secondary close-modal">
                            Cancelar
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Variables para selección
            let selectedTalla = preselectedTalla || (product.tallas && product.tallas.length === 1 ? product.tallas[0] : null);
            let selectedColor = preselectedColor || (product.colores && product.colores.length === 1 ? product.colores[0] : null);
            
            // Función para verificar si se pueden agregar al carrito
            const checkAddToCartButton = () => {
                const addButton = modal.querySelector('#add-to-cart-selected');
                const canAdd = (selectedTalla || product.tallas.length <= 1) && 
                              (selectedColor || product.colores.length <= 1);
                
                addButton.disabled = !canAdd;
                return canAdd;
            };
            
            // Seleccionar talla
            modal.querySelectorAll('.size-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.querySelectorAll('.size-option').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedTalla = btn.dataset.size;
                    checkAddToCartButton();
                });
            });
            
            // Seleccionar color
            modal.querySelectorAll('.color-option').forEach(colorDiv => {
                colorDiv.addEventListener('click', () => {
                    modal.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
                    colorDiv.classList.add('selected');
                    
                    // Agregar checkmark
                    if (!colorDiv.querySelector('.color-check')) {
                        const check = document.createElement('span');
                        check.className = 'color-check';
                        check.textContent = '✓';
                        colorDiv.appendChild(check);
                    }
                    
                    selectedColor = colorDiv.dataset.color;
                    checkAddToCartButton();
                });
            });
            
            // Agregar al carrito con selección
            modal.querySelector('#add-to-cart-selected').addEventListener('click', () => {
                this.addToCart(productId, selectedTalla, selectedColor);
                modal.remove();
            });
            
            // Cerrar modal
            modal.querySelector('.close-modal, .modal-close').addEventListener('click', () => {
                modal.remove();
            });
            
            // Verificar estado inicial del botón
            checkAddToCartButton();
        }
        
        getColorValue(colorName) {
            const colorMap = {
                'Negro': '#000000',
                'Blanco': '#FFFFFF',
                'Gris': '#808080',
                'Azul': '#0000FF',
                'Rojo': '#FF0000',
                'Verde': '#008000',
                'Rosa': '#FFC0CB',
                'Morado': '#800080',
                'Beige': '#F5F5DC',
                'Marino': '#000080',
                'Azul Marino': '#000080',
                'Negro Carbón': '#1A1A1A',
                'Gris Oscuro': '#333333',
                'Gris Claro': '#D3D3D3',
                'Azul Cielo': '#87CEEB',
                'Verde Oliva': '#808000',
                'Café': '#8B4513',
                'Naranja': '#FFA500',
                'Amarillo': '#FFFF00',
                'Celeste': '#00BFFF'
            };
            
            return colorMap[colorName] || '#CCCCCC';
        }
        
        toggleWishlist(productId) {
            const product = this.products.find(p => p.id == productId);
            if (!product) return;
            
            const heartIcon = document.querySelector(`.shop-product-card[data-id="${productId}"] .btn-add-wishlist i`);
            const existingIndex = this.wishlist.findIndex(item => item.id == productId);
            
            const precioFinal = this.calculateDiscountedPrice(product);
            
            if (existingIndex >= 0) {
                // Remover de wishlist
                this.wishlist.splice(existingIndex, 1);
                if (heartIcon) {
                    heartIcon.classList.remove('fas');
                    heartIcon.classList.add('far');
                }
                this.showNotification('Removido de favoritos', 'info');
            } else {
                // Agregar a wishlist
                this.wishlist.push({
                    id: product.id,
                    nombre: product.nombre,
                    precio: precioFinal,
                    precio_original: parseFloat(product.precio),
                    imagen: product.imagen,
                    sku: product.sku,
                    categoria: product.categoria,
                    agregado: new Date().toISOString()
                });
                if (heartIcon) {
                    heartIcon.classList.remove('far');
                    heartIcon.classList.add('fas');
                }
                this.showNotification('Agregado a favoritos', 'success');
            }
            
            // Guardar wishlist actualizada
            localStorage.setItem('mabel_wishlist', JSON.stringify(this.wishlist));
        }
        
        updateCartCount() {
            const cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            
            // Actualizar en toda la página
            document.querySelectorAll('.cart-count').forEach(element => {
                if (element) {
                    element.textContent = totalItems;
                    element.style.display = totalItems > 0 ? 'inline-block' : 'none';
                }
            });
        }
        
        animateCartButton() {
            const cartButtons = document.querySelectorAll('.icon-link[href*="cart"]');
            cartButtons.forEach(button => {
                button.classList.add('animate');
                setTimeout(() => {
                    button.classList.remove('animate');
                }, 500);
            });
        }
        
        showNotification(message, type = 'info') {
            // Eliminar notificaciones anteriores
            const existingNotifications = document.querySelectorAll('.notification');
            existingNotifications.forEach(notif => notif.remove());
            
            // Crear notificación
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            
            const icons = {
                success: 'check-circle',
                error: 'exclamation-circle',
                info: 'info-circle',
                warning: 'exclamation-triangle'
            };
            
            notification.innerHTML = `
                <i class="fas fa-${icons[type] || 'info-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            `;
            
            // Estilos
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                background: ${type === 'success' ? '#d4edda' : 
                            type === 'error' ? '#f8d7da' : 
                            type === 'warning' ? '#fff3cd' : '#d1ecf1'};
                color: ${type === 'success' ? '#155724' : 
                        type === 'error' ? '#721c24' : 
                        type === 'warning' ? '#856404' : '#0c5460'};
                border-left: 4px solid ${type === 'success' ? '#28a745' : 
                                    type === 'error' ? '#dc3545' : 
                                    type === 'warning' ? '#ffc107' : '#17a2b8'};
                border-radius: 4px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                max-width: 350px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            
            document.body.appendChild(notification);
            
            // Botón cerrar
            const closeBtn = notification.querySelector('.notification-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    notification.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => notification.remove(), 300);
                };
            }
            
            // Auto-remover después de 5 segundos
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => notification.remove(), 300);
                }
            }, 5000);
        }
        
        // Método para mostrar solo productos en oferta
        showDiscountedProductsOnly() {
            this.filters.onlyDiscounted = true;
            this.filters.category = '';
            
            const categoryFilter = document.getElementById('category-filter');
            const discountFilter = document.getElementById('discount-filter');
            
            if (categoryFilter) categoryFilter.value = '';
            if (discountFilter) discountFilter.checked = true;
            
            this.updateProductsGrid();
            this.showNotification('Mostrando productos en oferta', 'info');
        }
        
        // Método para mostrar solo productos con bajo stock
        showLowStockProductsOnly() {
            this.filters.inStockOnly = true;
            const stockFilter = document.getElementById('stock-filter');
            if (stockFilter) stockFilter.checked = true;
            
            // Filtrar productos con stock bajo (1-5 unidades)
            this.filteredProducts = this.products.filter(p => 
                p.stock > 0 && p.stock <= 5
            );
            
            this.currentPage = 1;
            this.updateProductsGrid();
            this.showNotification('Mostrando productos con bajo stock', 'warning');
        }
    };
    
    // Inicializar
    window.shopManager.init();
});

// Funciones globales para botones HTML
function addToCart(productId) {
    if (window.shopManager) {
        window.shopManager.addToCart(productId);
    } else {
        console.error('ShopManager no inicializado');
        alert('Por favor espera a que cargue la tienda');
    }
}

function toggleWishlist(productId) {
    if (window.shopManager) {
        window.shopManager.toggleWishlist(productId);
    }
}

function quickView(productId) {
    if (window.shopManager) {
        window.shopManager.quickView(productId);
    }
}

function showDiscountedProducts() {
    if (window.shopManager) {
        window.shopManager.showDiscountedProductsOnly();
    }
}

function showLowStockProducts() {
    if (window.shopManager) {
        window.shopManager.showLowStockProductsOnly();
    }
}

// Actualizar contador del carrito al cargar
document.addEventListener('DOMContentLoaded', function() {
    const cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    document.querySelectorAll('.cart-count').forEach(element => {
        if (element) {
            element.textContent = totalItems;
            element.style.display = totalItems > 0 ? 'inline-block' : 'none';
        }

          
    // Inicializar wishlist manager si existe
    if (typeof WishlistManager !== 'undefined' && !window.wishlistManager) {
        window.wishlistManager = new WishlistManager();
    }
    });
    
    // Agregar estilos CSS para modales
    if (!document.querySelector('#shop-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'shop-modal-styles';
        style.textContent = `
            /* Modal styles */
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 20px;
            }
            
            .modal.active {
                display: flex;
            }
            
            .modal-content {
                background: white;
                border-radius: 8px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                animation: modalFadeIn 0.3s ease;
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                font-weight: 300;
                letter-spacing: 1px;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #666;
                cursor: pointer;
                padding: 5px;
                line-height: 1;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            /* Quick View Modal */
            .quick-view-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
            }
            
            .quick-view-image img {
                width: 100%;
                height: auto;
                border-radius: 8px;
            }
            
            .quick-view-category {
                color: #666;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 10px;
            }
            
            .quick-view-price {
                margin: 15px 0;
            }
            
            .quick-view-description {
                color: #666;
                line-height: 1.6;
                margin: 15px 0;
            }
            
            .quick-view-option {
                margin: 10px 0;
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .quick-view-actions {
                margin-top: 20px;
                display: flex;
                gap: 10px;
            }
            
            /* Size/Color Modal */
            .product-selection {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            .product-info-mini {
                display: flex;
                gap: 15px;
                align-items: center;
                padding: 15px;
                background: #f8f8f8;
                border-radius: 8px;
            }
            
            .product-info-mini img {
                width: 80px;
                height: 80px;
                object-fit: cover;
                border-radius: 4px;
            }
            
            .price-info {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 5px;
            }
            
            .option-group {
                margin-bottom: 25px;
            }
            
            .option-group label {
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
                text-transform: uppercase;
                font-size: 12px;
                letter-spacing: 1px;
                color: #333;
            }
            
            .size-options {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .size-option {
                padding: 12px 20px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                min-width: 50px;
                text-align: center;
                font-size: 14px;
                transition: all 0.3s;
            }
            
            .size-option:hover {
                border-color: #000;
            }
            
            .size-option.selected {
                background: black;
                color: white;
                border-color: black;
            }
            
            .color-options {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }
            
            .color-option {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid transparent;
                cursor: pointer;
                position: relative;
                transition: all 0.3s;
            }
            
            .color-option:hover {
                transform: scale(1.1);
            }
            
            .color-option.selected {
                border-color: black;
            }
            
            .color-check {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-weight: bold;
                font-size: 14px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            
            /* Animations */
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
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
            
            /* Stock status colors */
            .in-stock {
                color: #34c759;
                font-weight: 500;
            }
            
            .low-stock {
                color: #ff9500;
                font-weight: 500;
            }
            
            .out-of-stock {
                color: #ff3b30;
                font-weight: 500;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .quick-view-content {
                    grid-template-columns: 1fr;
                }
                
                .modal-content {
                    margin: 0;
                    max-height: 100vh;
                    border-radius: 0;
                }
            }
            
            @media (max-width: 480px) {
                .product-info-mini {
                    flex-direction: column;
                    text-align: center;
                }
                
                .quick-view-actions {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);
    }
});

