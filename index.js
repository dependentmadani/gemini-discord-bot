
require('dotenv/config');
const discord = require('discord.js');

// Cheapest paid models in priority order (lowest cost first). Paid models
// avoid the congested free-tier rate limits while costing only fractions of a
// cent per message. OpenRouter automatically falls back to the next one if a
// model is rate-limited (429), down, or errors; you're billed only for the
// model that actually answers.
// Override with OPENROUTER_MODEL in .env (single id or comma-separated list).
const DEFAULT_MODELS = [
    "inclusionai/ling-2.6-flash",       // ~$0.01/$0.03 per 1M tokens
    "mistralai/mistral-nemo",           // ~$0.02/$0.03 per 1M tokens
    "meta-llama/llama-3.1-8b-instruct", // ~$0.02/$0.05 per 1M tokens
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

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                models: MODELS,
                messages: [
                    { role: "user", content: message.cleanContent },
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

        await message.reply({
            content: reply.slice(0, 2000),
        })


    }catch(e) {
        console.log("ERROR:", e);
    }
})
