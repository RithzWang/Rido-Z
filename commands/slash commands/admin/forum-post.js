const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forum-post')
        .setDescription('Create or edit a post in a forum channel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Restricts command to Admins
        
        // --- CREATE SUBCOMMAND ---
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a post in a forum channel.')
                .addChannelOption(option =>
                    option.setName('forum')
                        .setDescription('The forum channel to post in.')
                        .addChannelTypes(ChannelType.GuildForum)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('The title of the forum post.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The main text of the post.')
                        .setRequired(true))
                .addAttachmentOption(option =>
                    option.setName('attachment')
                        .setDescription('An optional image or file to attach.')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('hide_after')
                        .setDescription('Hide post after inactivity (Default: 1 Week)')
                        .setRequired(false)
                        .addChoices(
                            { name: '1 Hour', value: 60 },
                            { name: '24 Hours', value: 1440 },
                            { name: '3 Days', value: 4320 },
                            { name: '1 Week', value: 10080 }
                        ))
        )
        
        // --- EDIT SUBCOMMAND ---
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing forum post created by the bot.')
                .addChannelOption(option =>
                    option.setName('forum')
                        .setDescription('The forum channel where the post is located.')
                        .addChannelTypes(ChannelType.GuildForum)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('post_id')
                        .setDescription('The ID of the post (the thread ID).')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('The new title for the post.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The new text for the starter message.')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('hide_after')
                        .setDescription('Update when to hide post after inactivity')
                        .setRequired(false)
                        .addChoices(
                            { name: '1 Hour', value: 60 },
                            { name: '24 Hours', value: 1440 },
                            { name: '3 Days', value: 4320 },
                            { name: '1 Week', value: 10080 }
                        ))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Admin Permission Check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const forumChannel = interaction.options.getChannel('forum');

        try {
            if (subcommand === 'create') {
                const title = interaction.options.getString('title');
                const messageText = interaction.options.getString('message');
                const attachment = interaction.options.getAttachment('attachment');
                
                // Fetch the selected duration or default to 10080 minutes (1 week)
                const hideAfter = interaction.options.getInteger('hide_after') || 10080;

                const messagePayload = { content: messageText };
                if (attachment) {
                    messagePayload.files = [attachment.url];
                }

                const thread = await forumChannel.threads.create({
                    name: title,
                    message: messagePayload,
                    autoArchiveDuration: hideAfter,
                    reason: `Forum post created via command by ${interaction.user.tag}`
                });

                await interaction.editReply({ 
                    content: `<:yes:1528709597647470615> FORUM POST CREATED: <#${thread.id}>` 
                });
            } 
            
            else if (subcommand === 'edit') {
                const postId = interaction.options.getString('post_id');
                const newTitle = interaction.options.getString('title');
                const newMessage = interaction.options.getString('message');
                const hideAfter = interaction.options.getInteger('hide_after');

                // Check ensures they are actually trying to edit at least one property
                if (!newTitle && !newMessage && !hideAfter) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> YOU MUST PROVIDE A NEW TITLE, MESSAGE, OR HIDE DURATION' 
                    });
                }

                const thread = await forumChannel.threads.fetch(postId).catch(() => null);
                
                if (!thread) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> COULD NOT FIND THAT POST ID' 
                    });
                }

                // Batch thread settings updates (title and archive duration)
                const threadUpdates = {};
                if (newTitle) threadUpdates.name = newTitle;
                if (hideAfter) threadUpdates.autoArchiveDuration = hideAfter;

                if (Object.keys(threadUpdates).length > 0) {
                    await thread.edit(threadUpdates);
                }

                // Starter message edit needs to happen separately
                if (newMessage) {
                    const starterMessage = await thread.fetchStarterMessage();
                    if (starterMessage.author.id !== interaction.client.user.id) {
                        return interaction.editReply({ 
                            content: '<:no:1528709599740559415> I CAN ONLY EDIT MY OWN POSTS' 
                        });
                    }
                    await starterMessage.edit({ content: newMessage });
                }

                await interaction.editReply({ 
                    content: `<:yes:1528709597647470615> FORUM POST HAS BEEN **EDITED**: <#${thread.id}>` 
                });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `<:no:1528709599740559415> ERROR: \`${error.message}\`` 
            });
        }
    },
};
