const { Schema, model } = require('mongoose');

const configSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    panelChannelId: { type: String, default: null },
    panelMessageId: { type: String, default: null },
    gradientEnabled: { type: Boolean, default: true },
    globalDisabled: { type: Boolean, default: false },
    bypassedRoles: { type: [String], default: [] },
    bypassedUsers: { type: [String], default: [] },
});

module.exports = model('CustomRoleConfig', configSchema);
