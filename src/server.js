const express = require('express');
const { createBot } = require('./bot');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_BASE = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const { bot, users, checkLeadsForUser } = createBot(false);

// Health check (Render and browsers)
app.get('/', (req, res) => {
  res.send('Jobs4U bot is up. Use Telegram to talk to the bot.');
});

// Telegram sends updates here when using webhook
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Optional: external cron (e.g. cron-job.org) hits this every 10 min to run job checks
app.get('/cron', async (req, res) => {
  if (CRON_SECRET && req.query.key !== CRON_SECRET) {
    return res.status(403).send('Forbidden');
  }
  const chatIds = Object.keys(users);
  for (const chatId of chatIds) {
    try {
      await checkLeadsForUser(chatId);
    } catch (err) {
      console.error('Cron check error for', chatId, err.message);
    }
  }
  res.send(`Checked ${chatIds.length} users.`);
});

app.listen(PORT, async () => {
  if (WEBHOOK_BASE) {
    const webhookUrl = `${WEBHOOK_BASE.replace(/\/$/, '')}/webhook`;
    // Don't block startup on webhook call (avoid Render start timeouts).
    bot
      .setWebHook(webhookUrl)
      .then(() => console.log('Webhook set:', webhookUrl))
      .catch((err) => console.error('Failed to set webhook:', err.message || err));
  }
  console.log('MERN Job Lead Bot (web) listening on port', PORT);
});
