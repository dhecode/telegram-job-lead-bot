## MERN Job Lead Telegram Bot

**Goal:** Simple Telegram bot that watches Upwork & Freelancer for your MERN / JS niche and pushes fresh leads directly to your Telegram. Built for quick monetization as a SaaS-style alert bot or as a demo for custom bot gigs.

### 1. Setup

1. **Clone / create folder**

   ```bash
   cd /Users/utkarsh/Projects
   cd telegram-job-lead-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create Telegram bot & token**

   - In Telegram, search for `@BotFather`.
   - Run `/newbot`, follow the prompts, and copy the **HTTP API token**.

4. **Create `.env` file**

   In the project root:

   ```bash
   echo "TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE" > .env
   ```

   Replace `YOUR_BOT_TOKEN_HERE` with the token from BotFather.

### 2. Run the bot locally

```bash
npm start
```

Leave this running (use tmux/screen/pm2 on a VPS) so the bot can keep polling every ~10 minutes.

### 3. Bot commands (user-facing)

- `/start` – Intro message and quick instructions.
- `/track <keywords>` – Set your job search keyword.
  - Examples:
    - `/track mern developer`
    - `/track react node full stack india`
- `/status` – See what keyword you’re currently tracking.
- `/stop` – Stop receiving job alerts in that chat.

The bot:

- Polls **Upwork** and **Freelancer** every 10 minutes.
- De-duplicates by job title so you don’t get spammed with the same listing.
- Sends clickable titles linking to the job page.

### 4. Deploy on Render (free tier)

The app runs as a **Web Service** (not a worker) so it works on the free plan.

1. Push this repo to GitHub, then in [Render](https://dashboard.render.com): **New +** → **Blueprint** → connect the repo.
2. Render will use `render.yaml`: it creates a **Web Service** and sets `startCommand: node src/server.js`.
3. In the service **Environment** tab, set:
   - `TELEGRAM_BOT_TOKEN` = your BotFather token  
   - (Optional) `CRON_SECRET` = a random string; use it in the cron URL so only your cron can trigger checks.
4. Deploy. Render assigns a URL like `https://telegram-job-lead-bot-xxx.onrender.com`. The bot sets its Telegram webhook to `https://.../webhook` automatically using `RENDER_EXTERNAL_URL`.
5. **Optional – periodic job checks:** On the free tier the app may sleep when idle. To run job checks every 10 minutes, use [cron-job.org](https://cron-job.org): create a job that GETs  
   `https://YOUR-RENDER-URL.onrender.com/cron?key=YOUR_CRON_SECRET`  
   every 10 minutes. Use the same `CRON_SECRET` you set in Render.

**Local (polling):** Run `npm start` (runs `node src/bot.js`) for polling.  
**Render (webhook):** Runs `node src/server.js` with webhook + optional `/cron` for checks.

### 5. Other deployment ideas

- **Cheap VPS (always-on polling)**
  - Provision a small VPS, clone repo, set `.env`, run: `pm2 start src/bot.js --name mern-job-bot`

### 6. Monetization angles

- **SaaS-ish subscription**
  - Free tier: 1 keyword, slower checks (every 30–60 mins).
  - Premium: multiple keywords, faster checks (5–10 mins), niche presets (e.g. “MERN + long-term”, “React + India”), ₹99–₹299/month.

- **Custom bots as gigs**
  - Offer “Custom Telegram Job Lead Bot” on Fiverr/Upwork.
  - Use this project as a live demo:
    - Record a short Loom of the bot catching real MERN jobs.
    - Upsell: add email notifications, Google Sheets logging, more sources (Indeed, LinkedIn, etc.).

### 7. Notes & limitations

- Scraping/HTML structure can change on Upwork/Freelancer; if selectors break, tweak them in `src/bot.js`.
- This version keeps all state **in memory** (fine for a simple VPS bot). For production, persist user/keywords and last seen IDs in a small DB (SQLite/Postgres/Mongo).

