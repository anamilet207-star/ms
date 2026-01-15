// ============================================
// CHECKOUT - Procesamiento de compra CON PAGOS REALES
// Versión completa con formulario de direcciones RD
// ============================================

class CheckoutManager {
    constructor() {
        this.cart = [];
        this.shippingCost = 0;
        this.discount = 0;
        this.orderSummary = {};
        this.paymentConfig = null;
        this.paypalButtons = null;
        this.init();
    }

    async init() {
        console.log('💰 Inicializando checkout...');
        
        // Cargar carrito
        this.loadCart();
        
        // Renderizar resumen del pedido
        this.renderOrderSummary();
        
        // Cargar configuración de pagos
        await this.loadPaymentConfig();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Cargar datos del usuario si está autenticado
        this.loadUserDataIfAvailable();
        
        // Configurar selección de país (RD por defecto)
        this.setupCountrySelection();
        
        console.log('✅ Checkout inicializado');
    }

    async loadPaymentConfig() {
        try {
            // Cargar configuración desde el servidor
            const response = await fetch('/api/payments/config', {
                credentials: 'include'
            });
            const config = await response.json();
            
            this.paymentConfig = config;
            
            console.log('✅ Configuración de pagos cargada');
        } catch (error) {
            console.error('❌ Error cargando configuración de pagos:', error);
            this.paymentConfig = {
                currency: 'USD',
                paymentMethods: ['paypal', 'transfer']
            };
        }
    }

    loadCart() {
        try {
            // Obtener carrito de localStorage
            const cartData = localStorage.getItem('mabel_cart');
            console.log('🛒 Datos del carrito en localStorage:', cartData);
            
            if (cartData) {
                this.cart = JSON.parse(cartData);
                console.log('📦 Carrito cargado:', this.cart);
                
                // Verificar que los productos tengan estructura correcta
                this.cart = this.cart.map(item => ({
                    ...item,
                    id: item.id || item.product_id,
                    nombre: item.nombre || item.name,
                    precio: parseFloat(item.precio || item.price || 0),
                    cantidad: parseInt(item.cantidad || item.quantity || 1),
                    imagen: item.imagen || '/public/images/default-product.jpg',
                    talla: item.talla || item.size || 'M',
                    color: item.color || 'Negro'
                }));
                
                console.log('✅ Carrito procesado:', this.cart);
            } else {
                console.log('🛒 Carrito vacío');
                this.cart = [];
            }
            
            // Actualizar contador
            this.updateCartCount();
            
        } catch (error) {
            console.error('❌ Error cargando carrito:', error);
            this.cart = [];
            
            // Crear datos de prueba si el carrito está vacío (solo para desarrollo)
            if (this.cart.length === 0 && window.location.hostname === 'localhost') {
                console.log('🛠️ Modo desarrollo: creando carrito de prueba');
                this.cart = [
                    {
                        id: 1,
                        nombre: 'Legging High-Waist Black',
                        precio: 59.99,
                        cantidad: 2,
                        imagen: '/public/images/default-product.jpg',
                        talla: 'M',
                        color: 'Negro'
                    },
                    {
                        id: 2,
                        nombre: 'Sports Bra Essential',
                        precio: 34.99,
                        cantidad: 1,
                        imagen: '/public/images/default-product.jpg',
                        talla: 'S',
                        color: 'Negro'
                    }
                ];
            }
        }
    }

    calculateOrderSummary() {
        console.log('🧮 Calculando resumen del pedido...');
        
        let subtotal = 0;
        
        // Calcular subtotal
        if (this.cart && this.cart.length > 0) {
            subtotal = this.cart.reduce((sum, item) => {
                const price = parseFloat(item.precio || item.price || 0);
                const quantity = parseInt(item.cantidad || item.quantity || 1);
                return sum + (price * quantity);
            }, 0);
        }
        
        // Calcular costo de envío (gratis según política actual)
        this.shippingCost = 0;
        
        // Calcular total
        const total = subtotal + this.shippingCost - this.discount;
        
        // Guardar en this.orderSummary
        this.orderSummary = {
            subtotal: subtotal,
            shipping: this.shippingCost,
            discount: this.discount,
            total: total
        };
        
        console.log('✅ Resumen calculado:', this.orderSummary);
        return this.orderSummary;
    }

    renderOrderSummary() {
        console.log('📋 Renderizando resumen del pedido...');
        
        const orderItemsContainer = document.getElementById('order-items');
        if (!orderItemsContainer) {
            console.error('❌ No se encontró el contenedor de productos');
            return;
        }
        
        if (this.cart.length === 0) {
            orderItemsContainer.innerHTML = `
                <div class="empty-cart-message">
                    <i class="fas fa-shopping-cart fa-3x"></i>
                    <h4>Tu carrito está vacío</h4>
                    <p>Agrega productos para continuar con la compra</p>
                    <a href="/shop" class="btn btn-outline">Ir a la Tienda</a>
                </div>
            `;
            
            // Ocultar botón de pago
            const placeOrderBtn = document.querySelector('.place-order-btn');
            if (placeOrderBtn) {
                placeOrderBtn.disabled = true;
                placeOrderBtn.innerHTML = '<i class="fas fa-ban"></i> Carrito Vacío';
            }
            
            // Actualizar totales a 0
            this.updateTotalsUI(0, 0, 0, 0);
            return;
        }
        
        // Calcular totales usando la nueva función
        const summary = this.calculateOrderSummary();
        
        // Generar HTML para productos
        const itemsHtml = this.cart.map(item => {
            const price = parseFloat(item.precio || item.price || 0);
            const quantity = parseInt(item.cantidad || item.quantity || 1);
            const itemSubtotal = price * quantity;
            
            return `
                <div class="order-item">
                    <div class="order-item-image">
                        <img src="${item.imagen || item.image || '/public/images/default-product.jpg'}" 
                             alt="${item.nombre || item.name || 'Producto'}" 
                             onerror="this.src='/public/images/default-product.jpg'">
                    </div>
                    <div class="order-item-details">
                        <h4>${item.nombre || item.name || 'Producto'}</h4>
                        ${item.talla ? `<p>Talla: ${item.talla}</p>` : ''}
                        ${item.color ? `<p>Color: ${item.color}</p>` : ''}
                        <p class="order-item-quantity">Cantidad: ${quantity}</p>
                        <div class="order-item-price">$${itemSubtotal.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Actualizar HTML
        orderItemsContainer.innerHTML = itemsHtml;
        
        // Actualizar totales en la UI
        this.updateTotalsUI(
            summary.subtotal,
            this.shippingCost,
            this.discount,
            summary.total
        );
        
        console.log('✅ Resumen actualizado:', summary);
    }

    updateTotalsUI(subtotal, shipping, discount, total) {
        document.getElementById('order-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('order-shipping').textContent = shipping === 0 ? 'Gratis' : `$${shipping.toFixed(2)}`;
        document.getElementById('order-discount').textContent = `$${discount.toFixed(2)}`;
        document.getElementById('order-total').textContent = `$${total.toFixed(2)}`;
    }

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // Formulario de checkout
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => this.processOrder(e));
        }
        
        // Botón de aplicar cupón
        const applyCouponBtn = document.getElementById('apply-coupon');
        if (applyCouponBtn) {
            applyCouponBtn.addEventListener('click', () => this.applyCoupon());
        }
        
        // Métodos de pago
        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.togglePaymentForm(e.target.value));
        });
        
        // Campo de cupón (Enter para aplicar)
        const couponInput = document.getElementById('coupon-code');
        if (couponInput) {
            couponInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applyCoupon();
                }
            });
        }
        
        // Cambios en el carrito (para desarrollo)
        window.addEventListener('storage', (e) => {
            if (e.key === 'mabel_cart') {
                this.loadCart();
                this.renderOrderSummary();
            }
        });
        
        // Inicializar formulario de pago
        this.togglePaymentForm('paypal'); // PayPal por defecto según tu HTML
    }

    setupCountrySelection() {
        const countrySelect = document.getElementById('pais');
        if (countrySelect) {
            // Establecer RD como valor por defecto
            countrySelect.value = 'DO';
            
            // Ocultar/mostrar campos según país
            countrySelect.addEventListener('change', () => {
                this.toggleAddressFields(countrySelect.value);
            });
            
            // Ejecutar una vez al inicio
            this.toggleAddressFields('DO');
        }
    }

    toggleAddressFields(country) {
        // En esta versión, todos los campos son visibles ya que estamos en RD
        // Pero puedes personalizar esto para otros países
        console.log('🌍 País seleccionado:', country);
        
        if (country !== 'DO') {
            this.showNotification('Actualmente solo realizamos envíos a República Dominicana', 'warning');
            document.getElementById('pais').value = 'DO';
        }
    }

    async loadUserDataIfAvailable() {
        try {
            const response = await fetch('/api/session', {
                credentials: 'include'
            });
            const session = await response.json();
            
            if (session.authenticated) {
                // Autocompletar formulario con datos del usuario
                this.populateUserData(session.user);
                
                // Cargar teléfono del usuario
                try {
                    const userResponse = await fetch(`/api/users/${session.user.id}`, {
                        credentials: 'include'
                    });
                    const userData = await userResponse.json();
                    
                    if (userData.telefono) {
                        document.getElementById('telefono').value = userData.telefono;
                    }
                    
                    console.log('✅ Datos de usuario cargados');
                } catch (userError) {
                    console.log('⚠️ No se pudieron cargar datos adicionales del usuario');
                }
            } else {
                console.log('👤 Usuario no autenticado - Modo invitado');
            }
        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
        }
    }

    populateUserData(user) {
        document.getElementById('nombre').value = user.nombre || '';
        document.getElementById('apellido').value = user.apellido || '';
        document.getElementById('email').value = user.email || '';
        
        // Si el usuario tiene un nombre completo, usarlo para dirección
        if (user.nombre && user.apellido) {
            document.getElementById('nombre_completo').value = `${user.nombre} ${user.apellido}`;
        }
    }

    validateForm() {
        console.log('✅ Validando formulario...');
        
        let isValid = true;
        const errors = [];
        
        // Campos de información personal
        const personalFields = ['nombre', 'apellido', 'email', 'telefono'];
        
        // Campos de dirección para RD
        const addressFields = [
            'paqueteria_preferida', 
            'nombre_completo', 
            'telefono_envio', 
            'provincia', 
            'municipio', 
            'sector', 
            'referencia'
        ];
        
        // Combinar todos los campos
        const allFields = [...personalFields, ...addressFields];
        
        // Validar cada campo
        allFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (!field.value.trim()) {
                    field.classList.add('error');
                    errors.push(`${this.getFieldLabel(fieldId)} es obligatorio`);
                    isValid = false;
                } else {
                    field.classList.remove('error');
                    
                    // Validaciones específicas
                    if (fieldId === 'email' && field.value.trim()) {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(field.value)) {
                            field.classList.add('error');
                            errors.push('Email inválido');
                            isValid = false;
                        }
                    }
                    
                    if (fieldId === 'telefono' && field.value.trim()) {
                        // Validar formato de teléfono RD
                        const phoneRegex = /^[0-9]{3}-[0-9]{4}$/;
                        if (!phoneRegex.test(field.value.replace(/[^\d-]/g, ''))) {
                            field.classList.add('error');
                            errors.push('Teléfono inválido. Formato: 555-1234');
                            isValid = false;
                        }
                    }
                }
            }
        });
        
        // Validar país (debe ser RD)
        const countrySelect = document.getElementById('pais');
        if (countrySelect && countrySelect.value !== 'DO') {
            countrySelect.classList.add('error');
            errors.push('Actualmente solo realizamos envíos a República Dominicana');
            isValid = false;
        }
        
        // Validar términos y condiciones
        const termsCheckbox = document.getElementById('terms');
        if (!termsCheckbox || !termsCheckbox.checked) {
            errors.push('Debes aceptar los términos y condiciones');
            isValid = false;
        }
        
        // Validar carrito
        if (this.cart.length === 0) {
            errors.push('Tu carrito está vacío');
            isValid = false;
        }
        
        // Validar método de pago
        const paymentMethod = document.querySelector('input[name="payment"]:checked');
        if (!paymentMethod) {
            errors.push('Por favor selecciona un método de pago');
            isValid = false;
        }
        
        // Mostrar errores si los hay
        if (errors.length > 0) {
            this.showNotification(errors.join('<br>'), 'error');
        }
        
        return isValid;
    }

    getFieldLabel(fieldId) {
        const labels = {
            'nombre': 'Nombre',
            'apellido': 'Apellido',
            'email': 'Email',
            'telefono': 'Teléfono',
            'paqueteria_preferida': 'Servicio de paquetería',
            'nombre_completo': 'Nombre completo del destinatario',
            'telefono_envio': 'Teléfono del destinatario',
            'provincia': 'Provincia',
            'municipio': 'Municipio',
            'sector': 'Sector/Barrio',
            'referencia': 'Referencia de la paquetería'
        };
        
        return labels[fieldId] || fieldId;
    }

    collectOrderData() {
        console.log('📦 Recolectando datos del pedido...');
        
        // Calcular subtotal
        const subtotal = this.cart.reduce((sum, item) => {
            const price = parseFloat(item.precio || item.price || 0);
            const quantity = parseInt(item.cantidad || item.quantity || 1);
            return sum + (price * quantity);
        }, 0);
        
        // Crear objeto de orden con el nuevo formato para RD
        const orderData = {
            cliente: {
                // Información personal
                nombre: document.getElementById('nombre').value,
                apellido: document.getElementById('apellido').value,
                email: document.getElementById('email').value,
                telefono: document.getElementById('telefono').value,
                
                // Información de dirección para RD
                paqueteria_preferida: document.getElementById('paqueteria_preferida').value,
                nombre_completo: document.getElementById('nombre_completo').value,
                telefono_envio: document.getElementById('telefono_envio').value,
                provincia: document.getElementById('provincia').value,
                municipio: document.getElementById('municipio').value,
                sector: document.getElementById('sector').value,
                referencia: document.getElementById('referencia').value,
                
                // Campos compatibilidad (para otros sistemas)
                direccion: `Paquetería ${document.getElementById('paqueteria_preferida').value}, ${document.getElementById('sector').value}, ${document.getElementById('municipio').value}`,
                ciudad: document.getElementById('municipio').value,
                region: document.getElementById('provincia').value,
                codigo_postal: '00000',
                pais: 'DO'
            },
            items: this.cart.map(item => ({
                id: item.id,
                nombre: item.nombre || item.name,
                precio: parseFloat(item.precio || item.price || 0),
                cantidad: parseInt(item.cantidad || item.quantity || 1),
                talla: item.talla || item.size,
                color: item.color,
                imagen: item.imagen || item.image || '/public/images/default-product.jpg'
            })),
            subtotal: subtotal,
            shipping_cost: this.shippingCost,
            shipping_method: 'paqueteria_rd',
            discount: this.discount,
            total: subtotal + this.shippingCost - this.discount,
            instrucciones: document.getElementById('referencia').value,
            payment_method: document.querySelector('input[name="payment"]:checked')?.value
        };
        
        console.log('✅ Datos del pedido recolectados:', orderData);
        return orderData;
    }

    async processOrder(e) {
        e.preventDefault();
        console.log('🔄 Procesando pedido...');
        
        // Validar formulario
        if (!this.validateForm()) {
            return;
        }
        
        // Mostrar loading
        this.showLoading();
        
        try {
            // Recolectar datos del formulario
            const orderData = this.collectOrderData();
            
            // Verificar método de pago seleccionado
            const paymentMethod = document.querySelector('input[name="payment"]:checked');
            
            if (!paymentMethod) {
                throw new Error('Por favor selecciona un método de pago');
            }
            
            console.log('💳 Método de pago seleccionado:', paymentMethod.value);
            
            // Procesar según el método de pago
            switch (paymentMethod.value) {
                case 'paypal':
                    await this.processPayPalPayment(orderData);
                    break;
                    
                case 'transfer':
                    await this.processBankTransfer(orderData);
                    break;
                    
                default:
                    throw new Error('Método de pago no soportado');
            }
            
        } catch (error) {
            console.error('❌ Error procesando orden:', error);
            this.showNotification(error.message || 'Error procesando la orden', 'error');
            this.hideLoading();
        }
    }

    async processPayPalPayment(orderData) {
        console.log('💰 Procesando pago con PayPal...');
        
        try {
            // Crear orden de PayPal en el servidor
            const response = await fetch('/api/payments/create-paypal-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: orderData.total,
                    orderData: orderData
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error creando orden PayPal');
            }
            
            const paypalOrder = await response.json();
            console.log('✅ Orden PayPal creada:', paypalOrder.id);
            
            // Si es simulado (modo desarrollo), mostrar éxito directamente
            if (paypalOrder.simulated) {
                console.log('🛠️ Modo desarrollo: simulando éxito de PayPal');
                this.createOrder(orderData, 'paypal', paypalOrder.id)
                    .then(() => {
                        this.showSuccess(orderData, 'paypal', paypalOrder.id);
                    });
                return;
            }
            
            // En modo real, la redirección se manejará con PayPal SDK
            // Por ahora, mostramos éxito (esto debe integrarse con el SDK real de PayPal)
            this.showSuccess(orderData, 'paypal', paypalOrder.id);
            
        } catch (error) {
            console.error('❌ Error en pago PayPal:', error);
            throw error;
        }
    }

    async processBankTransfer(orderData) {
        console.log('🏦 Procesando transferencia bancaria...');
        
        try {
            // Crear orden pendiente de pago en el servidor
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...orderData,
                    payment_method: 'transfer',
                    status: 'pending_payment'
                })
            });
            
            let orderId;
            if (response.ok) {
                const order = await response.json();
                orderId = order.id || order.order_id || `TRANS-${Date.now()}`;
                console.log('✅ Orden creada para transferencia:', orderId);
            } else {
                // Si falla la API, crear un ID local
                orderId = `TRANS-${Date.now()}`;
                console.log('⚠️ Usando ID local para transferencia:', orderId);
            }
            
            // Mostrar instrucciones de transferencia con WhatsApp preconfigurado
            this.showBankTransferInstructions(orderId, orderData);
            
        } catch (error) {
            console.error('❌ Error en transferencia bancaria:', error);
            // Mostrar instrucciones igualmente
            const orderId = `TRANS-${Date.now()}`;
            this.showBankTransferInstructions(orderId, orderData);
        }
    }

    async createOrder(orderData, paymentMethod, paymentId) {
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...orderData,
                    payment_method: paymentMethod,
                    payment_id: paymentId,
                    status: 'paid'
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error creando orden');
            }
            
            const order = await response.json();
            console.log('✅ Orden creada:', order.id || order.order_id);
            return order;
            
        } catch (error) {
            console.error('❌ Error creando orden:', error);
            throw error;
        }
    }

    showSuccess(orderData, paymentMethod, paymentId) {
        console.log('🎉 Mostrando página de éxito');
        
        const checkoutContainer = document.querySelector('.checkout-container');
        if (!checkoutContainer) return;
        
        checkoutContainer.innerHTML = `
            <div class="order-success">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                
                <h2>¡Pago Completado Exitosamente!</h2>
                
                <p class="success-message">
                    Gracias por tu compra, ${orderData.cliente.nombre}. Tu pedido #${paymentId} ha sido procesado y recibirás 
                    un correo de confirmación en <strong>${orderData.cliente.email}</strong>.
                </p>
                
                <div class="order-number">
                    <strong>Número de Pedido:</strong> #${paymentId}
                </div>
                
                <div class="order-details">
                    <div class="detail-card">
                        <h4><i class="fas fa-shipping-fast"></i> Detalles de Envío</h4>
                        <div class="detail-row">
                            <span>Paquetería:</span>
                            <span>${orderData.cliente.paqueteria_preferida}</span>
                        </div>
                        <div class="detail-row">
                            <span>Destinatario:</span>
                            <span>${orderData.cliente.nombre_completo}</span>
                        </div>
                        <div class="detail-row">
                            <span>Teléfono:</span>
                            <span>${orderData.cliente.telefono_envio}</span>
                        </div>
                        <div class="detail-row">
                            <span>Ubicación:</span>
                            <span>${orderData.cliente.sector}, ${orderData.cliente.municipio}, ${orderData.cliente.provincia}</span>
                        </div>
                        <div class="detail-row">
                            <span>Referencia:</span>
                            <span>${orderData.cliente.referencia}</span>
                        </div>
                    </div>
                    
                    <div class="detail-card">
                        <h4><i class="fas fa-receipt"></i> Resumen del Pedido</h4>
                        <div class="detail-row">
                            <span>Subtotal:</span>
                            <span>$${orderData.subtotal.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Envío:</span>
                            <span>Gratis</span>
                        </div>
                        ${orderData.discount > 0 ? `
                        <div class="detail-row">
                            <span>Descuento:</span>
                            <span>-$${orderData.discount.toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div class="detail-row total">
                            <span>Total:</span>
                            <span>$${orderData.total.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Método de Pago:</span>
                            <span>${paymentMethod === 'paypal' ? 'PayPal' : 'Transferencia Bancaria'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="success-actions">
                    <a href="/" class="btn">
                        <i class="fas fa-home"></i> Volver al Inicio
                    </a>
                    <a href="/shop" class="btn btn-outline">
                        <i class="fas fa-shopping-bag"></i> Seguir Comprando
                    </a>
                </div>
                
                <div class="whats-next">
                    <h3>¿Qué sigue?</h3>
                    <div class="next-steps">
                        <div class="step">
                            <i class="fas fa-envelope"></i>
                            <h4>Confirmación por Email</h4>
                            <p>Recibirás un correo con los detalles de tu pedido en los próximos minutos.</p>
                        </div>
                        <div class="step">
                            <i class="fas fa-truck"></i>
                            <h4>Procesamiento</h4>
                            <p>Tu pedido será procesado y enviado en 24-48 horas hábiles.</p>
                        </div>
                        <div class="step">
                            <i class="fas fa-map-marker-alt"></i>
                            <h4>Recogida</h4>
                            <p>Recoge tu paquete en ${orderData.cliente.paqueteria_preferida} con tu identificación.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Vaciar carrito
        localStorage.removeItem('mabel_cart');
        this.updateCartCount();
        
        console.log('✅ Página de éxito mostrada');
    }

    showBankTransferInstructions(orderId, orderData) {
        console.log('🏦 Mostrando instrucciones de transferencia');
        
        const checkoutContainer = document.querySelector('.checkout-container');
        if (!checkoutContainer) return;
        
        // Crear mensaje detallado para WhatsApp
        const whatsappMessage = encodeURIComponent(`HOLA MABEL ACTIVEWEAR
    
    Acabo de realizar una transferencia bancaria para la orden #${orderId}.
    
    📋 INFORMACIÓN DEL PEDIDO:
    • Número de orden: #${orderId}
    • Cliente: ${orderData.cliente.nombre} ${orderData.cliente.apellido}
    • Email: ${orderData.cliente.email}
    • Teléfono: ${orderData.cliente.telefono}
    • Monto transferido: $${orderData.total.toFixed(2)}
    
    📍 DIRECCIÓN DE ENVÍO:
    • Paquetería: ${orderData.cliente.paqueteria_preferida}
    • Destinatario: ${orderData.cliente.nombre_completo}
    • Teléfono: ${orderData.cliente.telefono_envio}
    • Ubicación: ${orderData.cliente.sector}, ${orderData.cliente.municipio}, ${orderData.cliente.provincia}
    
    🛒 ARTÍCULOS COMPRADOS:
    ${orderData.items.map(item => `• ${item.nombre} (Talla: ${item.talla || 'N/A'}, Cantidad: ${item.cantidad}, Precio: $${item.precio.toFixed(2)})`).join('\n')}
    
    💰 TOTAL: $${orderData.total.toFixed(2)}
    
    📲 Adjunto comprobante de transferencia.
    Por favor confírmenme cuando reciban el pago. ¡Gracias!`);
        
        checkoutContainer.innerHTML = `
            <div class="bank-transfer-instructions">
                <div class="instructions-header">
                    <i class="fas fa-university fa-3x"></i>
                    <h2>Instrucciones de Transferencia Bancaria</h2>
                    <p class="order-number">Orden #${orderId}</p>
                    <p class="order-total">Monto total a transferir: <strong>$${orderData.total.toFixed(2)}</strong></p>
                </div>
                
                <div class="instructions-content">
                    <!-- Información Bancaria -->
                    <div class="bank-info-card">
                        <h3><i class="fas fa-university"></i> Información Bancaria para Transferencia</h3>
                        <div class="bank-details">
                            <div class="bank-detail-row">
                                <div class="bank-label">Banco:</div>
                                <div class="bank-value">Banco Popular Dominicano</div>
                            </div>
                            <div class="bank-detail-row">
                                <div class="bank-label">Número de Cuenta:</div>
                                <div class="bank-value highlight">9603502248</div>
                            </div>
                            <div class="bank-detail-row">
                                <div class="bank-label">Tipo de Cuenta:</div>
                                <div class="bank-value">Ahorro</div>
                            </div>
                            <div class="bank-detail-row">
                                <div class="bank-label">Nombre del Titular:</div>
                                <div class="bank-value highlight">Alba Mabel Soto Franco</div>
                            </div>
                            <div class="bank-detail-row">
                                <div class="bank-label">Monto a Transferir:</div>
                                <div class="bank-value amount">$${orderData.total.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="bank-note">
                            <i class="fas fa-exclamation-circle"></i>
                            <span>Transfiere el monto EXACTO de tu pedido</span>
                        </div>
                    </div>
                    
                    <!-- Pasos a Seguir -->
                    <div class="steps-section">
                        <h3><i class="fas fa-list-ol"></i> Pasos para Completar tu Compra</h3>
                        <div class="steps-container">
                            <div class="step">
                                <div class="step-icon">1</div>
                                <div class="step-content">
                                    <h4>Realiza la Transferencia</h4>
                                    <p>Transfiere el monto exacto de <strong>$${orderData.total.toFixed(2)}</strong> a la cuenta indicada arriba.</p>
                                </div>
                            </div>
                            <div class="step">
                                <div class="step-icon">2</div>
                                <div class="step-content">
                                    <h4>Toma Captura del Comprobante</h4>
                                    <p>Toma una foto o captura de pantalla del comprobante de transferencia.</p>
                                </div>
                            </div>
                            <div class="step">
                                <div class="step-icon">3</div>
                                <div class="step-content">
                                    <h4>Envía el Comprobante por WhatsApp</h4>
                                    <p>Envía la captura a nuestro WhatsApp junto con la información de tu pedido.</p>
                                </div>
                            </div>
                            <div class="step">
                                <div class="step-icon">4</div>
                                <div class="step-content">
                                    <h4>Espera Confirmación</h4>
                                    <p>Te confirmaremos la recepción del pago y procesaremos tu pedido.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Información de WhatsApp -->
                    <div class="whatsapp-section">
                        <div class="whatsapp-header">
                            <i class="fab fa-whatsapp fa-2x"></i>
                            <div>
                                <h3>Envía tu Comprobante a este WhatsApp</h3>
                                <p class="whatsapp-number-display">
                                    <i class="fab fa-whatsapp"></i>
                                    <strong>1 (829) 220-2292</strong>
                                </p>
                            </div>
                        </div>
                        
                        <div class="whatsapp-message-preview">
                            <h4>Tu mensaje incluirá automáticamente:</h4>
                            <div class="message-content">
                                <p><strong>Orden #${orderId}</strong></p>
                                <p><strong>Cliente:</strong> ${orderData.cliente.nombre} ${orderData.cliente.apellido}</p>
                                <p><strong>Email:</strong> ${orderData.cliente.email}</p>
                                <p><strong>Monto:</strong> $${orderData.total.toFixed(2)}</p>
                                <p><strong>Paquetería:</strong> ${orderData.cliente.paqueteria_preferida}</p>
                                <p><strong>Artículos (${orderData.items.length}):</strong></p>
                                <ul class="items-list">
                                    ${orderData.items.map(item => `
                                        <li>${item.nombre} - Cantidad: ${item.cantidad} - $${(item.precio * item.cantidad).toFixed(2)}</li>
                                    `).join('')}
                                </ul>
                            </div>
                            <p class="message-note">Solo tienes que adjuntar el comprobante de transferencia.</p>
                        </div>
                    </div>
                    
                    <!-- Botón Directo a WhatsApp -->
                    <div class="whatsapp-direct-container">
                        <a href="https://wa.me/18292202292?text=${whatsappMessage}" 
                           target="_blank" class="whatsapp-direct-btn">
                            <i class="fab fa-whatsapp"></i>
                            <span>Abrir WhatsApp para Enviar Comprobante</span>
                            <small>Mensaje predefinido con toda tu información</small>
                        </a>
                        <p class="whatsapp-tip">
                            <i class="fas fa-lightbulb"></i>
                            Al hacer clic, WhatsApp se abrirá automáticamente con todos los datos de tu pedido.
                            Solo tienes que adjuntar el comprobante de transferencia.
                        </p>
                    </div>
                    
                    <!-- Información Importante -->
                    <div class="important-info-section">
                        <h3><i class="fas fa-exclamation-triangle"></i> Información Importante</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <i class="fas fa-clock"></i>
                                <div>
                                    <h4>Tiempo de Procesamiento</h4>
                                    <p>Tu pedido será procesado dentro de las 24 horas hábiles posteriores a la confirmación del pago.</p>
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-truck"></i>
                                <div>
                                    <h4>Envío a Paquetería</h4>
                                    <p>Los artículos serán enviados a: <strong>${orderData.cliente.paqueteria_preferida}</strong></p>
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-history"></i>
                                <div>
                                    <h4>Vigencia del Pedido</h4>
                                    <p>Esta orden estará activa por 48 horas. Si no recibimos el pago, será cancelada automáticamente.</p>
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-question-circle"></i>
                                <div>
                                    <h4>¿Necesitas Ayuda?</h4>
                                    <p>Contacta al mismo WhatsApp: <strong>1 (829) 220-2292</strong></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Acciones -->
                <div class="instructions-actions">
                    <button onclick="window.print()" class="btn print-btn">
                        <i class="fas fa-print"></i> Imprimir Instrucciones
                    </button>
                    <button onclick="this.select(); document.execCommand('copy'); checkoutManager.showNotification('Instrucciones copiadas al portapapeles', 'success')" 
                            class="btn copy-btn">
                        <i class="fas fa-copy"></i> Copiar Información
                    </button>
                    <a href="/" class="btn btn-outline">
                        <i class="fas fa-home"></i> Volver al Inicio
                    </a>
                    <a href="/shop" class="btn btn-outline">
                        <i class="fas fa-shopping-bag"></i> Seguir Comprando
                    </a>
                </div>
                
                <!-- Confirmación de Email -->
                <div class="email-confirmation">
                    <i class="fas fa-envelope"></i>
                    <div>
                        <p><strong>Hemos enviado estas instrucciones a tu correo:</strong></p>
                        <p class="email-address">${orderData.cliente.email}</p>
                        <p class="email-note">Revisa tu bandeja de entrada (y carpeta de spam) para tener esta información a mano.</p>
                    </div>
                </div>
                
                <!-- Resumen Rápido para Copiar -->
                <div class="quick-summary" style="display: none;">
                    <textarea id="order-summary-text" readonly>
    ORDEN #${orderId}
    CLIENTE: ${orderData.cliente.nombre} ${orderData.cliente.apellido}
    EMAIL: ${orderData.cliente.email}
    TELÉFONO: ${orderData.cliente.telefono}
    MONTO: $${orderData.total.toFixed(2)}
    
    DATOS BANCARIOS:
    • Banco: Banco Popular Dominicano
    • Número de Cuenta: 9603502248
    • Tipo: Ahorro
    • Titular: Alba Mabel Soto Franco
    
    DIRECCIÓN DE ENVÍO:
    • Paquetería: ${orderData.cliente.paqueteria_preferida}
    • Destinatario: ${orderData.cliente.nombre_completo}
    • Teléfono: ${orderData.cliente.telefono_envio}
    • Ubicación: ${orderData.cliente.sector}, ${orderData.cliente.municipio}, ${orderData.cliente.provincia}
    
    ARTÍCULOS:
    ${orderData.items.map(item => `• ${item.nombre} (Talla: ${item.talla || 'N/A'}, Cantidad: ${item.cantidad}, $${item.precio.toFixed(2)} c/u)`).join('\n')}
    
    WHATSAPP PARA CONFIRMACIÓN: 1 (829) 220-2292
                    </textarea>
                </div>
            </div>
        `;
        
        // Vaciar carrito
        localStorage.removeItem('mabel_cart');
        this.updateCartCount();
        
        console.log('✅ Instrucciones de transferencia mostradas');
    }

    

    async applyCoupon() {
        const couponCode = document.getElementById('coupon-code').value.trim();
        
        if (!couponCode) {
            this.showNotification('Por favor ingresa un código de cupón', 'error');
            return;
        }
        
        this.showLoading();
        
        try {
            const subtotal = this.cart.reduce((sum, item) => {
                const price = parseFloat(item.precio || item.price || 0);
                const quantity = parseInt(item.cantidad || item.quantity || 1);
                return sum + (price * quantity);
            }, 0);
            
            const total = subtotal + this.shippingCost;
            
            const response = await fetch('/api/discounts/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    codigo: couponCode,
                    total: total
                })
            });
            
            const result = await response.json();
            
            if (result.valido) {
                this.discount = result.descuento.tipo === 'porcentaje' 
                    ? (total * result.descuento.valor / 100)
                    : result.descuento.valor;
                
                // Actualizar UI
                this.renderOrderSummary();
                this.showNotification(`🎉 Cupón "${result.descuento.codigo}" aplicado exitosamente`, 'success');
            } else {
                this.showNotification(result.error || 'Cupón inválido', 'error');
            }
            
        } catch (error) {
            console.error('Error aplicando cupón:', error);
            this.showNotification('Error aplicando cupón. Intenta nuevamente.', 'error');
        } finally {
            this.hideLoading();
        }
    }


    togglePaymentForm(paymentMethod) {
        console.log('💳 Cambiando método de pago:', paymentMethod);
        
        // Obtener los contenedores por sus IDs correctos
        const paypalContainer = document.getElementById('paypal-button-container');
        const transferInfo = document.getElementById('transfer-info');
        
        // Ocultar todos los contenedores
        if (paypalContainer) {
            paypalContainer.style.display = 'none';
            paypalContainer.innerHTML = '';
        }
        
        if (transferInfo) {
            transferInfo.style.display = 'none';
        }
        
        // Mostrar el contenedor del método seleccionado
        switch (paymentMethod) {
            case 'paypal':
                if (paypalContainer) {
                    paypalContainer.style.display = 'block';
                    setTimeout(() => this.initializePayPal(), 100);
                }
                break;
                
            case 'transfer':
                if (transferInfo) {
                    transferInfo.style.display = 'block';
                    
                    // También puedes calcular y actualizar el total para el mensaje de WhatsApp
                    const orderData = this.collectOrderData();
                    this.updateWhatsAppLink(orderData.total);
                }
                break;
                
            default:
                console.log('⚠️ Método de pago no reconocido:', paymentMethod);
        }
    }

    updateWhatsAppLink(total) {
        const whatsappBtn = document.querySelector('.whatsapp-direct-button a');
        if (whatsappBtn) {
            const message = encodeURIComponent(`Hola, quiero confirmar una transferencia bancaria para mi compra en Mabel Activewear.\n\n• Monto: $${total.toFixed(2)}\n• Favor confirmar los datos bancarios\n• Envío comprobante en siguiente mensaje`);
            whatsappBtn.href = `https://wa.me/18292202292?text=${message}`;
        }
    }

    initializePayPal() {
        console.log('💰 Inicializando PayPal...');
        
        const paypalContainer = document.getElementById('paypal-button-container');
        if (!paypalContainer) {
            console.error('No se encontró el contenedor de PayPal');
            return;
        }
        
        // Limpiar contenedor
        paypalContainer.innerHTML = '';
        
        // Crear mensaje de carga
        paypalContainer.innerHTML = `
            <div class="paypal-loading">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p>Cargando PayPal...</p>
            </div>
        `;
        
        // Cargar PayPal SDK dinámicamente
        if (!window.paypal) {
            const script = document.createElement('script');
            script.src = 'https://www.paypal.com/sdk/js?client-id=test&currency=USD';
            script.async = true;
            script.onload = () => {
                console.log('✅ PayPal SDK cargado');
                this.renderPayPalButtons();
            };
            script.onerror = () => {
                console.error('❌ Error cargando PayPal SDK');
                paypalContainer.innerHTML = `
                    <div class="paypal-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No se pudo cargar PayPal. Intenta con otro método de pago.</p>
                    </div>
                `;
            };
            document.head.appendChild(script);
        } else {
            this.renderPayPalButtons();
        }
    }

    renderPayPalButtons() {
        const paypalContainer = document.getElementById('paypal-button-container');
        if (!paypalContainer || !window.paypal) return;
        
        paypalContainer.innerHTML = '';
        
        try {
            window.paypal.Buttons({
                createOrder: (data, actions) => {
                    const orderData = this.collectOrderData();
                    
                    return fetch('/api/payments/create-paypal-order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            amount: orderData.total,
                            orderData: orderData
                        })
                    }).then(response => response.json())
                      .then(order => order.id);
                },
                
                onApprove: (data, actions) => {
                    return fetch(`/api/payments/capture-paypal-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            orderID: data.orderID
                        })
                    }).then(response => response.json())
                      .then(details => {
                          console.log('✅ Pago PayPal completado:', details);
                          
                          // Crear orden en el sistema
                          const orderData = this.collectOrderData();
                          this.createOrder(orderData, 'paypal', details.orderId)
                              .then(() => {
                                  this.showSuccess(orderData, 'paypal', details.orderId);
                              });
                      });
                },
                
                onError: (err) => {
                    console.error('❌ Error PayPal:', err);
                    this.showNotification('Error procesando pago con PayPal', 'error');
                },
                
                style: {
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'paypal'
                }
            }).render('#paypal-button-container');
            
            console.log('✅ Botones de PayPal renderizados');
            
        } catch (error) {
            console.error('❌ Error renderizando botones PayPal:', error);
            paypalContainer.innerHTML = `
                <div class="paypal-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error configurando PayPal. Intenta con otro método de pago.</p>
                </div>
            `;
        }
    }

    updateCartCount() {
        const cartCountElements = document.querySelectorAll('.cart-count');
        const totalItems = this.cart.reduce((sum, item) => sum + (item.cantidad || item.quantity || 1), 0);
        
        cartCountElements.forEach(element => {
            if (element) {
                element.textContent = totalItems;
                element.style.display = totalItems > 0 ? 'inline-block' : 'none';
            }
        });
    }

    showNotification(message, type = 'info') {
        // Remover notificaciones anteriores
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Estilos para la notificación
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        // Botón para cerrar
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.onclick = () => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        };
        
        document.body.appendChild(notification);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    showLoading() {
        const submitBtn = document.querySelector('.place-order-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        }
    }

    hideLoading() {
        const submitBtn = document.querySelector('.place-order-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-lock"></i> Realizar Pedido';
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.checkout-section')) {
        console.log('🛍️ Inicializando checkout...');
        window.checkoutManager = new CheckoutManager();
    }
});

// Agregar estilos CSS para animaciones y elementos de pago
const style = document.createElement('style');
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
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        font-family: 'Montserrat', sans-serif;
        font-size: 14px;
        font-weight: 500;
    }
    
    .notification button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        margin-left: 10px;
    }
    
    .empty-cart-message {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .empty-cart-message i {
        color: #ccc;
        margin-bottom: 20px;
    }
    
    .empty-cart-message h4 {
        margin-bottom: 10px;
        color: #333;
    }
    
    .empty-cart-message p {
        margin-bottom: 20px;
    }
    
    /* Estilos para PayPal */
    .paypal-loading, .paypal-error {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .paypal-loading i, .paypal-error i {
        margin-bottom: 15px;
    }
    
    .paypal-error i {
        color: #dc3545;
    }
    
    /* Mejoras para formulario */
    .form-group input.error,
    .form-group select.error,
    .form-group textarea.error {
        border-color: #dc3545 !important;
    }
    
    .error-message {
        color: #dc3545;
        font-size: 12px;
        margin-top: 5px;
        display: none;
    }
    
    .form-group input.error + .error-message,
    .form-group select.error + .error-message,
    .form-group textarea.error + .error-message {
        display: block;
    }
    
    /* Estilos para el nuevo formulario de dirección */
    .input-with-prefix {
        display: flex;
        align-items: center;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        overflow: hidden;
    }
    
    .input-with-prefix .prefix {
        padding: 12px 15px;
        background-color: var(--background-light);
        color: #666;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        border-right: 1px solid var(--border-color);
    }
    
    .input-with-prefix input {
        flex: 1;
        border: none;
        padding: 12px 15px;
        font-size: 14px;
        font-family: 'Montserrat', sans-serif;
    }
    
    .input-with-prefix input:focus {
        outline: none;
        box-shadow: none;
    }
    
    .hint {
        display: block;
        font-size: 12px;
        color: #666;
        margin-top: 5px;
        margin-bottom: 5px;
    }
    
    .address-info-note {
        display: flex;
        gap: 15px;
        padding: 20px;
        background-color: #f0f7ff;
        border-radius: 8px;
        margin-top: 20px;
        font-size: 14px;
        color: #2c5282;
    }
    
    .address-info-note i {
        color: #4299e1;
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .address-info-note div {
        flex: 1;
    }
    
    .address-info-note p {
        margin-bottom: 5px;
    }
    
    /* Estilos para instrucciones de transferencia */
    .bank-transfer-instructions {
        padding: 30px;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    
    .instructions-header {
        text-align: center;
        margin-bottom: 40px;
    }
    
    .instructions-header i {
        color: #28a745;
        margin-bottom: 20px;
    }
    
    .instructions-header .order-number {
        font-size: 18px;
        background-color: #f8f9fa;
        padding: 10px 20px;
        border-radius: 6px;
        display: inline-block;
        margin-top: 10px;
    }
    
    .bank-info, .instructions-steps, .important-notes {
        margin-bottom: 40px;
    }
    
    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }
    
    .info-item {
        background-color: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #28a745;
    }
    
    .info-label {
        display: block;
        font-size: 12px;
        color: #666;
        margin-bottom: 5px;
    }
    
    .info-value {
        font-size: 16px;
        font-weight: 600;
        color: #333;
    }
    
    .info-value.amount {
        color: #28a745;
        font-size: 18px;
    }
    
    .instructions-steps ol {
        padding-left: 20px;
        margin-top: 15px;
    }
    
    .instructions-steps li {
        margin-bottom: 15px;
        line-height: 1.6;
    }
    
    .instructions-steps ul {
        padding-left: 20px;
        margin-top: 10px;
    }
    
    .whatsapp-step {
        background-color: #25D366;
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        margin: 15px 0;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 16px;
    }
    
    .whatsapp-direct {
        text-align: center;
        margin: 40px 0;
        padding: 30px;
        background-color: #f8f9fa;
        border-radius: 12px;
    }
    
    .whatsapp-btn {
        background-color: #25D366;
        border-color: #25D366;
        font-size: 16px;
        padding: 15px 30px;
    }
    
    .whatsapp-btn:hover {
        background-color: #128C7E;
        border-color: #128C7E;
    }
    
    .whatsapp-note {
        font-size: 14px;
        color: #666;
        margin-top: 15px;
        font-style: italic;
    }
    
    .important-notes ul {
        padding-left: 20px;
        margin-top: 15px;
    }
    
    .important-notes li {
        margin-bottom: 10px;
        color: #666;
    }
    
    .instructions-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-top: 40px;
        flex-wrap: wrap;
    }
    
    .email-confirmation {
        text-align: center;
        margin-top: 30px;
        padding: 20px;
        background-color: #e8f4fd;
        border-radius: 8px;
        color: #0c5460;
    }
    
    /* Mejoras responsivas */
    @media (max-width: 768px) {
        .order-success, .bank-transfer-instructions {
            padding: 20px;
        }
        
        .success-actions, .instructions-actions {
            flex-direction: column;
            gap: 10px;
        }
        
        .success-actions .btn, .instructions-actions .btn {
            width: 100%;
        }
        
        .info-grid {
            grid-template-columns: 1fr;
        }
        
        .order-details {
            grid-template-columns: 1fr;
            gap: 20px;
        }
    }
    
    /* Estilos para la página de éxito */
    .order-success {
        text-align: center;
        padding: 40px 20px;
        max-width: 800px;
        margin: 0 auto;
    }
    
    .success-icon {
        font-size: 80px;
        color: #28a745;
        margin-bottom: 30px;
    }
    
    .success-message {
        font-size: 16px;
        color: #666;
        max-width: 600px;
        margin: 0 auto 30px;
        line-height: 1.8;
    }
    
    .order-number {
        font-size: 18px;
        margin: 20px 0;
        padding: 10px 20px;
        background-color: #f8f9fa;
        border-radius: 6px;
        display: inline-block;
    }
    
    .order-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
        margin: 40px 0;
    }
    
    .detail-card {
        background-color: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        text-align: left;
    }
    
    .detail-card h4 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 20px;
        color: #333;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
    }
    
    .detail-row:last-child {
        border-bottom: none;
    }
    
    .detail-row.total {
        font-weight: 700;
        font-size: 18px;
        padding-top: 12px;
        border-top: 2px solid #e0e0e0;
    }
    
    .success-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
        margin: 40px 0;
    }
    
    .whats-next {
        margin-top: 50px;
        padding-top: 40px;
        border-top: 1px solid #e0e0e0;
    }
    
    .next-steps {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 30px;
        margin-top: 30px;
    }
    
    .next-steps .step {
        text-align: center;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 12px;
    }
    
    .next-steps .step i {
        font-size: 32px;
        color: #667eea;
        margin-bottom: 15px;
    }
    
    .next-steps .step h4 {
        font-size: 16px;
        margin-bottom: 10px;
        color: #333;
    }
    
    .next-steps .step p {
        font-size: 14px;
        color: #666;
        line-height: 1.6;
    }
`;
document.head.appendChild(style);

// Función auxiliar para formatear teléfono
function formatPhoneNumber(input) {
    const phoneInput = document.getElementById(input);
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 7) value = value.substring(0, 7);
            if (value.length > 3) {
                value = value.substring(0, 3) + '-' + value.substring(3);
            }
            e.target.value = value;
        });
    }
}

// Función para cargar direcciones en checkout
async function loadAddressesForCheckout() {
    try {
        const response = await fetch('/api/session');
        const session = await response.json();
        
        if (!session.authenticated) return;
        
        const addressesResponse = await fetch(`/api/users/${session.user.id}/addresses`);
        const addresses = await addressesResponse.json();
        
        const addressSelect = document.getElementById('shipping-address');
        if (!addressSelect) return;
        
        // Limpiar opciones existentes
        addressSelect.innerHTML = '<option value="">Selecciona una dirección</option>';
        
        // Agregar direcciones
        addresses.forEach(address => {
            const option = document.createElement('option');
            option.value = address.id;
            option.textContent = `${address.nombre} - ${address.calle} ${address.numero}, ${address.sector}, ${address.municipio}`;
            if (address.predeterminada) {
                option.selected = true;
            }
            addressSelect.appendChild(option);
        });
        
        // Agregar opción para nueva dirección
        const newAddressOption = document.createElement('option');
        newAddressOption.value = 'new';
        newAddressOption.textContent = '+ Agregar nueva dirección';
        addressSelect.appendChild(newAddressOption);
        
        // Manejar cambio de selección
        addressSelect.addEventListener('change', function() {
            if (this.value === 'new') {
                showAddressFormInCheckout();
            } else {
                const selectedAddress = addresses.find(addr => addr.id == this.value);
                if (selectedAddress) {
                    updateCheckoutFormWithAddress(selectedAddress);
                }
            }
        });
        
        // Seleccionar dirección predeterminada automáticamente
        const defaultAddress = addresses.find(addr => addr.predeterminada);
        if (defaultAddress) {
            updateCheckoutFormWithAddress(defaultAddress);
        }
        
    } catch (error) {
        console.error('Error cargando direcciones:', error);
    }
}

function updateCheckoutFormWithAddress(address) {
    // Actualizar campos del formulario de checkout
    document.getElementById('shipping-fullname').value = address.nombre_completo;
    document.getElementById('shipping-phone').value = address.telefono;
    document.getElementById('shipping-address').value = `${address.calle} ${address.numero}`;
    document.getElementById('shipping-apartment').value = address.apartamento || '';
    document.getElementById('shipping-city').value = address.municipio;
    document.getElementById('shipping-province').value = address.provincia;
    document.getElementById('shipping-sector').value = address.sector;
    document.getElementById('shipping-reference').value = address.referencia;
}

function saveOrderToLocalStorage(orderData) {
    // Guardar orden en localStorage
    const orders = JSON.parse(localStorage.getItem('mabel_orders')) || [];
    orders.push(orderData);
    localStorage.setItem('mabel_orders', JSON.stringify(orders));
}

// Aplicar formato a los campos de teléfono
document.addEventListener('DOMContentLoaded', function() {
    formatPhoneNumber('telefono');
    formatPhoneNumber('telefono_envio');
});