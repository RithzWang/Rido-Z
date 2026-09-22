const { Schema, model } = require('mongoose');

const userRoleSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    roleId: { type: String, required: true }
});

module.exports = model('CustomRoleUser', userRoleSchema);
