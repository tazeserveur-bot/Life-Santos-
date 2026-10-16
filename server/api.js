require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const publicDir = path.join(__dirname, '..', 'public');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpeg|webp|svg\+xml)$/.test(file.mimetype)) });
const callbackUrl = () => `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/auth/discord/callback`;
const staffRoles = () => (process.env.STAFF_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean);

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(publicDir));

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
function requireLogin(req, res, next) { if (!req.session.user) return res.status(401).json({ error: 'Connecte-toi avec Discord.' }); next(); }
function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Connecte-toi avec Discord.' });
  const roles = staffRoles();
  if (!roles.length || !req.session.user.roles.some(role => roles.includes(role))) return res.status(403).json({ error: 'Accès réservé au staff Life Santos.' });
  next();
}
async function uploadImage(file) {
  if (!file) return null;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error('Configure les trois variables Cloudinary avant les importations d’images.');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'life-santos', resource_type: 'image' }, (err, result) => err ? reject(err) : resolve(result.secure_url));
    stream.end(file.buffer);
  });
}
async function sendPlanAnnouncement(plan) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.ANNOUNCEMENT_CHANNEL_ID) {
    throw new Error('Ajoute DISCORD_BOT_TOKEN et ANNOUNCEMENT_CHANNEL_ID dans Render pour activer les annonces.');
  }
  const roleId = process.env.PLAYER_ROLE_ID;
  const siteUrl = process.env.RENDER_EXTERNAL_URL || 'https://life-santos.onrender.com';
  const response = await fetch(`https://discord.com/api/v10/channels/${process.env.ANNOUNCEMENT_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: roleId ? `<@&${roleId}> Nouveau planning Life Santos disponible !` : 'Nouveau planning Life Santos disponible !',
      embeds: [{
        title: 'Planning de la semaine',
        description: `Du ${plan.start_date} au ${plan.end_date}. Retrouvez le planning sur le site Life Santos.`,
        color: 0xffb52b,
        image: { url: plan.image_url },
        url: siteUrl,
        footer: { text: 'Life Santos · Une ville, mille histoires' }
      }],
      allowed_mentions: { roles: roleId ? [roleId] : [] }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Discord a refusé l’annonce (HTTP ${response.status}).`);
}
async function getGuildMember(userId) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`, { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
  if (!response.ok) return null;
  return response.json();
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/auth/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_GUILD_ID) return res.status(503).send('Configure Discord dans les variables Render.');
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  const query = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, redirect_uri: callbackUrl(), response_type: 'code', scope: 'identify', state, prompt: 'consent' });
  req.session.save(() => res.redirect(`https://discord.com/oauth2/authorize?${query}`));
});
app.get('/auth/discord/callback', async (req, res) => {
  try {
    if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) return res.status(400).send('Connexion Discord invalide. Recommence la connexion.');
    delete req.session.oauthState;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code: req.query.code, redirect_uri: callbackUrl() }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) return res.status(401).send('Discord n’a pas validé la connexion. Vérifie le Redirect URI dans le Developer Portal.');
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const user = await userResponse.json();
    const member = await getGuildMember(user.id);
    if (!member) return res.status(403).send('Rejoins le serveur Discord Life Santos avant de te connecter au site.');
    req.session.user = { id: user.id, username: user.global_name || user.username, avatar: user.avatar, roles: member.roles || [] };
    req.session.save(() => res.redirect('/'));
  } catch (error) { console.error('Discord OAuth error:', error.message); res.status(500).send('La connexion Discord a échoué.'); }
});
app.post('/auth/logout', (req, res) => req.session.destroy(() => res.clearCookie('connect.sid').json({ ok: true })));
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { id: req.session.user.id, username: req.session.user.username, avatar: req.session.user.avatar }, isStaff: req.session.user.roles.some(role => staffRoles().includes(role)) });
});
app.get('/api/plans/latest', async (_req, res) => {
  const result = await pool.query('SELECT id,start_date,end_date,image_url,published_by,created_at FROM plans ORDER BY created_at DESC LIMIT 1');
  res.json(result.rows[0] || null);
});
app.post('/api/plans', requireStaff, upload.single('image'), async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    if (!start_date || !end_date || start_date > end_date) return res.status(400).json({ error: 'La période du planning est invalide.' });
    const imageUrl = await uploadImage(req.file);
    if (!imageUrl) return res.status(400).json({ error: 'Ajoute une affiche au planning.' });
    const plan = (await pool.query('INSERT INTO plans(start_date,end_date,image_url,published_by) VALUES($1,$2,$3,$4) RETURNING *', [start_date, end_date, imageUrl, req.session.user.username])).rows[0];
    try {
      await sendPlanAnnouncement(plan);
      res.status(201).json({ ...plan, announcement_sent: true });
    } catch (error) {
      console.error('Discord announcement failed:', error.message);
      res.status(201).json({ ...plan, announcement_sent: false, announcement_error: error.message });
    }
  } catch (error) { console.error('Plan publish error:', error.message); res.status(500).json({ error: error.message || 'Publication impossible.' }); }
});
app.post('/api/uploads', requireLogin, upload.single('image'), async (req, res) => {
  try { const url = await uploadImage(req.file); if (!url) return res.status(400).json({ error: 'Choisis une image.' }); res.json({ url }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/suggestions', requireLogin, async (req, res) => {
  const staff = req.session.user.roles.some(role => staffRoles().includes(role));
  const q = staff ? pool.query('SELECT * FROM suggestions ORDER BY created_at DESC') : pool.query('SELECT * FROM suggestions WHERE author_id=$1 ORDER BY created_at DESC', [req.session.user.id]);
  res.json((await q).rows);
});
app.post('/api/suggestions', requireLogin, async (req, res) => {
  const { title, body, attachment_url } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Ajoute un titre et explique ton idée.' });
  const result = await pool.query('INSERT INTO suggestions(author_id,author_name,title,body,attachment_url) VALUES($1,$2,$3,$4,$5) RETURNING *', [req.session.user.id, req.session.user.username, title.trim().slice(0,120), body.trim().slice(0,5000), attachment_url || null]);
  res.status(201).json(result.rows[0]);
});
app.get('/api/suggestions/:id/messages', requireLogin, async (req, res) => {
  const s = await pool.query('SELECT author_id FROM suggestions WHERE id=$1', [req.params.id]);
  if (!s.rowCount) return res.sendStatus(404);
  const staff = req.session.user.roles.some(role => staffRoles().includes(role));
  if (!staff && s.rows[0].author_id !== req.session.user.id) return res.sendStatus(403);
  res.json((await pool.query('SELECT * FROM suggestion_messages WHERE suggestion_id=$1 ORDER BY created_at', [req.params.id])).rows);
});
app.post('/api/suggestions/:id/messages', requireLogin, async (req, res) => {
  const s = await pool.query('SELECT author_id FROM suggestions WHERE id=$1', [req.params.id]);
  if (!s.rowCount) return res.sendStatus(404);
  const staff = req.session.user.roles.some(role => staffRoles().includes(role));
  if (!staff && s.rows[0].author_id !== req.session.user.id) return res.sendStatus(403);
  const body = String(req.body?.body || '').trim();
  if (!body && !req.body?.attachment_url) return res.status(400).json({ error: 'Le message est vide.' });
  const result = await pool.query('INSERT INTO suggestion_messages(suggestion_id,author_id,author_name,body,attachment_url) VALUES($1,$2,$3,$4,$5) RETURNING *', [req.params.id, req.session.user.id, req.session.user.username, body.slice(0,5000), req.body.attachment_url || null]);
  res.status(201).json(result.rows[0]);
});
app.patch('/api/suggestions/:id', requireStaff, async (req, res) => {
  const status = ['pending','review','accepted','rejected'].includes(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Statut invalide.' });
  const result = await pool.query('UPDATE suggestions SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
  if (!result.rowCount) return res.sendStatus(404);
  res.json(result.rows[0]);
});
app.use((_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

initDb().then(() => app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Life Santos API prête.'))).catch(error => { console.error('Database initialization failed:', error.message); process.exit(1); });


