#!/usr/bin/env node
// Lists the Telegram chats that have written to your bot, so you can authorise them in
// TELEGRAM_CHAT_IDS. The token is read from the environment and never stored.
//
//   1. Each staff member opens the bot in Telegram (t.me/<your_bot>) and sends /start
//      (or adds the bot to the restaurant's group and writes a message there).
//   2. TELEGRAM_BOT_TOKEN=123456:ABC... node scripts/setup/telegram-chat-ids.mjs
//   3. Put the ids you trust in wrangler.jsonc -> vars.TELEGRAM_CHAT_IDS (comma separated).
//
// Uses getUpdates, which only works while the bot has no webhook (this project never sets one).
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token || !/^\d{5,16}:[A-Za-z0-9_-]{20,}$/.test(token)) {
  console.error("Set TELEGRAM_BOT_TOKEN (from @BotFather) in the environment.");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?allowed_updates=${encodeURIComponent('["message","my_chat_member"]')}`);
const body = await res.json();
if (!body.ok) {
  console.error(`Telegram answered: ${body.description ?? res.status}`);
  process.exit(1);
}

const chats = new Map();
for (const update of body.result ?? []) {
  const chat = update.message?.chat ?? update.my_chat_member?.chat;
  if (!chat) continue;
  const who = chat.type === "private" ? [chat.first_name, chat.last_name, chat.username && `@${chat.username}`].filter(Boolean).join(" ") : chat.title;
  chats.set(String(chat.id), { type: chat.type, who });
}

if (chats.size === 0) {
  console.log("No messages yet. Ask each staff member to send /start to the bot, then run this again.");
} else {
  console.log("Chats that wrote to the bot (authorise only the ones you recognise):\n");
  for (const [id, chat] of chats) console.log(`  ${id.padEnd(16)} ${chat.type.padEnd(10)} ${chat.who ?? ""}`);
  console.log(`\nTELEGRAM_CHAT_IDS="${[...chats.keys()].join(",")}"`);
}
