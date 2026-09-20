const { 
    Events, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    MediaGalleryBuilder, 
    MediaGalleryItemBuilder, 
    SeparatorBuilder, 
    SeparatorSpacingSize, 
    ThumbnailBuilder, 
    SectionBuilder,
    MessageFlags
} = require('discord.js');

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        // Only listen to the hidden channel where the webhook posts
        if (message.channelId !== '920516326978641981' || !message.webhookId) return;

        const questEmbed = message.embeds[0];
        if (!questEmbed) return;

        // Extract whatever data the webhook provides (adjust these based on the actual webhook)
        const questTitle = questEmbed.title || "New Quest";
        const questUrl = questEmbed.url || "https://discord.com/quests";
        const questThumbnailUrl = questEmbed.image?.url || questEmbed.thumbnail?.url || "https://discord.com/assets/favicon.ico";
        const questDescription = questEmbed.description || "Complete the required tasks in-game.";
        
        // Build the V2 layout you requested
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## New Quest - [${questTitle}](<${questUrl}>)`)
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(questThumbnailUrl)
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# Quest Info\n**Duration**: (timestamp) - (timestamp)\n**Redeemable Platform**: PC/Console\n**Game**: ${questTitle}\n**Application**: [App](<link>) ( \`id\` )\n**Features**: In-Game Tracking`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# Tasks\nYou must complete the following tasks:\n${questDescription}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL("https://example.com/reward.png") // Replace with actual reward thumbnail
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("# Rewards"),
                        new TextDisplayBuilder().setContent("**Reward Type**: In-App Item\n**SKU ID**: \`sku_id\`\n**Name**: Reward Name\n**Orbs Amount**: 0")
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("Quest _ID_: `quest_id`")
            );

        const publicChannel = message.client.channels.cache.get('878582788608122900');
        if (publicChannel) {
            await publicChannel.send({
                // content: `🎯 <@&QUEST_ROLE_ID>`,
                components: [container],
                flags: [MessageFlags.IsComponentsV2] // Required for V2 layouts
            });
        }
    });
};
