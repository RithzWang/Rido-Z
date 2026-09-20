const { 
    Events, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    MediaGalleryBuilder, 
    MediaGalleryItemBuilder, 
    SeparatorBuilder, 
    SeparatorSpacingSize, 
    ThumbnailBuilder, 
    SectionBuilder 
} = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) {
        // 1. Listen for the datamining webhook in your hidden channel
        if (message.channelId !== '878582788608122900' || !message.webhookId) return;

        // 2. Extract the raw embed data from the webhook
        const questEmbed = message.embeds[0];
        if (!questEmbed) return;

        // 3. Map the data to variables
        const questTitle = questEmbed.title || "Unknown Quest";
        const questUrl = questEmbed.url || "https://discord.com/quests";
        const questThumbnailUrl = questEmbed.image?.url || questEmbed.thumbnail?.url || "https://example.com/fallback.png";
        const questDescription = questEmbed.description || "Complete the required tasks in-game.";
        const questId = "1234567890"; // You would extract this from the embed text

        // 4. Build your custom Component V2 Layout
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
                new TextDisplayBuilder().setContent(`# Quest Info\n**Duration**: (timestamp) - (timestamp)\n**Redeemable Platform**: PC / Console\n**Game**: ${questTitle}\n**Application**: [App](<link>) ( \`id\` )\n**Features**: In-Game Tracking`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# Tasks\nYou must complete the following tasks\n${questDescription}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL("https://example.com/reward_icon.png")
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("# Rewards"),
                        new TextDisplayBuilder().setContent("**Reward Type**: In-App Item\n**SKU ID**: \`sku_id_here\`\n**Name**: Exclusive Reward")
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL("https://example.com/watch_video_thumbnail.png") // If applicable
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`Quest _ID_: \`${questId}\``)
            );

        // 5. Have your bot send the final UI to your public server channel
        const publicChannel = message.client.channels.cache.get('YOUR_PUBLIC_CHANNEL_ID');
        if (publicChannel) {
            await publicChannel.send({
                content: `🎯 <@&QUEST_ROLE_ID>`,
                components: [container]
            });
        }
    }
};
