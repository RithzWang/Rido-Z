const fs = require('fs');
const path = require('path');
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection,
    REST,
    Routes,
    ActivityType
} = require('discord.js');

const mongoose = require('mongoose');
const moment = require('moment-timezone');

// 👇 Import RSS Parser and your YouTube Schema for the background checker
const Parser = require('rss-parser');
const parser = new Parser();
const YouTubeDB = require('./schema/youtubeSchema'); // Ensure this path matches your folder structure!

// 👇 Import your new unified Database Translator
const databaseTranslator = require('./feature/database-translator.js');
const personaChatbot = require('./feature/chatbot.js'); // <-- ADD THIS


// Keep your hosting ping script if you use services like Replit/UptimeRobot
require('./keep_alive.js');

// --- CONFIGURATION ---
const config = require("./config.json");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
    ],
    partials: [ 
        Partials.Channel, 
        Partials.Message, 
        Partials.Reaction, 
        Partials.GuildMember, 
        Partials.User 
    ],
});

// --- COLLECTIONS ---
client.messageCommands = new Collection();
client.slashCommands = new Collection(); 

// --- 1. LOAD SLASH COMMAND HANDLER ---
// Make sure your commandHandler file correctly sets client.slashCommands
require('./handlers/commandHandler.js')(client);

// --- 2. LOAD LEGACY MESSAGE COMMANDS ---
const normalCommandsPath = path.join(__dirname, 'commands/normal commands');
if (fs.existsSync(normalCommandsPath)) {
    const commandFiles = fs.readdirSync(normalCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(normalCommandsPath, file);
        const command = require(filePath);
        if ('name' in command && 'execute' in command) {
            client.messageCommands.set(command.name, command);
            console.log(`✅ Loaded Message Command: ${command.name}`);
        }
    }
}

// --- 3. LOAD EVENTS ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        // Skip 'ready' event if it's in the events folder, since we handle it below!
        if (event.name === 'ready' || event.name === 'clientReady') continue;

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

// --- 4. READY EVENT (AUTO DEPLOY & CLOCK) ---
client.once('clientReady', async () => {
    console.log(`✅ Logged in successfully as ${client.user.tag}`);

    // ==========================================
    // AUTO-DEPLOY SLASH COMMANDS (FIXED FOR GLOBAL & GUILD)
    // ==========================================
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    const guildCommandsData = [];
    const globalCommandsData = [];
    
    // Sort commands into their proper deployment targets
    client.slashCommands.forEach(command => {
        if (command.data) {
            if (command.guildOnly) {
                guildCommandsData.push(command.data.toJSON());
            } else {
                globalCommandsData.push(command.data.toJSON());
            }
        }
    });

    try {
        // 1. Deploy Global Commands (No guildOnly rule set)
        if (globalCommandsData.length > 0) {
            console.log(`🔄 Refreshing ${globalCommandsData.length} Global (/) commands...`);
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: globalCommandsData }
            );
            console.log(`✅ Global commands registered.`);
        }

        // 2. Deploy Guild Commands (Has guildOnly: true)
        if (config.guildId) {
            if (guildCommandsData.length > 0) {
                console.log(`🔄 Refreshing ${guildCommandsData.length} Guild-only (/) commands...`);
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, config.guildId),
                    { body: guildCommandsData }
                );
                console.log(`✅ Guild-only commands registered to server: ${config.guildId}`);
            } else {
                // If there are no guild commands, push an empty array to clear the guild's cache
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, config.guildId),
                    { body: [] }
                );
            }
        }
        
    } catch (error) {
        console.error("❌ Command Register Error:", error);
    }

    // ==========================================
    // DYNAMIC STATUS CLOCK
    // ==========================================
    setInterval(() => {
        const now = moment().tz('Asia/Bangkok');
        const formattedTime = now.format('HH:mm');
        const currentHour = now.hour();

        let timeEmoji = '🌙'; 
        if (currentHour >= 6 && currentHour < 9) timeEmoji = '🌄'; 
        else if (currentHour >= 9 && currentHour < 16) timeEmoji = '☀️'; 
        else if (currentHour >= 16 && currentHour < 18) timeEmoji = '🌇'; 

        client.user.setPresence({
            activities: [{ 
                name: 'customstatus', 
                type: ActivityType.Custom, 
                emoji: '🐦‍🔥',
                state: `${timeEmoji} ${formattedTime} (GMT+7)` 
            }],
            status: 'dnd'
        });
    }, 15000); // Updates every 15 seconds to avoid Discord rate limits

    // ==========================================
    // DYNAMIC CHANNEL CLOCK
    // ==========================================
    setInterval(async () => {
        try {
            const targetChannelId = '1529986124565446758';
            const timeChannel = client.channels.cache.get(targetChannelId);

            if (timeChannel) {
                // Get current GMT+7 time using moment-timezone
                const now = moment().tz('Asia/Bangkok');
                const timeString = `🕒 ${now.format('HH:mm')} (GMT+7)`;

                // Only update if the name is actually different (saves API calls)
                if (timeChannel.name !== timeString) {
                    await timeChannel.setName(timeString);
                }
            }
        } catch (error) {
            console.error(`[Clock] Failed to update time channel:`, error.message);
        }
    }, 6 * 60 * 1000); // 6 minutes to respect Discord's rate limits

    // ==========================================
    // YOUTUBE BACKGROUND CHECKER
    // ==========================================
    setInterval(async () => {
        try {
            // 1. Get all tracked channels from MongoDB
            const trackedChannels = await YouTubeDB.find({});

            // 2. Loop through each channel and check their RSS feed
            for (const dbChannel of trackedChannels) {
                try {
                    const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${dbChannel.ytChannelId}`);
                    
                    if (feed.items.length > 0) {
                        const latestVideo = feed.items[0]; // The first item is always the newest

                        // Turn the saved string into an array of the last 5 IDs
                        let savedIds = dbChannel.lastVideoId ? dbChannel.lastVideoId.split(',') : [];

                        // Check if the latest video's ID is ALREADY in our list
                        if (!savedIds.includes(latestVideo.id)) {
                            
                            // We found a new video! Let's send the message
                            const discordChannel = client.channels.cache.get(dbChannel.discordChannelId);
                            if (discordChannel) {
                                await discordChannel.send(`**${latestVideo.author}** just posted a video!\n${latestVideo.link}`);
                            }

                            // Add the new video ID to the front of the array
                            savedIds.unshift(latestVideo.id);
                            
                            // Keep only the last 5 video IDs to prevent the string from getting too long
                            if (savedIds.length > 5) savedIds.pop();

                            // Save it back to the database as a string (e.g., "id1,id2,id3")
                            dbChannel.lastVideoId = savedIds.join(',');
                            await dbChannel.save();
                        }
                    }
                } catch (feedError) {
                    console.error(`[YouTube] Failed to fetch feed for ${dbChannel.ytChannelName}:`, feedError.message);
                }
            }
        } catch (dbError) {
            console.error(`[YouTube] Database error during interval:`, dbError);
        }
    }, 1 * 60 * 1000); // Check every 1 minute
});

// --- 5. MESSAGE COMMAND LISTENER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // ==========================================
    // RUN DYNAMIC DATABASE TRANSLATOR & CHATBOT
    // ==========================================
    if (await personaChatbot(message)) return;
    if (await databaseTranslator(message)) return;

    // ==========================================
    // COMMAND EXECUTION
    // ==========================================
    const args = message.content.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    let command = client.messageCommands.get(commandName);
    if (!command) {
        command = client.messageCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    }
    
    if (!command) return;

    if (command.channels && command.channels.length > 0 && !command.channels.includes(message.channel.id)) {
        return;
    }

    try { 
        await command.execute(message, args, client); 
    } catch (error) { 
        console.error(`❌ Error executing ${commandName}:`, error); 
    }
});

// --- 6. STARTUP SEQUENCE ---
(async () => {
    try {
        if (process.env.MONGO_TOKEN) {
            await mongoose.connect(process.env.MONGO_TOKEN, { dbName: 'MyBotData' });
            console.log("✅ MongoDB Connected.");
        }
        await client.login(process.env.TOKEN);
    } catch (error) { 
        console.error("❌ Startup Error:", error); 
    }
})();
