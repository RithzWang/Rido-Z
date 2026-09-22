const { Schema, model } = require('mongoose');

const userRoleSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    roleId: { type: String, required: true },
    style: { type: String, enum: ['solid', 'gradient'], default: 'solid' },
    primaryColor: { type: String, default: null },
    secondaryColor: { type: String, default: null }
});

module.exports = model('CustomRoleUser', userRoleSchema);
