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
    ActionRowBuilder 
} = require('discord.js');

module.exports = {
    name: 'banner',
    aliases: ['bn'],
    description: 'Shows user banner',
   // channels: ['1456197056510165026', '1456197056510165029', '1456197056988319870'],

    async execute(message, args) {
        try {
            // 1. Resolve User
            let targetUser = message.mentions.users.first();
            if (!targetUser && args[0]) {
                try { targetUser = await message.client.users.fetch(args[0]); } catch (e) { targetUser = null; }
            }
            if (!targetUser && !args[0]) targetUser = message.author;

            // 👇 CHANGE: If user not found, do nothing (return silently)
            if (!targetUser) return;

            // 2. Fetch Banner
            let targetMember = null;
            try { targetMember = await message.guild.members.fetch(targetUser.id); } catch (err) { targetMember = null; }

            const fetchedUser = await message.client.users.fetch(targetUser.id, { force: true });
            const globalBanner = fetchedUser.bannerURL({ size: 4096, forceStatic: false });
            const displayBanner = targetMember ? targetMember.bannerURL({ size: 4096, forceStatic: false }) : null;

            if (!globalBanner && !displayBanner) {
                return message.reply({ 
                    content: `<:No:1297814819105144862> <@${targetUser.id}> has no banner set.`, 
                    flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
                    allowedMentions: { parse: [], repliedUser: false }
                });
            }

            // 3. Builder
            const createBannerContainer = (isShowingGlobal, disableToggle = false) => {
                const currentImage = isShowingGlobal ? globalBanner : displayBanner;
                const titleText = isShowingGlobal ? `## Banner Picture` : `## Per-server Banner Picture`;
                const bodyText = isShowingGlobal ? `Banner for <@${targetUser.id}>` : `Per-server Banner for <@${targetUser.id}>`;

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

                const container = new ContainerBuilder()
                    .setAccentColor(0x888888)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titleText}\n${bodyText}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));

                if (currentImage) {
                    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(currentImage)));
                }

                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                         .addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton));
                return container;
            };

            let isGlobalMode = !!globalBanner;

            // 4. Send Reply (SILENT & NO PING)
            const sentMessage = await message.reply({ 
                components: [createBannerContainer(isGlobalMode)], 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false } 
            });

            if (!(globalBanner && displayBanner)) return;

            // 5. Collector
            const collector = sentMessage.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 60_000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ 
                        content: `<:No:1297814819105144862> Only <@${message.author.id}> can use this button`, 
                        flags: [MessageFlags.Ephemeral],
                        allowedMentions: { parse: [] }
                    });
                }
                isGlobalMode = !isGlobalMode;
                await i.update({ 
                    components: [createBannerContainer(isGlobalMode)], 
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                });
            });

            collector.on('end', () => {
                sentMessage.edit({ 
                    components: [createBannerContainer(isGlobalMode, true)], 
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                }).catch(() => {});
            });

        } catch (error) {
            console.error(error);
        }
    }
};
