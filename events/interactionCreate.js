const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'interactionCreate', // The exact name of the Discord event
    once: false,
    async execute(interaction, client) {
        // 1. We only want to handle slash commands right now
        if (!interaction.isChatInputCommand()) return;

        // 2. Find the command in the bot's memory by its name
        const command = client.slashCommands.get(interaction.commandName);

        // If the command doesn't exist, just ignore it
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        // 3. Try to execute the command!
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            
            // 4. Fallback error message if something crashes
            const errorMessage = { 
                content: 'There was an error while executing this command!', 
                flags: MessageFlags.Ephemeral 
            };

            // Check if we already deferred or replied so we don't crash the bot trying to reply twice
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};
