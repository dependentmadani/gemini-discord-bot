
require('dotenv/config');
const discord = require('discord.js');

// Cheapest paid models in priority order (lowest cost first). Paid models
// avoid the congested free-tier rate limits while costing only fractions of a
// cent per message. OpenRouter automatically falls back to the next one if a
// model is rate-limited (429), down, or errors; you're billed only for the
// model that actually answers.
// Override with OPENROUTER_MODEL in .env (single id or comma-separated list).
const DEFAULT_MODELS = [
    "mistralai/mistral-nemo",           // ~$0.02/$0.03 per 1M tokens
    "meta-llama/llama-3.1-8b-instruct", // ~$0.02/$0.05 per 1M tokens
    "inclusionai/ling-2.6-flash",       // ~$0.01/$0.03 per 1M tokens
];
const MODELS = process.env.OPENROUTER_MODEL
    ? process.env.OPENROUTER_MODEL.split(",").map(s => s.trim()).filter(Boolean)
    : DEFAULT_MODELS;

const API_KEY = process.env.OPENROUTER_API_KEY;
const BOT_TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Fail loudly at startup if required config is missing (e.g. env vars not set
// on the cloud host). Otherwise a missing key only shows up as a runtime 401.
for (const [name, value] of Object.entries({ TOKEN: BOT_TOKEN, OPENROUTER_API_KEY: API_KEY, CHANNEL_ID })) {
    if (!value) console.warn(`WARNING: ${name} is not set — the bot will not work correctly until it is.`);
}

// The bot's personality. Override with SYSTEM_PROMPT in .env to change its vibe.
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
    "You're a witty, playful Discord bot. Keep replies fun, upbeat, and " +
    "conversational, with light humor and the occasional emoji. Be friendly " +
    "and a little cheeky, but still genuinely helpful. Keep it short — usually " +
    "a sentence or two — since this is casual chat. Never sound formal or robotic.";

// Rolling per-channel conversation history so the bot can follow a back-and-forth.
// In-memory only: it resets on restart, which is fine for a casual chat bot.
const MAX_HISTORY = 10; // keep the last N user/assistant messages
const histories = new Map();

const bot = new discord.Client({
    intents: Object.keys(discord.GatewayIntentBits),
});

bot.on('ready', () => {
    console.log("The bot is ready!")
});

bot.login(BOT_TOKEN);

bot.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        if (message.channel.id !== CHANNEL_ID) return;

        await message.channel.sendTyping();

        // Build this turn's context: previous history + the new user message.
        // Not committed to memory yet — only stored if the request succeeds.
        const prev = histories.get(message.channel.id) || [];
        const history = [...prev, { role: "user", content: message.cleanContent }];

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                models: MODELS,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    ...history,
                ],
            }),
        });

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;

        if (!res.ok || !reply) {
            console.log("OpenRouter error:", res.status, JSON.stringify(data));
            await message.reply("⚠️ Sorry, I couldn't get a response right now. Please try again in a moment.");
            return;
        }

        // Commit the exchange to memory, trimmed to the most recent messages.
        histories.set(message.channel.id, [...history, { role: "assistant", content: reply }].slice(-MAX_HISTORY));

        await message.reply({
            content: reply.slice(0, 2000),
        })


    }catch(e) {
        console.log("ERROR:", e);
    }
})
