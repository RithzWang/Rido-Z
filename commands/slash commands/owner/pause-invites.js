const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    // guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('pause-invites')
        .setDescription('Manage the server invite pause state')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // --- ENABLE SUBCOMMAND ---
        .addSubcommand(sub => sub
            .setName('enable')
            .setDescription('Permanently pause invites')
        )
        
        // --- DISABLE SUBCOMMAND ---
        .addSubcommand(sub => sub
            .setName('disable')
            .setDescription('Unpause invites')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();
        const currentFeatures = interaction.guild.features;
        let newFeatures = [...currentFeatures];

        try {
            if (subcommand === 'enable') {
                if (currentFeatures.includes('INVITES_DISABLED')) {
                    return interaction.editReply({ content: '⚠️ Invites are already paused.' });
                }
                
                // Add the feature (Same as your first bash script)
                newFeatures.push('INVITES_DISABLED');
                await interaction.guild.edit({ features: newFeatures });
                
                await interaction.editReply({ content: '⛔ Server invites are now **paused**.' });
            
            } 
            else if (subcommand === 'disable') {
                if (!currentFeatures.includes('INVITES_DISABLED')) {
                    return interaction.editReply({ content: '⚠️ Invites are not currently paused.' });
                }
                
                // Remove the feature (Same as your second bash script)
                newFeatures = newFeatures.filter(feature => feature !== 'INVITES_DISABLED');
                await interaction.guild.edit({ features: newFeatures });
                
                await interaction.editReply({ content: '✅ Server invites are now **unpaused**.' });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
};
