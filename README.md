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

### 4. Deployment ideas

- **Cheap VPS (recommended for polling bots)**
  - Provision a small VPS (DigitalOcean/Linode/etc.).
  - Install Node.js and git.
  - Pull this repo, set `.env`, run via `pm2`:

    ```bash
    pm2 start src/bot.js --name mern-job-bot
    pm2 save
    pm2 startup
    ```

- **Serverless/webhook variant (later upgrade)**
  - Convert from polling to webhook mode and host behind a simple Node server (Render/Heroku/Fly.io).

### 5. Monetization angles

- **SaaS-ish subscription**
  - Free tier: 1 keyword, slower checks (every 30–60 mins).
  - Premium: multiple keywords, faster checks (5–10 mins), niche presets (e.g. “MERN + long-term”, “React + India”), ₹99–₹299/month.

- **Custom bots as gigs**
  - Offer “Custom Telegram Job Lead Bot” on Fiverr/Upwork.
  - Use this project as a live demo:
    - Record a short Loom of the bot catching real MERN jobs.
    - Upsell: add email notifications, Google Sheets logging, more sources (Indeed, LinkedIn, etc.).

### 6. Notes & limitations

- Scraping/HTML structure can change on Upwork/Freelancer; if selectors break, tweak them in `src/bot.js`.
- This version keeps all state **in memory** (fine for a simple VPS bot). For production, persist user/keywords and last seen IDs in a small DB (SQLite/Postgres/Mongo).

