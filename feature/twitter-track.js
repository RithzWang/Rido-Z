const TwitterDB = require('../schema/twitterSchema'); 

module.exports = (client) => {
    // ==========================================
    // TWITTER BACKGROUND CHECKER (API v2 VERSION)
    // ==========================================
    setInterval(async () => {
        try {
            const trackedAccounts = await TwitterDB.find({});
            const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

            if (!BEARER_TOKEN) return;

            for (const dbAccount of trackedAccounts) {
                try {
                    // Fetch latest tweet (excluding retweets and replies)
                    const response = await fetch(`https://api.twitter.com/2/users/${dbAccount.twitterId}/tweets?max_results=5&exclude=retweets,replies`, {
                        headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
                    });
                    const data = await response.json();

                    if (data.data && data.data.length > 0) {
                        const latestTweetId = data.data[0].id;
                        const tweetUrl = `https://x.com/${dbAccount.twitterHandle}/status/${latestTweetId}`;

                        let savedIds = dbAccount.lastTweetId ? dbAccount.lastTweetId.split(',') : [];

                        if (!savedIds.includes(latestTweetId)) {
                            
                            const discordChannel = client.channels.cache.get(dbAccount.discordChannelId);
                            if (discordChannel) {
                                // You can use x.com or twitter.com/fxtwitter.com here depending on how you want embeds to look
                                await discordChannel.send(`**@${dbAccount.twitterHandle}** just tweeted!\n${tweetUrl}`);
                            }

                            savedIds.unshift(latestTweetId);
                            if (savedIds.length > 5) savedIds.pop();

                            dbAccount.lastTweetId = savedIds.join(',');
                            await dbAccount.save();
                        }
                    }
                } catch (fetchError) {
                    console.error(`[Twitter] Failed to fetch data for @${dbAccount.twitterHandle}:`, fetchError.message);
                }
            }
        } catch (dbError) {
            console.error(`[Twitter] Database error during interval:`, dbError);
        }
    }, 3 * 60 * 1000); // 3-minute interval to respect API limits
};
