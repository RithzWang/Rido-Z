const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');

module.exports = {
    guildOnly: true,

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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // 1. Check User Permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '-# <:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        let targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        
        const content = interaction.options.getString('content');
        const shouldMention = interaction.options.getBoolean('mention') ?? true; 
        
        const imageAttachment = interaction.options.getAttachment('image_attachment');
        const imageLink = interaction.options.getString('image_link');
        const image = imageAttachment ? imageAttachment.url : (imageLink || null);

        // --- PAYLOAD CONSTRUCTION ---
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
                await interaction.editReply({ 
                    content: `-# <:yes:1528709597647470615> MESSAGE SENT TO ${targetChannel}` 
                });
            } 
            else if (subcommand === 'edit') {
                const messageId = interaction.options.getString('message_id');
                const messageToEdit = await targetChannel.messages.fetch(messageId);

                if (messageToEdit.author.id !== interaction.client.user.id) {
                    return interaction.editReply({ 
                        content: `-# <:no:1528709599740559415> I CAN ONLY EDIT MY OWN MESSAGES` 
                    });
                }

                await messageToEdit.edit(payload);
                await interaction.editReply({ 
                    content: `-# <:yes:1528709597647470615> MESSAGE HAS BEEN **EDITED**` 
                });
            }
            else if (subcommand === 'reply') {
                const messageId = interaction.options.getString('message_id');
                const targetMessage = await targetChannel.messages.fetch(messageId);
                await targetMessage.reply(payload);
                await interaction.editReply({ 
                    content: `-# <:yes:1528709597647470615> REPLIED TO THE MESSAGE` 
                });
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
                await interaction.editReply({ 
                    content: `-# <:yes:1528709597647470615> CONTAINER SENT TO ${targetChannel}` 
                });
            }
            else if (subcommand === 'react') {
                const messageId = interaction.options.getString('message_id');
                const normalReactInput = interaction.options.getString('normal_react');
                const superReactInput = interaction.options.getString('super_react');
                const targetMessage = await targetChannel.messages.fetch(messageId);

                let successCount = 0;
                let responseMsg = '';

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
                    responseMsg += `-# <:yes:1528709597647470615> ADDED **${successCount}** NORMAL REACTION(S)\n`;
                }

                if (superReactInput) {
                    responseMsg += `-# <:warn:1528710101324529775> SKIPPED SUPER REACTIONS (**BOTS CANNOT USE THEM**)`;
                }

                await interaction.editReply({ content: responseMsg.trim() });
            }
            else if (subcommand === 'pin') {
                const messageId = interaction.options.getString('message_id');
                const targetMessage = await targetChannel.messages.fetch(messageId);
                await targetMessage.pin();
                await interaction.editReply({ 
                    content: `-# <:yes:1528709597647470615> MESSAGE **PINNED** SUCCESSFULLY` 
                });
            }
            else if (subcommand === 'sticker') {
                const stickerId = interaction.options.getString('sticker_id');
                
                await targetChannel.send({ stickers: [stickerId] });
                await interaction.editReply({ 
                    content: `-# <:yes:1528709597647470615> STICKER SENT TO ${targetChannel}` 
                });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `-# <:no:1528709599740559415> ERROR: \`${error.message}\`` 
            });
        }
    },
};
