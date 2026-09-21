const { 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    MessageFlags,
    TextDisplayBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');

// Helper to easily add the same options to standard and container create commands
const setupCreateOptions = (subcommand) => {
    subcommand
        .addChannelOption(option => option.setName('forum').setDescription('The forum channel to post in.').addChannelTypes(ChannelType.GuildForum).setRequired(true))
        .addStringOption(option => option.setName('title').setDescription('The title of the forum post.').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('The main text of the post.').setRequired(false))
        .addIntegerOption(option => option.setName('hide_after').setDescription('Hide post after inactivity (Default: 1 Week)').setRequired(false).addChoices(
            { name: '1 Hour', value: 60 },
            { name: '24 Hours', value: 1440 },
            { name: '3 Days', value: 4320 },
            { name: '1 Week', value: 10080 }
        ));

    // Add 10 attachment options
    for (let i = 1; i <= 10; i++) {
        subcommand.addAttachmentOption(option => option.setName(`attachment_${i}`).setDescription(`Optional image/file attachment ${i}.`).setRequired(false));
    }
    return subcommand;
};

// Helper to easily add the same options to standard and container edit commands
const setupEditOptions = (subcommand) => {
    subcommand
        .addChannelOption(option => option.setName('forum').setDescription('The forum channel where the post is located.').addChannelTypes(ChannelType.GuildForum).setRequired(true))
        .addStringOption(option => option.setName('post_id').setDescription('The ID of the post (the thread ID).').setRequired(true))
        .addStringOption(option => option.setName('title').setDescription('The new title for the post.').setRequired(false))
        .addStringOption(option => option.setName('message').setDescription('The new text for the starter message.').setRequired(false))
        .addIntegerOption(option => option.setName('hide_after').setDescription('Update when to hide post after inactivity').setRequired(false).addChoices(
            { name: '1 Hour', value: 60 },
            { name: '24 Hours', value: 1440 },
            { name: '3 Days', value: 4320 },
            { name: '1 Week', value: 10080 }
        ));

    // Add 10 attachment options
    for (let i = 1; i <= 10; i++) {
        subcommand.addAttachmentOption(option => option.setName(`attachment_${i}`).setDescription(`Update optional attachment ${i}.`).setRequired(false));
    }
    return subcommand;
};

// Helper to build the components array for Container subcommands
const buildContainerComponents = (messageText, attachments) => {
    const container = new ContainerBuilder();

    if (messageText) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(messageText)
        );
    }

    if (attachments.length > 0) {
        const gallery = new MediaGalleryBuilder();
        gallery.addItems(
            ...attachments.map(att => new MediaGalleryItemBuilder().setURL(att.url))
        );
        container.addMediaGalleryComponents(gallery);
    }

    return [container];
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forum-post')
        .setDescription('Create or edit a post in a forum channel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => setupCreateOptions(sub.setName('create').setDescription('Create a standard post in a forum channel.')))
        .addSubcommand(sub => setupEditOptions(sub.setName('edit').setDescription('Edit an existing standard forum post.')))
        .addSubcommand(sub => setupCreateOptions(sub.setName('create-container').setDescription('Create a container-based post in a forum channel.')))
        .addSubcommand(sub => setupEditOptions(sub.setName('edit-container').setDescription('Edit a container-based forum post.'))),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const forumChannel = interaction.options.getChannel('forum');

        // Extract Attachments
        const attachments = [];
        for (let i = 1; i <= 10; i++) {
            const att = interaction.options.getAttachment(`attachment_${i}`);
            if (att) attachments.push(att);
        }

        try {
            // ==================== CREATE & CREATE-CONTAINER ====================
            if (subcommand === 'create' || subcommand === 'create-container') {
                const title = interaction.options.getString('title');
                const messageText = interaction.options.getString('message');
                const hideAfter = interaction.options.getInteger('hide_after') || 10080;

                if (!messageText && attachments.length === 0) {
                    return interaction.editReply({ content: '<:no:1528709599740559415> YOU MUST PROVIDE EITHER A MESSAGE OR AT LEAST ONE ATTACHMENT.' });
                }

                const messagePayload = {};

                if (subcommand === 'create-container') {
                    messagePayload.components = buildContainerComponents(messageText, attachments);
                } else {
                    if (messageText) messagePayload.content = messageText;
                    if (attachments.length > 0) messagePayload.files = attachments.map(a => a.url);
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
            
            // ==================== EDIT & EDIT-CONTAINER ====================
            else if (subcommand === 'edit' || subcommand === 'edit-container') {
                const postId = interaction.options.getString('post_id');
                const newTitle = interaction.options.getString('title');
                const newMessage = interaction.options.getString('message');
                const hideAfter = interaction.options.getInteger('hide_after');

                if (!newTitle && !newMessage && !hideAfter && attachments.length === 0) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> YOU MUST PROVIDE A NEW TITLE, MESSAGE, DURATION, OR ATTACHMENTS TO EDIT.' 
                    });
                }

                const thread = await forumChannel.threads.fetch(postId).catch(() => null);
                
                if (!thread) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> COULD NOT FIND THAT POST ID' 
                    });
                }

                // Edit Thread metadata
                const threadUpdates = {};
                if (newTitle) threadUpdates.name = newTitle;
                if (hideAfter) threadUpdates.autoArchiveDuration = hideAfter;

                if (Object.keys(threadUpdates).length > 0) {
                    await thread.edit(threadUpdates);
                }

                // Edit Starter Message content
                if (newMessage || attachments.length > 0) {
                    const starterMessage = await thread.fetchStarterMessage();
                    if (starterMessage.author.id !== interaction.client.user.id) {
                        return interaction.editReply({ 
                            content: '<:no:1528709599740559415> I CAN ONLY EDIT MY OWN POSTS' 
                        });
                    }

                    const messagePayload = {};

                    if (subcommand === 'edit-container') {
                        // For containers, passing components will overwrite the old ones
                        messagePayload.components = buildContainerComponents(
                            newMessage || starterMessage.content, 
                            attachments
                        );
                    } else {
                        if (newMessage) messagePayload.content = newMessage;
                        if (attachments.length > 0) messagePayload.files = attachments.map(a => a.url);
                    }

                    await starterMessage.edit(messagePayload);
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
