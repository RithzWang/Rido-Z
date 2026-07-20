const mongoose = require('mongoose');

const hypeSquadSchema = new mongoose.Schema({
    guildId: String,
    channelId: String,
    messageId: String
});

module.exports = mongoose.model('HypeSquadMessage', hypeSquadSchema);
