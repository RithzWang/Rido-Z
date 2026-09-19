const { 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags, 
    ComponentType, 
    SeparatorSpacingSize,
    TextDisplayBuilder,      
    SeparatorBuilder,        
    MediaGalleryBuilder,     
    MediaGalleryItemBuilder, 
    ActionRowBuilder,
    AttachmentBuilder
} = require('discord.js');

module.exports = {
    name: 'avatar',
    aliases: ['av'],
    description: 'Shows avatar',

    async execute(message, args) {
        const allowedGuilds = ['878565984108150824']; 
        
        if (!message.guild || !allowedGuilds.includes(message.guild.id)) {
            return; 
        }

        try {
            // 1. Resolve User
            let targetUser = message.mentions.users.first();
            if (!targetUser && args[0]) {
                try { targetUser = await message.client.users.fetch(args[0]); } catch (e) { targetUser = null; }
            }
            if (!targetUser && !args[0]) targetUser = message.author;
            if (!targetUser) return;

            // 2. Fetch Logic
            let targetMember = null;
            try { targetMember = await message.guild.members.fetch(targetUser.id); } catch (err) { targetMember = null; }

            // Keep forceStatic: false so GIFs return as .gif
            const globalAvatar = targetUser.displayAvatarURL({ size: 1024, forceStatic: false });
            const displayAvatar = targetMember ? targetMember.displayAvatarURL({ size: 1024, forceStatic: false }) : globalAvatar;
            const hasServerAvatar = globalAvatar !== displayAvatar;

            // Helper to download the raw binary data (works for GIF, PNG, WebP, etc.)
            const downloadAvatar = async (url) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            };

            // 3. Builder
            const buildMessagePayload = async (isShowingGlobal, disableToggle = false) => {
                const currentImageUrl = isShowingGlobal ? globalAvatar : displayAvatar;
                const titleText = isShowingGlobal ? `## Avatar Picture` : `## Per-server Avatar Picture`;
                const bodyText = isShowingGlobal ? `Avatar for <@${targetUser.id}>` : `Per-server Avatar for <@${targetUser.id}>`;

                // Detect file extension dynamically to preserve GIF animations
                const isGif = currentImageUrl.includes('.gif');
                const fileName = isGif ? 'avatar.gif' : 'avatar.png';

                // Download the raw avatar and wrap it in an attachment
                const avatarBuffer = await downloadAvatar(currentImageUrl);
                const attachment = new AttachmentBuilder(avatarBuffer, { name: fileName });

                const toggleButton = new ButtonBuilder()
                    .setCustomId('toggle_av_msg')
                    .setStyle(ButtonStyle.Secondary);

                if (isShowingGlobal) {
                    toggleButton.setLabel('Show Per-server Avatar');
                    if (!hasServerAvatar) toggleButton.setDisabled(true).setLabel('No Per-server Avatar');
                } else {
                    toggleButton.setLabel('Show Global Avatar');
                }
                if (disableToggle) toggleButton.setDisabled(true);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titleText}\n${bodyText}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                    // Reference the newly attached file directly
                    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                    .addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton));

                return { components: [container], files: [attachment] };
            };

            let isGlobalMode = true;
            
            // Build the initial payload and download avatar
            const initialPayload = await buildMessagePayload(true);

            // 4. Send Reply
            const sentMessage = await message.reply({ 
                components: initialPayload.components, 
                files: initialPayload.files,
                flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false } 
            });

            if (!hasServerAvatar) return;

            // 5. Collector
            const collector = sentMessage.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                idle: 60_000 
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ 
                        content: `<:no:1528709599740559415> ONLY <@${message.author.id}> CAN TOGGLE THIS BUTTON`, 
                        flags: [MessageFlags.Ephemeral],
                        allowedMentions: { parse: [] }
                    });
                }
                
                await i.deferUpdate(); 
                isGlobalMode = !isGlobalMode;
                
                const updatePayload = await buildMessagePayload(isGlobalMode);
                
                await i.editReply({ 
                    components: updatePayload.components, 
                    files: updatePayload.files,
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                });
            });

            collector.on('end', async () => {
                try {
                    const endPayload = await buildMessagePayload(isGlobalMode, true);
                    await sentMessage.edit({ 
                        components: endPayload.components, 
                        flags: [MessageFlags.IsComponentsV2],
                        allowedMentions: { parse: [] }
                    });
                } catch (e) {}
            });

        } catch (error) {
            console.error(error);
        }
    }
};
