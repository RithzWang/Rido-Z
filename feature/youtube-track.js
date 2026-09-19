// 👇 Go up one folder to find the schema folder
const YouTubeDB = require('../schema/youtubeSchema'); 

module.exports = (client) => {
    // ==========================================
    // YOUTUBE BACKGROUND CHECKER (API VERSION)
    // ==========================================
    setInterval(async () => {
        try {
            // 1. Get all tracked channels from MongoDB
            const trackedChannels = await YouTubeDB.find({});
            const API_KEY = process.env.YOUTUBE_API_KEY;

            if (!API_KEY) {
                console.log("[YouTube API] Warning: YOUTUBE_API_KEY is missing in .env");
                return;
            }

            // 2. Loop through each channel
            for (const dbChannel of trackedChannels) {
                try {
                    // Quick trick: A channel's "Uploads" playlist is just their Channel ID with 'UU' instead of 'UC'
                    const uploadsPlaylistId = dbChannel.ytChannelId.replace(/^UC/, 'UU');

                    // Fetch the latest video from their uploads playlist
                    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${API_KEY}`);
                    const data = await response.json();

                    // Check if we got a valid video back
                    if (data.items && data.items.length > 0) {
                        const latestVideo = data.items[0].snippet;
                        const videoId = latestVideo.resourceId.videoId;
                        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                        const channelName = latestVideo.channelTitle;

                        // Turn the saved string into an array of the last 5 IDs
                        let savedIds = dbChannel.lastVideoId ? dbChannel.lastVideoId.split(',') : [];

                        // Check if the latest video's ID is ALREADY in our list
                        if (!savedIds.includes(videoId)) {
                            
                            // We found a new video! Let's send the message
                            const discordChannel = client.channels.cache.get(dbChannel.discordChannelId);
                            if (discordChannel) {
                                await discordChannel.send(`**${channelName}** just uploaded a new video!\n${videoUrl}`);
                            }

                            // Add the new video ID to the front of the array
                            savedIds.unshift(videoId);
                            
                            // Keep only the last 5 video IDs to prevent the string from getting too long
                            if (savedIds.length > 5) savedIds.pop();

                            // Save it back to the database as a string (e.g., "id1,id2,id3")
                            dbChannel.lastVideoId = savedIds.join(',');
                            await dbChannel.save();
                        }
                    } else if (data.error) {
                        console.error(`[YouTube API Error for ${dbChannel.ytChannelName}]:`, data.error.message);
                    }
                } catch (fetchError) {
                    console.error(`[YouTube] Failed to fetch data for ${dbChannel.ytChannelName}:`, fetchError.message);
                }
            }
        } catch (dbError) {
            console.error(`[YouTube] Database error during interval:`, dbError);
        }
    }, 3 * 60 * 1000); // 3-minute interval
};
