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

// 👇 NEW: You MUST implement this function using an external API or library (e.g., nsfwjs, Sightengine)
// Right now, it just returns false (safe) so your code doesn't break.
async function checkNSFW(url) {
    if (!url) return false;
    
    try {
        // Example logic (pseudocode):
        // const response = await fetch(`https://api.nsfw-checker.com/check?url=${url}`);
        // const data = await response.json();
        // return data.isNsfw === true;
        
        return false; // <-- Replace this with your actual API check
    } catch (error) {
        console.error("Failed to check NSFW status:", error);
        return false; // Default to false if the check fails
    }
}

module.exports = {
    name: 'tavatar',
    aliases: ['tav'],
    description: 'Shows avatar',

    async execute(message, args) {
        // Array of allowed server IDs
        const allowedGuilds = ['878565984108150824']; 
        
        // Check if the message is from a server, and if that server is in the allowed list.
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

            // 2. Fetch Logic
            let targetMember = null;
            try { targetMember = await message.guild.members.fetch(targetUser.id); } catch (err) { targetMember = null; }

            const globalAvatar = targetUser.displayAvatarURL({ size: 1024, forceStatic: false });
            const displayAvatar = targetMember ? targetMember.displayAvatarURL({ size: 1024, forceStatic: false }) : globalAvatar;
            const hasServerAvatar = globalAvatar !== displayAvatar;

            // 👇 NEW: Check both avatars for NSFW content
            const isGlobalNSFW = await checkNSFW(globalAvatar);
            const isDisplayNSFW = hasServerAvatar ? await checkNSFW(displayAvatar) : isGlobalNSFW;

            // 3. Builder
            const createAvatarContainer = (isShowingGlobal, disableToggle = false) => {
                const currentImage = isShowingGlobal ? globalAvatar : displayAvatar;
                const isNSFW = isShowingGlobal ? isGlobalNSFW : isDisplayNSFW; // Get the correct spoiler state

                const titleText = isShowingGlobal ? `## Avatar Picture` : `## Per-server Avatar Picture`;
                
                // Add a warning to the body text if it's flagged
                const warningText = isNSFW ? `\n⚠️ **Warning: Image flagged as inappropriate and has been spoilered.**` : ``;
                const bodyText = (isShowingGlobal ? `Avatar for <@${targetUser.id}>` : `Per-server Avatar for <@${targetUser.id}>`) + warningText;

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

                // 👇 NEW: Apply setSpoiler(isNSFW) to the media gallery item
                const galleryItem = new MediaGalleryItemBuilder()
                    .setURL(currentImage)
                    .setSpoiler(isNSFW); 

                return new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titleText}\n${bodyText}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItem))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                    .addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton));
            };

            let isGlobalMode = true;

            // 4. Send Reply (SILENT & NO PING)
            const sentMessage = await message.reply({ 
                components: [createAvatarContainer(true)], 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false } 
            });

            if (!hasServerAvatar) return;

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
                    components: [createAvatarContainer(isGlobalMode)], 
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                });
            });

            collector.on('end', () => {
                sentMessage.edit({ 
                    components: [createAvatarContainer(isGlobalMode, true)], 
                    flags: [MessageFlags.IsComponentsV2],
                    allowedMentions: { parse: [] }
                }).catch(() => {});
            });

        } catch (error) {
            console.error(error);
        }
    }
};
