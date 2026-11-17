const express = require('express');
const cors = require('cors');

const TARGET_USER_ID = '792341624797265930';
const MUTUAL_GUILD_ID = '878565984108150824'; // Replace with a server ID you and the bot share


function formatSpotifyActivity(activities = []) {
    // Activity type 2 corresponds to ActivityType.Listening
    const spotify = activities.find(act => act.name === 'Spotify' && act.type === 2);
    if (!spotify) return null;

    // Discord prefixes Spotify image IDs with "spotify:"
    const rawImage = spotify.assets?.largeImage || '';
    const albumArtUrl = rawImage.startsWith('spotify:')
        ? `https://i.scdn.co/image/${rawImage.slice('spotify:'.length)}`
        : null;

    return {
        track_id: spotify.syncId || null,
        track_url: spotify.syncId ? `https://open.spotify.com/track/${spotify.syncId}` : null,
        song: spotify.details || 'Unknown Track',
        // Discord separates multiple artists with "; "
        artist: spotify.state ? spotify.state.replace(/; /g, ', ') : 'Unknown Artist',
        album: spotify.assets?.largeText || '',
        album_art_url: albumArtUrl,
        timestamps: {
            start: spotify.timestamps?.start ? spotify.timestamps.start.getTime() : null,
            end: spotify.timestamps?.end ? spotify.timestamps.end.getTime() : null
        }
    };
}

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

            const member = guild.members.cache.get(TARGET_USER_ID)
                || await guild.members.fetch(TARGET_USER_ID).catch(() => null);

            const discordStatus = member?.presence?.status || 'offline';
            const spotifyData = formatSpotifyActivity(member?.presence?.activities);

            return res.json({
                success: true,
                data: {
                    discord_status: discordStatus,
                    listening_to_spotify: Boolean(spotifyData),
                    spotify: spotifyData
                }
            });
        } catch (err) {
            console.error('Status lookup failed:', err);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });
}

function initFetchAccount(client, existingApp = null) {
    if (existingApp) {
        registerStatusRoute(client, existingApp);
        return existingApp;
    }

    const app = express();
    const PORT = process.env.PORT || 3000;
    registerStatusRoute(client, app);

    app.listen(PORT, () => {
        console.log(`Status API listening on port ${PORT}`);
    });

    return app;
}

module.exports = { initFetchAccount };
