require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Rutas de archivos ───────────────────────────────────────────────────────
const MENU_PATH   = path.join(__dirname, 'data', 'menu.json');
const UPLOAD_DIR  = path.join(__dirname, 'demos', 'img', 'fastfood');

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000   // 8 horas
  }
}));

// Archivos estáticos (demos/, img/, etc.) — servidos desde la raíz del proyecto
app.use(express.static(path.join(__dirname)));

// ─── Multer — upload de imágenes ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, ext)
                       .replace(/[^a-z0-9_-]/gi, '-')
                       .toLowerCase();
    cb(null, `${basename}-${Date.now()}${ext}`);
  }
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },   // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPEG, PNG o WEBP.'));
    }
  }
});

// ─── Guard de autenticación ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado. Iniciá sesión primero.' });
}

// ─── API: Login ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
});

// ─── API: Logout ─────────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ─── API: Estado de sesión (para que el admin sepa si ya está logueado) ──────
app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ─── API: Demo Login ──────────────────────────────────────────────────────────
app.post('/api/demo-login', (req, res) => {
  const { username, password } = req.body;
  const DEMO_USER = process.env.DEMO_USER || 'demo';
  const DEMO_PASS = process.env.DEMO_PASS || 'demo';
  if (username === DEMO_USER && password === DEMO_PASS) {
    req.session.demoAuthenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Credenciales incorrectas.' });
});

// ─── API: Estado de sesión demo ───────────────────────────────────────────────
app.get('/api/demo-session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.demoAuthenticated) });
});

// ─── API: GET menú (público — lo consume fastfood.html) ──────────────────────
app.get('/api/menu', (_req, res) => {
  try {
    const data = fs.readFileSync(MENU_PATH, 'utf8');
    res.type('json').send(data);
  } catch {
    res.status(500).json({ error: 'No se pudo leer el menú.' });
  }
});

// ─── API: POST menú (protegido) ───────────────────────────────────────────────
app.post('/api/menu', requireAuth, (req, res) => {
  try {
    const menu = req.body;

    // Validaciones básicas de estructura
    if (!menu.items || !Array.isArray(menu.items) || menu.items.length !== 8) {
      return res.status(400).json({ error: 'El menú debe tener exactamente 8 ítems.' });
    }
    if (!menu.featured || !menu.beverages || !Array.isArray(menu.beverages)) {
      return res.status(400).json({ error: 'Estructura de menú inválida.' });
    }

    fs.writeFileSync(MENU_PATH, JSON.stringify(menu, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar el menú.' });
  }
});

// ─── API: Upload de imagen (protegido) ───────────────────────────────────────
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }
    // Devuelve la ruta relativa usable directamente en el HTML
    const relativePath = `img/fastfood/${req.file.filename}`;
    res.json({ ok: true, path: relativePath });
  });
});

// ─── Inicio ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`  Display: http://localhost:${PORT}/demos/fastfood.html`);
  console.log(`  Admin:   http://localhost:${PORT}/demos/fastfood-admin.html`);
});
