const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hypesquad')
        .setDescription('Manage your HypeSquad house (EDUCATIONAL / TOS WARNING)')
        .addSubcommand(sub => sub
            .setName('join')
            .setDescription('Join or change your HypeSquad house')
            .addIntegerOption(opt => opt
                .setName('house')
                .setDescription('Choose a house')
                .setRequired(true)
                .addChoices(
                    { name: 'Bravery', value: 1 },
                    { name: 'Brilliance', value: 2 },
                    { name: 'Balance', value: 3 }
                )
            )
            .addStringOption(opt => opt
                .setName('token')
                .setDescription('Your Discord User Token (DANGEROUS)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('leave')
            .setDescription('Leave HypeSquad')
            .addStringOption(opt => opt
                .setName('token')
                .setDescription('Your Discord User Token (DANGEROUS)')
                .setRequired(true)
            )
        ),

    async execute(interaction) {
        // ALWAYS defer as ephemeral when handling sensitive data like tokens
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();
        const token = interaction.options.getString('token');

        try {
            if (subcommand === 'join') {
                const houseId = interaction.options.getInteger('house');
                
                const response = await fetch('https://discord.com/api/v10/hypesquad/online', {
                    method: 'POST',
                    headers: {
                        // Notice there is no "Bot " prefix here. It uses the raw user token.
                        'Authorization': token, 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ house_id: houseId })
                });

                if (response.ok || response.status === 204) {
                    await interaction.editReply({ content: '✅ Successfully updated your HypeSquad house!' });
                } else {
                    const errorData = await response.text();
                    await interaction.editReply({ content: `❌ API Failed: \`${response.status} ${response.statusText}\`\n\`\`\`json\n${errorData}\n\`\`\`` });
                }
            } 
            else if (subcommand === 'leave') {
                const response = await fetch('https://discord.com/api/v10/hypesquad/online', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': token
                    }
                });

                if (response.ok || response.status === 204) {
                    await interaction.editReply({ content: '✅ Successfully left HypeSquad.' });
                } else {
                    const errorData = await response.text();
                    await interaction.editReply({ content: `❌ API Failed: \`${response.status} ${response.statusText}\`\n\`\`\`json\n${errorData}\n\`\`\`` });
                }
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Code Error: ${error.message}` });
        }
    }
};
