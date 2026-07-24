const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { REST, Routes } = require('discord.js');
require('dotenv').config(); // Loads your .env credentials

async function runCleanup() {
    console.log("🧹 Starting complete system cleanup...\n");

    // ==========================================
    // 1. DELETE OLD FILES FROM FEATURE FOLDER
    // ==========================================
    const featurePath = path.join(__dirname, 'feature');
    if (fs.existsSync(featurePath)) {
        const files = fs.readdirSync(featurePath);
        let deletedFiles = 0;

        files.forEach(file => {
            // Deletes old files starting with "message-"
            if (file.startsWith('message-') && file.endsWith('.js')) {
                const filePath = path.join(featurePath, file);
                fs.unlinkSync(filePath);
                console.log(`🗑️ [Files] Deleted old ghost file: ${file}`);
                deletedFiles++;
            }
        });
        console.log(`✅ [Files] Cleaned up ${deletedFiles} old file(s).\n`);
    }

    // ==========================================
    // 2. WIPE DATABASE COLLECTIONS (MongoDB)
    // ==========================================
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoUri) {
        try {
            console.log("🔌 [Database] Connecting to MongoDB...");
            await mongoose.connect(mongoUri);
            console.log("✅ [Database] Connected successfully.");

            // ⚠️ WARNING: This will delete ALL documents in your database collections!
            // If you only want to clear specific collections, change the names below.
            const collections = await mongoose.connection.db.collections();
            
            for (let collection of collections) {
                const name = collection.collectionName;
                // Uncomment the line below if you want to protect certain collections from being wiped:
                // if (name === 'important_collection') continue;

                await collection.deleteMany({});
                console.log(`🗑️ [Database] Cleared all documents from collection: "${name}"`);
            }

            await mongoose.disconnect();
            console.log("✅ [Database] Wipe complete & connection closed.\n");
        } catch (dbError) {
            console.error("❌ [Database] Error wiping database:", dbError.message);
        }
    } else {
        console.log("ℹ️ [Database] No MongoDB URI found in .env, skipping database wipe.\n");
    }

    // ==========================================
    // 3. WIPE OLD DISCORD SLASH COMMANDS
    // ==========================================
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID; // Your bot's client/application ID

    if (token && clientId) {
        try {
            console.log("🤖 [Discord] Connecting to Discord API to clear slash commands...");
            const rest = new REST({ version: '10' }).setToken(token);

            // Clear Global Slash Commands
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log("🗑️ [Discord] Successfully cleared all GLOBAL slash commands.");

            // Clear Guild (Server) Specific Slash Commands if you have a test server ID set
            if (process.env.GUILD_ID) {
                await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: [] });
                console.log(`🗑️ [Discord] Successfully cleared all GUILD slash commands for server: ${process.env.GUILD_ID}`);
            }

            console.log("✅ [Discord] Slash command cleanup complete.\n");
        } catch (discordError) {
            console.error("❌ [Discord] Error clearing commands:", discordError.message);
        }
    } else {
        console.log("ℹ️ [Discord] DISCORD_TOKEN or CLIENT_ID missing in .env, skipping command wipe.\n");
    }

    console.log("✨ All cleanup tasks finished successfully!");
    process.exit(0);
}

runCleanup();
