const express = require('express');
const cors = require('cors');

const TARGET_USER_ID = '792341624797265930';
const MUTUAL_GUILD_ID = '878565984108150824'; // Replace with a server ID you and the bot share

function registerStatusRoute(client, app) {
    app.use(cors());

    app.get('/v1/users/:id', async (req, res) => {
        if (req.params.id !== TARGET_USER_ID) {
            return res.status(404).json({ success: false, error: 'User not tracked' });
        }

        if (!client.isReady()) {
            return res.status(503).json({ success: false, error: 'Bot is still connecting' });
        }

        try {
            const guild = client.guilds.cache.get(MUTUAL_GUILD_ID);
            if (!guild) {
                return res.status(500).json({ success: false, error: 'Mutual guild not found' });
            }

            // Fetch member if not already cached
            const member = guild.members.cache.get(TARGET_USER_ID)
                || await guild.members.fetch(TARGET_USER_ID).catch(() => null);

            // When a user is offline, member.presence is null in discord.js
            const discordStatus = member?.presence?.status || 'offline';

            return res.json({
                success: true,
                data: {
                    discord_status: discordStatus
                }
            });
        } catch (err) {
            console.error('Status lookup failed:', err);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
}

function initFetchAccount(client, existingApp = null) {
    // If you already have an Express app running, attach the route to it
    if (existingApp) {
        registerStatusRoute(client, existingApp);
        return existingApp;
    }

    // Otherwise, start a standalone Express server on PORT
    const app = express();
    const PORT = process.env.PORT || 3000;
    registerStatusRoute(client, app);

    app.listen(PORT, () => {
        console.log(`Status API listening on port ${PORT}`);
    });

    return app;
}

module.exports = { initFetchAccount };
