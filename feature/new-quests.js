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
        // 1. Ensure it is a webhook message in your hidden tracking channel
        if (message.channelId !== '920516326978641981' || !message.webhookId) return;

        // 2. Extract the raw embed data from the datamining webhook
        const questEmbed = message.embeds[0];
        if (!questEmbed) return;

        const questTitle = questEmbed.title || "Unknown Quest";
        const questUrl = questEmbed.url || "https://discord.com/quests";
        const questThumbnailUrl = questEmbed.image?.url || questEmbed.thumbnail?.url || "https://discord.com/assets/favicon.ico";
        const questDescription = questEmbed.description || "Complete the required tasks in-game.";

        // 3. Build your custom Component V2 Layout
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                // The role ping MUST go inside a TextDisplay for V2 components
                new TextDisplayBuilder().setContent(`<@&QUEST_ROLE_ID>\n## New Quest - [${questTitle}](<${questUrl}>)`)
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
                        new ThumbnailBuilder().setURL("https://example.com/reward_icon.png") // Replace with actual reward URL if available
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("# Rewards"),
                        new TextDisplayBuilder().setContent("**Reward Type**: In-App Item\n**SKU ID**: \`sku_id_here\`\n**Name**: Exclusive Reward\n**Orbs Amount**: 0")
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`Quest _ID_: \`extracted_id\``)
            );

        // 4. Have your bot send the final UI to your public server channel
        const publicChannel = message.client.channels.cache.get('878582788608122900');
        if (publicChannel) {
            await publicChannel.send({
                components: [container],
                flags: [MessageFlags.IsComponentsV2] // CRITICAL: This flag enables the V2 layout
            });
        }
    });
};
