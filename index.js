const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const mysql2 = require('mysql2');
const path = require('path');
require('dotenv').config();
const { logout } = require('./functions/auth.js');

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true })); // Para manejar datos de formularios
app.use(express.json()); // Para manejar datos JSON
// Sirve archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));
// Configuración de la base de datos
const dbOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};
// Conexión a MySQL
const pool = mysql.createPool(dbOptions);
const pool2 = mysql2.createPool(dbOptions);
// Almacenamiento de sesiones en MySQL, innecesario, se puede quitar
const sessionStore = new MySQLStore(dbOptions);
app.use(
    session({
        key: 'linkhub_dev_user',
        secret: process.env.SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // true si está en producción, no he podido hacer funcionar
        },
    })
);
// Middleware para verificar autenticación
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.redirect('/login');
};
app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/public/index.html');
});
// Ruta protegida del panel
app.get('/panel', isAuthenticated, (req, res) => {
    res.sendFile(process.cwd() + '/private/panel/index.html');
});
// Ruta para el registro de usuarios
/* 
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Hashear la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Guardar en la base de datos
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, hashedPassword]
        );

        // Redirigir al dashboard tras el registro exitoso
        req.session.userId = result.insertId; // Guardamos la ID del usuario en la sesión
        res.redirect('/panel');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al registrar el usuario');
    }
});
*/
// Ruta para iniciar sesión
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Buscar el usuario en la base de datos
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [
            email,
        ]);
        if (rows.length === 0) {
            return res.status(401).send('Usuario o contraseña incorrectos');
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).send('Usuario o contraseña incorrectos');
        }
        req.session.userId = user.id;
        res.redirect('/panel');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al iniciar sesión');
    }
});
// Endpoint para recuperar los links
app.get('/api/links', (req, res) => {
    pool2.query('SELECT * FROM linkdev', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});
// Endpoint para agregar un nuevo recurso
app.post('/api/links', async (req, res) => {
    const { title, url, description, image } = req.body;

    if (!title || !url || !description || !image) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const result = await pool2.promise().query('INSERT INTO linkdev (title, url, description, image) VALUES (?, ?, ?, ?)', [title, url, description, image]);
        res.status(201).json({ id: result[0].insertId, title, url, description, image });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al agregar el recurso' });
    }
});
// Endpoint para eliminar un recurso
app.delete('/api/links/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'ID es obligatorio' });
    }

    try {
        const result = await pool2.promise().query('DELETE FROM linkdev WHERE id = ?', [id]);
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el recurso' });
    }
});
// Ruta para cerrar sesión
app.post('/logout', logout);
app.use((
    req, res) => {
    res.status(404).send('<h1>404 - Página no encontrada</h1><p>La página que estás buscando no existe o ha sido eliminada.<a href="/">Volver a la página principal</a></p>')
}
)
app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
module.exports = app;