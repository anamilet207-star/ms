// server.js - VERSIÓN COMPLETA CON MÚLTIPLES IMÁGENES
require('dotenv').config();
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Importar configuración de base de datos
const { query } = require('./env/db.js');

// Importar SDKs de pago
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
const PORT = 3000;


// ================= CONFIGURACIÓN MULTER PARA SUBIR IMÁGENES =================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/images/products');
        // Crear directorio si no existe
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'product-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});



// ================= FUNCIONES AUXILIARES =================

// Función para convertir array a formato PostgreSQL
const formatArrayForPostgres = (data) => {
    if (data === undefined || data === null) return null;
    
    // Si ya está en formato PostgreSQL {item1,item2}
    if (typeof data === 'string' && data.startsWith('{') && data.endsWith('}')) {
        return data;
    }
    
    // Si es array de JavaScript
    if (Array.isArray(data)) {
        if (data.length === 0) return '{}';
        return `{${data.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')}}`;
    }
    
    // Si es string JSON array
    if (typeof data === 'string') {
        // Intentar parsear como JSON
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    return `{${parsed.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')}}`;
                }
            } catch (error) {
                console.warn('No se pudo parsear JSON:', error);
            }
        }
        
        // Si es string separado por comas
        if (data.includes(',')) {
            const items = data.split(',')
                .map(item => item.trim())
                .filter(item => item.length > 0);
            return `{${items.map(item => `"${item.replace(/"/g, '\\"')}"`).join(',')}}`;
        }
        
        // Si es un solo elemento
        if (data.trim().length > 0) {
            return `{"${data.trim().replace(/"/g, '\\"')}"}`;
        }
    }
    
    return '{}';
};

// Función para convertir array PostgreSQL a JavaScript
const parseArrayFromPostgres = (pgArray) => {
    if (!pgArray) return [];
    
    // Si ya es array JavaScript, devolverlo
    if (Array.isArray(pgArray)) return pgArray;
    
    // Si es string en formato PostgreSQL {item1,item2,item3}
    if (typeof pgArray === 'string' && pgArray.startsWith('{') && pgArray.endsWith('}')) {
        try {
            const content = pgArray.slice(1, -1);
            if (content.trim() === '') return [];
            
            // Manejo simple: eliminar comillas y split por comas
            const cleaned = content.replace(/"/g, '');
            if (cleaned.trim() === '') return [];
            
            return cleaned.split(',').map(item => item.trim()).filter(item => item.length > 0);
        } catch (error) {
            console.warn('Error parseando array PostgreSQL:', error, pgArray);
            return [];
        }
    }
    
    // Si viene como string JSON (para compatibilidad)
    if (typeof pgArray === 'string' && pgArray.startsWith('[') && pgArray.endsWith(']')) {
        try {
            const parsed = JSON.parse(pgArray);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Error parseando JSON:', error);
            return [];
        }
    }
    
    return [];
};

// ================= CONFIGURACIÓN MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Configuración de sesión
app.use(session({
    secret: 'mabel-activewear-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador' });
    }
    next();
};

// Middleware para debug
app.use((req, res, next) => {
    if (req.path.includes('/api/payments') || req.path.includes('/api/orders')) {
        console.log(`🔓 Ruta pública: ${req.method} ${req.path}`);
    }
    next();
});

// ================= RUTAS DE ARCHIVOS ESTÁTICOS =================
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Servir imágenes placeholder si no existen
app.get('/public/images/products/:imageName', (req, res) => {
    const imageName = req.params.imageName;
    const imagePath = path.join(__dirname, 'public/images/products', imageName);
    
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        // Crear placeholder SVG
        const placeholder = `
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
                <rect width="400" height="600" fill="#f5f5f5"/>
                <text x="200" y="300" font-family="Arial" font-size="20" text-anchor="middle" fill="#666">
                    ${imageName.replace('.jpg', '').replace(/[_-]/g, ' ')}
                </text>
            </svg>
        `;
        res.set('Content-Type', 'image/svg+xml');
        res.send(placeholder);
    }
});

// Imagen por defecto
app.get('/public/images/default-product.jpg', (req, res) => {
    const placeholder = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
            <rect width="400" height="500" fill="#f8f8f8"/>
            <text x="200" y="250" font-family="Arial" font-size="24" text-anchor="middle" fill="#666">
                MABEL ACTIVEWEAR
            </text>
        </svg>
    `;
    res.set('Content-Type', 'image/svg+xml');
    res.send(placeholder);
});

// ================= RUTAS PARA PÁGINAS HTML =================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'pages/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'pages/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'pages/register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'pages/admin.html')));
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, 'pages/shop.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'pages/cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'pages/checkout.html')));
app.get('/account', (req, res) => res.sendFile(path.join(__dirname, 'pages/account.html')));
app.get('/product-detail.html', (req, res) => res.sendFile(path.join(__dirname, 'pages/product-detail.html')));
app.get('/ofertas', (req, res) => res.sendFile(path.join(__dirname, 'pages/ofertas.html')));
app.get('/envios', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/envios.html'));
});

// Página de contacto
app.get('/contacto', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/contacto.html'));
});

// Página de ayuda (reemplaza devoluciones)
app.get('/ayuda', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/ayuda.html'));
});

// Redirecciones
app.get('/devoluciones', (req, res) => res.redirect('/ayuda#devoluciones'));
app.get('/faq', (req, res) => res.redirect('/ayuda#faq'));
app.get('/privacidad', (req, res) => res.redirect('/ayuda#privacidad'));
app.get('/terminos', (req, res) => res.redirect('/ayuda#terminos'));

// ================= API - AUTENTICACIÓN =================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('🔐 Login:', email);
    
    try {
        const result = await query(
            'SELECT id, nombre, apellido, email, password_hash, rol FROM usuarios WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const user = result.rows[0];
        let isValidPassword = false;
        
        if (email === 'admin@gmail.com' && password === 'admin123') {
            isValidPassword = true;
        } else {
            try {
                isValidPassword = await bcrypt.compare(password, user.password_hash);
            } catch (bcryptError) {
                console.error('Error bcrypt:', bcryptError);
                isValidPassword = password === user.password_hash;
            }
        }
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        req.session.userId = user.id;
        req.session.userRole = user.rol;
        req.session.userEmail = user.email;
        req.session.userName = `${user.nombre} ${user.apellido}`;
        
        console.log('✅ Login exitoso:', user.email, 'Rol:', user.rol);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                rol: user.rol
            }
        });
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/register', async (req, res) => {
    const { nombre, apellido, email, password, telefono } = req.body;
    
    console.log('📝 Registro:', email);
    
    try {
        const existingUser = await query(
            'SELECT id FROM usuarios WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const result = await query(
            `INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, rol, activo) 
             VALUES ($1, $2, $3, $4, $5, 'cliente', true) 
             RETURNING id, nombre, apellido, email, rol`,
            [nombre, apellido, email, hashedPassword, telefono || null]
        );
        
        const newUser = result.rows[0];
        
        req.session.userId = newUser.id;
        req.session.userRole = newUser.rol;
        req.session.userEmail = newUser.email;
        req.session.userName = `${newUser.nombre} ${newUser.apellido}`;
        
        res.status(201).json({
            success: true,
            user: newUser
        });
        
    } catch (error) {
        console.error('❌ Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Error cerrando sesión:', err);
            return res.status(500).json({ error: 'Error cerrando sesión' });
        }
        res.json({ success: true });
    });
});

app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                nombre: req.session.userName?.split(' ')[0] || '',
                apellido: req.session.userName?.split(' ')[1] || '',
                email: req.session.userEmail,
                rol: req.session.userRole
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ================= RUTAS DE PAGOS =================

// Configuración de pagos
app.get('/api/payments/config', (req, res) => {
    console.log('🔧 Enviando configuración de pagos al frontend');
    
    res.json({
        stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx',
        paypalClientId: process.env.PAYPAL_CLIENT_ID || 'test',
        currency: 'USD',
        environment: process.env.NODE_ENV || 'development',
        country: 'DO', // República Dominicana
        paymentMethods: ['card', 'paypal', 'transfer'],
        features: {
            stripe: true,
            paypal: true,
            bankTransfer: true
        }
    });
});

// ========== STRIPE ==========

// Crear Payment Intent de Stripe
app.post('/api/orders', async (req, res) => {
    try {
        const { amount, orderData } = req.body;
        
        // Validar monto mínimo
        const minAmount = 50; // $0.50 USD mínimo para Stripe
        const amountInCents = Math.round(parseFloat(amount) * 100);
        
        if (amountInCents < minAmount) {
            return res.status(400).json({ 
                error: 'El monto mínimo de pago es $0.50 USD' 
            });
        }
        
        // Crear Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            metadata: {
                userId: req.session.userId,
                orderData: JSON.stringify(orderData)
            },
            shipping: orderData.shipping_method !== 'digital' ? {
                name: `${orderData.cliente.nombre} ${orderData.cliente.apellido}`,
                address: {
                    line1: orderData.cliente.direccion,
                    city: orderData.cliente.ciudad,
                    state: orderData.cliente.region,
                    postal_code: orderData.cliente.codigo_postal,
                    country: orderData.cliente.pais
                },
                phone: orderData.cliente.telefono
            } : undefined,
            description: `Compra Mabel Activewear - ${orderData.cliente.email}`
        });
        
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
        
    } catch (error) {
        console.error('❌ Error creando Payment Intent:', error);
        res.status(500).json({ 
            error: 'Error procesando pago',
            details: error.message 
        });
    }
});

// Webhook de Stripe para eventos de pago
app.post('/api/payments/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('❌ Error de verificación de webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Manejar eventos de pago
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('✅ Pago completado:', paymentIntent.id);
            
            // Aquí actualizarías la orden en tu base de datos
            try {
                const orderData = JSON.parse(paymentIntent.metadata.orderData);
                
                // Crear orden en tu sistema
                await query(
                    `INSERT INTO pedidos (
                        usuario_id, total, subtotal, shipping_cost, discount,
                        estado, metodo_pago, stripe_payment_id,
                        direccion_envio, ciudad_envio, provincia_envio,
                        telefono_contacto, email_cliente, nombre_cliente
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                    [
                        paymentIntent.metadata.userId,
                        paymentIntent.amount / 100,
                        orderData.subtotal,
                        orderData.shipping_cost,
                        orderData.discount,
                        'completado',
                        'stripe',
                        paymentIntent.id,
                        orderData.cliente.direccion,
                        orderData.cliente.ciudad,
                        orderData.cliente.region,
                        orderData.cliente.telefono,
                        orderData.cliente.email,
                        `${orderData.cliente.nombre} ${orderData.cliente.apellido}`
                    ]
                );
                
                console.log('✅ Orden creada desde webhook');
                
            } catch (dbError) {
                console.error('❌ Error creando orden desde webhook:', dbError);
            }
            break;
            
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.error('❌ Pago fallido:', failedPayment.id);
            break;
    }
    
    res.json({received: true});
});

// ========== PAYPAL ==========

// Configurar cliente de PayPal
let paypalClient = null;

try {
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
        if (process.env.PAYPAL_ENVIRONMENT === 'live') {
            // MODO PRODUCCIÓN (dinero real)
            const environment = new paypal.core.LiveEnvironment(
                process.env.PAYPAL_CLIENT_ID,
                process.env.PAYPAL_CLIENT_SECRET
            );
            paypalClient = new paypal.core.PayPalHttpClient(environment);
            console.log('✅ PayPal configurado en modo PRODUCCIÓN');
        } else {
            // MODO SANDBOX (pruebas)
            const environment = new paypal.core.SandboxEnvironment(
                process.env.PAYPAL_CLIENT_ID,
                process.env.PAYPAL_CLIENT_SECRET
            );
            paypalClient = new paypal.core.PayPalHttpClient(environment);
            console.log('✅ PayPal configurado en modo SANDBOX');
        }
    } else {
        console.log('⚠️ PayPal no configurado - Se usará modo simulación para desarrollo');
        paypalClient = null;
    }
} catch (error) {
    console.error('❌ Error configurando PayPal:', error.message);
    paypalClient = null;
}

// Crear orden de PayPal
app.post('/api/payments/create-paypal-order', async (req, res) => {
    try {
        const { amount, orderData } = req.body;
        
        console.log('💰 Creando orden PayPal...');
        console.log('📦 Monto:', amount);
        console.log('👤 Cliente:', orderData.cliente.email);
        
        // MODO SIMULACIÓN para desarrollo cuando PayPal no está configurado
        if (!paypalClient) {
            console.log('🔧 Simulando orden PayPal (modo desarrollo)');
            
            // Simular una respuesta exitosa
            const simulatedOrderId = `PAYPAL-DEV-${Date.now()}`;
            
            return res.json({
                id: simulatedOrderId,
                status: 'CREATED',
                amount: amount,
                simulated: true,
                message: 'Modo desarrollo - PayPal no configurado'
            });
        }
        
        // Validar monto mínimo para PayPal
        const minAmount = 1.00; // $1.00 USD mínimo para PayPal
        if (parseFloat(amount) < minAmount) {
            return res.status(400).json({ 
                error: `El monto mínimo para PayPal es $${minAmount.toFixed(2)} USD` 
            });
        }
        
        // Crear items para PayPal
        const items = orderData.items.map(item => ({
            name: item.nombre.substring(0, 127), // PayPal tiene límite de 127 caracteres
            description: `${item.talla ? `Talla: ${item.talla}` : ''} ${item.color ? `Color: ${item.color}` : ''}`.trim().substring(0, 127),
            quantity: item.cantidad.toString(),
            unit_amount: {
                currency_code: 'USD',
                value: parseFloat(item.precio).toFixed(2)
            },
            sku: item.id ? `SKU-${item.id}` : undefined
        }));
        
        // Configurar envío si es aplicable
        let shipping = undefined;
        if (orderData.shipping_method !== 'digital' && orderData.cliente.direccion) {
            // Convertir código de país para PayPal
            let countryCode = 'US'; // Por defecto
            if (orderData.cliente.pais === 'República Dominicana' || orderData.cliente.pais === 'DO') {
                countryCode = 'DO';
            } else if (orderData.cliente.pais === 'México' || orderData.cliente.pais === 'MX') {
                countryCode = 'MX';
            } else if (orderData.cliente.pais === 'España' || orderData.cliente.pais === 'ES') {
                countryCode = 'ES';
            }
            
            shipping = {
                name: {
                    full_name: `${orderData.cliente.nombre} ${orderData.cliente.apellido}`.substring(0, 300)
                },
                address: {
                    address_line_1: orderData.cliente.direccion.substring(0, 300),
                    admin_area_2: orderData.cliente.ciudad ? orderData.cliente.ciudad.substring(0, 120) : '',
                    admin_area_1: orderData.cliente.region ? orderData.cliente.region.substring(0, 300) : '',
                    postal_code: orderData.cliente.codigo_postal ? orderData.cliente.codigo_postal.substring(0, 60) : '',
                    country_code: countryCode
                }
            };
        }
        
        // Crear request para PayPal
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: parseFloat(amount).toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: 'USD',
                            value: parseFloat(orderData.subtotal).toFixed(2)
                        },
                        shipping: {
                            currency_code: 'USD',
                            value: parseFloat(orderData.shipping_cost || 0).toFixed(2)
                        },
                        discount: {
                            currency_code: 'USD',
                            value: parseFloat(orderData.discount || 0).toFixed(2)
                        },
                        tax_total: {
                            currency_code: 'USD',
                            value: '0.00'
                        }
                    }
                },
                items: items,
                shipping: shipping,
                description: `Compra Mabel Activewear - ${orderData.cliente.email}`,
                custom_id: `ORDER-${Date.now()}`,
                invoice_id: `INV-${Date.now()}`,
                soft_descriptor: 'MABEL ACTIVEWEAR'
            }],
            application_context: {
                brand_name: 'Mabel Activewear',
                landing_page: 'BILLING',
                user_action: 'PAY_NOW',
                shipping_preference: shipping ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING',
                return_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout/success?payment_method=paypal`,
                cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout`
            }
        });
        
        console.log('📤 Enviando solicitud a PayPal...');
        
        // Ejecutar la solicitud
        const order = await paypalClient.execute(request);
        
        console.log('✅ Orden PayPal creada exitosamente:', order.result.id);
        console.log('🔗 Enlaces:', {
            approve: order.result.links.find(link => link.rel === 'approve')?.href,
            self: order.result.links.find(link => link.rel === 'self')?.href
        });
        
        res.json({
            success: true,
            id: order.result.id,
            status: order.result.status,
            amount: order.result.purchase_units[0].amount.value,
            links: order.result.links,
            created_time: order.result.create_time
        });
        
    } catch (error) {
        console.error('❌ Error creando orden de PayPal:', error);
        
        // Manejar errores específicos de PayPal
        let errorMessage = 'Error procesando pago PayPal';
        let statusCode = 500;
        
        if (error.statusCode === 401) {
            errorMessage = 'Credenciales de PayPal inválidas. Verifica tu configuración.';
            statusCode = 401;
        } else if (error.statusCode === 400) {
            errorMessage = 'Datos inválidos para PayPal. Verifica los montos y detalles.';
            statusCode = 400;
        } else if (error.message?.includes('network')) {
            errorMessage = 'Error de conexión con PayPal. Intenta nuevamente.';
        }
        
        // Log detallado para debugging
        console.error('📋 Detalles del error PayPal:', {
            statusCode: error.statusCode,
            message: error.message,
            details: error.details,
            debug_id: error.headers?.['paypal-debug-id']
        });
        
        res.status(statusCode).json({ 
            success: false,
            error: errorMessage,
            details: error.message,
            debug_id: error.headers?.['paypal-debug-id'],
            code: error.statusCode
        });
    }
});

// Capturar orden de PayPal
app.post('/api/payments/capture-paypal-order', async (req, res) => {
    try {
        const { orderID } = req.body;
        
        console.log('💰 Capturando orden PayPal:', orderID);
        
        // MODO SIMULACIÓN para desarrollo
        if (!paypalClient) {
            console.log('🔧 Simulando captura PayPal (modo desarrollo)');
            
            // Simular captura exitosa
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay
            
            return res.json({
                success: true,
                orderId: orderID,
                captureId: `CAPTURE-DEV-${Date.now()}`,
                status: 'COMPLETED',
                simulated: true,
                message: 'Modo desarrollo - Captura simulada'
            });
        }
        
        // Capturar orden REAL de PayPal
        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});
        
        console.log('📤 Enviando solicitud de captura a PayPal...');
        
        const capture = await paypalClient.execute(request);
        
        console.log('📊 Respuesta de captura PayPal:', {
            id: capture.result.id,
            status: capture.result.status,
            amount: capture.result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value
        });
        
        if (capture.result.status === 'COMPLETED' || capture.result.status === 'APPROVED') {
            console.log('✅ Pago PayPal capturado exitosamente');
            
            // Extraer detalles importantes
            const captureDetails = capture.result.purchase_units?.[0]?.payments?.captures?.[0];
            
            res.json({
                success: true,
                orderId: orderID,
                captureId: captureDetails?.id || `CAPTURE-${Date.now()}`,
                status: capture.result.status,
                amount: captureDetails?.amount?.value || '0.00',
                currency: captureDetails?.amount?.currency_code || 'USD',
                create_time: captureDetails?.create_time || new Date().toISOString(),
                payer: capture.result.payer,
                shipping: capture.result.purchase_units?.[0]?.shipping
            });
        } else {
            console.warn('⚠️ Estado de captura PayPal:', capture.result.status);
            res.status(400).json({ 
                success: false,
                error: 'Pago no completado',
                status: capture.result.status,
                details: capture.result 
            });
        }
        
    } catch (error) {
        console.error('❌ Error capturando orden PayPal:', error);
        
        // Manejar errores específicos
        let errorMessage = 'Error capturando pago PayPal';
        
        if (error.statusCode === 400) {
            errorMessage = 'No se pudo capturar el pago. La orden puede haber expirado o sido cancelada.';
        } else if (error.statusCode === 404) {
            errorMessage = 'Orden no encontrada. Verifica el ID de la orden.';
        } else if (error.statusCode === 422) {
            errorMessage = 'La orden ya ha sido capturada o rechazada.';
        }
        
        res.status(error.statusCode || 500).json({ 
            success: false,
            error: errorMessage,
            details: error.message,
            debug_id: error.headers?.['paypal-debug-id'],
            code: error.statusCode
        });
    }
});

// Verificar estado de orden PayPal
app.get('/api/payments/verify-paypal-order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        
        console.log('🔍 Verificando estado de orden PayPal:', orderId);
        
        // MODO SIMULACIÓN para desarrollo
        if (!paypalClient) {
            console.log('🔧 Simulando verificación PayPal (modo desarrollo)');
            
            return res.json({
                success: true,
                id: orderId,
                status: 'COMPLETED',
                amount: '99.99',
                simulated: true,
                created_time: new Date().toISOString(),
                message: 'Modo desarrollo - Verificación simulada'
            });
        }
        
        // Verificar orden REAL en PayPal
        const request = new paypal.orders.OrdersGetRequest(orderId);
        
        const order = await paypalClient.execute(request);
        
        console.log('📊 Estado de orden PayPal:', order.result.status);
        
        res.json({
            success: true,
            id: order.result.id,
            status: order.result.status,
            amount: order.result.purchase_units[0].amount.value,
            created_time: order.result.create_time,
            payer: order.result.payer,
            shipping: order.result.purchase_units[0].shipping,
            links: order.result.links
        });
        
    } catch (error) {
        console.error('❌ Error verificando orden PayPal:', error);
        
        res.status(error.statusCode || 500).json({ 
            success: false,
            error: 'Error verificando orden PayPal',
            details: error.message,
            debug_id: error.headers?.['paypal-debug-id']
        });
    }
});

// Webhook para notificaciones de PayPal (OPCIONAL pero recomendado)
app.post('/api/payments/paypal-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID;
    const payload = req.body.toString();
    
    console.log('📨 Webhook de PayPal recibido');
    console.log('📋 Headers:', req.headers);
    
    try {
        // Verificar que el webhook sea de PayPal
        if (!paypalClient) {
            console.log('⚠️ PayPal no configurado, ignorando webhook');
            return res.status(200).send('OK');
        }
        
        const event = JSON.parse(payload);
        console.log('🎯 Evento PayPal:', event.event_type, 'ID:', event.id);
        
        // Aquí procesarías diferentes tipos de eventos
        switch (event.event_type) {
            case 'CHECKOUT.ORDER.APPROVED':
                console.log('✅ Orden aprobada por el cliente:', event.resource.id);
                // El cliente aprobó el pago, pero aún no se capturó
                break;
                
            case 'PAYMENT.CAPTURE.COMPLETED':
                console.log('💰 Pago capturado exitosamente:', event.resource.id);
                // Aquí actualizarías tu base de datos para marcar el pago como completado
                // y crear la orden en tu sistema
                break;
                
            case 'PAYMENT.CAPTURE.DENIED':
                console.log('❌ Pago denegado:', event.resource.id);
                // El pago fue denegado
                break;
                
            case 'PAYMENT.CAPTURE.REFUNDED':
                console.log('↩️ Pago reembolsado:', event.resource.id);
                // El pago fue reembolsado
                break;
                
            default:
                console.log('📝 Otro evento PayPal:', event.event_type);
        }
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('❌ Error procesando webhook PayPal:', error);
        res.status(400).send('Error');
    }
});

// ================= API - SUBIDA DE IMÁGENES =================

// Subir imágenes de productos
app.post('/api/admin/upload-images', requireAuth, requireAdmin, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se subieron imágenes' });
        }
        
        const uploadedImages = req.files.map(file => {
            return `/public/images/products/${file.filename}`;
        });
        
        console.log('✅ Imágenes subidas:', uploadedImages.length);
        res.json({ 
            success: true, 
            images: uploadedImages,
            message: `${uploadedImages.length} imagen(es) subida(s) exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error subiendo imágenes:', error);
        res.status(500).json({ 
            error: 'Error subiendo imágenes',
            details: error.message 
        });
    }
});

// Eliminar imagen de producto
app.delete('/api/admin/images/:imageName', requireAuth, requireAdmin, async (req, res) => {
    try {
        const imageName = req.params.imageName;
        const imagePath = path.join(__dirname, 'public/images/products', imageName);
        
        // Verificar si existe
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log('🗑️ Imagen eliminada:', imageName);
            
            // Actualizar productos que usan esta imagen
            await query(
                `UPDATE productos 
                 SET imagenes_adicionales = array_remove(imagenes_adicionales, $1)
                 WHERE $1 = ANY(imagenes_adicionales)`,
                [`/public/images/products/${imageName}`]
            );
            
            await query(
                `UPDATE productos 
                 SET imagen = '/public/images/default-product.jpg'
                 WHERE imagen = $1`,
                [`/public/images/products/${imageName}`]
            );
            
            res.json({ success: true, message: 'Imagen eliminada' });
        } else {
            res.status(404).json({ error: 'Imagen no encontrada' });
        }
        
    } catch (error) {
        console.error('❌ Error eliminando imagen:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - USUARIOS REALES =================
// ================= API - USUARIOS REALES =================

// Obtener todos los usuarios (con estadísticas reales)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                u.id, 
                u.nombre, 
                u.apellido, 
                u.email, 
                u.telefono, 
                u.direccion,
                u.rol, 
                u.fecha_registro,
                u.activo,
                COUNT(DISTINCT p.id) as total_ordenes,
                COALESCE(SUM(p.total), 0) as total_gastado
            FROM usuarios u
            LEFT JOIN pedidos p ON p.usuario_id = u.id
            GROUP BY u.id
            ORDER BY u.fecha_registro DESC
        `);
        
        const users = result.rows.map(user => ({
            id: user.id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono || '-',
            direccion: user.direccion || '-',
            rol: user.rol,
            fecha_registro: user.fecha_registro,
            activo: user.activo,
            total_orders: parseInt(user.total_ordenes) || 0,
            total_spent: parseFloat(user.total_gastado) || 0,
            wishlist_items: 0 // Temporal, puedes implementar la tabla wishlist después
        }));
        
        console.log(`✅ Enviando ${users.length} usuarios reales`);
        res.json(users);
        
    } catch (error) {
        console.error('❌ Error obteniendo usuarios:', error);
        
        // Consulta alternativa más simple
        try {
            const result = await query(`
                SELECT 
                    u.id, 
                    u.nombre, 
                    u.apellido, 
                    u.email, 
                    u.telefono, 
                    u.direccion,
                    u.rol, 
                    u.fecha_registro,
                    u.activo
                FROM usuarios u
                ORDER BY u.fecha_registro DESC
            `);
            
            // Obtener estadísticas por separado
            const usersWithStats = await Promise.all(result.rows.map(async (user) => {
                const ordersResult = await query(
                    'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM pedidos WHERE usuario_id = $1',
                    [user.id]
                );
                
                return {
                    ...user,
                    telefono: user.telefono || '-',
                    direccion: user.direccion || '-',
                    total_orders: parseInt(ordersResult.rows[0]?.count) || 0,
                    total_spent: parseFloat(ordersResult.rows[0]?.total) || 0,
                    wishlist_items: 0
                };
            }));
            
            console.log(`✅ Enviando ${usersWithStats.length} usuarios (consulta simple)`);
            res.json(usersWithStats);
            
        } catch (fallbackError) {
            console.error('❌ Error en consulta alternativa:', fallbackError);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});

// Obtener usuario específico con estadísticas
app.get('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Verificar permisos
        if (parseInt(userId) !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        // Obtener datos básicos del usuario
        const userResult = await query(
            'SELECT * FROM usuarios WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const user = userResult.rows[0];
        
        // Obtener estadísticas por separado
        const ordersResult = await query(
            'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM pedidos WHERE usuario_id = $1',
            [userId]
        );
        
        const wishlistResult = await query(
            'SELECT COUNT(*) as count FROM wishlist WHERE usuario_id = $1',
            [userId]
        ).catch(() => ({ rows: [{ count: 0 }] })); // Si no existe la tabla wishlist
        
        const reviewsResult = await query(
            'SELECT COUNT(*) as count FROM comentarios_productos WHERE usuario_id = $1 AND aprobado = true',
            [userId]
        ).catch(() => ({ rows: [{ count: 0 }] })); // Si no existe la tabla comentarios_productos
        
        // Obtener últimas órdenes del usuario - USANDO fecha_creacion
        const recentOrdersResult = await query(`
            SELECT id, fecha_creacion, total, estado 
            FROM pedidos 
            WHERE usuario_id = $1 
            ORDER BY fecha_creacion DESC 
            LIMIT 5
        `, [userId]);
        
        const userData = {
            id: user.id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono || '',
            direccion: user.direccion || '',
            ciudad: user.ciudad || '',
            provincia: user.provincia || '',
            codigo_postal: user.codigo_postal || '',
            pais: user.pais || '',
            rol: user.rol,
            activo: user.activo,
            fecha_registro: user.fecha_registro,
            stats: {
                total_orders: parseInt(ordersResult.rows[0]?.count) || 0,
                total_spent: parseFloat(ordersResult.rows[0]?.total) || 0,
                wishlist_items: parseInt(wishlistResult.rows[0]?.count) || 0,
                reviews: parseInt(reviewsResult.rows[0]?.count) || 0,
                avg_order_value: parseInt(ordersResult.rows[0]?.count) > 0 ? 
                    (parseFloat(ordersResult.rows[0]?.total) / parseInt(ordersResult.rows[0]?.count)).toFixed(2) : 0
            },
            recent_orders: recentOrdersResult.rows.map(order => ({
                id: order.id,
                date: order.fecha_creacion,
                total: parseFloat(order.total) || 0,
                status: order.estado || 'pendiente'
            }))
        };
        
        res.json(userData);
        
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener órdenes de usuario específico
app.get('/api/users/:id/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const limit = req.query.limit || 10;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('📋 Obteniendo órdenes para usuario:', userId);
        
        // USANDO fecha_creacion en lugar de fecha_orden
        const ordersResult = await query(`
            SELECT id, fecha_creacion, total, estado, tracking_number, metodo_envio
            FROM pedidos 
            WHERE usuario_id = $1 
            ORDER BY fecha_creacion DESC 
            LIMIT $2
        `, [userId, limit]);
        
        const orders = ordersResult.rows.map(order => ({
            id: order.id,
            fecha_orden: order.fecha_creacion, // Mapear fecha_creacion a fecha_orden
            total: parseFloat(order.total) || 0,
            estado: order.estado || 'pendiente',
            items_count: 1,
            tracking_number: order.tracking_number,
            paqueteria: order.metodo_envio
        }));
        
        res.json(orders);
        
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - ÓRDENES ADMIN =================
app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
    try {
        // USANDO fecha_creacion
        const result = await query(`
            SELECT p.*, 
                   u.nombre as nombre_cliente, 
                   u.email as email_cliente,
                   u.telefono as telefono_contacto
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.fecha_creacion DESC
        `);
        
        const orders = result.rows.map(order => ({
            id: order.id,
            fecha_orden: order.fecha_creacion, // Mapear aquí también
            total: parseFloat(order.total) || 0,
            estado: order.estado || 'pendiente',
            metodo_pago: order.metodo_pago,
            metodo_envio: order.metodo_envio,
            direccion_envio: order.direccion_envio,
            ciudad_envio: order.ciudad_envio,
            telefono_contacto: order.telefono_contacto,
            nombre_cliente: order.nombre_cliente,
            email_cliente: order.email_cliente,
            // Items simulados para demo
            items: [
                {
                    nombre: 'Producto de ejemplo',
                    cantidad: 1,
                    precio_unitario: parseFloat(order.total) || 0,
                    imagen: '/public/images/default-product.jpg'
                }
            ]
        }));
        
        console.log(`✅ Enviando ${orders.length} órdenes`);
        res.json(orders);
        
    } catch (error) {
        console.error('❌ Error obteniendo órdenes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// ================= API - USUARIO =================
app.get('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const result = await query(
            'SELECT id, nombre, apellido, email, telefono, fecha_registro FROM usuarios WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error obteniendo usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener estadísticas del usuario
app.get('/api/users/:id/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        // Estadísticas simuladas
        const stats = {
            totalOrders: 3,
            wishlistItems: 5,
            reviews: 2,
            pendingOrders: 1,
            totalSpent: 450.46
        };
        
        res.json(stats);
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar perfil
app.put('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const { nombre, apellido, email, telefono } = req.body;
        
        const result = await query(
            `UPDATE usuarios 
             SET nombre = $1, apellido = $2, email = $3, telefono = $4
             WHERE id = $5 
             RETURNING id, nombre, apellido, email, telefono`,
            [nombre, apellido, email, telefono, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Actualizar sesión
        req.session.userName = `${nombre} ${apellido}`;
        req.session.userEmail = email;
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Cambiar contraseña
app.put('/api/users/:id/password', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const { current_password, new_password } = req.body;
        
        const userResult = await query(
            'SELECT password_hash FROM usuarios WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
        if (!isValid) {
            return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }
        
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        await query(
            'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
            [hashedPassword, userId]
        );
        
        res.json({ success: true, message: 'Contraseña actualizada' });
        
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - DIRECCIONES =================
app.get('/api/users/:id/addresses', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('📍 Obteniendo direcciones para usuario:', userId);
        
        // Simulación de direcciones
        const addresses = [
            {
                id: 1,
                nombre: 'Casa',
                nombre_completo: req.session.userName || 'Ana Martínez Soto',
                telefono: '809-555-1234',
                calle: 'Av. 27 de Febrero',
                numero: '123',
                apartamento: 'Apto 5B',
                sector: 'Naco',
                ciudad: 'Santo Domingo Este',
                provincia: 'Distrito Nacional',
                codigo_postal: '10101',
                pais: 'República Dominicana',
                predeterminada: true,
                paqueteria_preferida: 'VIMENPAQ'
            },
            {
                id: 2,
                nombre: 'Oficina',
                nombre_completo: req.session.userName || 'Ana Martínez Soto',
                telefono: '809-555-5678',
                calle: 'Calle Santiago',
                numero: '456',
                apartamento: 'Torre A, Piso 8',
                sector: 'Piantini',
                ciudad: 'Santo Domingo',
                provincia: 'Distrito Nacional',
                codigo_postal: '10102',
                pais: 'República Dominicana',
                predeterminada: false,
                paqueteria_preferida: 'Mundo Cargo'
            }
        ];
        
        res.json(addresses);
        
    } catch (error) {
        console.error('Error obteniendo direcciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/users/:id/addresses', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const addressData = req.body;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        // Validación básica
        const required = ['nombre', 'calle', 'numero', 'ciudad', 'provincia'];
        for (const field of required) {
            if (!addressData[field] || addressData[field].trim() === '') {
                return res.status(400).json({ error: `El campo ${field} es requerido` });
            }
        }
        
        console.log('➕ Creando dirección:', addressData.nombre);
        
        // Simulación de creación
        const newAddress = {
            id: Date.now(),
            usuario_id: userId,
            ...addressData,
            nombre_completo: addressData.nombre_completo || req.session.userName,
            telefono: addressData.telefono || '809-555-0000',
            pais: 'República Dominicana',
            predeterminada: addressData.predeterminada || false,
            fecha_creacion: new Date()
        };
        
        res.status(201).json(newAddress);
        
    } catch (error) {
        console.error('Error creando dirección:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.put('/api/users/:id/addresses/:addressId', requireAuth, async (req, res) => {
    try {
        const { id, addressId } = req.params;
        const addressData = req.body;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('✏️ Actualizando dirección:', addressId);
        
        // Simulación de actualización
        const updatedAddress = {
            id: addressId,
            usuario_id: id,
            ...addressData,
            fecha_actualizacion: new Date()
        };
        
        res.json(updatedAddress);
        
    } catch (error) {
        console.error('Error actualizando dirección:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/api/users/:id/addresses/:addressId', requireAuth, async (req, res) => {
    try {
        const { id, addressId } = req.params;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('🗑️ Eliminando dirección:', addressId);
        
        res.json({ success: true, message: 'Dirección eliminada' });
        
    } catch (error) {
        console.error('Error eliminando dirección:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.put('/api/users/:id/addresses/:addressId/default', requireAuth, async (req, res) => {
    try {
        const { id, addressId } = req.params;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('⭐ Estableciendo dirección predeterminada:', addressId);
        
        res.json({ 
            success: true, 
            message: 'Dirección predeterminada actualizada',
            address_id: addressId
        });
        
    } catch (error) {
        console.error('Error estableciendo dirección predeterminada:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - PEDIDOS =================
app.get('/api/orders/:id', requireAuth, async (req, res) => {
    try {
        const orderId = req.params.id;
        
        console.log('📦 Obteniendo orden:', orderId);
        
        // Simulación de orden
        const order = {
            id: orderId,
            fecha_orden: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            total: 149.97,
            subtotal: 149.97,
            shipping_cost: 0,
            estado: 'entregado',
            metodo_pago: 'Tarjeta de crédito',
            paqueteria: 'VIMENPAQ',
            tracking_number: 'VMP789012345RD',
            direccion_envio: 'Av. 27 de Febrero 123, Naco',
            ciudad_envio: 'Santo Domingo Este',
            provincia_envio: 'Distrito Nacional',
            telefono_contacto: '809-555-1234',
            items: [
                {
                    id: 1,
                    producto_id: 1,
                    nombre: 'Legging High-Waist Black',
                    imagen: '/public/images/default-product.jpg',
                    precio: 59.99,
                    cantidad: 2,
                    talla: 'M',
                    color: 'Negro'
                },
                {
                    id: 2,
                    producto_id: 2,
                    nombre: 'Sports Bra Essential',
                    imagen: '/public/images/default-product.jpg',
                    precio: 29.99,
                    cantidad: 1,
                    talla: 'S',
                    color: 'Negro'
                }
            ]
        };
        
        res.json(order);
        
    } catch (error) {
        console.error('Error obteniendo orden:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/api/users/:id/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const limit = req.query.limit || 10;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('📋 Obteniendo órdenes para usuario:', userId);
        
        // Simulación de órdenes
        const orders = [
            {
                id: 1001,
                fecha_orden: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                total: 149.97,
                estado: 'entregado',
                items_count: 2,
                tracking_number: 'VMP123456789RD',
                paqueteria: 'VIMENPAQ'
            },
            {
                id: 1002,
                fecha_orden: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                total: 89.99,
                estado: 'procesando',
                items_count: 1,
                tracking_number: null,
                paqueteria: null
            },
            {
                id: 1003,
                fecha_orden: new Date(),
                total: 210.50,
                estado: 'pendiente',
                items_count: 3,
                tracking_number: null,
                paqueteria: null
            }
        ].slice(0, limit);
        
        res.json(orders);
        
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear pedido (checkout)
app.post('/api/orders', requireAuth, async (req, res) => {
    try {
        const { items, address_id, payment_method } = req.body;
        const userId = req.session.userId;
        
        console.log('🛒 Creando pedido para usuario:', userId);
        
        
        // Simulación de pedido
        const order = {
            id: Date.now(),
            usuario_id: userId,
            address_id: address_id || 1,
            subtotal: subtotal,
            shipping_cost: shipping_cost,
            total: total,
            payment_method: payment_method || 'Tarjeta de crédito',
            estado: 'pendiente',
            fecha_creacion: new Date(),
            items: items
        };
        
        console.log('✅ Pedido creado:', order.id);
        
        res.status(201).json({ 
            success: true, 
            order_id: order.id,
            order: order
        });
        
    } catch (error) {
        console.error('Error creando pedido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - WISHLIST =================
app.get('/api/users/:id/wishlist', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('❤️ Obteniendo wishlist para usuario:', userId);
        
        // Simulación de wishlist
        const wishlist = [
            {
                producto_id: 1,
                nombre: 'Legging High-Waist Black',
                imagen: '/public/images/default-product.jpg',
                precio: 59.99,
                precio_final: 59.99,
                categoria: 'leggings',
                tallas: ['XS', 'S', 'M', 'L'],
                stock: 10,
                tiene_descuento: false
            },
            {
                producto_id: 2,
                nombre: 'Sports Bra Essential',
                imagen: '/public/images/default-product.jpg',
                precio: 34.99,
                precio_final: 27.99,
                categoria: 'tops',
                tallas: ['S', 'M', 'L'],
                stock: 3,
                tiene_descuento: true,
                descuento_porcentaje: 20
            }
        ];
        
        res.json(wishlist);
        
    } catch (error) {
        console.error('Error obteniendo wishlist:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/api/users/:id/wishlist/:productId', requireAuth, async (req, res) => {
    try {
        const { id, productId } = req.params;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('🗑️ Eliminando de wishlist:', productId);
        
        res.json({ success: true, message: 'Producto eliminado de wishlist' });
        
    } catch (error) {
        console.error('Error eliminando de wishlist:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - PROVINCIAS RD =================
app.get('/api/dominican-republic/provinces', async (req, res) => {
    console.log('🗺️ Obteniendo provincias de RD');
    
    const provinces = [
        'Distrito Nacional', 'Santo Domingo', 'Santiago', 'La Vega', 'San Cristóbal',
        'San Pedro de Macorís', 'La Altagracia', 'Puerto Plata', 'Duarte', 'Espaillat',
        'San Juan', 'Azua', 'Barahona', 'Dajabón', 'El Seibo', 'Elías Piña', 'Hato Mayor',
        'Hermanas Mirabal', 'Independencia', 'María Trinidad Sánchez', 'Monseñor Nouel',
        'Monte Cristi', 'Monte Plata', 'Pedernales', 'Peravia', 'Samaná', 'San José de Ocoa',
        'Sánchez Ramírez', 'Valverde', 'La Romana'
    ];
    
    res.json(provinces.sort());
});

// ================= API - PRODUCTOS =================
app.get('/api/products', async (req, res) => {
    console.log('📦 Obteniendo todos los productos');
    
    try {
        const result = await query(
            'SELECT * FROM productos WHERE activo = true ORDER BY id DESC'
        );
        
        // Procesar arrays de PostgreSQL
        const products = result.rows.map(product => ({
            ...product,
            imagen: product.imagen || '/public/images/default-product.jpg',
            imagenes_adicionales: parseArrayFromPostgres(product.imagenes_adicionales),
            tallas: parseArrayFromPostgres(product.tallas),
            colores: parseArrayFromPostgres(product.colores),
            precio_final: product.descuento_porcentaje > 0 ? 
                parseFloat(product.precio) * (1 - product.descuento_porcentaje / 100) :
                product.descuento_precio > 0 ? 
                    parseFloat(product.descuento_precio) : 
                    parseFloat(product.precio),
            tiene_descuento: product.descuento_porcentaje > 0 || product.descuento_precio > 0
        }));
        
        console.log(`✅ Enviando ${products.length} productos`);
        res.json(products);
        
    } catch (error) {
        console.error('❌ Error obteniendo productos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    console.log('🎯 Obteniendo producto ID:', productId);
    
    try {
        const result = await query(
            'SELECT * FROM productos WHERE id = $1',
            [productId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const product = result.rows[0];
        
        // Procesar arrays
        product.tallas = parseArrayFromPostgres(product.tallas);
        product.colores = parseArrayFromPostgres(product.colores);
        product.imagenes_adicionales = parseArrayFromPostgres(product.imagenes_adicionales);
        
        // Asegurar imagen por defecto
        if (!product.imagen) {
            product.imagen = '/public/images/default-product.jpg';
        }
        
        // Calcular precio con descuento
        product.precio_final = product.descuento_porcentaje > 0 ? 
            parseFloat(product.precio) * (1 - product.descuento_porcentaje / 100) :
            product.descuento_precio > 0 ? 
                parseFloat(product.descuento_precio) : 
                parseFloat(product.precio);
        
        product.tiene_descuento = product.descuento_porcentaje > 0 || product.descuento_precio > 0;
        
        console.log('✅ Producto encontrado:', product.nombre);
        res.json(product);
        
    } catch (error) {
        console.error('❌ Error obteniendo producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener productos en oferta
app.get('/api/products/ofertas', async (req, res) => {
    console.log('🎁 Obteniendo productos en oferta');
    
    try {
        const result = await query(
            `SELECT * FROM productos 
             WHERE (descuento_porcentaje > 0 OR descuento_precio > 0)
               AND activo = true
               AND stock > 0
             ORDER BY id DESC`
        );
        
        const products = result.rows.map(product => ({
            ...product,
            imagen: product.imagen || '/public/images/default-product.jpg',
            imagenes_adicionales: parseArrayFromPostgres(product.imagenes_adicionales),
            tallas: parseArrayFromPostgres(product.tallas),
            colores: parseArrayFromPostgres(product.colores),
            precio_final: product.descuento_porcentaje > 0 ? 
                parseFloat(product.precio) * (1 - product.descuento_porcentaje / 100) :
                parseFloat(product.descuento_precio)
        }));
        
        console.log(`✅ Enviando ${products.length} productos en oferta`);
        res.json(products);
        
    } catch (error) {
        console.error('❌ Error obteniendo ofertas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener categorías
app.get('/api/categories', async (req, res) => {
    try {
        const result = await query(
            'SELECT DISTINCT categoria FROM productos WHERE activo = true ORDER BY categoria'
        );
        res.json(result.rows.map(row => row.categoria));
    } catch (error) {
        console.error('❌ Error obteniendo categorías:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Búsqueda de productos
app.get('/api/products/search', async (req, res) => {
    const { q, category, minPrice, maxPrice, sort } = req.query;
    console.log('🔍 Búsqueda de productos:', req.query);
    
    try {
        let queryStr = 'SELECT * FROM productos WHERE activo = true';
        const params = [];
        let paramCount = 1;
        
        if (q) {
            queryStr += ` AND (nombre ILIKE $${paramCount} OR descripcion ILIKE $${paramCount})`;
            params.push(`%${q}%`);
            paramCount++;
        }
        
        if (category) {
            queryStr += ` AND categoria = $${paramCount}`;
            params.push(category);
            paramCount++;
        }
        
        if (minPrice) {
            queryStr += ` AND precio >= $${paramCount}`;
            params.push(parseFloat(minPrice));
            paramCount++;
        }
        
        if (maxPrice) {
            queryStr += ` AND precio <= $${paramCount}`;
            params.push(parseFloat(maxPrice));
            paramCount++;
        }
        
        switch (sort) {
            case 'price-low':
                queryStr += ' ORDER BY precio ASC';
                break;
            case 'price-high':
                queryStr += ' ORDER BY precio DESC';
                break;
            case 'name':
                queryStr += ' ORDER BY nombre ASC';
                break;
            case 'newest':
            default:
                queryStr += ' ORDER BY id DESC';
                break;
        }
        
        const result = await query(queryStr, params);
        
        const products = result.rows.map(product => ({
            ...product,
            imagen: product.imagen || '/public/images/default-product.jpg',
            imagenes_adicionales: parseArrayFromPostgres(product.imagenes_adicionales),
            tallas: parseArrayFromPostgres(product.tallas),
            colores: parseArrayFromPostgres(product.colores)
        }));
        
        res.json(products);
        
    } catch (error) {
        console.error('❌ Error buscando productos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Incrementar vistas
app.post('/api/products/:id/view', async (req, res) => {
    try {
        await query(
            'UPDATE productos SET vistas = COALESCE(vistas, 0) + 1 WHERE id = $1',
            [req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error incrementando vistas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - ADMINISTRACIÓN =================
// Obtener todos los productos (admin)
app.get('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM productos ORDER BY id DESC');
        
        const products = result.rows.map(product => ({
            ...product,
            tallas: parseArrayFromPostgres(product.tallas),
            colores: parseArrayFromPostgres(product.colores),
            imagenes_adicionales: parseArrayFromPostgres(product.imagenes_adicionales)
        }));
        
        res.json(products);
    } catch (error) {
        console.error('❌ Error obteniendo productos (admin):', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear producto (admin) - CON MÚLTIPLES IMÁGENES
app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
    const { 
        nombre, 
        descripcion, 
        precio, 
        categoria, 
        imagen, 
        stock, 
        tallas, 
        colores, 
        sku, 
        material, 
        coleccion,
        imagenes_adicionales
    } = req.body;
    
    console.log('➕ Creando producto:', nombre);
    console.log('🖼️ Imágenes adicionales:', imagenes_adicionales);
    
    try {
        const productData = {
            nombre: nombre || 'Producto sin nombre',
            descripcion: descripcion || '',
            precio: parseFloat(precio) || 0,
            categoria: categoria || 'sin-categoria',
            imagen: imagen || '/public/images/default-product.jpg',
            stock: parseInt(stock) || 0,
            tallas: formatArrayForPostgres(tallas),
            colores: formatArrayForPostgres(colores),
            sku: sku || `SKU-${Date.now()}`,
            material: material || '',
            coleccion: coleccion || '',
            imagenes_adicionales: formatArrayForPostgres(imagenes_adicionales),
            activo: true
        };
        
        const result = await query(
            `INSERT INTO productos (
                nombre, descripcion, precio, categoria, imagen, stock, 
                tallas, colores, sku, material, coleccion, 
                imagenes_adicionales, activo, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [
                productData.nombre,
                productData.descripcion,
                productData.precio,
                productData.categoria,
                productData.imagen,
                productData.stock,
                productData.tallas,
                productData.colores,
                productData.sku,
                productData.material,
                productData.coleccion,
                productData.imagenes_adicionales,
                productData.activo
            ]
        );

        const newProduct = result.rows[0];
        newProduct.tallas = parseArrayFromPostgres(newProduct.tallas);
        newProduct.colores = parseArrayFromPostgres(newProduct.colores);
        newProduct.imagenes_adicionales = parseArrayFromPostgres(newProduct.imagenes_adicionales);
        
        console.log('✅ Producto creado:', newProduct.nombre);
        console.log('🖼️ Total imágenes:', newProduct.imagenes_adicionales.length + 1);
        
        res.status(201).json(newProduct);
        
    } catch (error) {
        console.error('❌ Error creando producto:', error.message);
        
        let errorMessage = 'Error interno del servidor';
        if (error.message.includes('null value')) {
            errorMessage = 'Faltan campos requeridos';
        } else if (error.message.includes('unique constraint')) {
            errorMessage = 'El SKU ya existe';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message
        });
    }
});

// Actualizar producto (admin) - CON MÚLTIPLES IMÁGENES
app.put('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const productData = req.body;
    
    console.log('✏️ Actualizando producto ID:', id);
    console.log('🖼️ Datos de imágenes:', {
        imagen: productData.imagen,
        imagenes_adicionales: productData.imagenes_adicionales
    });
    
    try {
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        const fields = ['nombre', 'descripcion', 'precio', 'categoria', 'imagen', 'stock', 
                       'tallas', 'colores', 'sku', 'material', 'coleccion', 
                       'imagenes_adicionales', 'activo'];
        
        fields.forEach(field => {
            if (productData[field] !== undefined) {
                let value = productData[field];
                
                if (field === 'tallas' || field === 'colores' || field === 'imagenes_adicionales') {
                    value = formatArrayForPostgres(value);
                }
                
                if (field === 'precio' && value !== null) {
                    value = parseFloat(value);
                }
                if (field === 'stock' && value !== null) {
                    value = parseInt(value);
                }
                if (field === 'activo') {
                    value = Boolean(value);
                }
                
                updates.push(`${field} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        });
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay datos para actualizar' });
        }
        
        updates.push('fecha_actualizacion = CURRENT_TIMESTAMP');
        values.push(id);
        
        const queryStr = `
            UPDATE productos 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex} 
            RETURNING *
        `;
        
        const result = await query(queryStr, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const updatedProduct = result.rows[0];
        updatedProduct.tallas = parseArrayFromPostgres(updatedProduct.tallas);
        updatedProduct.colores = parseArrayFromPostgres(updatedProduct.colores);
        updatedProduct.imagenes_adicionales = parseArrayFromPostgres(updatedProduct.imagenes_adicionales);
        
        console.log('✅ Producto actualizado:', updatedProduct.nombre);
        console.log('🖼️ Imágenes después de actualizar:', {
            principal: updatedProduct.imagen,
            adicionales: updatedProduct.imagenes_adicionales
        });
        
        res.json(updatedProduct);
        
    } catch (error) {
        console.error('❌ Error actualizando producto:', error.message);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Eliminar producto (admin)
app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Desactivando producto ID:', id);
    
    try {
        const result = await query(
            'UPDATE productos SET activo = false WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        console.log('✅ Producto desactivado:', result.rows[0].nombre);
        res.json({ success: true, message: 'Producto desactivado' });
        
    } catch (error) {
        console.error('❌ Error desactivando producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener usuarios (admin)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await query(
            'SELECT id, nombre, apellido, email, telefono, rol, fecha_registro FROM usuarios ORDER BY id DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error obteniendo usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener órdenes (admin)
app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Simulación para desarrollo
        const orders = [
            {
                id: 1001,
                fecha_orden: new Date(),
                total: 149.97,
                estado: 'pendiente',
                metodo_envio: 'Estándar',
                direccion_envio: 'Calle Principal 123',
                ciudad_envio: 'Ciudad',
                telefono_contacto: '+123456789',
                nombre_cliente: 'Ana Martínez',
                email_cliente: 'ana@email.com',
                items: [
                    {
                        nombre: 'Legging High-Waist Black',
                        talla: 'M',
                        color: 'Negro',
                        cantidad: 2,
                        precio_unitario: 59.99,
                        imagen: '/public/images/default-product.jpg'
                    }
                ]
            }
        ];
        
        res.json(orders);
        
    } catch (error) {
        console.error('❌ Error obteniendo órdenes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar estado de orden (admin)
app.put('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    
    console.log('🔄 Actualizando estado de orden:', id, '->', estado);
    
    try {
        // Simulación para desarrollo
        res.json({
            id: id,
            estado: estado,
            fecha_actualizacion: new Date()
        });
    } catch (error) {
        console.error('❌ Error actualizando orden:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - DESCUENTOS =================
app.get('/api/admin/discounts', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Simulación para desarrollo
        const discounts = [
            {
                id: 1,
                codigo: "VERANO20",
                tipo: "porcentaje",
                valor: 20,
                aplicable_a: "todos",
                minimo_compra: 50,
                usos_totales: 100,
                usos_actuales: 34,
                expiracion: "2024-12-31",
                activo: true
            }
        ];
        
        res.json(discounts);
        
    } catch (error) {
        console.error('Error obteniendo descuentos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/admin/discounts', requireAuth, requireAdmin, async (req, res) => {
    try {
        const discountData = req.body;
        
        if (!discountData.codigo || !discountData.tipo || !discountData.valor) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        const newDiscount = {
            id: Date.now(),
            ...discountData,
            fecha_creacion: new Date(),
            usos_actuales: 0
        };
        
        console.log('✅ Descuento creado:', newDiscount.codigo);
        res.status(201).json(newDiscount);
        
    } catch (error) {
        console.error('Error creando descuento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/api/admin/discounts/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('🗑️ Descuento eliminado:', id);
        res.json({ success: true, message: 'Descuento eliminado' });
        
    } catch (error) {
        console.error('Error eliminando descuento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Validar código de descuento
app.post('/api/discounts/validate', async (req, res) => {
    const { codigo, total } = req.body;
    
    try {
        const validDiscounts = {
            'VERANO20': {
                id: 1,
                codigo: 'VERANO20',
                tipo: 'porcentaje',
                valor: 20,
                minimo_compra: 50,
                valido: total >= 50
            },
            'ENVIOGRATIS': {
                id: 3,
                codigo: 'ENVIOGRATIS',
                tipo: 'envio',
                valor: 100,
                minimo_compra: 30,
                valido: total >= 30
            },
            'BIENVENIDA10': {
                id: 4,
                codigo: 'BIENVENIDA10',
                tipo: 'porcentaje',
                valor: 10,
                minimo_compra: 0,
                valido: true
            }
        };
        
        const discount = validDiscounts[codigo.toUpperCase()];
        
        if (!discount) {
            return res.status(404).json({ 
                valido: false, 
                error: 'Código no válido' 
            });
        }
        
        if (!discount.valido) {
            return res.status(400).json({ 
                valido: false, 
                error: `Mínimo de compra: $${discount.minimo_compra}` 
            });
        }
        
        res.json({
            valido: true,
            descuento: discount
        });
        
    } catch (error) {
        console.error('Error validando descuento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - DESCUENTOS ESPECÍFICOS DE PRODUCTOS =================

// Aplicar descuento a un producto específico
app.post('/api/admin/products/:id/discount', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { discount_type, discount_percent, discount_price, discount_expires } = req.body;
    
    console.log('🎯 Aplicando descuento al producto ID:', id, req.body);
    
    try {
        if (!discount_type) {
            return res.status(400).json({ error: 'Tipo de descuento requerido' });
        }
        
        let updateQuery = '';
        let updateValues = [];
        
        if (discount_type === 'percent') {
            if (!discount_percent || discount_percent < 1 || discount_percent > 100) {
                return res.status(400).json({ error: 'Porcentaje inválido (1-100%)' });
            }
            
            updateQuery = `
                UPDATE productos 
                SET descuento_porcentaje = $1,
                    descuento_precio = NULL,
                    descuento_expiracion = $2,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;
            updateValues = [discount_percent, discount_expires || null, id];
            
        } else if (discount_type === 'fixed') {
            if (!discount_price || discount_price <= 0) {
                return res.status(400).json({ error: 'Precio con descuento inválido' });
            }
            
            // Verificar que el precio con descuento sea menor al precio original
            const productResult = await query(
                'SELECT precio FROM productos WHERE id = $1',
                [id]
            );
            
            if (productResult.rows.length === 0) {
                return res.status(404).json({ error: 'Producto no encontrado' });
            }
            
            const originalPrice = parseFloat(productResult.rows[0].precio);
            if (discount_price >= originalPrice) {
                return res.status(400).json({ 
                    error: 'El precio con descuento debe ser menor al precio original'
                });
            }
            
            // Calcular porcentaje de descuento
            const discountPercent = Math.round((1 - (discount_price / originalPrice)) * 100);
            
            updateQuery = `
                UPDATE productos 
                SET descuento_precio = $1,
                    descuento_porcentaje = $2,
                    descuento_expiracion = $3,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING *
            `;
            updateValues = [discount_price, discountPercent, discount_expires || null, id];
            
        } else {
            return res.status(400).json({ error: 'Tipo de descuento no válido' });
        }
        
        const result = await query(updateQuery, updateValues);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const updatedProduct = result.rows[0];
        
        console.log('✅ Descuento aplicado al producto:', updatedProduct.nombre);
        res.json({
            success: true,
            product: updatedProduct,
            message: 'Descuento aplicado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error aplicando descuento:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Quitar descuento de un producto
app.delete('/api/admin/products/:id/discount', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Quitando descuento del producto ID:', id);
    
    try {
        const result = await query(
            `UPDATE productos 
             SET descuento_porcentaje = NULL,
                 descuento_precio = NULL,
                 descuento_expiracion = NULL,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const updatedProduct = result.rows[0];
        
        console.log('✅ Descuento removido del producto:', updatedProduct.nombre);
        res.json({
            success: true,
            product: updatedProduct,
            message: 'Descuento eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error quitando descuento:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Obtener descuentos activos por producto
app.get('/api/admin/products/:id/discounts', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await query(
            `SELECT descuento_porcentaje, descuento_precio, descuento_expiracion 
             FROM productos 
             WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const discounts = {
            descuento_porcentaje: result.rows[0].descuento_porcentaje,
            descuento_precio: result.rows[0].descuento_precio,
            descuento_expiracion: result.rows[0].descuento_expiracion,
            tiene_descuento: result.rows[0].descuento_porcentaje > 0 || result.rows[0].descuento_precio > 0
        };
        
        res.json(discounts);
        
    } catch (error) {
        console.error('Error obteniendo descuentos del producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Verificar si un descuento ha expirado
app.get('/api/admin/discounts/check-expired', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT COUNT(*) as expirados 
             FROM productos 
             WHERE descuento_expiracion IS NOT NULL 
               AND descuento_expiracion < CURRENT_DATE
               AND (descuento_porcentaje > 0 OR descuento_precio > 0)`
        );
        
        const expirados = parseInt(result.rows[0].expirados);
        
        if (expirados > 0) {
            // Limpiar descuentos expirados
            await query(
                `UPDATE productos 
                 SET descuento_porcentaje = NULL,
                     descuento_precio = NULL,
                     descuento_expiracion = NULL
                 WHERE descuento_expiracion IS NOT NULL 
                   AND descuento_expiracion < CURRENT_DATE`
            );
            
            console.log(`🧹 Limpiados ${expirados} descuentos expirados`);
        }
        
        res.json({
            expirados: expirados,
            message: expirados > 0 ? 
                `${expirados} descuentos expirados limpiados` : 
                'No hay descuentos expirados'
        });
        
    } catch (error) {
        console.error('Error verificando descuentos expirados:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= RUTAS DE UTILIDAD =================
app.get('/api/test', async (req, res) => {
    try {
        const result = await query('SELECT NOW() as time, version() as version');
        res.json({ 
            message: '✅ Servidor funcionando',
            database: '✅ Conectado a PostgreSQL',
            time: result.rows[0].time,
            version: result.rows[0].version
        });
    } catch (error) {
        res.status(500).json({ 
            error: '❌ Error de conexión',
            details: error.message 
        });
    }
});

// Crear datos de prueba
app.get('/api/create-test-data', async (req, res) => {
    try {
        const existing = await query('SELECT COUNT(*) FROM productos');
        const count = parseInt(existing.rows[0].count);
        
        if (count === 0) {
            const testProducts = [
                {
                    nombre: 'Legging High-Waist Black',
                    descripcion: 'Legging de alta compresión con tecnología dry-fit',
                    precio: 59.99,
                    categoria: 'leggings',
                    stock: 25,
                    tallas: '{"XS","S","M","L"}',
                    colores: '{"Negro","Gris Oscuro"}',
                    imagenes_adicionales: '{"https://via.placeholder.com/400x600/000000/FFFFFF?text=Legging+Back","https://via.placeholder.com/400x600/333333/FFFFFF?text=Legging+Side"}',
                    material: 'Nylon/Spandex',
                    coleccion: 'Essentials',
                    sku: 'MAB-LG001'
                },
                {
                    nombre: 'Sports Bra Essential',
                    descripcion: 'Sujetador deportivo esencial con soporte medio',
                    precio: 34.99,
                    categoria: 'tops',
                    stock: 30,
                    tallas: '{"S","M","L"}',
                    colores: '{"Negro","Blanco"}',
                    imagenes_adicionales: '{"https://via.placeholder.com/400x600/FFFFFF/000000?text=Sports+Bra+Back","https://via.placeholder.com/400x600/000000/FFFFFF?text=Sports+Bra+Detail"}',
                    material: 'Polyester/Spandex',
                    coleccion: 'Essentials',
                    sku: 'MAB-BR001'
                }
            ];
            
            for (const product of testProducts) {
                await query(
                    `INSERT INTO productos (
                        nombre, descripcion, precio, categoria, stock, 
                        tallas, colores, imagenes_adicionales, material, coleccion, sku, activo
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        product.nombre,
                        product.descripcion,
                        product.precio,
                        product.categoria,
                        product.stock,
                        product.tallas,
                        product.colores,
                        product.imagenes_adicionales,
                        product.material,
                        product.coleccion,
                        product.sku,
                        true
                    ]
                );
            }
            
            res.json({ 
                success: true, 
                message: `${testProducts.length} productos de prueba creados`
            });
        } else {
            res.json({ 
                success: true, 
                message: `Ya existen ${count} productos`
            });
        }
    } catch (error) {
        console.error('Error creando datos de prueba:', error);
        res.status(500).json({ 
            error: 'Error creando datos de prueba',
            details: error.message
        });
    }
});

// ================= MANEJO DE ERRORES =================
app.use((req, res, next) => {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        method: req.method,
        url: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('🔥 Error del servidor:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: err.message
    });
});

// ================= API - RESEÑAS DE PRODUCTOS =================

// Obtener reseñas de un producto
app.get('/api/products/:id/reviews', async (req, res) => {
    const productId = req.params.id;
    
    try {
        const result = await query(
            `SELECT c.*, u.nombre as usuario_nombre, u.email as usuario_email
             FROM comentarios_productos c
             JOIN usuarios u ON c.usuario_id = u.id
             WHERE c.producto_id = $1 AND c.aprobado = true
             ORDER BY c.fecha_creacion DESC`,
            [productId]
        );
        
        const reviews = result.rows.map(review => ({
            ...review,
            respuestas: parseArrayFromPostgres(review.respuestas)
        }));
        
        res.json(reviews);
        
    } catch (error) {
        console.error('Error obteniendo reseñas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear una reseña
app.post('/api/products/:id/reviews', requireAuth, async (req, res) => {
    const productId = req.params.id;
    const userId = req.session.userId;
    const { calificacion, titulo, comentario } = req.body;
    
    try {
        // Verificar si el usuario ya ha reseñado este producto
        const existingReview = await query(
            'SELECT id FROM comentarios_productos WHERE producto_id = $1 AND usuario_id = $2',
            [productId, userId]
        );
        
        if (existingReview.rows.length > 0) {
            return res.status(400).json({ error: 'Ya has reseñado este producto' });
        }
        
        // Crear la reseña
        const result = await query(
            `INSERT INTO comentarios_productos 
             (producto_id, usuario_id, calificacion, titulo, comentario, aprobado)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [productId, userId, calificacion, titulo, comentario, false] // Aprobación pendiente
        );
        
        res.status(201).json({
            success: true,
            review: result.rows[0],
            message: 'Reseña enviada para aprobación'
        });
        
    } catch (error) {
        console.error('Error creando reseña:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Marcar reseña como útil
app.post('/api/reviews/:id/helpful', async (req, res) => {
    const reviewId = req.params.id;
    
    try {
        // Aquí podrías implementar un sistema de votos más sofisticado
        // Por ahora, simplemente devolvemos éxito
        res.json({ success: true, message: 'Gracias por tu feedback' });
        
    } catch (error) {
        console.error('Error marcando como útil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API ADMIN - RESEÑAS =================

// Obtener todas las reseñas (admin)
app.get('/api/admin/reviews', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        
        let queryStr = `
            SELECT c.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
            FROM comentarios_productos c
            JOIN productos p ON c.producto_id = p.id
            JOIN usuarios u ON c.usuario_id = u.id
        `;
        
        const params = [];
        
        if (status === 'pending') {
            queryStr += ' WHERE c.aprobado = false';
        } else if (status === 'approved') {
            queryStr += ' WHERE c.aprobado = true';
        }
        
        queryStr += ' ORDER BY c.fecha_creacion DESC';
        
        const result = await query(queryStr, params);
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error obteniendo reseñas (admin):', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Aprobar/rechazar reseña (admin)
app.put('/api/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
    const reviewId = req.params.id;
    const { aprobado } = req.body;
    
    try {
        const result = await query(
            `UPDATE comentarios_productos 
             SET aprobado = $1, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [aprobado, reviewId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reseña no encontrada' });
        }
        
        res.json({
            success: true,
            review: result.rows[0],
            message: `Reseña ${aprobado ? 'aprobada' : 'rechazada'}`
        });
        
    } catch (error) {
        console.error('Error actualizando reseña:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Responder a reseña (admin)
app.post('/api/admin/reviews/:id/reply', requireAuth, requireAdmin, async (req, res) => {
    const reviewId = req.params.id;
    const { respuesta } = req.body;
    
    try {
        // Obtener respuestas actuales
        const reviewResult = await query(
            'SELECT respuestas FROM comentarios_productos WHERE id = $1',
            [reviewId]
        );
        
        if (reviewResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reseña no encontrada' });
        }
        
        const currentReplies = parseArrayFromPostgres(reviewResult.rows[0].respuestas);
        const newReplies = [...currentReplies, respuesta];
        
        const updateResult = await query(
            `UPDATE comentarios_productos 
             SET respuestas = $1, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [formatArrayForPostgres(newReplies), reviewId]
        );
        
        res.json({
            success: true,
            review: updateResult.rows[0],
            message: 'Respuesta añadida'
        });
        
    } catch (error) {
        console.error('Error añadiendo respuesta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar reseña (admin)
app.delete('/api/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
    const reviewId = req.params.id;
    
    try {
        await query('DELETE FROM comentarios_productos WHERE id = $1', [reviewId]);
        res.json({ success: true, message: 'Reseña eliminada' });
        
    } catch (error) {
        console.error('Error eliminando reseña:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= INICIAR SERVIDOR =================
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`\n📋 RUTAS PRINCIPALES:`);
    console.log(`   • Página principal: http://localhost:${PORT}/`);
    console.log(`   • Login: http://localhost:${PORT}/login`);
    console.log(`   • Registro: http://localhost:${PORT}/register`);
    console.log(`   • Admin: http://localhost:${PORT}/admin`);
    console.log(`   • Tienda: http://localhost:${PORT}/shop`);
    console.log(`   • Carrito: http://localhost:${PORT}/cart`);
    console.log(`   • Cuenta: http://localhost:${PORT}/account`);
    console.log(`\n🔧 RUTAS DE API:`);
    console.log(`   • Test: http://localhost:${PORT}/api/test`);
    console.log(`   • Productos: http://localhost:${PORT}/api/products`);
    console.log(`   • Provincias RD: http://localhost:${PORT}/api/dominican-republic/provinces`);
    console.log(`   • Configuración Pagos: http://localhost:${PORT}/api/payments/config`);
    console.log(`\n👤 CREDENCIALES:`);
    console.log(`   • Admin: admin@gmail.com / admin123`);
    console.log(`\n✅ Listo para usar!`);
});

app.post('/api/payments/create-stripe-payment', async (req, res) => {
    console.log('📨 Petición recibida en create-stripe-payment');
    console.log('👤 Usuario en sesión:', req.session.userId);
    console.log('📦 Body recibido:', req.body);
    
    // Simular respuesta exitosa para pruebas
    res.json({
        clientSecret: 'pi_test_secret_123456',
        paymentIntentId: 'pi_123456789'
    });
});