const { Pool } = require('pg');

// Configuración de conexión a PostgreSQL
const pool = new Pool({
    user: 'postgres',
    password: '20942094',
    host: 'localhost',
    port: 5432,
    database: 'Tienda_mb'
});

// Probar la conexión al iniciar
pool.connect((err, client, done) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
    } else {
        console.log('✅ Conectado a PostgreSQL');
        done();
    }
});

// Función para consultas
async function query(text, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } catch (error) {
        console.error('Error en consulta SQL:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    query,
    pool
};