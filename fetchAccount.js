const express = require('express');
const cors = require('cors');

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
        throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
}

function registerSpotifyRoutes(app) {
    app.use(cors());

    // One-time login helper to authorize your Spotify account
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

    // Callback helper that displays your permanent refresh token
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

    // Main endpoint fetched by your website
    app.get('/v1/spotify', async (req, res) => {
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
            return res.status(500).json({ success: false, error: 'Spotify environment variables not configured' });
        }

        try {
            const accessToken = await getSpotifyAccessToken();
            const playerRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            // 204 means nothing is currently playing
            if (playerRes.status === 204) {
                return res.json({
                    success: true,
                    listening_to_spotify: false,
                    spotify: null
                });
            }

            if (!playerRes.ok) {
                return res.status(playerRes.status).json({ success: false, error: 'Spotify API error' });
            }

            const playerData = await playerRes.json();

            if (!playerData?.is_playing || !playerData?.item) {
                return res.json({
                    success: true,
                    listening_to_spotify: false,
                    spotify: null
                });
            }

            const item = playerData.item;
            return res.json({
                success: true,
                listening_to_spotify: true,
                spotify: {
                    song: item.name,
                    artist: item.artists?.map(a => a.name).join(', ') || '',
                    track_url: item.external_urls?.spotify || 'https://open.spotify.com'
                }
            });
        } catch (err) {
            console.error('Spotify status error:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch Spotify status' });
        }
    });
}

function initFetchAccount(client, existingApp = null) {
    if (existingApp) {
        registerSpotifyRoutes(existingApp);
        return existingApp;
    }

    const app = express();
    const PORT = process.env.PORT || 3000;
    registerSpotifyRoutes(app);

    app.listen(PORT, () => {
        console.log(`Spotify API listening on port ${PORT}`);
    });

    return app;
}

module.exports = { initFetchAccount };
