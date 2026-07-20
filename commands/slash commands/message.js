const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Manage bot messages')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // --- SEND SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('send').setDescription('Create a message')
            .addStringOption(opt => opt.setName('content').setDescription('Content').setRequired(true))
            .addBooleanOption(opt => opt.setName('mention').setDescription('Mention users? (Defaults to True)').setRequired(false))
            .addChannelOption(opt => opt.setName('channel').setDescription('Where to send?').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addAttachmentOption(opt => opt.setName('image_attachment').setDescription('Upload an image file'))
            .addStringOption(opt => opt.setName('image_link').setDescription('Or paste an Image Link (URL)'))
        )
        
        // --- EDIT SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('edit').setDescription('Edit a message')
            .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
            .addStringOption(opt => opt.setName('content').setDescription('New content').setRequired(true))
            .addBooleanOption(opt => opt.setName('mention').setDescription('Mention users? (Defaults to True)').setRequired(false))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addAttachmentOption(opt => opt.setName('image_attachment').setDescription('Upload a new image file'))
            .addStringOption(opt => opt.setName('image_link').setDescription('Or paste a new Image Link (URL)'))
        )

        // --- REPLY SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('reply').setDescription('Reply directly to a specific message')
            .addStringOption(opt => opt.setName('message_id').setDescription('The ID of the message to reply to').setRequired(true))
            .addStringOption(opt => opt.setName('content').setDescription('Content').setRequired(true))
            .addBooleanOption(opt => opt.setName('mention').setDescription('Mention users? (Defaults to True)').setRequired(false))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel the message is in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addAttachmentOption(opt => opt.setName('image_attachment').setDescription('Upload an image file'))
            .addStringOption(opt => opt.setName('image_link').setDescription('Or paste an Image Link (URL)'))
        )

        // --- CONTAINER SUBCOMMAND (V2 COMPONENTS) ---
        .addSubcommand(sub => sub.setName('container').setDescription('Send a message in a V2 container')
            .addStringOption(opt => opt.setName('content').setDescription('Content').setRequired(true))
            .addBooleanOption(opt => opt.setName('mention').setDescription('Mention users? (Defaults to True)').setRequired(false))
            .addChannelOption(opt => opt.setName('channel').setDescription('Where to send?').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )

        // --- REACT SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('react').setDescription('Add reactions to a message')
            .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
            .addStringOption(opt => opt.setName('normal_react').setDescription('Standard or custom emojis separated by spaces').setRequired(true))
            .addStringOption(opt => opt.setName('super_react').setDescription('Super emojis (Note: Bots cannot send these)').setRequired(false))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel the message is in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )

        // --- PIN SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('pin').setDescription('Pin a message in the channel')
            .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel the message is in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )
        
        // --- STICKER SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('sticker').setDescription('Send a sticker to the channel')
            .addStringOption(opt => opt.setName('sticker_id').setDescription('The ID of the sticker to send').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Where to send?').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        let targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        
        const content = interaction.options.getString('content');
        const shouldMention = interaction.options.getBoolean('mention') ?? true; 
        
        // Handle both attachment and link options
        const imageAttachment = interaction.options.getAttachment('image_attachment');
        const imageLink = interaction.options.getString('image_link');
        
        // Prefer the attachment if provided, otherwise fallback to the link, otherwise null
        const image = imageAttachment ? imageAttachment.url : (imageLink || null);

        // --- IMMEDIATE EXECUTION LOGIC ---
        let payload = {};
        if (content !== null) {
            const allowedMentions = shouldMention ? { parse: ['users', 'roles', 'everyone'] } : { parse: [] };
            payload = { content: content, allowedMentions: allowedMentions };
            if (image) payload.files = [image];
        }

        try {
            targetChannel = await interaction.guild.channels.fetch(targetChannel.id);

            if (subcommand === 'send') {
                await targetChannel.send(payload);
                await interaction.reply({ content: `<:yes:1297814648417943565> Sent to ${targetChannel}.`, flags: MessageFlags.Ephemeral });
            } 
            else if (subcommand === 'edit') {
                const messageId = interaction.options.getString('message_id');
                const messageToEdit = await targetChannel.messages.fetch(messageId);

                if (messageToEdit.author.id !== interaction.client.user.id) {
                    return interaction.reply({ content: `❌ I can only edit my own messages.`, flags: MessageFlags.Ephemeral });
                }

                await messageToEdit.edit(payload);
                await interaction.reply({ content: `<:yes:1297814648417943565> Message edited.`, flags: MessageFlags.Ephemeral });
            }
            else if (subcommand === 'reply') {
                const messageId = interaction.options.getString('message_id');
                const targetMessage = await targetChannel.messages.fetch(messageId);
                await targetMessage.reply(payload);
                await interaction.reply({ content: `<:yes:1297814648417943565> Replied to the message.`, flags: MessageFlags.Ephemeral });
            }
            else if (subcommand === 'container') {
                const components = [
                    new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(content)
                        ),
                ];

                const containerPayload = { 
                    components: components, 
                    allowedMentions: payload.allowedMentions,
                    flags: MessageFlags.IsComponentsV2 
                };

                await targetChannel.send(containerPayload);
                await interaction.reply({ content: `<:yes:1297814648417943565> Container sent to ${targetChannel}.`, flags: MessageFlags.Ephemeral });
            }
            else if (subcommand === 'react') {
                const messageId = interaction.options.getString('message_id');
                const normalReactInput = interaction.options.getString('normal_react');
                const superReactInput = interaction.options.getString('super_react');
                const targetMessage = await targetChannel.messages.fetch(messageId);

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                let successCount = 0;
                let responseMsg = '';

                // Handle the normal reactions
                if (normalReactInput) {
                    const emojisToReact = normalReactInput.split(/\s+/);
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
                    responseMsg += `<:yes:1297814648417943565> Successfully added ${successCount} normal reaction(s).\n`;
                }

                // Acknowledge the super reactions but inform the user they were skipped
                if (superReactInput) {
                    responseMsg += `⚠️ **Note:** Skipped super reactions. Bots do not have Nitro and cannot send Super Reactions via the API.`;
                }

                await interaction.editReply({ content: responseMsg.trim() });
            }
            else if (subcommand === 'pin') {
                const messageId = interaction.options.getString('message_id');
                const targetMessage = await targetChannel.messages.fetch(messageId);
                await targetMessage.pin();
                await interaction.reply({ content: `<:yes:1297814648417943565> Message pinned successfully.`, flags: MessageFlags.Ephemeral });
            }
            else if (subcommand === 'sticker') {
                const stickerId = interaction.options.getString('sticker_id');
                
                await targetChannel.send({ stickers: [stickerId] });
                await interaction.reply({ content: `<:yes:1297814648417943565> Sticker sent to ${targetChannel}.`, flags: MessageFlags.Ephemeral });
            }

        } catch (error) {
            console.error(error);
            if (interaction.deferred) {
                await interaction.editReply({ content: `<:no:1297814819105144862> Error: ${error.message}` });
            } else {
                await interaction.reply({ content: `<:no:1297814819105144862> Error: ${error.message}`, flags: MessageFlags.Ephemeral });
            }
        }
    },
};
