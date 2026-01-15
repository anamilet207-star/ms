// 🔕 Stripe desactivado temporalmente
const STRIPE_ENABLED = false;

// ================= CONFIGURACIÓN DE MONEDA =================
const DEFAULT_CURRENCY = 'DOP'; // Solo pesos dominicanos
const CURRENCY_SYMBOL = 'RD$'; // Símbolo de pesos dominicanos

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Importar configuración de base de datos
const { query } = require('./env/db.js');

// Importar SDK de PayPal
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
const PORT = 3002;

let stripe = null;

if (STRIPE_ENABLED) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ================= FUNCIONES DE FORMATO DOP =================

/**
 * Formatear precio en DOP
 */
const formatDOP = (amount) => {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount) || 0;
    }
    return `RD$ ${amount.toLocaleString('es-DO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

/**
 * Procesar productos para mostrar precios en DOP
 */
const processProductPrices = (product) => {
    const precioDOP = parseFloat(product.precio) || 0;
    
    // Calcular precio final con descuento
    let precioFinalDOP = precioDOP;
    let descuentoAplicado = false;
    let descuentoPorcentaje = 0;
    
    if (product.descuento_porcentaje > 0) {
        descuentoPorcentaje = product.descuento_porcentaje;
        precioFinalDOP = Math.round(precioDOP * (1 - descuentoPorcentaje / 100));
        descuentoAplicado = true;
    } else if (product.descuento_precio > 0) {
        precioFinalDOP = parseFloat(product.descuento_precio) || 0;
        descuentoAplicado = true;
        // Calcular porcentaje de descuento
        if (precioDOP > 0) {
            descuentoPorcentaje = Math.round((1 - (precioFinalDOP / precioDOP)) * 100);
        }
    }
    
    return {
        ...product,
        // Precios en DOP
        precio_dop: precioDOP,
        precio_final_dop: precioFinalDOP,
        precio_formateado: formatDOP(precioFinalDOP),
        
        // Información de descuento
        tiene_descuento: descuentoAplicado,
        descuento_porcentaje: descuentoPorcentaje,
        precio_original_dop: precioDOP,
        precio_original_formateado: formatDOP(precioDOP),
        
        // Para compatibilidad
        precio: precioFinalDOP,
        precio_final: precioFinalDOP,
        
        // Arrays procesados
        tallas: parseArrayFromPostgres(product.tallas),
        colores: parseArrayFromPostgres(product.colores),
        imagenes_adicionales: parseArrayFromPostgres(product.imagenes_adicionales),
        
        // Imagen por defecto si no existe
        imagen: product.imagen || '/public/images/default-product.jpg'
    };
};

// ================= CONFIGURACIÓN MULTER =================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/images/products');
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
    limits: { fileSize: 10 * 1024 * 1024 },
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

// Función auxiliar para nombres de campos (ACTUALIZADA)
function getFieldName(field) {
    const fieldNames = {
        'nombre': 'Nombre para la dirección',
        'nombre_completo': 'Nombre completo',
        'telefono': 'Teléfono',
        'provincia': 'Provincia',
        'municipio': 'Municipio',
        'sector': 'Sector/Barrio',
        'referencia': 'Punto de referencia'
        // Eliminados: 'calle', 'numero', 'apartamento'
    };
    return fieldNames[field] || field;
}

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

// ================= RUTAS DE ARCHIVOS ESTÁTICOS =================
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/public', express.static(path.join(__dirname, 'public')));

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
app.get('/envios', (req, res) => res.sendFile(path.join(__dirname, 'pages/envios.html')));
app.get('/contacto', (req, res) => res.sendFile(path.join(__dirname, 'pages/contacto.html')));
app.get('/ayuda', (req, res) => res.sendFile(path.join(__dirname, 'pages/ayuda.html')));
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

// ================= API - DIRECCIONES (ACTUALIZADO SIN CALLE/NUMERO/APARTAMENTO) =================

// Obtener direcciones del usuario
app.get('/api/users/:id/addresses', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('📍 Obteniendo direcciones para usuario:', userId);
        
        const result = await query(
            `SELECT * FROM direcciones 
             WHERE usuario_id = $1 
             ORDER BY predeterminada DESC, fecha_creacion DESC`,
            [userId]
        );
        
        const addresses = result.rows.map(addr => ({
            ...addr,
            // Formatear teléfono para mostrar
            telefono_formateado: addr.telefono
        }));
        
        console.log(`✅ ${addresses.length} direcciones encontradas`);
        res.json(addresses);
        
    } catch (error) {
        console.error('❌ Error obteniendo direcciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear nueva dirección (ACTUALIZADO)
app.post('/api/users/:id/addresses', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const addressData = req.body;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('➕ Creando dirección para usuario:', userId);
        console.log('📦 Datos recibidos:', addressData);
        
        // Validación de campos requeridos (ACTUALIZADO - sin calle, numero, apartamento)
        const required = ['nombre', 'nombre_completo', 'telefono', 'provincia', 
                         'municipio', 'sector', 'referencia'];
        
        for (const field of required) {
            if (!addressData[field] || addressData[field].trim() === '') {
                return res.status(400).json({ 
                    error: `El campo ${getFieldName(field)} es requerido` 
                });
            }
        }
        
        // Si se marca como predeterminada, quitar predeterminada de otras direcciones
        if (addressData.predeterminada) {
            await query(
                'UPDATE direcciones SET predeterminada = false WHERE usuario_id = $1',
                [userId]
            );
        }
        
        // Insertar nueva dirección (ACTUALIZADO - sin calle, numero, apartamento)
        const result = await query(
            `INSERT INTO direcciones (
                usuario_id, 
                nombre, 
                nombre_completo, 
                telefono, 
                provincia,
                municipio,
                sector, 
                referencia, 
                paqueteria_preferida, 
                predeterminada,
                fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
             RETURNING *`,
            [
                userId,
                addressData.nombre,
                addressData.nombre_completo,
                addressData.telefono,
                addressData.provincia,
                addressData.municipio,
                addressData.sector,
                addressData.referencia,
                addressData.paqueteria_preferida || null,
                addressData.predeterminada || false
            ]
        );
        
        const newAddress = result.rows[0];
        console.log('✅ Dirección creada ID:', newAddress.id);
        
        res.status(201).json(newAddress);
        
    } catch (error) {
        console.error('❌ Error creando dirección:', error);
        
        if (error.message.includes('unique_usuario_predeterminada')) {
            return res.status(400).json({ 
                error: 'Solo puedes tener una dirección predeterminada' 
            });
        }
        
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// Actualizar dirección (ACTUALIZADO)
app.put('/api/users/:id/addresses/:addressId', requireAuth, async (req, res) => {
    try {
        const { id, addressId } = req.params;
        const addressData = req.body;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('✏️ Actualizando dirección:', addressId);
        
        // Verificar que la dirección pertenece al usuario
        const verifyResult = await query(
            'SELECT id FROM direcciones WHERE id = $1 AND usuario_id = $2',
            [addressId, id]
        );
        
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dirección no encontrada' });
        }
        
        // Si se marca como predeterminada, quitar predeterminada de otras direcciones
        if (addressData.predeterminada) {
            await query(
                'UPDATE direcciones SET predeterminada = false WHERE usuario_id = $1 AND id != $2',
                [id, addressId]
            );
        }
        
        // Actualizar dirección (ACTUALIZADO - sin calle, numero, apartamento)
        const updateResult = await query(
            `UPDATE direcciones SET
                nombre = $1,
                nombre_completo = $2,
                telefono = $3,
                provincia = $4,
                municipio = $5,
                sector = $6,
                referencia = $7,
                paqueteria_preferida = $8,
                predeterminada = $9,
                fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $10 AND usuario_id = $11
             RETURNING *`,
            [
                addressData.nombre,
                addressData.nombre_completo,
                addressData.telefono,
                addressData.provincia,
                addressData.municipio,
                addressData.sector,
                addressData.referencia,
                addressData.paqueteria_preferida || null,
                addressData.predeterminada || false,
                addressId,
                id
            ]
        );
        
        const updatedAddress = updateResult.rows[0];
        console.log('✅ Dirección actualizada ID:', updatedAddress.id);
        
        res.json(updatedAddress);
        
    } catch (error) {
        console.error('❌ Error actualizando dirección:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar dirección
app.delete('/api/users/:id/addresses/:addressId', requireAuth, async (req, res) => {
    try {
        const { id, addressId } = req.params;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('🗑️ Eliminando dirección:', addressId);
        
        // Verificar que no sea la única dirección
        const countResult = await query(
            'SELECT COUNT(*) FROM direcciones WHERE usuario_id = $1',
            [id]
        );
        
        const addressCount = parseInt(countResult.rows[0].count);
        
        if (addressCount <= 1) {
            return res.status(400).json({ 
                error: 'No puedes eliminar tu única dirección. Agrega otra dirección primero.' 
            });
        }
        
        // Verificar que la dirección pertenece al usuario
        const verifyResult = await query(
            'SELECT predeterminada FROM direcciones WHERE id = $1 AND usuario_id = $2',
            [addressId, id]
        );
        
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dirección no encontrada' });
        }
        
        const isDefault = verifyResult.rows[0].predeterminada;
        
        // Eliminar dirección
        const deleteResult = await query(
            'DELETE FROM direcciones WHERE id = $1 AND usuario_id = $2 RETURNING *',
            [addressId, id]
        );
        
        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dirección no encontrada' });
        }
        
        // Si la dirección eliminada era predeterminada, establecer otra como predeterminada
        if (isDefault) {
            await query(
                `UPDATE direcciones SET predeterminada = true 
                 WHERE usuario_id = $1 
                 AND id = (
                     SELECT id FROM direcciones 
                     WHERE usuario_id = $1 
                     ORDER BY fecha_creacion DESC 
                     LIMIT 1
                 )`,
                [id]
            );
        }
        
        res.json({ 
            success: true, 
            message: 'Dirección eliminada correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error eliminando dirección:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Establecer dirección como predeterminada
app.put('/api/users/:id/addresses/:addressId/default', requireAuth, async (req, res) => {
    try {
        const { id, addressId } = req.params;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('⭐ Estableciendo dirección predeterminada:', addressId);
        
        // Verificar que la dirección pertenece al usuario
        const verifyResult = await query(
            'SELECT id FROM direcciones WHERE id = $1 AND usuario_id = $2',
            [addressId, id]
        );
        
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dirección no encontrada' });
        }
        
        // Usar transacción para asegurar consistencia
        await query('BEGIN');
        
        try {
            // Quitar predeterminada de todas las direcciones
            await query(
                'UPDATE direcciones SET predeterminada = false WHERE usuario_id = $1',
                [id]
            );
            
            // Establecer la nueva predeterminada
            const result = await query(
                `UPDATE direcciones SET predeterminada = true, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id = $1 AND usuario_id = $2
                 RETURNING *`,
                [addressId, id]
            );
            
            await query('COMMIT');
            
            res.json({ 
                success: true, 
                message: 'Dirección predeterminada actualizada',
                address: result.rows[0]
            });
            
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error estableciendo dirección predeterminada:', error);
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

// ================= API - PRODUCTOS =================
app.get('/api/products', async (req, res) => {
    console.log('📦 Obteniendo todos los productos en DOP');
    
    try {
        const result = await query(
            'SELECT * FROM productos WHERE activo = true ORDER BY id DESC'
        );
        
        const products = result.rows.map(product => processProductPrices(product));
        
        console.log(`✅ Enviando ${products.length} productos en DOP`);
        res.json(products);
        
    } catch (error) {
        console.error('❌ Error obteniendo productos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    console.log('🎯 Obteniendo producto ID:', productId, 'en DOP');
    
    try {
        const result = await query(
            'SELECT * FROM productos WHERE id = $1',
            [productId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const product = processProductPrices(result.rows[0]);
        
        console.log('✅ Producto encontrado:', product.nombre);
        console.log('💰 Precio:', product.precio_formateado);
        
        res.json(product);
        
    } catch (error) {
        console.error('❌ Error obteniendo producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - ORDENES =================
app.get('/api/users/:id/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const limit = req.query.limit || 10;
        
        if (parseInt(userId) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('📋 Obteniendo órdenes para usuario:', userId);
        
        const ordersResult = await query(`
            SELECT 
                id, 
                fecha_creacion, 
                total, 
                estado,
                metodo_envio,
                direccion_envio,
                ciudad_envio,
                telefono_contacto
            FROM pedidos 
            WHERE usuario_id = $1 
            ORDER BY fecha_creacion DESC 
            LIMIT $2
        `, [userId, limit]);
        
        const orders = ordersResult.rows.map(order => ({
            id: order.id,
            fecha_orden: order.fecha_creacion,
            total: parseFloat(order.total) || 0,
            estado: order.estado || 'pendiente',
            items_count: 1,
            tracking_number: null,
            paqueteria: order.metodo_envio || null,
            direccion_envio: order.direccion_envio,
            ciudad_envio: order.ciudad_envio,
            telefono_contacto: order.telefono_contacto
        }));
        
        console.log(`✅ ${orders.length} órdenes obtenidas para usuario ${userId}`);
        res.json(orders);
        
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - WISHLIST =================
// API - WISHLIST (VERSIÓN DEPURADA)
app.get('/api/users/:id/wishlist', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        console.log('🔍 DEBUG Wishlist - Usuario ID recibido:', userId);
        console.log('🔍 DEBUG Wishlist - Sesión UserId:', req.session.userId);
        console.log('🔍 DEBUG Wishlist - Sesión Role:', req.session.userRole);
        
        if (parseInt(userId) !== req.session.userId) {
            console.log('❌ Acceso denegado: userId no coincide');
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('❤️ Obteniendo wishlist para usuario:', userId);
        
        // Verificar si la tabla wishlist existe
        try {
            const tableCheck = await query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'wishlist'
                );
            `);
            
            console.log('🔍 Tabla wishlist existe?:', tableCheck.rows[0].exists);
            
            if (!tableCheck.rows[0].exists) {
                console.log('⚠️ Tabla wishlist no existe, creándola...');
                await query(`
                    CREATE TABLE wishlist (
                        id SERIAL PRIMARY KEY,
                        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                        producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
                        fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(usuario_id, producto_id)
                    );
                `);
                console.log('✅ Tabla wishlist creada');
                return res.json([]);
            }
            
        } catch (tableError) {
            console.error('❌ Error verificando tabla wishlist:', tableError);
        }
        
        const result = await query(
            `SELECT w.*, 
                    p.nombre, p.imagen, p.precio, p.categoria, p.stock,
                    p.descuento_porcentaje, p.descuento_precio,
                    p.descripcion
             FROM wishlist w
             LEFT JOIN productos p ON w.producto_id = p.id
             WHERE w.usuario_id = $1
             ORDER BY w.fecha_agregado DESC`,
            [userId]
        );
        
        console.log(`✅ ${result.rows.length} productos encontrados en wishlist`);
        
        // Procesar precios
        const wishlist = result.rows.map(row => {
            const product = row.nombre ? processProductPrices(row) : null;
            
            return {
                id: row.id,
                producto_id: row.producto_id,
                fecha_agregado: row.fecha_agregado,
                nombre: row.nombre || 'Producto no disponible',
                imagen: row.imagen || '/public/images/default-product.jpg',
                descripcion: row.descripcion || '',
                categoria: row.categoria || 'sin-categoria',
                stock: row.stock || 0,
                
                // Precios procesados
                precio_original: product ? product.precio_original_dop : 0,
                precio_original_formateado: product ? product.precio_original_formateado : 'RD$ 0.00',
                precio_final: product ? product.precio_final_dop : 0,
                precio_formateado: product ? product.precio_formateado : 'RD$ 0.00',
                tiene_descuento: product ? product.tiene_descuento : false,
                descuento_porcentaje: product ? product.descuento_porcentaje : 0
            };
        }).filter(item => item.producto_id !== null);
        
        console.log(`📊 Wishlist procesada: ${wishlist.length} productos válidos`);
        res.json(wishlist);
        
    } catch (error) {
        console.error('❌ Error completo obteniendo wishlist:', error);
        // Devolver array vacío en lugar de error
        res.json([]);
    }
});
// Eliminar de wishlist
app.delete('/api/users/:id/wishlist/:productId', requireAuth, async (req, res) => {
    try {
        const { id, productId } = req.params;
        
        if (parseInt(id) !== req.session.userId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        console.log('🗑️ Eliminando de wishlist:', productId);
        
        const result = await query(
            'DELETE FROM wishlist WHERE usuario_id = $1 AND producto_id = $2 RETURNING *',
            [id, productId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado en wishlist' });
        }
        
        res.json({ 
            success: true, 
            message: 'Producto eliminado de tu wishlist'
        });
        
    } catch (error) {
        console.error('❌ Error eliminando de wishlist:', error);
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

// ================= API - ADMINISTRACIÓN (RUTAS FALTANTES) =================

// Obtener todas las órdenes (admin)
app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('📋 Admin: Obteniendo todas las órdenes');
        
        const result = await query(`
            SELECT 
                p.*,
                u.nombre as nombre_cliente,
                u.apellido as apellido_cliente,
                u.email as email_cliente
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.fecha_creacion DESC
        `);
        
        // Procesar las órdenes para el admin
        const orders = result.rows.map(order => ({
            id: order.id,
            usuario_id: order.usuario_id,
            nombre_cliente: order.nombre_cliente ? 
                `${order.nombre_cliente} ${order.apellido_cliente}` : 
                'Cliente no registrado',
            email_cliente: order.email_cliente || 'N/A',
            fecha_orden: order.fecha_creacion,
            total: parseFloat(order.total) || 0,
            subtotal: parseFloat(order.subtotal) || 0,
            costo_envio: parseFloat(order.costo_envio) || 0,
            estado: order.estado || 'pendiente',
            estado_pago: order.estado_pago || 'pendiente',
            metodo_pago: order.metodo_pago || 'N/A',
            metodo_envio: order.metodo_envio || 'Estándar',
            direccion_envio: order.direccion_envio || 'N/A',
            ciudad_envio: order.ciudad_envio || 'N/A',
            telefono_contacto: order.telefono_contacto || 'N/A',
            notas: order.notas,
            tracking_number: order.tracking_number,
            paqueteria: order.paqueteria,
            fecha_actualizacion: order.fecha_actualizacion,
            items: [] // Se cargarán en otra consulta si es necesario
        }));
        
        console.log(`✅ Admin: ${orders.length} órdenes obtenidas`);
        res.json(orders);
        
    } catch (error) {
        console.error('❌ Error obteniendo órdenes (admin):', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener todos los usuarios (admin)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('👥 Admin: Obteniendo todos los usuarios');
        
        const result = await query(`
            SELECT 
                id, 
                nombre, 
                apellido, 
                email, 
                telefono,
                rol,
                activo,
                fecha_registro,
                direccion,
                ciudad
            FROM usuarios 
            WHERE rol != 'admin' OR id = $1
            ORDER BY fecha_registro DESC
        `, [req.session.userId]);
        
        // Obtener estadísticas para cada usuario
        const usersWithStats = await Promise.all(result.rows.map(async (user) => {
            try {
                // Total de órdenes
                const ordersResult = await query(
                    'SELECT COUNT(*) as total_orders, SUM(total) as total_spent FROM pedidos WHERE usuario_id = $1',
                    [user.id]
                );
                
                // Total en wishlist
                const wishlistResult = await query(
                    'SELECT COUNT(*) as wishlist_items FROM wishlist WHERE usuario_id = $1',
                    [user.id]
                );
                
                return {
                    ...user,
                    total_orders: parseInt(ordersResult.rows[0].total_orders) || 0,
                    total_spent: parseFloat(ordersResult.rows[0].total_spent) || 0,
                    wishlist_items: parseInt(wishlistResult.rows[0].wishlist_items) || 0,
                    // Agregar estadísticas adicionales
                    stats: {
                        total_orders: parseInt(ordersResult.rows[0].total_orders) || 0,
                        total_spent: parseFloat(ordersResult.rows[0].total_spent) || 0,
                        wishlist_items: parseInt(wishlistResult.rows[0].wishlist_items) || 0,
                        avg_order_value: ordersResult.rows[0].total_orders > 0 ? 
                            parseFloat(ordersResult.rows[0].total_spent) / parseInt(ordersResult.rows[0].total_orders) : 0
                    }
                };
            } catch (error) {
                console.error(`Error obteniendo stats para usuario ${user.id}:`, error);
                return {
                    ...user,
                    total_orders: 0,
                    total_spent: 0,
                    wishlist_items: 0,
                    stats: {
                        total_orders: 0,
                        total_spent: 0,
                        wishlist_items: 0,
                        avg_order_value: 0
                    }
                };
            }
        }));
        
        console.log(`✅ Admin: ${usersWithStats.length} usuarios obtenidos`);
        res.json(usersWithStats);
        
    } catch (error) {
        console.error('❌ Error obteniendo usuarios (admin):', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener detalles de una orden específica (admin)
app.get('/api/orders/:id', requireAuth, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.userId;
        const isAdmin = req.session.userRole === 'admin';
        
        console.log(`📋 Obteniendo detalles de orden ${orderId}`);
        
        // Construir la consulta según permisos
        let queryStr = `
            SELECT 
                p.*,
                u.nombre as nombre_cliente,
                u.apellido as apellido_cliente,
                u.email as email_cliente,
                u.telefono as telefono_cliente
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.id = $1
        `;
        
        const params = [orderId];
        
        if (!isAdmin) {
            queryStr += ' AND p.usuario_id = $2';
            params.push(userId);
        }
        
        const orderResult = await query(queryStr, params);
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        const order = orderResult.rows[0];
        
        // Obtener items de la orden
        const itemsResult = await query(`
            SELECT 
                oi.*,
                p.nombre,
                p.imagen,
                p.sku
            FROM orden_items oi
            LEFT JOIN productos p ON oi.producto_id = p.id
            WHERE oi.orden_id = $1
        `, [orderId]);
        
        // Formatear la respuesta
        const formattedOrder = {
            id: order.id,
            usuario_id: order.usuario_id,
            nombre_cliente: order.nombre_cliente ? 
                `${order.nombre_cliente} ${order.apellido_cliente}` : 
                'Cliente no registrado',
            email_cliente: order.email_cliente || 'N/A',
            telefono_cliente: order.telefono_cliente || order.telefono_contacto || 'N/A',
            fecha_orden: order.fecha_creacion,
            total: parseFloat(order.total) || 0,
            subtotal: parseFloat(order.subtotal) || 0,
            costo_envio: parseFloat(order.costo_envio) || 0,
            descuento_aplicado: parseFloat(order.descuento_aplicado) || 0,
            estado: order.estado || 'pendiente',
            estado_pago: order.estado_pago || 'pendiente',
            metodo_pago: order.metodo_pago || 'N/A',
            metodo_envio: order.metodo_envio || 'Estándar',
            direccion_envio: order.direccion_envio || 'N/A',
            ciudad_envio: order.ciudad_envio || 'N/A',
            telefono_contacto: order.telefono_contacto || 'N/A',
            notas: order.notas,
            tracking_number: order.tracking_number,
            paqueteria: order.paqueteria,
            fecha_actualizacion: order.fecha_actualizacion,
            items: itemsResult.rows.map(item => ({
                id: item.id,
                producto_id: item.producto_id,
                nombre: item.nombre || 'Producto no disponible',
                imagen: item.imagen || '/public/images/default-product.jpg',
                sku: item.sku || 'N/A',
                talla: item.talla,
                color: item.color,
                cantidad: item.cantidad,
                precio_unitario: parseFloat(item.precio_unitario) || 0,
                subtotal: parseFloat(item.subtotal) || 0
            }))
        };
        
        console.log(`✅ Orden ${orderId} obtenida con ${formattedOrder.items.length} items`);
        res.json(formattedOrder);
        
    } catch (error) {
        console.error('❌ Error obteniendo detalles de orden:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar estado de orden (admin)
app.put('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { estado, notas } = req.body;
        
        console.log(`✏️ Actualizando estado de orden ${orderId} a: ${estado}`);
        
        const validStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
        if (!validStatuses.includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        
        const result = await query(
            `UPDATE pedidos 
             SET estado = $1, 
                 notas = COALESCE($2, notas),
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $3 
             RETURNING *`,
            [estado, notas || null, orderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        const updatedOrder = result.rows[0];
        
        console.log(`✅ Estado de orden ${orderId} actualizado a: ${updatedOrder.estado}`);
        
        res.json({
            success: true,
            message: 'Estado actualizado correctamente',
            order: updatedOrder
        });
        
    } catch (error) {
        console.error('❌ Error actualizando estado de orden:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar usuario (admin)
app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { nombre, apellido, email, telefono, rol, activo } = req.body;
        
        console.log(`✏️ Admin actualizando usuario ${userId}`);
        
        // Verificar que no sea el propio admin
        if (parseInt(userId) === req.session.userId && (rol !== 'admin' || activo === false)) {
            return res.status(400).json({ 
                error: 'No puedes cambiar tu propio rol o desactivarte a ti mismo' 
            });
        }
        
        const result = await query(
            `UPDATE usuarios 
             SET nombre = $1, 
                 apellido = $2, 
                 email = $3, 
                 telefono = $4,
                 rol = $5,
                 activo = $6,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $7 
             RETURNING id, nombre, apellido, email, telefono, rol, activo, fecha_registro`,
            [nombre, apellido, email, telefono || null, rol || 'cliente', activo !== false, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`✅ Usuario ${userId} actualizado por admin`);
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('❌ Error actualizando usuario (admin):', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Desactivar usuario (admin)
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        console.log(`🚫 Admin desactivando usuario ${userId}`);
        
        // Verificar que no sea el propio admin
        if (parseInt(userId) === req.session.userId) {
            return res.status(400).json({ 
                error: 'No puedes desactivar tu propia cuenta' 
            });
        }
        
        const result = await query(
            `UPDATE usuarios 
             SET activo = false,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $1 
             RETURNING id, nombre, apellido, email`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`✅ Usuario ${userId} desactivado por admin`);
        res.json({ 
            success: true, 
            message: 'Usuario desactivado correctamente',
            user: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Error desactivando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Activar usuario (admin)
app.post('/api/admin/users/:id/activate', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        console.log(`✅ Admin activando usuario ${userId}`);
        
        const result = await query(
            `UPDATE usuarios 
             SET activo = true,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $1 
             RETURNING id, nombre, apellido, email`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`✅ Usuario ${userId} activado por admin`);
        res.json({ 
            success: true, 
            message: 'Usuario activado correctamente',
            user: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Error activando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Aplicar descuento a producto (admin)
app.post('/api/admin/products/:id/discount', requireAuth, requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const { discount_type, discount_percent, discount_price, discount_expires } = req.body;
        
        console.log(`🎯 Aplicando descuento a producto ${productId}:`, {
            discount_type,
            discount_percent,
            discount_price,
            discount_expires
        });
        
        let updateData = {};
        
        if (discount_type === 'percent') {
            updateData = {
                descuento_porcentaje: discount_percent || 0,
                descuento_precio: null,
                descuento_expiracion: discount_expires || null
            };
        } else if (discount_type === 'fixed') {
            updateData = {
                descuento_porcentaje: 0,
                descuento_precio: discount_price || 0,
                descuento_expiracion: discount_expires || null
            };
        } else {
            return res.status(400).json({ error: 'Tipo de descuento inválido' });
        }
        
        const result = await query(
            `UPDATE productos 
             SET descuento_porcentaje = $1,
                 descuento_precio = $2,
                 descuento_expiracion = $3,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $4 
             RETURNING *`,
            [
                updateData.descuento_porcentaje,
                updateData.descuento_precio,
                updateData.descuento_expiracion,
                productId
            ]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const updatedProduct = result.rows[0];
        const processedProduct = processProductPrices(updatedProduct);
        
        console.log(`✅ Descuento aplicado a producto ${productId}`);
        console.log(`💰 Precio con descuento: ${processedProduct.precio_formateado}`);
        
        res.json({
            success: true,
            message: 'Descuento aplicado correctamente',
            product: processedProduct
        });
        
    } catch (error) {
        console.error('❌ Error aplicando descuento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar descuento de producto (admin)
app.delete('/api/admin/products/:id/discount', requireAuth, requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        
        console.log(`🗑️ Eliminando descuento de producto ${productId}`);
        
        const result = await query(
            `UPDATE productos 
             SET descuento_porcentaje = 0,
                 descuento_precio = null,
                 descuento_expiracion = null,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $1 
             RETURNING *`,
            [productId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const updatedProduct = result.rows[0];
        const processedProduct = processProductPrices(updatedProduct);
        
        console.log(`✅ Descuento eliminado de producto ${productId}`);
        console.log(`💰 Precio actual: ${processedProduct.precio_formateado}`);
        
        res.json({
            success: true,
            message: 'Descuento eliminado correctamente',
            product: processedProduct
        });
        
    } catch (error) {
        console.error('❌ Error eliminando descuento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para descuentos generales (placeholder)
app.get('/api/admin/discounts', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Por ahora devolvemos un array vacío o datos de ejemplo
        // Puedes implementar la lógica real según tu base de datos
        console.log('🎯 Admin: Obteniendo descuentos');
        
        // Ejemplo de datos de prueba
        const sampleDiscounts = [
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
            },
            {
                id: 2,
                codigo: "ENVIOGRATIS",
                tipo: "envio",
                valor: 100,
                aplicable_a: "todos",
                minimo_compra: 30,
                usos_totales: 200,
                usos_actuales: 89,
                expiracion: null,
                activo: true
            }
        ];
        
        console.log(`✅ Admin: ${sampleDiscounts.length} descuentos de ejemplo`);
        res.json(sampleDiscounts);
        
    } catch (error) {
        console.error('❌ Error obteniendo descuentos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================= API - ADMINISTRACIÓN =================
// Obtener todos los productos (admin)
app.get('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM productos ORDER BY id DESC');
        
        const products = result.rows.map(product => {
            const processed = processProductPrices(product);
            return {
                ...processed,
                // Datos administrativos
                fecha_creacion: product.fecha_creacion,
                fecha_actualizacion: product.fecha_actualizacion
            };
        });
        
        res.json(products);
    } catch (error) {
        console.error('❌ Error obteniendo productos (admin):', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear producto (admin)
app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
    const { 
        nombre, 
        descripcion, 
        precio, // Recibido en DOP desde el frontend
        categoria, 
        imagen, 
        stock, 
        tallas, 
        colores, 
        sku, 
        material, 
        coleccion,
        imagenes_adicionales,
        descuento_porcentaje,
        descuento_precio // En DOP
    } = req.body;
    
    console.log('➕ Creando producto:', nombre);
    console.log('💰 Precio recibido en DOP:', precio);
    
    try {
        // El precio ya viene en DOP, lo guardamos directamente
        const precioDOP = parseFloat(precio);
        
        const productData = {
            nombre: nombre || 'Producto sin nombre',
            descripcion: descripcion || '',
            precio: precioDOP, // Guardamos en DOP
            categoria: categoria || 'sin-categoria',
            imagen: imagen || '/public/images/default-product.jpg',
            stock: parseInt(stock) || 0,
            tallas: formatArrayForPostgres(tallas),
            colores: formatArrayForPostgres(colores),
            sku: sku || `SKU-${Date.now()}`,
            material: material || '',
            coleccion: coleccion || '',
            imagenes_adicionales: formatArrayForPostgres(imagenes_adicionales),
            descuento_porcentaje: parseInt(descuento_porcentaje) || 0,
            descuento_precio: descuento_precio ? parseFloat(descuento_precio) : null,
            activo: true
        };
        
        const result = await query(
            `INSERT INTO productos (
                nombre, descripcion, precio, categoria, imagen, stock, 
                tallas, colores, sku, material, coleccion, 
                imagenes_adicionales, descuento_porcentaje, descuento_precio, activo, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP) 
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
                productData.descuento_porcentaje,
                productData.descuento_precio,
                productData.activo
            ]
        );

        const newProduct = result.rows[0];
        const processedProduct = processProductPrices(newProduct);
        newProduct.tallas = parseArrayFromPostgres(newProduct.tallas);
        newProduct.colores = parseArrayFromPostgres(newProduct.colores);
        newProduct.imagenes_adicionales = parseArrayFromPostgres(newProduct.imagenes_adicionales);
        
        console.log('✅ Producto creado:', newProduct.nombre);
        console.log('🖼️ Total imágenes:', newProduct.imagenes_adicionales.length + 1);
        console.log('💰 Precio:', processedProduct.precio_formateado);
        
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

// ================= API - PAGOS PAYPAL =================
// Configuración de pagos
app.get('/api/payments/config', (req, res) => {
    console.log('🔧 Enviando configuración de pagos al frontend');
    
    res.json({
        paypalClientId: process.env.PAYPAL_CLIENT_ID || 'test',
        currency: 'USD',
        environment: process.env.NODE_ENV || 'development',
        country: 'DO',
        paymentMethods: ['paypal', 'transfer'],
        features: {
            paypal: true,
            bankTransfer: true
        }
    });
});

// ================= RUTAS DE UTILIDAD =================
app.get('/api/test', async (req, res) => {
    try {
        const result = await query('SELECT NOW() as time, version() as version');
        res.json({ 
            message: '✅ Servidor funcionando',
            database: '✅ Conectado a PostgreSQL',
            currency: {
                default: 'DOP',
                symbol: 'RD$',
                example: formatDOP(1000)
            },
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

// Crear datos de prueba con direcciones (ACTUALIZADO)
app.get('/api/create-test-data', async (req, res) => {
    try {
        // Crear tabla direcciones si no existe (ACTUALIZADO - sin calle, numero, apartamento)
        await query(`
            CREATE TABLE IF NOT EXISTS direcciones (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                nombre VARCHAR(100) NOT NULL,
                nombre_completo VARCHAR(200) NOT NULL,
                telefono VARCHAR(20) NOT NULL,
                provincia VARCHAR(100) NOT NULL,
                municipio VARCHAR(100) NOT NULL,
                sector VARCHAR(100) NOT NULL,
                referencia TEXT NOT NULL,
                paqueteria_preferida VARCHAR(50),
                predeterminada BOOLEAN DEFAULT false,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP,
                UNIQUE(usuario_id, predeterminada) WHERE predeterminada = true
            )
        `);
        
        console.log('✅ Tabla direcciones creada/verificada (formato simplificado)');
        
        res.json({ 
            success: true, 
            message: 'Tabla direcciones lista para usar (sin calle/numero/apartamento)'
        });
        
    } catch (error) {
        console.error('Error creando tabla direcciones:', error);
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
    console.log(`\n📍 DIRECCIONES (FORMATO SIMPLIFICADO):`);
    console.log(`   • API Direcciones: http://localhost:${PORT}/api/users/:id/addresses`);
    console.log(`   • Campos requeridos: nombre, nombre_completo, telefono, provincia, municipio, sector, referencia`);
    console.log(`\n🔧 RUTAS DE API:`);
    console.log(`   • Test: http://localhost:${PORT}/api/test`);
    console.log(`   • Productos: http://localhost:${PORT}/api/products`);
    console.log(`   • Provincias RD: http://localhost:${PORT}/api/dominican-republic/provinces`);
    console.log(`\n👤 CREDENCIALES:`);
    console.log(`   • Admin: admin@gmail.com / admin123`);
    console.log(`\n✅ Listo para usar! Direcciones simplificadas (sin calle/numero/apartamento)`);
});