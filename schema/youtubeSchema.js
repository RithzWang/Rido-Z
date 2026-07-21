const { Schema, model, models } = require('mongoose');

const youtubeSchema = new Schema({
    ytChannelId: { type: String, required: true },
    ytChannelName: { type: String, required: true },
    ytChannelLink: { type: String, required: true },
    discordChannelId: { type: String, required: true },
    profileUrl: { type: String, default: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png" },
    lastVideoId: { type: String, default: null } 
});

// Export the model so other files can use it
module.exports = models.YouTubeChannel || model('YouTubeChannel', youtubeSchema);
