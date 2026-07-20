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
    // AUTO-DEPLOY SLASH COMMANDS
    // ==========================================
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const slashCommandsData = [];
    
    // Extract JSON data from loaded slash commands
    client.slashCommands.forEach(command => {
        if (command.data) {
            slashCommandsData.push(command.data.toJSON());
        }
    });

    try {
        console.log(`Started refreshing ${slashCommandsData.length} application (/) commands.`);
        
        // If you have a specific server ID in your config, deploy as Guild-only commands
        if (config.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, config.guildId),
                { body: slashCommandsData }
            );
            console.log(`✅ Guild-only commands registered to server: ${config.guildId}`);
        } else {
            // Otherwise, deploy globally
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: slashCommandsData }
            );
            console.log(`✅ Global commands registered.`);
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
});

// --- 5. MESSAGE COMMAND LISTENER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

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
