const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete a specified number of messages')
        .setDMPermission(false)
        // ManageMessages is standard for purging, but you can change to Administrator if preferred
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        
        .addIntegerOption(opt => opt
            .setName('amount')
            .setDescription('Number of messages to delete (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addUserOption(opt => opt
            .setName('target_user')
            .setDescription('Only delete messages from this specific user (Optional)')
            .setRequired(false)
        )
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Where to purge? (Defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // 1. Check User Permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.editReply({ 
                content: '<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('target_user');
        let targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            targetChannel = await interaction.guild.channels.fetch(targetChannel.id);

            // Fetch the specified number of messages
            let fetchedMessages = await targetChannel.messages.fetch({ limit: amount });

            // If a specific user was provided, filter the messages to only include theirs
            if (targetUser) {
                fetchedMessages = fetchedMessages.filter(msg => msg.author.id === targetUser.id);
            }

            // bulkDelete with `true` as the second argument ignores messages older than 14 days,
            // preventing the bot from throwing a Discord API error.
            const deletedMessages = await targetChannel.bulkDelete(fetchedMessages, true);

            // Construct the success message
            let successContent = `<:yes:1528709597647470615> DELETED **${deletedMessages.size}** MESSAGE(S)`;
            if (targetUser) successContent += ` FROM ${targetUser}`;
            if (interaction.options.getChannel('channel')) successContent += ` IN ${targetChannel}`;

            await interaction.editReply({ 
                content: successContent 
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `<:no:1528709599740559415> ERROR: \`${error.message}\`` 
            });
        }
    },
};
