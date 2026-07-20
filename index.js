const fs = require('fs');
const path = require('path');
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection 
} = require('discord.js');

const mongoose = require('mongoose');

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
// Assumes this handles your slash command registry
require('./handlers/commandHandler')(client);

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
} else {
    console.log(`⚠️ Folder not found: ${normalCommandsPath}`);
}

// --- 3. LOAD EVENTS ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
} else {
    console.log(`⚠️ Folder not found: ${eventsPath}`);
}

// --- 4. READY EVENT ---
client.once('ready', () => {
    console.log(`✅ Logged in successfully as ${client.user.tag}`);
});

// --- 5. MESSAGE COMMAND LISTENER ---
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Split message into arguments based on spaces
    const args = message.content.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // Fetch the command by name or alias
    let command = client.messageCommands.get(commandName);
    if (!command) {
        command = client.messageCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    }
    
    // If no matching command is found, exit
    if (!command) return;

    // If the command is restricted to specific channels, check here
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
        // Connect to MongoDB
        if (process.env.MONGO_TOKEN) {
            await mongoose.connect(process.env.MONGO_TOKEN, { dbName: 'MyBotData' });
            console.log("✅ MongoDB Connected.");
        } else {
            console.log("⚠️ No MONGO_TOKEN found in environment variables.");
        }

        // Login to Discord
        await client.login(process.env.TOKEN);
    } catch (error) { 
        console.error("❌ Startup Error:", error); 
    }
})();
