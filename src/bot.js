const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

// In‑memory user tracking: { [chatId]: { keyword, lastUpworkTitles: Set, lastFreelancerTitles: Set, lastRemotiveTitles: Set } }
const users = {};
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function createBot(usePolling = true) {
  if (!token) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: usePolling });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const text =
      '👋 Welcome to MERN Job Lead Bot!\n\n' +
      'I scan Upwork & Freelancer for your niche and send fresh leads.\n\n' +
      'Use:\n' +
      '• /track mern developer remote\n' +
      '• /track react node js india\n\n' +
      'You can change your keyword anytime with another /track command.';

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(console.error);
  });

  bot.onText(/\/track\s+(.+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const keyword = (match && match[1] ? match[1] : '').trim();

    if (!keyword) {
      bot
        .sendMessage(chatId, 'Please provide a keyword, e.g. `/track mern developer`', {
          parse_mode: 'Markdown',
        })
        .catch(console.error);
      return;
    }

    if (!users[chatId]) {
      users[chatId] = {
        keyword,
        lastUpworkTitles: new Set(),
        lastFreelancerTitles: new Set(),
        lastRemotiveTitles: new Set(),
      };
    } else {
      users[chatId].keyword = keyword;
    }

    bot
      .sendMessage(
        chatId,
        `✅ Tracking leads for: *${keyword}*\n\nYou will get alerts about new jobs from Upwork, Freelancer & Remotive every ${POLL_INTERVAL_MS / 60000} minutes.`,
        { parse_mode: 'Markdown' },
      )
      .catch(console.error);

    try {
      await checkLeadsForUser(chatId);
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, 'There was an error fetching jobs just now, will retry soon.').catch(console.error);
    }
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const user = users[chatId];
    if (!user || !user.keyword) {
      bot.sendMessage(chatId, 'You are not tracking anything yet. Use `/track mern developer`.', {
        parse_mode: 'Markdown',
      });
      return;
    }
    bot.sendMessage(chatId, `You are currently tracking: *${user.keyword}*`, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (users[chatId]) {
      delete users[chatId];
      bot.sendMessage(chatId, '🛑 Stopped tracking job leads for this chat.');
    } else {
      bot.sendMessage(chatId, 'You were not tracking any keywords.');
    }
  });

async function checkLeadsForUser(chatId) {
  const user = users[chatId];
  if (!user || !user.keyword) return;

  const keyword = user.keyword;

  try {
    const [upworkJobs, freelancerJobs, remotiveJobs] = await Promise.all([
      fetchUpworkJobs(keyword),
      fetchFreelancerJobs(keyword),
      fetchRemotiveJobs(keyword),
    ]);

    const newUpwork = filterNewTitles(upworkJobs, user.lastUpworkTitles);
    const newFreelancer = filterNewTitles(freelancerJobs, user.lastFreelancerTitles);
    const newRemotive = filterNewTitles(remotiveJobs, user.lastRemotiveTitles || (user.lastRemotiveTitles = new Set()));

    if (!newUpwork.length && !newFreelancer.length && !newRemotive.length) {
      console.log(`No new jobs for ${chatId} (${keyword})`);
      return;
    }

    const lines = [];

    if (newUpwork.length) {
      lines.push('*Upwork:*');
      newUpwork.slice(0, 5).forEach((job) => {
        lines.push(`• [${job.title}](${job.url || 'https://www.upwork.com'})`);
      });
      lines.push('');
    }

    if (newFreelancer.length) {
      lines.push('*Freelancer:*');
      newFreelancer.slice(0, 5).forEach((job) => {
        lines.push(`• [${job.title}](${job.url || 'https://www.freelancer.com'})`);
      });
      lines.push('');
    }

    if (newRemotive.length) {
      lines.push('*Remotive (remote jobs):*');
      newRemotive.slice(0, 5).forEach((job) => {
        lines.push(`• [${job.title}](${job.url || 'https://remotive.com'})`);
      });
    }

    const message =
      `🔥 New leads for *${keyword}*:\n\n` +
      (lines.length ? lines.join('\n') : 'No new leads this round.');

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`Error checking leads for chat ${chatId}:`, error.message || error);
  }
}

function filterNewTitles(jobs, seenSet) {
  const fresh = [];
  for (const job of jobs) {
    const key = job.title;
    if (!key) continue;
    if (!seenSet.has(key)) {
      fresh.push(job);
      seenSet.add(key);
    }
  }

  // Keep seen set from growing forever (simple cap)
  if (seenSet.size > 200) {
    const trimmed = Array.from(seenSet).slice(-100);
    seenSet.clear();
    trimmed.forEach((t) => seenSet.add(t));
  }

  return fresh;
}

async function fetchUpworkJobs(keyword) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://www.upwork.com/nx/search/jobs/?q=${encoded}&sort=recency`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    const jobs = [];

    // Upwork frontend changes often; this targets generic card titles as a fallback.
    $('.up-card-section, .job-tile, article').each((_, el) => {
      const title =
        $(el).find('a[data-test="job-title-link"]').text().trim() ||
        $(el).find('.job-tile-title').text().trim() ||
        $(el).find('.up-n-link').first().text().trim();

      const href =
        $(el).find('a[data-test="job-title-link"]').attr('href') ||
        $(el).find('a').first().attr('href');

      if (title) {
        jobs.push({
          title,
          url: href && href.startsWith('http') ? href : href ? `https://www.upwork.com${href}` : null,
        });
      }
    });

    return jobs.slice(0, 10);
  } catch (err) {
    console.error('Error fetching Upwork jobs:', err.message || err);
    return [];
  }
}

async function fetchFreelancerJobs(keyword) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://www.freelancer.com/rss/job?keyword=${encoded}`;

  try {
    const { data: xml } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(xml, { xmlMode: true });
    const jobs = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      if (title) {
        jobs.push({ title, url: link || null });
      }
    });

    return jobs.slice(0, 10);
  } catch (err) {
    console.error('Error fetching Freelancer jobs:', err.message || err);
    return [];
  }
}

// Remotive: public remote job API (no auth)
// Docs: https://remotive.com/api/remote-jobs
async function fetchRemotiveJobs(keyword) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://remotive.com/api/remote-jobs?search=${encoded}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
      timeout: 15000,
    });

    if (!data || !Array.isArray(data.jobs)) return [];

    return data.jobs.slice(0, 15).map((job) => ({
      title: `${job.title} @ ${job.company_name}`,
      url: job.url,
    }));
  } catch (err) {
    console.error('Error fetching Remotive jobs:', err.message || err);
    return [];
  }
}

  if (usePolling) {
    setInterval(() => {
      Object.keys(users).forEach((chatId) => {
        checkLeadsForUser(chatId);
      });
    }, POLL_INTERVAL_MS);
    console.log('MERN Job Lead Bot is running (polling)...');
  }

  return { bot, users, checkLeadsForUser };
}

module.exports = { createBot, users, POLL_INTERVAL_MS };

// When run directly (e.g. locally), use polling
if (require.main === module) {
  createBot(true);
}
