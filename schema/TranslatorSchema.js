const mongoose = require('mongoose');

const translatorSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    language: { type: String, required: true, enum: ['english', 'spanish', 'arabic', 'thai', 'bilingual'] }
});

module.exports = mongoose.model('Translator', translatorSchema);
