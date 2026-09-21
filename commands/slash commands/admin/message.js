const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    MessageFlags, 
    ContainerBuilder, 
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');

// Helper function to easily apply up to 10 attachments and shared options
const setupMessageOptions = (subcommand, type = 'create') => {
    // If it's edit or reply, we require a message ID first
    if (type === 'edit' || type === 'reply') {
        subcommand.addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true));
    }
    
    subcommand
        .addStringOption(opt => opt.setName('content').setDescription('Content of the message').setRequired(false))
        .addBooleanOption(opt => opt.setName('mention').setDescription('Mention users? (Defaults to True)').setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Target Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addStringOption(opt => opt.setName('image_link').setDescription('Optional Image Link (URL)').setRequired(false));

    // Add 10 attachment options
    for (let i = 1; i <= 10; i++) {
        subcommand.addAttachmentOption(opt => opt.setName(`attachment_${i}`).setDescription(`Upload image/file ${i}`).setRequired(false));
    }
    
    return subcommand;
};

// Helper for building V2 Components with optional text and media
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
            ...attachments.map(url => new MediaGalleryItemBuilder().setURL(url))
        );
        container.addMediaGalleryComponents(gallery);
    }

    return [container];
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('msg')
        .setDescription('Message commands')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // --- MESSAGE SUBCOMMANDS (Using Helper) ---
        .addSubcommand(sub => setupMessageOptions(sub.setName('create').setDescription('Create a message'), 'create'))
        .addSubcommand(sub => setupMessageOptions(sub.setName('edit').setDescription('Edit a message'), 'edit'))
        .addSubcommand(sub => setupMessageOptions(sub.setName('reply').setDescription('Reply to a message'), 'reply'))
        .addSubcommand(sub => setupMessageOptions(sub.setName('container').setDescription('Send a message in a container'), 'create'))

        // --- REACT SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('react').setDescription('Add reactions to a message')
            .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
            .addStringOption(opt => opt.setName('emoji').setDescription('Standard or custom emojis separated by spaces').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel the message is in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )

        // --- PIN SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('pin').setDescription('Pin a message')
            .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel the message is in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )
        
        // --- STICKER SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('sticker').setDescription('Send a sticker')
            .addStringOption(opt => opt.setName('sticker_id').setDescription('The ID of the sticker to send').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Where to send?').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Admin Check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        let targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        
        try {
            targetChannel = await interaction.guild.channels.fetch(targetChannel.id);

            // ==================== CREATE / EDIT / REPLY / CONTAINER ====================
            if (['create', 'edit', 'reply', 'container'].includes(subcommand)) {
                const content = interaction.options.getString('content');
                const shouldMention = interaction.options.getBoolean('mention') ?? true; 
                const imageLink = interaction.options.getString('image_link');

                // Extract all attachments + image link into an array of URLs
                const attachments = [];
                for (let i = 1; i <= 10; i++) {
                    const att = interaction.options.getAttachment(`attachment_${i}`);
                    if (att) attachments.push(att.url);
                }
                if (imageLink) attachments.push(imageLink);

                // Prevent sending completely empty messages
                if (!content && attachments.length === 0) {
                    return interaction.editReply({ 
                        content: '<:no:1528709599740559415> YOU MUST PROVIDE EITHER CONTENT OR AT LEAST ONE ATTACHMENT.' 
                    });
                }

                const allowedMentions = shouldMention ? { parse: ['users', 'roles', 'everyone'] } : { parse: [] };
                let payload = {};

                if (subcommand === 'container') {
                    payload = {
                        components: buildContainerComponents(content, attachments),
                        allowedMentions: allowedMentions,
                        flags: MessageFlags.IsComponentsV2 
                    };
                } else {
                    payload = { allowedMentions };
                    if (content) payload.content = content;
                    if (attachments.length > 0) payload.files = attachments;
                }

                // Execute based on specific subcommand
                if (subcommand === 'create') {
                    await targetChannel.send(payload);
                    await interaction.editReply({ content: `<:yes:1528709597647470615> MESSAGE SENT TO ${targetChannel}` });
                } 
                else if (subcommand === 'edit') {
                    const messageId = interaction.options.getString('message_id');
                    const messageToEdit = await targetChannel.messages.fetch(messageId);

                    if (messageToEdit.author.id !== interaction.client.user.id) {
                        return interaction.editReply({ content: `<:no:1528709599740559415> I CAN ONLY EDIT MY OWN MESSAGES` });
                    }

                    await messageToEdit.edit(payload);
                    await interaction.editReply({ content: `<:yes:1528709597647470615> MESSAGE HAS BEEN **EDITED**` });
                }
                else if (subcommand === 'reply') {
                    const messageId = interaction.options.getString('message_id');
                    const targetMessage = await targetChannel.messages.fetch(messageId);
                    
                    await targetMessage.reply(payload);
                    await interaction.editReply({ content: `<:yes:1528709597647470615> REPLIED TO THE MESSAGE` });
                }
                else if (subcommand === 'container') {
                    await targetChannel.send(payload);
                    await interaction.editReply({ content: `<:yes:1528709597647470615> CONTAINER SENT TO ${targetChannel}` });
                }
            }
            
            // ==================== REACT ====================
            else if (subcommand === 'react') {
                const messageId = interaction.options.getString('message_id');
                const emojiInput = interaction.options.getString('emoji');
                const targetMessage = await targetChannel.messages.fetch(messageId);

                let successCount = 0;
                const emojisToReact = emojiInput.split(/\s+/);
                
                for (const rawEmoji of emojisToReact) {
                    if (!rawEmoji) continue;
                    const customMatch = rawEmoji.match(/<a?:.+:(\d+)>/);
                    const resolvedEmoji = customMatch ? customMatch[1] : rawEmoji;

                    try {
                        await targetMessage.react(resolvedEmoji);
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to react with ${resolvedEmoji}`);
                    }
                }
                
                await interaction.editReply({ content: `<:yes:1528709597647470615> ADDED **${successCount}** REACTION(S)` });
            }
            
            // ==================== PIN ====================
            else if (subcommand === 'pin') {
                const messageId = interaction.options.getString('message_id');
                const targetMessage = await targetChannel.messages.fetch(messageId);
                
                await targetMessage.pin();
                await interaction.editReply({ content: `<:yes:1528709597647470615> MESSAGE **PINNED** SUCCESSFULLY` });
            }
            
            // ==================== STICKER ====================
            else if (subcommand === 'sticker') {
                const stickerId = interaction.options.getString('sticker_id');
                
                await targetChannel.send({ stickers: [stickerId] });
                await interaction.editReply({ content: `<:yes:1528709597647470615> STICKER SENT TO ${targetChannel}` });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `<:no:1528709599740559415> ERROR: \`${error.message}\`` 
            });
        }
    },
};
