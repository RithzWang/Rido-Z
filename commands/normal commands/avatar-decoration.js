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
    name: 'decoration',
    aliases: ['dec', 'deco', 'ad', 'avd', 'avdec', 'avdeco', 'avatardecoration'],
    description: 'Shows a user\'s avatar decoration',

    async execute(message, args) {
        // 👇 Array of allowed server IDs
        const allowedGuilds = ['878565984108150824']; 
        
        // 👇 Check if the message is from a server, and if that server is in the allowed list.
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

            // If user not found, do nothing (return silently)
            if (!targetUser) return;

            // 2. Fetch User & Member
            let targetMember = null;
            try { targetMember = await message.guild.members.fetch(targetUser.id); } catch (err) { targetMember = null; }

            const fetchedUser = await message.client.users.fetch(targetUser.id, { force: true });
            
            // Fetch both decorations
            const globalDeco = fetchedUser.avatarDecorationURL({ size: 1024 });
            const displayDeco = targetMember ? targetMember.avatarDecorationURL({ size: 1024 }) : null;

            // Check if there's a distinct server decoration
            const hasServerDeco = displayDeco && displayDeco !== globalDeco;

            if (!globalDeco && !displayDeco) {
                return message.reply({ 
                    content: `<:no:1528709599740559415> <@${targetUser.id}> HAS NO AVATAR DECORATION`, 
                    flags: [MessageFlags.Ephemeral, MessageFlags.SuppressNotifications],
                    allowedMentions: { parse: [], repliedUser: false }
                });
            }

            // 3. Builder
            const createDecoContainer = (isShowingGlobal, disableToggle = false) => {
                const currentImage = isShowingGlobal ? globalDeco : displayDeco;
                const titleText = isShowingGlobal ? `## Avatar Decoration` : `## Per-server Avatar Decoration`;
                const bodyText = isShowingGlobal ? `Decoration for <@${targetUser.id}>` : `Per-server Decoration for <@${targetUser.id}>`;

                const toggleButton = new ButtonBuilder()
                    .setCustomId('toggle_deco_msg')
                    .setStyle(ButtonStyle.Secondary);

                if (isShowingGlobal) {
                    toggleButton.setLabel('Show Per-server Decoration');
                    if (!hasServerDeco) toggleButton.setDisabled(true).setLabel('No Per-server Decoration');
                } else {
                    toggleButton.setLabel('Show Global Decoration');
                    if (!globalDeco) toggleButton.setDisabled(true).setLabel('No Global Decoration');
                }
                if (disableToggle) toggleButton.setDisabled(true);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titleText}\n${bodyText}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));

                if (currentImage) {
                    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(currentImage)));
                }

                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                         .addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton));
                
                return container;
            };

            let isGlobalMode = !!globalDeco;

            // 4. Send Reply (SILENT & NO PING)
            const sentMessage = await message.reply({ 
                components: [createDecoContainer(isGlobalMode)], 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false } 
            });

            // If they don't have BOTH a global and a distinct server decoration, we don't need a collector
            if (!globalDeco || !hasServerDeco) return;

            // 5. Collector
            const collector = sentMessage.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 60_000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ 
                        content: `<:no:1528709599740559415> ONLY <@${message.author.id}> CAN TOGGLE THIS BUTTON`, 
                        flags: [MessageFlags.Ephemeral],
                        allowedMentions: { parse: [] }
                    });
                }
                isGlobalMode = !isGlobalMode;
                await i.update({ 
                    components: [createDecoContainer(isGlobalMode)], 
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                });
            });

            collector.on('end', () => {
                sentMessage.edit({ 
                    components: [createDecoContainer(isGlobalMode, true)], 
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                }).catch(() => {});
            });

        } catch (error) {
            console.error(error);
        }
    }
};
