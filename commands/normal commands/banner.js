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
    name: 'banner',
    aliases: ['bn'],
    description: 'Shows banner',

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

            await message.channel.sendTyping();

            // 2. Fetch Banner
            let targetMember = null;
            try { targetMember = await message.guild.members.fetch(targetUser.id); } catch (err) { targetMember = null; }

            const fetchedUser = await message.client.users.fetch(targetUser.id, { force: true });
            const globalBanner = fetchedUser.bannerURL({ size: 4096, forceStatic: false });
            const displayBanner = targetMember ? targetMember.bannerURL({ size: 4096, forceStatic: false }) : null;

            if (!globalBanner && !displayBanner) {
                return message.reply({ 
                    content: `<:no:1528709599740559415> <@${targetUser.id}> HAS NO BANNER`, 
                    flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
                    allowedMentions: { parse: [], repliedUser: false }
                });
            }

            const downloadBanner = async (url) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            };

            // 3. Builder
            const buildMessagePayload = async (isShowingGlobal, disableToggle = false) => {
                const currentImageUrl = isShowingGlobal ? globalBanner : displayBanner;
                const titleText = isShowingGlobal ? `## <:image:1551901191124947026> Profile Banner` : `## <:image:1551901191124947026> Per-server Profile Banner`;
                
                // 👇 UPDATED: Added `targetUser.username` in backticks
                const bodyText = isShowingGlobal 
                    ? `Banner for <@${targetUser.id}> \`${targetUser.username}\`` 
                    : `Per-server Banner for <@${targetUser.id}> \`${targetUser.username}\``;

                const isGif = currentImageUrl.includes('.gif');
                const fileName = isGif ? 'banner.gif' : 'banner.png';

                const bannerBuffer = await downloadBanner(currentImageUrl);
                const attachment = new AttachmentBuilder(bannerBuffer, { name: fileName });

                // Toggle Button
                const toggleButton = new ButtonBuilder()
                    .setCustomId('toggle_bn_msg')
                    .setStyle(ButtonStyle.Secondary);

                if (isShowingGlobal) {
                    toggleButton.setLabel('Show Per-server Banner');
                    if (!displayBanner) toggleButton.setDisabled(true).setLabel('No Per-server Banner');
                } else {
                    toggleButton.setLabel('Show Global Banner');
                    if (!globalBanner) toggleButton.setDisabled(true).setLabel('No Global Banner');
                }
                if (disableToggle) toggleButton.setDisabled(true);

                // Link Button
                const linkButton = new ButtonBuilder()
                    .setLabel('Link')
                    .setStyle(ButtonStyle.Link)
                    .setURL(currentImageUrl);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titleText}\n${bodyText}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`)
                    ))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                    .addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton, linkButton));

                return { components: [container], files: [attachment] };
            };

            let isGlobalMode = !!globalBanner;
            const initialPayload = await buildMessagePayload(isGlobalMode);

            // 4. Send Reply
            const sentMessage = await message.reply({ 
                components: initialPayload.components, 
                files: initialPayload.files,
                flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false } 
            });

            if (!(globalBanner && displayBanner)) return;

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
