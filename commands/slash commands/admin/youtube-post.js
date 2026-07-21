const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags,
    ChannelType,
    ContainerBuilder, 
    TextDisplayBuilder, 
    SectionBuilder, 
    ThumbnailBuilder, 
    SeparatorBuilder, 
    SeparatorSpacingSize, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ComponentType
} = require('discord.js');
const { Schema, model, models } = require('mongoose');
const Parser = require('rss-parser');
const parser = new Parser();

// ==========================================
// MONGODB SCHEMA
// ==========================================
const youtubeSchema = new Schema({
    ytChannelId: { type: String, required: true },
    ytChannelName: { type: String, required: true },
    ytChannelLink: { type: String, required: true },
    discordChannelId: { type: String, required: true },
    profileUrl: { type: String, default: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png" },
    lastVideoId: { type: String, default: null } // Useful for your background checker
});

// Prevent model overwrite error upon hot-reloading
const YouTubeDB = models.YouTubeChannel || model('YouTubeChannel', youtubeSchema);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube-post')
        .setDescription('Manage automated YouTube video announcements')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a YouTube channel to be tracked')
                .addStringOption(option => 
                    option.setName('yt_channel_id')
                        .setDescription('The YouTube Channel ID (starts with UC)')
                        .setRequired(true))
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('The Discord channel to post updates in')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a tracked YouTube channel')
                .addStringOption(option => 
                    option.setName('yt_channel')
                        .setDescription('The YouTube channel to remove')
                        .setRequired(true)
                        .setAutocomplete(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View the list of tracked YouTube channels')
        ),

    // ==========================================
    // AUTOCOMPLETE LOGIC FOR /youtube remove
    // ==========================================
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        // Fetch all channels from MongoDB
        const dbChannels = await YouTubeDB.find({});
        
        // Filter channels by matching the YouTube Name or ID
        const filtered = dbChannels.filter(entry => 
            entry.ytChannelName.toLowerCase().includes(focusedValue) || 
            entry.ytChannelId.toLowerCase().includes(focusedValue)
        );

        // Discord limits autocomplete to 25 choices
        await interaction.respond(
            filtered.slice(0, 25).map(entry => ({ 
                name: `${entry.ytChannelName} (Posts in #${interaction.client.channels.cache.get(entry.discordChannelId)?.name || 'Unknown'})`, 
                value: entry.ytChannelId 
            }))
        );
    },

    // ==========================================
    // EXECUTE LOGIC
    // ==========================================
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // ------------------------------------------
        // ADD SUBCOMMAND
        // ------------------------------------------
        if (subcommand === 'add') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const ytId = interaction.options.getString('yt_channel_id');
            const targetChannel = interaction.options.getChannel('channel');

            // 1. Check if it's already added in MongoDB
            const exists = await YouTubeDB.findOne({ ytChannelId: ytId, discordChannelId: targetChannel.id });
            if (exists) {
                return interaction.editReply(`❌ This YouTube channel is already being tracked in <#${targetChannel.id}>.`);
            }

            // 2. Check Bot Permissions in the target channel
            const botPermissions = targetChannel.permissionsFor(interaction.client.user);
            const requiredPerms = [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles
            ];

            const missingPerms = requiredPerms.filter(perm => !botPermissions.has(perm));
            if (missingPerms.length > 0) {
                return interaction.editReply(`❌ I am missing required permissions in <#${targetChannel.id}>.\nPlease ensure I have: **View Channel, Send Messages, Embed Links, and Attach Files**.`);
            }

            // 3. Validate YouTube Channel via RSS
            let ytName = "Unknown Channel";
            let ytLink = `https://youtube.com/channel/${ytId}`;
            let lastVidId = null;
            
            try {
                const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytId}`);
                ytName = feed.title;
                ytLink = feed.link;
                if (feed.items.length > 0) lastVidId = feed.items[0].id; // Save newest video so it doesn't instantly ping on startup
            } catch (error) {
                return interaction.editReply(`❌ Invalid YouTube Channel ID or the channel has no public videos.\nEnsure you are using the ID starting with \`UC...\``);
            }

            // 4. Save to MongoDB
            await YouTubeDB.create({
                ytChannelId: ytId,
                ytChannelName: ytName,
                ytChannelLink: ytLink,
                discordChannelId: targetChannel.id,
                lastVideoId: lastVidId
            });

            return interaction.editReply(`✅ Successfully added **[${ytName}](${ytLink})**.\nNew videos will be announced in <#${targetChannel.id}>!`);
        }

        // ------------------------------------------
        // REMOVE SUBCOMMAND
        // ------------------------------------------
        if (subcommand === 'remove') {
            const ytIdToRemove = interaction.options.getString('yt_channel');
            
            // Delete from MongoDB
            const removedEntry = await YouTubeDB.findOneAndDelete({ ytChannelId: ytIdToRemove });

            if (!removedEntry) {
                return interaction.reply({ content: `❌ Could not find that channel in the database.`, flags: [MessageFlags.Ephemeral] });
            }

            return interaction.reply({ 
                content: `🗑️ Successfully stopped tracking **${removedEntry.ytChannelName}**.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // ------------------------------------------
        // LIST SUBCOMMAND
        // ------------------------------------------
        if (subcommand === 'list') {
            const dbChannels = await YouTubeDB.find({});

            if (dbChannels.length === 0) {
                return interaction.reply({ content: `There are currently no YouTube channels being tracked.`, flags: [MessageFlags.Ephemeral] });
            }

            let currentPage = 0;
            const itemsPerPage = 5;
            const maxPages = Math.ceil(dbChannels.length / itemsPerPage);

            const generatePage = (pageIndex) => {
                const start = pageIndex * itemsPerPage;
                const currentItems = dbChannels.slice(start, start + itemsPerPage);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## <:youtube:123456789> Youtube Poster") 
                    );

                // Add sections for each item on this page
                currentItems.forEach((item, index) => {
                    const itemNumber = start + index + 1;
                    container.addSectionComponents(
                        new SectionBuilder()
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(item.profileUrl)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${itemNumber}. **[${item.ytChannelName}](${item.ytChannelLink})** \`${item.ytChannelId}\`\n- new videos posted in <#${item.discordChannelId}>`
                                )
                            )
                    );
                });

                container.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                );

                // Action Row for Pagination
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("yt_first")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("First")
                        .setEmoji({ name: "⏪" })
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId("yt_prev")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Previous")
                        .setEmoji({ name: "◀️" })
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId("yt_next")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Next")
                        .setEmoji({ name: "▶️" })
                        .setDisabled(pageIndex === maxPages - 1),
                    new ButtonBuilder()
                        .setCustomId("yt_last")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Last")
                        .setEmoji({ name: "⏩" })
                        .setDisabled(pageIndex === maxPages - 1)
                );

                if (maxPages > 1) {
                    container.addActionRowComponents(actionRow);
                }

                return container;
            };

            const response = await interaction.reply({ 
                components: [generatePage(currentPage)], 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] 
            });

            if (maxPages === 1) return; 

            const collector = response.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 120_000 
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'yt_first') currentPage = 0;
                else if (i.customId === 'yt_prev') currentPage--;
                else if (i.customId === 'yt_next') currentPage++;
                else if (i.customId === 'yt_last') currentPage = maxPages - 1;

                await i.update({ 
                    components: [generatePage(currentPage)],
                    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
                });
            });

            collector.on('end', () => {
                const disabledPage = generatePage(currentPage);
                disabledPage.components.pop(); 
                interaction.editReply({ components: [disabledPage] }).catch(() => {});
            });
        }
    }
};
