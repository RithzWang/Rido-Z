const express = require('express');
const cors = require('cors');

const TARGET_USER_ID = '792341624797265930';
const MUTUAL_GUILD_ID = '878565984108150824'; // Replace with a server ID you and the bot share

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const REDIRECT_URI = 'https://rido-z.onrender.com/spotify/callback';

async function getSpotifyAccessToken() {
    const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: SPOTIFY_REFRESH_TOKEN
        })
    });

    if (!response.ok) {
        throw new Error(`Spotify token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function fetchSpotifyNowPlaying() {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
        return { listening_to_spotify: false, spotify: null };
    }

    try {
        const accessToken = await getSpotifyAccessToken();
        const playerRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (playerRes.status === 204 || !playerRes.ok) {
            return { listening_to_spotify: false, spotify: null };
        }

        const playerData = await playerRes.json();
        if (!playerData?.is_playing || !playerData?.item) {
            return { listening_to_spotify: false, spotify: null };
        }

        const item = playerData.item;
        return {
            listening_to_spotify: true,
            spotify: {
                song: item.name,
                artist: item.artists?.map(a => a.name).join(', ') || '',
                track_url: item.external_urls?.spotify || 'https://open.spotify.com'
            }
        };
    } catch (err) {
        console.error('Spotify fetch failed:', err);
        return { listening_to_spotify: false, spotify: null };
    }
}

function registerRoutes(client, app) {
    app.use(cors());

    // One-time Spotify login helper
    app.get('/spotify/login', (req, res) => {
        if (!SPOTIFY_CLIENT_ID) {
            return res.status(500).send('SPOTIFY_CLIENT_ID is missing in Render environment variables.');
        }

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: SPOTIFY_CLIENT_ID,
            scope: 'user-read-currently-playing',
            redirect_uri: REDIRECT_URI
        });

        res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
    });

    // Spotify OAuth callback helper
    app.get('/spotify/callback', async (req, res) => {
        const code = req.query.code;
        if (!code) return res.status(400).send('Missing authorization code.');

        try {
            const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: REDIRECT_URI
                })
            });

            const data = await response.json();
            if (!data.refresh_token) {
                return res.status(400).json(data);
            }

            res.send(`<h3>Copy this into Render as SPOTIFY_REFRESH_TOKEN:</h3><textarea rows="4" cols="60" readonly>${data.refresh_token}</textarea>`);
        } catch (err) {
            console.error('Spotify callback error:', err);
            res.status(500).send('Failed to exchange code for refresh token.');
        }
    });

    // Combined Discord status + Spotify Web API endpoint
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
            const spotifyState = await fetchSpotifyNowPlaying();

            return res.json({
                success: true,
                data: {
                    discord_status: discordStatus,
                    listening_to_spotify: spotifyState.listening_to_spotify,
                    spotify: spotifyState.spotify
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
        registerRoutes(client, existingApp);
        return existingApp;
    }

    const app = express();
    const PORT = process.env.PORT || 3000;
    registerRoutes(client, app);

    app.listen(PORT, () => {
        console.log(`Status & Spotify API listening on port ${PORT}`);
    });

    return app;
}

module.exports = { initFetchAccount };
