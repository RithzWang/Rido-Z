const { request } = require('undici'); // discord.js native fetcher, or you can just use global fetch

async function fetchAdvancedProfile(userId) {
    const userToken = process.env.BURNER_TOKEN;

    if (!userToken) {
        console.error("❌ Missing BURNER_TOKEN in .env file.");
        return null;
    }

    try {
        const response = await fetch(`https://discord.com/api/v10/users/${userId}/profile`, {
            method: 'GET',
            headers: {
                'Authorization': userToken,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`❌ v9 API Error: ${response.status} - ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Fetch Error:", error);
        return null;
    }
}

module.exports = { fetchAdvancedProfile };
