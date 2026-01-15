// js/product-detail.js - VERSIÓN COMPLETAMENTE CORREGIDA CON MÚLTIPLES IMÁGENES
class ProductDetailManager {
    constructor() {
        this.product = null;
        this.selectedSize = null;
        this.selectedColor = null;
        this.quantity = 1;
        this.init();
    }
    
    async init() {
        console.log('🛍️ Inicializando detalle de producto...');
        
        // Obtener ID del producto de la URL
        const productId = this.getProductIdFromUrl();
        console.log('📝 ID obtenido:', productId);
        
        if (!productId) {
            this.showError('Producto no encontrado. ID no especificado.');
            return;
        }
        
        // Mostrar loading
        this.showLoading();
        
        // Cargar datos del producto
        await this.loadProduct(productId);
        
        if (this.product) {
            // Renderizar producto
            this.renderProduct();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Actualizar breadcrumb
            this.updateBreadcrumb();

             // Inicializar guía de tallas
        this.initializeSizeGuide();
        
        // Inicializar sistema de reseñas
        this.initializeReviews();
            
            console.log('✅ Detalle de producto cargado:', this.product.nombre);
        }
    }

    // Nuevas funciones:
initializeSizeGuide() {
    if (document.getElementById('size-guide-section')) {
        window.sizeGuideManager = new SizeGuideManager(this.product);
    }
}

initializeReviews() {
    // Inicializar después de que se cargue el producto
    setTimeout(() => {
        if (document.getElementById('product-reviews-section')) {
            window.reviewsManager = new ProductReviewsManager(this.product.id);
        }
    }, 500);
}
    
    showLoading() {
        const loading = document.getElementById('loading-state');
        const content = document.getElementById('product-content');
        const error = document.getElementById('error-state');
        
        if (loading) loading.style.display = 'block';
        if (content) content.style.display = 'none';
        if (error) error.style.display = 'none';
    }
    
    showContent() {
        const loading = document.getElementById('loading-state');
        const content = document.getElementById('product-content');
        const error = document.getElementById('error-state');
        
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
        if (error) error.style.display = 'none';
    }
    
    showErrorState(message) {
        const loading = document.getElementById('loading-state');
        const content = document.getElementById('product-content');
        const error = document.getElementById('error-state');
        
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'none';
        if (error) {
            error.style.display = 'block';
            error.querySelector('h3').textContent = message;
        }
    }
    
    getProductIdFromUrl() {
        // Verificar múltiples formas de obtener el ID
        const urlParams = new URLSearchParams(window.location.search);
        let productId = urlParams.get('id');
        
        // Si no está en query params, verificar en hash
        if (!productId && window.location.hash) {
            const hashMatch = window.location.hash.match(/id=([^&]+)/);
            if (hashMatch) productId = hashMatch[1];
        }
        
        // Verificar que el ID sea válido
        if (productId && !isNaN(parseInt(productId))) {
            return parseInt(productId);
        }
        
        return null;
    }
    
    async loadProduct(productId) {
        console.log(`🔄 Cargando producto ID: ${productId}`);
        
        try {
            // Usar la ruta correcta de la API
            const response = await fetch(`/api/products/${productId}`);
            console.log('📤 Respuesta de API:', response.status);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Producto no encontrado');
                }
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            this.product = await response.json();
            console.log('✅ Producto cargado exitosamente:', this.product);
            
            // Procesar arrays que vienen como strings de la BD
            this.processProductArrays();
            
            // Configurar opciones por defecto
            if (this.product.tallas && this.product.tallas.length > 0) {
                this.selectedSize = this.product.tallas[0];
            }
            if (this.product.colores && this.product.colores.length > 0) {
                this.selectedColor = this.product.colores[0];
            }
            
            this.showContent();
            
        } catch (error) {
            console.error('❌ Error cargando producto:', error);
            this.showErrorState(`Error al cargar el producto: ${error.message}`);
        }
    }
    
    processProductArrays() {
        // Función para procesar arrays que vienen como strings de PostgreSQL
        const processArray = (data) => {
            if (!data) return [];
            
            // Si ya es array, devolverlo
            if (Array.isArray(data)) return data;
            
            // Si es string, intentar parsearlo
            if (typeof data === 'string') {
                // Si es JSON array
                if (data.startsWith('[') && data.endsWith(']')) {
                    try {
                        return JSON.parse(data);
                    } catch (error) {
                        console.warn('No se pudo parsear JSON array:', data);
                    }
                }
                
                // Si es string separado por comas
                if (data.includes(',')) {
                    return data.split(',')
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
                }
                
                // Si es un solo elemento
                return [data];
            }
            
            return [];
        };
        
        // Procesar tallas, colores e imágenes adicionales
        if (this.product.tallas) {
            this.product.tallas = processArray(this.product.tallas);
        }
        
        if (this.product.colores) {
            this.product.colores = processArray(this.product.colores);
        }
        
        if (this.product.imagenes_adicionales) {
            this.product.imagenes_adicionales = processArray(this.product.imagenes_adicionales);
        }
        
        console.log('📏 Tallas procesadas:', this.product.tallas);
        console.log('🎨 Colores procesados:', this.product.colores);
        console.log('🖼️ Imágenes adicionales:', this.product.imagenes_adicionales);
    }
    
    renderProduct() {
        // Actualizar título de la página
        document.title = `${this.product.nombre} - Mabel Activewear`;
        
        // Renderizar cada sección
        this.renderGallery();
        this.renderProductInfo();
        this.renderOptions();
        this.updateStockStatus();
        this.renderAccordion();
        this.loadRecommendations();
    }
    
    renderGallery() {
        const mainImageContainer = document.querySelector('.main-image');
        const thumbnailContainer = document.querySelector('.thumbnail-gallery');
        
        if (!mainImageContainer) {
            console.error('❌ No se encontró .main-image');
            return;
        }
        
        // Obtener imágenes del producto (con múltiples imágenes)
        const images = this.getProductImages();
        
        console.log('🖼️ Imágenes para galería:', images.length);
        
        // Crear imagen principal
        mainImageContainer.innerHTML = `
            <img src="${images[0]}" 
                 alt="${this.product.nombre}"
                 onerror="this.src='/public/images/default-product.jpg'"
                 id="main-product-img">
        `;
        
        // Crear miniaturas si hay más de una imagen
        if (thumbnailContainer && images.length > 1) {
            thumbnailContainer.innerHTML = images.map((image, index) => `
                <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                     data-index="${index}"
                     onclick="window.productDetailManager.selectImage(${index})">
                    <img src="${image}" 
                         alt="${this.product.nombre} - Vista ${index + 1}"
                         onerror="this.src='/public/images/default-product.jpg'">
                </div>
            `).join('');
            
            // Asegurar que las miniaturas sean visibles
            thumbnailContainer.style.display = 'grid';
            console.log('✅ Galería con miniaturas creada:', images.length, 'imágenes');
        } else if (thumbnailContainer) {
            thumbnailContainer.style.display = 'none';
            console.log('ℹ️ Solo una imagen disponible, ocultando miniaturas');
        }
    }
    
    getProductImages() {
        const images = [];
        
        // Imagen principal
        if (this.product.imagen) {
            images.push(this.product.imagen);
        }
        
        // Imágenes adicionales (si existen)
        if (this.product.imagenes_adicionales && this.product.imagenes_adicionales.length > 0) {
            this.product.imagenes_adicionales.forEach(img => {
                if (img && img.trim()) images.push(img);
            });
        }
        
        // Si no hay imágenes, usar una por defecto
        if (images.length === 0) {
            images.push('/public/images/default-product.jpg');
        }
        
        console.log('📸 Total de imágenes encontradas:', images.length);
        return images;
    }
    
    selectImage(index) {
        const images = this.getProductImages();
        if (images[index]) {
            const mainImg = document.getElementById('main-product-img');
            if (mainImg) {
                mainImg.src = images[index];
            }
            
            // Actualizar miniaturas activas
            document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
                thumb.classList.toggle('active', i === index);
            });
            
            console.log('🖼️ Imagen seleccionada:', index + 1, 'de', images.length);
        }
    }
    
    renderProductInfo() {
        // Título
        const titleElement = document.querySelector('.product-title');
        if (titleElement) {
            titleElement.textContent = this.product.nombre;
            document.getElementById('product-title').textContent = this.product.nombre;
        }
        
        // SKU
        const skuElement = document.querySelector('.product-sku');
        if (skuElement) {
            skuElement.textContent = `SKU: ${this.product.sku || 'N/A'}`;
            document.getElementById('product-sku').textContent = `SKU: ${this.product.sku || 'N/A'}`;
        }
        
        // Precio con descuento
        const priceElement = document.querySelector('.product-price');
        if (priceElement) {
            let precioOriginal = parseFloat(this.product.precio);
            let precioFinal = precioOriginal;
            let descuentoPorcentaje = this.product.descuento_porcentaje || 0;
            
            if (descuentoPorcentaje > 0) {
                precioFinal = precioOriginal * (1 - descuentoPorcentaje / 100);
            } else if (this.product.descuento_precio > 0) {
                precioFinal = parseFloat(this.product.descuento_precio);
                descuentoPorcentaje = Math.round((1 - precioFinal / precioOriginal) * 100);
            }
            
            let priceHTML = '';
            if (descuentoPorcentaje > 0 || this.product.descuento_precio > 0) {
                priceHTML = `
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <span style="text-decoration: line-through; color: #999; font-size: 18px;">
                            $${precioOriginal.toFixed(2)}
                        </span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #ff3b30; font-size: 32px; font-weight: bold;">
                                $${precioFinal.toFixed(2)}
                            </span>
                            ${descuentoPorcentaje > 0 ? `
                                <span style="background: #ff3b30; color: white; padding: 5px 12px; border-radius: 20px; font-weight: bold;">
                                    -${descuentoPorcentaje}%
                                </span>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                priceHTML = `<span style="font-size: 32px; font-weight: bold;">$${precioFinal.toFixed(2)}</span>`;
            }
            
            priceElement.innerHTML = priceHTML;
            document.getElementById('product-price').innerHTML = priceHTML;
        }
        
        // Descripción
        const descElement = document.querySelector('.product-description p');
        if (descElement) {
            descElement.textContent = this.product.descripcion || 
                'Sin descripción disponible. Este producto ofrece calidad y comodidad para tus entrenamientos.';
            document.getElementById('product-description').textContent = 
                this.product.descripcion || 'Sin descripción disponible.';
        }
    }
    
    renderOptions() {
        // Tallas
        this.renderSizes();
        
        // Colores
        this.renderColors();
        
        // Selector de cantidad
        this.renderQuantitySelector();
    }
    
    renderSizes() {
        const sizeContainer = document.querySelector('.size-options');
        if (!sizeContainer) return;
        
        // Limpiar container
        sizeContainer.innerHTML = '';
        
        if (this.product.tallas && this.product.tallas.length > 0) {
            this.product.tallas.forEach(size => {
                const button = document.createElement('button');
                button.className = `size-option ${size === this.selectedSize ? 'selected' : ''}`;
                button.dataset.size = size;
                button.textContent = size;
                button.onclick = () => this.selectSize(size);
                sizeContainer.appendChild(button);
            });
        } else {
            // Ocultar sección de tallas si no hay disponibles
            const sizeGroup = sizeContainer.closest('.option-group');
            if (sizeGroup) sizeGroup.style.display = 'none';
        }
    }
    
    selectSize(size) {
        this.selectedSize = size;
        
        // Actualizar UI
        document.querySelectorAll('.size-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.size === size);
        });
        
        console.log('📏 Talla seleccionada:', size);
        
        // Verificar disponibilidad
        this.checkAvailability();
    }
    
    renderColors() {
        const colorContainer = document.querySelector('.color-options');
        if (!colorContainer) return;
        
        // Limpiar container
        colorContainer.innerHTML = '';
        
        if (this.product.colores && this.product.colores.length > 0) {
            this.product.colores.forEach(color => {
                const colorDiv = document.createElement('div');
                colorDiv.className = `color-option ${color === this.selectedColor ? 'selected' : ''}`;
                colorDiv.dataset.color = color;
                colorDiv.title = color;
                colorDiv.style.backgroundColor = this.getColorValue(color);
                colorDiv.onclick = () => this.selectColor(color);
                
                // Agregar checkmark si está seleccionado
                if (color === this.selectedColor) {
                    const check = document.createElement('span');
                    check.className = 'color-check';
                    check.innerHTML = '✓';
                    check.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        font-weight: bold;
                        font-size: 14px;
                    `;
                    colorDiv.appendChild(check);
                }
                
                colorContainer.appendChild(colorDiv);
            });
        } else {
            // Ocultar sección de colores si no hay disponibles
            const colorGroup = colorContainer.closest('.option-group');
            if (colorGroup) colorGroup.style.display = 'none';
        }
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
    
    selectColor(color) {
        this.selectedColor = color;
        
        // Actualizar UI
        document.querySelectorAll('.color-option').forEach(colorOption => {
            const isSelected = colorOption.dataset.color === color;
            colorOption.classList.toggle('selected', isSelected);
            
            // Agregar/remover checkmark
            if (isSelected) {
                if (!colorOption.querySelector('.color-check')) {
                    const check = document.createElement('span');
                    check.className = 'color-check';
                    check.innerHTML = '✓';
                    check.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        font-weight: bold;
                        font-size: 14px;
                    `;
                    colorOption.appendChild(check);
                }
            } else {
                const existingCheck = colorOption.querySelector('.color-check');
                if (existingCheck) existingCheck.remove();
            }
        });
        
        console.log('🎨 Color seleccionado:', color);
        
        // Verificar disponibilidad
        this.checkAvailability();
    }
    
    checkAvailability() {
        // Aquí puedes agregar lógica de validación específica
        // Por ejemplo, verificar si la combinación talla-color está disponible
        
        console.log('✅ Disponibilidad verificada:', {
            talla: this.selectedSize,
            color: this.selectedColor,
            stock: this.product.stock
        });
    }
    
    renderQuantitySelector() {
        const quantityInput = document.getElementById('quantity-input');
        const decreaseBtn = document.getElementById('decrease-quantity');
        const increaseBtn = document.getElementById('increase-quantity');
        const stockStatus = document.getElementById('stock-status');
        
        if (quantityInput) {
            // Configurar valor inicial
            quantityInput.value = this.quantity;
            
            // Configurar máximo según stock
            const maxStock = this.product.stock || 0;
            quantityInput.max = maxStock;
            quantityInput.min = 1;
            
            // Actualizar stock status
            if (stockStatus) {
                if (maxStock <= 0) {
                    stockStatus.textContent = '❌ Agotado';
                    stockStatus.style.color = '#ff3b30';
                    stockStatus.className = 'stock-status out-of-stock';
                } else if (maxStock <= 5) {
                    stockStatus.textContent = `⚠️ Últimas ${maxStock} unidades`;
                    stockStatus.style.color = '#ff9500';
                    stockStatus.className = 'stock-status low-stock';
                } else {
                    stockStatus.textContent = `✅ ${maxStock} disponibles`;
                    stockStatus.style.color = '#34c759';
                    stockStatus.className = 'stock-status available';
                }
            }
            
            // Configurar input manual
            quantityInput.addEventListener('change', (e) => {
                let value = parseInt(e.target.value) || 1;
                const maxStock = this.product.stock || 0;
                
                // Validar rango
                if (value < 1) value = 1;
                if (value > maxStock) value = maxStock;
                
                this.quantity = value;
                e.target.value = value;
                console.log('🔢 Cantidad actualizada:', this.quantity);
            });
            
            quantityInput.addEventListener('input', (e) => {
                // Solo permitir números
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            });
        }
        
        // Configurar botones de cantidad
        if (decreaseBtn) {
            decreaseBtn.onclick = () => this.changeQuantity(-1);
        }
        
        if (increaseBtn) {
            increaseBtn.onclick = () => this.changeQuantity(1);
        }
    }
    
    changeQuantity(change) {
        let newQuantity = this.quantity + change;
        const maxStock = this.product.stock || 0;
        
        // Validar límites
        if (newQuantity < 1) newQuantity = 1;
        if (newQuantity > maxStock) newQuantity = maxStock;
        
        this.quantity = newQuantity;
        
        // Actualizar input
        const quantityInput = document.getElementById('quantity-input');
        if (quantityInput) {
            quantityInput.value = newQuantity;
        }
        
        console.log('🔢 Cantidad cambiada a:', this.quantity);
    }
    
    updateStockStatus() {
        const stock = this.product.stock || 0;
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        const buyNowBtn = document.getElementById('buy-now-btn');
        
        if (addToCartBtn) {
            if (stock <= 0) {
                addToCartBtn.textContent = 'Agotado';
                addToCartBtn.disabled = true;
                addToCartBtn.style.opacity = '0.6';
                addToCartBtn.style.cursor = 'not-allowed';
                addToCartBtn.classList.add('disabled');
            } else {
                addToCartBtn.textContent = 'Agregar al Carrito';
                addToCartBtn.disabled = false;
                addToCartBtn.style.opacity = '1';
                addToCartBtn.style.cursor = 'pointer';
                addToCartBtn.classList.remove('disabled');
            }
        }
        
        if (buyNowBtn) {
            if (stock <= 0) {
                buyNowBtn.disabled = true;
                buyNowBtn.style.opacity = '0.6';
                buyNowBtn.style.cursor = 'not-allowed';
                buyNowBtn.classList.add('disabled');
            } else {
                buyNowBtn.disabled = false;
                buyNowBtn.style.opacity = '1';
                buyNowBtn.style.cursor = 'pointer';
                buyNowBtn.classList.remove('disabled');
            }
        }
    }
    
    renderAccordion() {
        const accordionContainer = document.querySelector('.product-details-accordion');
        if (!accordionContainer) return;
        
        // Tabla de tallas simplificada
        const sizeGuideHTML = this.renderSimpleSizeGuide();
        
        const detailsHTML = `
            <div class="accordion-item active">
                <div class="accordion-header" onclick="window.productDetailManager.toggleAccordion(this)">
                    <h4>ESPECIFICACIONES Y TALLAS</h4>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content" style="max-height: 500px;">
                    <table class="details-table" id="specifications-table">
                        <tbody>
                            <tr>
                                <td><strong>Material</strong></td>
                                <td>${this.product.material || 'Poliamida, Elastano'}</td>
                            </tr>
                            <tr>
                                <td><strong>Categoría</strong></td>
                                <td>${this.formatCategoryName(this.product.categoria)}</td>
                            </tr>
                            <tr>
                                <td><strong>Stock disponible</strong></td>
                                <td>${this.product.stock || 0} unidades</td>
                            </tr>
                            <tr>
                                <td><strong>Tallas disponibles</strong></td>
                                <td>${this.product.tallas ? this.product.tallas.join(', ') : 'Única'}</td>
                            </tr>
                            <tr>
                                <td><strong>Colores disponibles</strong></td>
                                <td>${this.product.colores ? this.product.colores.join(', ') : 'Varios'}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <!-- Guía de tallas integrada -->
                    <div class="integrated-size-guide" id="integrated-size-guide">
                        <h5>GUÍA DE TALLAS (CM)</h5>
                        ${sizeGuideHTML}
                        <div class="size-guide-note">
                            <p><i class="fas fa-info-circle"></i> <strong>¿Cómo elegir tu talla?</strong></p>
                            <ul>
                                <li>Mide tu cintura en la parte más estrecha</li>
                                <li>Mide tus caderas en la parte más ancha</li>
                                <li>Si estás entre dos tallas, elige la superior</li>
                                <li>Nuestras prendas tienen elasticidad para mejor ajuste</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="accordion-item">
                <div class="accordion-header" onclick="window.productDetailManager.toggleAccordion(this)">
                    <h4>CUIDADO Y MANTENIMIENTO</h4>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <ul class="care-list">
                        <li><i class="fas fa-tshirt"></i> Lavar a máquina en agua fría (30°C máximo)</li>
                        <li><i class="fas fa-ban"></i> No usar blanqueador ni suavizantes</li>
                        <li><i class="fas fa-sun"></i> Secar a la sombra, no exponer directamente al sol</li>
                        <li><i class="fas fa-iron"></i> No planchar directamente sobre la tela</li>
                        <li><i class="fas fa-sync-alt"></i> Recomendado lavar del revés para mayor durabilidad</li>
                    </ul>
                </div>
            </div>
            
            <div class="accordion-item">
                <div class="accordion-header" onclick="window.productDetailManager.toggleAccordion(this)">
                    <h4>ENVÍOS </h4>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="shipping-info">
                        <div class="shipping-item">
                            <i class="fas fa-shipping-fast"></i>
                            <div>
                                <h5>Envíos</h5>
                                <p>Atraves de su paqueteria de preferencia</p>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
        `;
        
        accordionContainer.innerHTML = detailsHTML;
    }
    
    // Nueva función para renderizar la tabla de tallas simplificada
    renderSimpleSizeGuide() {
        // Tabla de tallas genérica para leggings (puedes personalizar según categoría)
        const sizeTable = {
            'XS': { 'Talla': 'XS', 'Cintura (cm)': '60-66', 'Cadera (cm)': '86-92', 'Altura': '155-165' },
            'S': { 'Talla': 'S', 'Cintura (cm)': '67-73', 'Cadera (cm)': '93-99', 'Altura': '160-170' },
            'M': { 'Talla': 'M', 'Cintura (cm)': '74-80', 'Cadera (cm)': '100-106', 'Altura': '165-175' },
            'L': { 'Talla': 'L', 'Cintura (cm)': '81-87', 'Cadera (cm)': '107-113', 'Altura': '170-180' },
            'XL': { 'Talla': 'XL', 'Cintura (cm)': '88-94', 'Cadera (cm)': '114-120', 'Altura': '175-185' }
        };
        
        const sizes = ['XS', 'S', 'M', 'L', 'XL'];
        const columns = ['Talla', 'Cintura (cm)', 'Cadera (cm)', 'Altura'];
        
        let tableHTML = `
            <div class="simple-size-table-container">
                <table class="simple-size-table">
                    <thead>
                        <tr>
        `;
        
        // Encabezados de columna
        columns.forEach(col => {
            tableHTML += `<th>${col}</th>`;
        });
        
        tableHTML += `</tr></thead><tbody>`;
        
        // Filas de datos
        sizes.forEach(size => {
            tableHTML += `<tr>`;
            columns.forEach(col => {
                const value = sizeTable[size][col];
                const isSizeLabel = col === 'Talla';
                const isRecommended = this.selectedSize === size;
                
                tableHTML += `
                    <td class="${isSizeLabel ? 'size-label' : ''} ${isRecommended ? 'highlight' : ''}">
                        ${value}
                    </td>
                `;
            });
            tableHTML += `</tr>`;
        });
        
        tableHTML += `</tbody></table></div>`;
        
        return tableHTML;
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
            'pants': 'Pantalones'
        };
        
        return categoryMap[category] || 
               category.charAt(0).toUpperCase() + category.slice(1);
    }
    
    toggleAccordion(header) {
        const item = header.closest('.accordion-item');
        const content = item.querySelector('.accordion-content');
        const icon = header.querySelector('.accordion-icon');
        
        if (item.classList.contains('active')) {
            item.classList.remove('active');
            content.style.maxHeight = '0';
            content.style.paddingBottom = '0';
            icon.style.transform = 'rotate(0deg)';
        } else {
            // Cerrar otros acordeones
            document.querySelectorAll('.accordion-item.active').forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    otherItem.querySelector('.accordion-content').style.maxHeight = '0';
                    otherItem.querySelector('.accordion-content').style.paddingBottom = '0';
                    otherItem.querySelector('.accordion-icon').style.transform = 'rotate(0deg)';
                }
            });
            
            // Abrir este
            item.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            content.style.paddingBottom = '20px';
            icon.style.transform = 'rotate(180deg)';
        }
    }
    
    async loadRecommendations() {
        const recommendationsGrid = document.querySelector('.recommendations-grid');
        if (!recommendationsGrid) return;
        
        try {
            // Mostrar loading
            recommendationsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 30px;">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Cargando recomendaciones...</p>
                </div>
            `;
            
            // Cargar todos los productos
            const response = await fetch('/api/products');
            if (!response.ok) return;
            
            const allProducts = await response.json();
            
            // Filtrar productos de la misma categoría (excluyendo el actual)
            const recommendations = allProducts
                .filter(p => p.id !== this.product.id && p.categoria === this.product.categoria)
                .slice(0, 4);
            
            if (recommendations.length > 0) {
                recommendationsGrid.innerHTML = recommendations.map(product => `
                    <div class="product-card">
                        <div class="product-image">
                            <img src="${product.imagen || '/public/images/default-product.jpg'}" 
                                 alt="${product.nombre}"
                                 onerror="this.src='/public/images/default-product.jpg'"
                                 style="width: 100%; height: 250px; object-fit: cover;">
                        </div>
                        <div class="product-info">
                            <h3>${product.nombre}</h3>
                            <p class="price">$${parseFloat(product.precio).toFixed(2)}</p>
                            <a href="/product-detail.html?id=${product.id}" class="btn btn-small">
                                Ver Detalles
                            </a>
                        </div>
                    </div>
                `).join('');
            } else {
                recommendationsGrid.innerHTML = `
                    <p style="grid-column: 1/-1; text-align: center; color: var(--gray-text); padding: 30px;">
                        No hay productos recomendados disponibles en esta categoría
                    </p>
                `;
            }
            
        } catch (error) {
            console.error('Error cargando recomendaciones:', error);
            recommendationsGrid.innerHTML = `
                <p style="grid-column: 1/-1; text-align: center; color: var(--gray-text); padding: 30px;">
                    No se pudieron cargar las recomendaciones
                </p>
            `;
        }
    }
    
    updateBreadcrumb() {
        const breadcrumbCurrent = document.querySelector('.breadcrumb .current');
        if (breadcrumbCurrent && this.product) {
            breadcrumbCurrent.textContent = this.product.nombre;
        }
    }
    
    setupEventListeners() {
        // Agregar al carrito
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => this.addToCart());
        }
        
        // Comprar ahora
        const buyNowBtn = document.getElementById('buy-now-btn');
        if (buyNowBtn) {
            buyNowBtn.addEventListener('click', () => this.buyNow());
        }
        
        // Wishlist
        const wishlistBtn = document.getElementById('wishlist-btn');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', () => this.toggleWishlist());
        }
        
        // Compartir en redes sociales
        this.setupSocialSharing();
        
        console.log('✅ Event listeners configurados');
    }
    
    addToCart() {
        if (!this.product || this.product.stock <= 0) {
            this.showNotification('❌ Producto agotado', 'error');
            return;
        }
        
        // Validar que se haya seleccionado talla si hay disponibles
        if (this.product.tallas && this.product.tallas.length > 0 && !this.selectedSize) {
            this.showNotification('⚠️ Por favor selecciona una talla', 'info');
            return;
        }
        
        // Validar que se haya seleccionado color si hay disponibles
        if (this.product.colores && this.product.colores.length > 0 && !this.selectedColor) {
            this.showNotification('⚠️ Por favor selecciona un color', 'info');
            return;
        }
        
        const cartItem = {
            id: this.product.id,
            nombre: this.product.nombre,
            precio: parseFloat(this.product.precio),
            imagen: this.product.imagen || '/public/images/default-product.jpg',
            categoria: this.product.categoria,
            quantity: this.quantity,
            talla: this.selectedSize,
            color: this.selectedColor,
            stock: this.product.stock,
            sku: this.product.sku || `SKU-${this.product.id}`,
            agregado: new Date().toISOString()
        };
        
        // Obtener carrito actual
        let cart = JSON.parse(localStorage.getItem('mabel_cart')) || [];
        
        // Verificar si el producto ya está en el carrito (misma talla y color)
        const existingIndex = cart.findIndex(item => 
            item.id === cartItem.id && 
            item.talla === cartItem.talla && 
            item.color === cartItem.color
        );
        
        if (existingIndex >= 0) {
            // Actualizar cantidad
            const nuevaCantidad = cart[existingIndex].quantity + cartItem.quantity;
            const stockDisponible = cart[existingIndex].stock;
            
            if (nuevaCantidad > stockDisponible) {
                this.showNotification(`⚠️ Solo quedan ${stockDisponible} unidades disponibles`, 'error');
                return;
            }
            
            cart[existingIndex].quantity = nuevaCantidad;
            this.showNotification(`✏️ Cantidad actualizada: ${cartItem.nombre} (${nuevaCantidad})`, 'success');
        } else {
            // Agregar nuevo item
            cart.push(cartItem);
            this.showNotification(`✅ "${cartItem.nombre}" agregado al carrito`, 'success');
        }
        
        // Guardar en localStorage
        localStorage.setItem('mabel_cart', JSON.stringify(cart));
        
        // Actualizar contador del carrito
        this.updateCartCount();
        
        console.log('🛒 Producto agregado al carrito:', cartItem);
    }
    
    buyNow() {
        // Primero agregar al carrito
        this.addToCart();
        
        // Redirigir al carrito después de un breve delay
        setTimeout(() => {
            window.location.href = '/cart';
        }, 800);
    }
    
    toggleWishlist() {
        const wishlistBtn = document.getElementById('wishlist-btn');
        if (!wishlistBtn) return;
        
        const icon = wishlistBtn.querySelector('i');
        const productId = this.product.id;
        
        // Obtener wishlist actual
        let wishlist = JSON.parse(localStorage.getItem('mabel_wishlist')) || [];
        
        // Verificar si ya está en la wishlist
        const existingIndex = wishlist.findIndex(item => item.id === productId);
        
        if (existingIndex >= 0) {
            // Remover de wishlist
            wishlist.splice(existingIndex, 1);
            icon.classList.remove('fas');
            icon.classList.add('far');
            wishlistBtn.style.color = '';
            this.showNotification('❤️ Removido de favoritos', 'info');
        } else {
            // Agregar a wishlist
            wishlist.push({
                id: this.product.id,
                nombre: this.product.nombre,
                precio: this.product.precio,
                imagen: this.product.imagen,
                sku: this.product.sku
            });
            icon.classList.remove('far');
            icon.classList.add('fas');
            wishlistBtn.style.color = '#ff3b30';
            this.showNotification('❤️ Agregado a favoritos', 'success');
        }
        
        // Guardar wishlist actualizada
        localStorage.setItem('mabel_wishlist', JSON.stringify(wishlist));
    }
    
    setupSocialSharing() {
        const shareUrl = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(this.product.nombre);
        const image = encodeURIComponent(this.product.imagen || '');
        const description = encodeURIComponent(this.product.descripcion || '');
        
        // Facebook
        const facebookBtn = document.getElementById('share-facebook');
        if (facebookBtn) {
            facebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${title}`;
            facebookBtn.target = '_blank';
            facebookBtn.rel = 'noopener noreferrer';
        }
        
        // Instagram (solo enlace directo)
        const instagramBtn = document.getElementById('share-instagram');
        if (instagramBtn) {
            instagramBtn.href = `https://www.instagram.com/`;
            instagramBtn.target = '_blank';
            instagramBtn.rel = 'noopener noreferrer';
        }
        
        // Pinterest
        const pinterestBtn = document.getElementById('share-pinterest');
        if (pinterestBtn) {
            pinterestBtn.href = `https://pinterest.com/pin/create/button/?url=${shareUrl}&media=${image}&description=${title}`;
            pinterestBtn.target = '_blank';
            pinterestBtn.rel = 'noopener noreferrer';
        }
        
        // WhatsApp
        const whatsappBtn = document.getElementById('share-whatsapp');
        if (whatsappBtn) {
            whatsappBtn.href = `https://wa.me/?text=${title}%20${shareUrl}`;
            whatsappBtn.target = '_blank';
            whatsappBtn.rel = 'noopener noreferrer';
        }
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
        
        // Agregar estilos de animación si no existen
        if (!document.querySelector('#notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    showError(message) {
        const detailSection = document.querySelector('.product-detail-section');
        if (detailSection) {
            detailSection.innerHTML = `
                <div style="text-align: center; padding: 80px 20px;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="color: #ccc; margin-bottom: 30px;"></i>
                    <h2 style="margin-bottom: 20px; font-weight: 300;">${message}</h2>
                    <p style="color: var(--gray-text); margin-bottom: 30px;">
                        El producto solicitado no está disponible o ha sido eliminado.
                    </p>
                    <a href="/shop" class="btn" style="margin-top: 20px;">
                        <i class="fas fa-arrow-left"></i> Volver a la tienda
                    </a>
                </div>
            `;
        }
    }
}

// js/wishlist.js - Script para manejar wishlist en páginas de productos
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

        // Botones en listado de productos (shop.html, ofertas.html, etc.)
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
            const wishlistResponse = await fetch(`/api/wishlist/check/${productId}`);
            const data = await wishlistResponse.json();
            
            this.updateWishlistButton(productId, data.in_wishlist);
            
        } catch (error) {
            console.error('Error verificando wishlist:', error);
        }
    }

    async toggleWishlist() {
        const wishlistBtn = document.getElementById('wishlist-btn');
        if (!wishlistBtn) return;
        
        const icon = wishlistBtn.querySelector('i');
        const productId = this.product.id;
        
        try {
            // Verificar si el usuario está autenticado
            const sessionResponse = await fetch('/api/session');
            const session = await sessionResponse.json();
            
            if (!session.authenticated) {
                this.showNotification('Debes iniciar sesión para usar la wishlist', 'error');
                setTimeout(() => {
                    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
                }, 1500);
                return;
            }
            
            // Verificar si ya está en la wishlist
            const checkResponse = await fetch(`/api/wishlist/check/${productId}`);
            const checkData = await checkResponse.json();
            
            if (checkData.in_wishlist) {
                // Eliminar de wishlist
                const deleteResponse = await fetch(`/api/users/${session.user.id}/wishlist/${productId}`, {
                    method: 'DELETE'
                });
                
                if (deleteResponse.ok) {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    wishlistBtn.style.color = '';
                    this.showNotification('❤️ Removido de favoritos', 'info');
                }
            } else {
                // Agregar a wishlist
                const addResponse = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ producto_id: productId })
                });
                
                if (addResponse.ok) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                    wishlistBtn.style.color = '#ff3b30';
                    this.showNotification('❤️ Agregado a favoritos', 'success');
                }
            }
            
        } catch (error) {
            console.error('Error actualizando wishlist:', error);
            this.showNotification('Error al actualizar wishlist', 'error');
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

    async removeFromWishlist(productId) {
        try {
            const sessionResponse = await fetch('/api/session');
            const session = await sessionResponse.json();
            
            const response = await fetch(`/api/users/${session.user.id}/wishlist/${productId}`, {
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, inicializando ProductDetailManager...');
    
    // Verificar si estamos en la página de detalle de producto
    if (document.querySelector('.product-detail-section')) {
        // Hacer las funciones accesibles globalmente
        window.productDetailManager = new ProductDetailManager();
        
        console.log('✅ ProductDetailManager inicializado');
    }
});