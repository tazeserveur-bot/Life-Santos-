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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpeg|webp)$/.test(file.mimetype)) });
const callbackUrl = () => `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/auth/discord/callback`;
const envIds = () => (process.env.STAFF_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const staffRoles = () => (process.env.STAFF_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const isOwner = user => Boolean(user && envIds().includes(user.id));
async function hasSiteStaff(user) {
  if (!user) return false;
  if (isOwner(user) || user.roles?.some(role => staffRoles().includes(role))) return true;
  const result = await pool.query('SELECT 1 FROM staff_members WHERE user_id=$1', [user.id]);
  return result.rowCount > 0;
}
async function getSiteSetting(key) {
  const result = await pool.query('SELECT value FROM site_settings WHERE key=$1', [key]);
  return result.rows[0]?.value || '';
}
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Connecte-toi avec Discord.' });
  next();
}
function requireStaff(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Connecte-toi avec Discord.' });
  hasSiteStaff(req.session.user).then(ok => ok ? next() : res.status(403).json({ error: 'Accès réservé au staff Life Santos.' })).catch(() => res.status(500).json({ error: 'Vérification des accès impossible.' }));
}
function requireOwner(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Connecte-toi avec Discord.' });
  if (!isOwner(req.session.user)) return res.status(403).json({ error: 'Seul l’administrateur principal peut gérer les accès staff.' });
  next();
}
async function getDiscordResources() {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) throw new Error('Configure DISCORD_BOT_TOKEN et DISCORD_GUILD_ID dans Render.');
  const headers = { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };
  const [channelResponse, roleResponse] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/channels`, { headers }),
    fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/roles`, { headers })
  ]);
  const channels = await channelResponse.json().catch(() => []), roles = await roleResponse.json().catch(() => []);
  if (!channelResponse.ok) throw new Error(channels.message || 'Discord ne peut pas lire les salons du serveur.');
  if (!roleResponse.ok) throw new Error(roles.message || 'Discord ne peut pas lire les rôles du serveur.');
  return { channels: channels.filter(channel => [0, 5].includes(channel.type)).map(({ id, name, type }) => ({ id, name, type })), roles: roles.filter(role => !role.managed && role.name !== '@everyone').map(({ id, name, color }) => ({ id, name, color })) };
}
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }), secret: process.env.SESSION_SECRET,
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(publicDir, req.session.user ? 'index.html' : 'login.html')));
app.use(express.static(publicDir, { index: false }));
async function initDb() { await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); }

async function uploadImage(file) {
  if (!file) return null;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'life-santos', resource_type: 'image' }, (err, result) => err ? reject(err) : resolve(result.secure_url));
    stream.end(file.buffer);
  });
}
async function sendPlanAnnouncement(plan) {
  const channelId = await getSiteSetting('announcement_channel_id') || process.env.ANNOUNCEMENT_CHANNEL_ID;
  const roleId = await getSiteSetting('player_role_id') || process.env.PLAYER_ROLE_ID;
  if (!process.env.DISCORD_BOT_TOKEN || !channelId) throw new Error('Choisis un salon d’annonces dans Administration Discord.');
  const siteUrl = process.env.RENDER_EXTERNAL_URL || 'https://life-santos.onrender.com';
  const embed = { title: 'Planning Life Santos', description: `Du ${plan.start_date} au ${plan.end_date}. Retrouvez le planning sur le site Life Santos.`, color: 0xb9ed65, url: siteUrl, footer: { text: 'Life Santos · Une ville, mille histoires' } };
  const payload = { content: roleId ? `<@&${roleId}> Nouveau planning Life Santos disponible !` : 'Nouveau planning Life Santos disponible !', embeds: [embed], allowed_mentions: { roles: roleId ? [roleId] : [] } };
  const headers = { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };
  let body;
  const dataImage = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(plan.image_url || '');
  if (dataImage) {
    const ext = dataImage[1] === 'image/jpeg' ? 'jpg' : dataImage[1].split('/')[1], filename = `planning.${ext}`;
    payload.embeds[0].image = { url: `attachment://${filename}` };
    body = new FormData(); body.append('payload_json', JSON.stringify(payload)); body.append('files[0]', new Blob([Buffer.from(dataImage[2], 'base64')], { type: dataImage[1] }), filename);
  } else {
    if (plan.image_url) embed.image = { url: plan.image_url };
    headers['Content-Type'] = 'application/json'; body = JSON.stringify(payload);
  }
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers, body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Discord a refusé l’annonce (HTTP ${response.status}).`);
}
async function getGuildMember(userId) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`, { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
  if (!response.ok) return null;
  return response.json();
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config-status', async (_req, res) => res.json({ discordLogin: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_GUILD_ID && process.env.DISCORD_BOT_TOKEN), discordAnnouncements: Boolean(process.env.DISCORD_BOT_TOKEN && (await getSiteSetting('announcement_channel_id') || process.env.ANNOUNCEMENT_CHANNEL_ID)), imageImports: true, staffAccess: Boolean(process.env.STAFF_ROLE_IDS || process.env.STAFF_USER_IDS) }));
app.get('/auth/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_GUILD_ID || !process.env.DISCORD_BOT_TOKEN) return res.redirect('/?discord=configure');
  const state = crypto.randomBytes(24).toString('hex'); req.session.oauthState = state;
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
app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { id: req.session.user.id, username: req.session.user.username, avatar: req.session.user.avatar }, isStaff: await hasSiteStaff(req.session.user), isOwner: isOwner(req.session.user) });
});
app.get('/api/admin/backup', requireStaff, async (_req, res) => {
  try {
    const [plans, suggestions, messages, events] = await Promise.all([pool.query('SELECT * FROM plans ORDER BY id'), pool.query('SELECT * FROM suggestions ORDER BY id'), pool.query('SELECT * FROM suggestion_messages ORDER BY id'), pool.query('SELECT * FROM schedule_events ORDER BY starts_at')]);
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="life-santos-backup-${day}.json"`);
    res.json({ format: 'life-santos-backup-v2', exported_at: new Date().toISOString(), note: 'Images are stockées sur Cloudinary; leurs liens sont inclus.', tables: { plans: plans.rows, suggestions: suggestions.rows, suggestion_messages: messages.rows, schedule_events: events.rows } });
  } catch (error) { console.error('Backup export failed:', error.message); res.status(500).json({ error: 'La sauvegarde n’a pas pu être créée.' }); }
});
app.get('/api/admin/staff', requireOwner, async (_req, res) => {
  const result = await pool.query('SELECT user_id,display_name,created_at FROM staff_members ORDER BY created_at');
  const owners = envIds().map(user_id => ({ user_id, display_name: 'Administrateur principal', owner: true }));
  res.json([...owners, ...result.rows.map(row => ({ ...row, owner: false }))]);
});
app.post('/api/admin/staff', requireOwner, async (req, res) => {
  const id = String(req.body?.user_id || '').trim(), name = String(req.body?.display_name || '').trim().slice(0,80);
  if (!/^\d{17,20}$/.test(id)) return res.status(400).json({ error: 'Saisis un identifiant utilisateur Discord valide (17 à 20 chiffres).' });
  if (envIds().includes(id)) return res.status(409).json({ error: 'Cet utilisateur est déjà administrateur principal.' });
  const result = await pool.query('INSERT INTO staff_members(user_id,display_name,added_by) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING user_id,display_name,created_at', [id,name,req.session.user.id]);
  res.status(201).json({ ...result.rows[0], owner: false });
});
app.delete('/api/admin/staff/:id', requireOwner, async (req, res) => {
  await pool.query('DELETE FROM staff_members WHERE user_id=$1', [req.params.id]); res.json({ ok: true });
});
app.get('/api/admin/discord-resources', requireStaff, async (_req, res) => { try { res.json(await getDiscordResources()); } catch (error) { res.status(503).json({ error: error.message }); } });
app.get('/api/admin/discord-settings', requireStaff, async (_req, res) => res.json({ announcement_channel_id: await getSiteSetting('announcement_channel_id') || process.env.ANNOUNCEMENT_CHANNEL_ID || '', player_role_id: await getSiteSetting('player_role_id') || process.env.PLAYER_ROLE_ID || '' }));
app.put('/api/admin/discord-settings', requireStaff, async (req, res) => {
  try {
    const { announcement_channel_id: channelId, player_role_id: roleId } = req.body || {}, resources = await getDiscordResources();
    if (!resources.channels.some(channel => channel.id === channelId)) return res.status(400).json({ error: 'Choisis un salon texte du serveur.' });
    if (roleId && !resources.roles.some(role => role.id === roleId)) return res.status(400).json({ error: 'Choisis un rôle valide du serveur.' });
    await pool.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()', ['announcement_channel_id',channelId]);
    if (roleId) await pool.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()', ['player_role_id',roleId]); else await pool.query('DELETE FROM site_settings WHERE key=$1', ['player_role_id']);
    res.json({ ok: true });
  } catch (error) { res.status(503).json({ error: error.message }); }
});
app.get('/api/plans/latest', requireLogin, async (_req, res) => { const result = await pool.query('SELECT id,start_date,end_date,image_url,published_by,created_at FROM plans ORDER BY created_at DESC LIMIT 1'); res.json(result.rows[0] || null); });
app.post('/api/plans', requireStaff, upload.single('image'), async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    if (!start_date || !end_date || start_date > end_date) return res.status(400).json({ error: 'La période du planning est invalide.' });
    const imageUrl = await uploadImage(req.file);
    if (!imageUrl) return res.status(400).json({ error: 'Importe une image du planning.' });
    const plan = (await pool.query('INSERT INTO plans(start_date,end_date,image_url,published_by) VALUES($1,$2,$3,$4) RETURNING *', [start_date,end_date,imageUrl,req.session.user.username])).rows[0];
    try { await sendPlanAnnouncement(plan); res.status(201).json({ ...plan, announcement_sent: true }); }
    catch (error) { console.error('Discord announcement failed:', error.message); res.status(201).json({ ...plan, announcement_sent: false, announcement_error: error.message }); }
  } catch (error) { console.error('Plan publish error:', error.message); res.status(500).json({ error: error.message || 'Publication impossible.' }); }
});
app.get('/api/staff/events', requireStaff, async (_req, res) => { const result = await pool.query('SELECT id,title,description,starts_at,color,created_by FROM schedule_events WHERE starts_at >= NOW()-INTERVAL \'45 days\' ORDER BY starts_at'); res.json(result.rows); });
app.post('/api/staff/events', requireStaff, async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0,120), description = String(req.body?.description || '').trim().slice(0,500), starts = new Date(req.body?.starts_at), color = String(req.body?.color || '#b9ed65');
  if (!title || !Number.isFinite(starts.getTime()) || !/^#[\da-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Vérifie le titre, la date et la couleur.' });
  const result = await pool.query('INSERT INTO schedule_events(title,description,starts_at,color,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,title,description,starts_at,color,created_by', [title,description,starts.toISOString(),color,req.session.user.username]); res.status(201).json(result.rows[0]);
});
app.delete('/api/staff/events/:id', requireStaff, async (req, res) => { await pool.query('DELETE FROM schedule_events WHERE id=$1', [req.params.id]); res.json({ ok: true }); });
app.post('/api/uploads', requireLogin, upload.single('image'), async (req, res) => { try { const url = await uploadImage(req.file); if (!url) return res.status(400).json({ error: 'Choisis une image.' }); res.json({ url }); } catch (error) { res.status(500).json({ error: error.message }); } });
app.get('/api/suggestions', requireLogin, async (req, res) => {
  const result = await pool.query('SELECT s.*, COUNT(v.user_id)::int AS vote_count, COALESCE(BOOL_OR(v.user_id=$1),false) AS user_voted FROM suggestions s LEFT JOIN suggestion_votes v ON v.suggestion_id=s.id GROUP BY s.id ORDER BY s.created_at DESC', [req.session.user.id]); res.json(result.rows);
});
app.post('/api/suggestions', requireLogin, async (req, res) => {
  const { title, body, attachment_url } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Ajoute un titre et explique ton idée.' });
  const result = await pool.query('INSERT INTO suggestions(author_id,author_name,title,body,attachment_url) VALUES($1,$2,$3,$4,$5) RETURNING *', [req.session.user.id,req.session.user.username,title.trim().slice(0,120),body.trim().slice(0,5000),attachment_url || null]); res.status(201).json({ ...result.rows[0], vote_count: 0, user_voted: false });
});
app.post('/api/suggestions/:id/vote', requireLogin, async (req, res) => {
  const id = req.params.id, exists = await pool.query('SELECT 1 FROM suggestions WHERE id=$1', [id]); if (!exists.rowCount) return res.sendStatus(404);
  const prior = await pool.query('DELETE FROM suggestion_votes WHERE suggestion_id=$1 AND user_id=$2 RETURNING user_id', [id,req.session.user.id]);
  const voted = !prior.rowCount; if (voted) await pool.query('INSERT INTO suggestion_votes(suggestion_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id,req.session.user.id]);
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM suggestion_votes WHERE suggestion_id=$1', [id]); res.json({ user_voted: voted, vote_count: count.rows[0].count });
});
app.get('/api/suggestions/:id/messages', requireLogin, async (req, res) => {
  const exists = await pool.query('SELECT 1 FROM suggestions WHERE id=$1', [req.params.id]); if (!exists.rowCount) return res.sendStatus(404);
  res.json((await pool.query('SELECT id,author_id,author_name,body,attachment_url,created_at FROM suggestion_messages WHERE suggestion_id=$1 ORDER BY created_at', [req.params.id])).rows);
});
app.post('/api/suggestions/:id/messages', requireLogin, async (req, res) => {
  const exists = await pool.query('SELECT 1 FROM suggestions WHERE id=$1', [req.params.id]); if (!exists.rowCount) return res.sendStatus(404);
  const body = String(req.body?.body || '').trim(); if (!body && !req.body?.attachment_url) return res.status(400).json({ error: 'Le message est vide.' });
  const result = await pool.query('INSERT INTO suggestion_messages(suggestion_id,author_id,author_name,body,attachment_url) VALUES($1,$2,$3,$4,$5) RETURNING id,author_id,author_name,body,attachment_url,created_at', [req.params.id,req.session.user.id,req.session.user.username,body.slice(0,5000),req.body.attachment_url || null]); res.status(201).json(result.rows[0]);
});
app.patch('/api/suggestions/:id', requireStaff, async (req, res) => {
  const status = ['pending','review','accepted','rejected'].includes(req.body?.status) ? req.body.status : null; if (!status) return res.status(400).json({ error: 'Statut invalide.' });
  const result = await pool.query('UPDATE suggestions SET status=$1 WHERE id=$2 RETURNING *', [status,req.params.id]); if (!result.rowCount) return res.sendStatus(404); res.json(result.rows[0]);
});
app.use((_req, res) => res.redirect('/'));
initDb().then(() => app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Life Santos API prête.'))).catch(error => { console.error('Database initialization failed:', error.message); process.exit(1); });
