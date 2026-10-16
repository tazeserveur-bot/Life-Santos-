const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let busy = false;

async function ensureTables() { await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); }
async function takeJob() {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const job = await db.query("SELECT * FROM bot_jobs WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
    if (!job.rowCount) { await db.query('COMMIT'); return null; }
    await db.query("UPDATE bot_jobs SET status='processing' WHERE id=$1", [job.rows[0].id]);
    await db.query('COMMIT');
    return job.rows[0];
  } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
async function publishPlan(plan) {
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const embed = new EmbedBuilder()
    .setColor(0xffb52b)
    .setTitle('Nouveau planning Life Santos')
    .setDescription(`Planning du ${plan.start_date} au ${plan.end_date}. Retrouvez l’affiche et les détails sur le site Life Santos.`)
    .setImage(plan.image_url)
    .setURL(process.env.FRONTEND_URL || 'https://life-santos.onrender.com')
    .setFooter({ text: 'Life Santos · Une ville, mille histoires' });
  const roleId = process.env.PLAYER_ROLE_ID;
  const channelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (channelId) {
    const channel = await guild.channels.fetch(channelId);
    if (channel?.isTextBased()) await channel.send({ content: roleId ? `<@&${roleId}> Nouveau planning disponible !` : 'Nouveau planning disponible !', embeds: [embed], allowedMentions: { roles: roleId ? [roleId] : [] } });
  }
  if (roleId) {
    const members = await guild.members.fetch();
    const recipients = members.filter(m => !m.user.bot && m.roles.cache.has(roleId));
    let sent = 0, skipped = 0;
    for (const member of recipients.values()) {
      try { await member.send({ content: `Le planning Life Santos du ${plan.start_date} au ${plan.end_date} est disponible.`, embeds: [embed] }); sent++; }
      catch { skipped++; }
      await wait(1100);
    }
    console.log(`Planning ${plan.id}: ${sent} DM envoyés, ${skipped} non délivrés.`);
  }
}
async function processQueue() {
  if (busy || !client.isReady()) return;
  busy = true;
  try {
    const job = await takeJob();
    if (!job) return;
    try {
      if (job.kind === 'publish_plan') await publishPlan(job.payload);
      await pool.query("UPDATE bot_jobs SET status='done',finished_at=NOW() WHERE id=$1", [job.id]);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error.message);
      await pool.query("UPDATE bot_jobs SET status='failed',finished_at=NOW(),error=$2 WHERE id=$1", [job.id, String(error.message).slice(0,1000)]);
    }
  } catch (error) { console.error('Queue error:', error.message); }
  finally { busy = false; }
}
client.once('ready', () => { console.log(`Bot Life Santos connecté en tant que ${client.user.tag}.`); setInterval(processQueue, 8000); processQueue(); });
client.on('error', error => console.error('Discord client error:', error.message));
ensureTables().then(() => client.login(process.env.DISCORD_BOT_TOKEN)).catch(error => { console.error('Bot startup failed:', error.message); process.exit(1); });


