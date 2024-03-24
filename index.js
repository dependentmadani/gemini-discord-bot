
require('dotenv/config');
const discord = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = "gemini-pro";
const API_KEY = process.env.API_KEY;
const BOT_TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const ai = new GoogleGenerativeAI(API_KEY);
const model = ai.getGenerativeModel({model: MODEL});

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

        const { response } = await model.generateContent(message.cleanContent);

        await message.reply({
            content: response.text(),
        })


    }catch(e) {
        console.log("ERROR:", e);
    }
})