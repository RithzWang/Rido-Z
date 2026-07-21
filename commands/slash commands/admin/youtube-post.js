const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags,
    ChannelType,
    ContainerBuilder, 
    TextDisplayBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ComponentType
} = require('discord.js');
const Parser = require('rss-parser');
const parser = new Parser();

// 👇 Import your MongoDB model from the Schema folder
const YouTubeDB = require('../../../schema/youtubeSchema'); 

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
                    option.setName('yt_channel_id') // 👈 Changed to yt_channel_id
                        .setDescription('The YouTube Channel ID to remove')
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
                return interaction.editReply(`<:warn:1528710101324529775> THIS YOUTUBE CHANNEL IS ALREADY BEING TRACKED IN <#${targetChannel.id}>.`);
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
                return interaction.editReply(`<:no:1528709599740559415> I AM MISSING REQUIRED PERMISSIONS IN <#${targetChannel.id}>.\nPLEASE ENSURE I HAVE: **__View Channel__, __Send Messages__ and __Embed Links__**`);
            }

            // 3. Validate YouTube Channel via RSS
            let ytName = "Unknown Channel";
            let ytLink = `https://youtube.com/channel/${ytId}`;
            let lastVidId = null;
            
            try {
                const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytId}`);
                ytName = feed.title;
                ytLink = feed.link;
                if (feed.items.length > 0) lastVidId = feed.items[0].id; 
            } catch (error) {
                return interaction.editReply(`<:no:1528709599740559415> INVALID YOUTUBE CHANNEL ID OR THE CHANNEL HAS NO PUBLIC VIDEOS.\nENSURE YOU ARE USING THE ID STARTING WITH \`UC...\``);
            }

            // 4. Save to MongoDB
            await YouTubeDB.create({
                ytChannelId: ytId,
                ytChannelName: ytName,
                ytChannelLink: ytLink,
                discordChannelId: targetChannel.id,
                lastVideoId: lastVidId
            });

            return interaction.editReply(`<:yes:1528709597647470615> SUCCESSFULLY ADDED **[${ytName}](${ytLink})**.\nNEW VIDEOS WILL BE ANNOUNCED IN <#${targetChannel.id}>!`);
        }

        // ------------------------------------------
        // REMOVE SUBCOMMAND
        // ------------------------------------------
        if (subcommand === 'remove') {
            // 👈 Changed to grab yt_channel_id
            const ytIdToRemove = interaction.options.getString('yt_channel_id'); 
            
            // Delete from MongoDB
            const removedEntry = await YouTubeDB.findOneAndDelete({ ytChannelId: ytIdToRemove });

            if (!removedEntry) {
                return interaction.reply({ content: `<:no:1528709599740559415> I COULD NOT FIND THAT CHANNEL IN THE DATABASE`, flags: [MessageFlags.Ephemeral] });
            }

            return interaction.reply({ 
                content: `<:yes:1528709597647470615> SUCCESSFULLY STOP TRACKING **${removedEntry.ytChannelName}**.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // ------------------------------------------
        // LIST SUBCOMMAND
        // ------------------------------------------
        if (subcommand === 'list') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); 
            
            const dbChannels = await YouTubeDB.find({});

            if (dbChannels.length === 0) {
                return interaction.editReply({ content: `THERE ARE CURRENTLY NO YOUTUBE CHANNELS BEING TRACKED` });
            }

            let currentPage = 0;
            const itemsPerPage = 5;
            const maxPages = Math.ceil(dbChannels.length / itemsPerPage);

            const generatePage = (pageIndex) => {
                const start = pageIndex * itemsPerPage;
                const currentItems = dbChannels.slice(start, start + itemsPerPage);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("# Youtube Poster") 
                    );

                // Add text displays for each item on this page
                currentItems.forEach((item) => {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## **[${item.ytChannelName}](${item.ytChannelLink})**\n-# Channel ID: \`${item.ytChannelId}\`\n-# Post In: <#${item.discordChannelId}>`
                        )
                    );
                });

                // Action Row for Pagination
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("yt_first")
                        .setStyle(ButtonStyle.Primary)
                        .setLabel("First")
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId("yt_prev")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Previous")
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId("yt_next")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Next")
                        .setDisabled(pageIndex === maxPages - 1),
                    new ButtonBuilder()
                        .setCustomId("yt_last")
                        .setStyle(ButtonStyle.Primary)
                        .setLabel("Last")
                        .setDisabled(pageIndex === maxPages - 1)
                );

                container.addActionRowComponents(actionRow);

                return container;
            };

            const response = await interaction.editReply({ 
                components: [generatePage(currentPage)], 
                flags: [MessageFlags.IsComponentsV2] 
            });

            // If there's only 1 page, stop here
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
                    flags: [MessageFlags.IsComponentsV2]
                });
            });

            collector.on('end', () => {
                const disabledPage = generatePage(currentPage);
                disabledPage.components[disabledPage.components.length - 1].components.forEach(btn => btn.setDisabled(true));
                interaction.editReply({ components: [disabledPage] }).catch(() => {});
            });
        }
    }
};
