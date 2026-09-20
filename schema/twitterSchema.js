const { Schema, model, models } = require('mongoose');

const twitterSchema = new Schema({
    twitterId: { type: String, required: true },
    twitterHandle: { type: String, required: true },
    discordChannelId: { type: String, required: true },
    lastTweetId: { type: String, default: null } 
});

module.exports = models.TwitterAccount || model('TwitterAccount', twitterSchema);
