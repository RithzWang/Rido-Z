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
                .setDescription('Create a new post in a forum channel.')
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
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Admin Permission Check (matching your reference code)
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

                const messagePayload = { content: messageText };
                if (attachment) {
                    messagePayload.files = [attachment.url];
                }

                const thread = await forumChannel.threads.create({
                    name: title,
                    message: messagePayload,
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

                if (!newTitle && !newMessage) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> YOU MUST PROVIDE A NEW TITLE OR MESSAGE' 
                    });
                }

                const thread = await forumChannel.threads.fetch(postId).catch(() => null);
                
                if (!thread) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> COULD NOT FIND THAT POST ID' 
                    });
                }

                if (newTitle) {
                    await thread.edit({ name: newTitle });
                }

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
