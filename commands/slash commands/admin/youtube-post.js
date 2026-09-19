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

const YouTubeDB = require('../../../schema/youtubeSchema'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Manage automated YouTube video announcements')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a YouTube channel')
                .addStringOption(option => 
                    option.setName('youtube_link') // 👈 Changed option name
                        .setDescription('A YouTube Channel Link, @handle, or ID')
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
                        .setDescription('Select the channel to remove')
                        .setRequired(true)
                        .setAutocomplete(true)) // Autocomplete makes finding the channel easy!
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
        const dbChannels = await YouTubeDB.find({});
        
        const filtered = dbChannels.filter(entry => 
            entry.ytChannelName.toLowerCase().includes(focusedValue) || 
            entry.ytChannelId.toLowerCase().includes(focusedValue)
        );

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

            const input = interaction.options.getString('youtube_link');
            const targetChannel = interaction.options.getChannel('channel');

            // 1. Check Bot Permissions first
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

            // 2. Parse the Input to figure out what kind of link they provided
            const API_KEY = process.env.YOUTUBE_API_KEY; 
            let apiSearchUrl = '';

            if (/^UC[\w-]{22}$/.test(input)) {
                // They pasted a raw Channel ID (e.g., UC1234567890abcdefg)
                apiSearchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${input}&key=${API_KEY}`;
            } else if (input.includes('/channel/UC')) {
                // They pasted a full /channel/ link
                const idMatch = input.match(/\/channel\/(UC[\w-]{22})/);
                if (idMatch) apiSearchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${idMatch[1]}&key=${API_KEY}`;
            } else if (input.includes('@')) {
                // They pasted an @handle or a youtube.com/@handle link
                const handleMatch = input.match(/@([\w.-]+)/);
                if (handleMatch) apiSearchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=@${handleMatch[1]}&key=${API_KEY}`;
            } else if (input.includes('/user/')) {
                // They pasted a legacy /user/ link
                const userMatch = input.match(/\/user\/([\w.-]+)/);
                if (userMatch) apiSearchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forUsername=${userMatch[1]}&key=${API_KEY}`;
            } else {
                return interaction.editReply(`<:no:1528709599740559415> INVALID FORMAT. Please provide a valid YouTube channel link, @handle, or ID.`);
            }

            // 3. Fetch from YouTube API
            let ytName, ytLink, ytId, lastVidId;
            try {
                const channelRes = await fetch(apiSearchUrl);
                const channelData = await channelRes.json();

                if (!channelData.items || channelData.items.length === 0) {
                    return interaction.editReply(`<:no:1528709599740559415> COULD NOT FIND THAT YOUTUBE CHANNEL. Double check the link!`);
                }

                // Extract the exact Channel ID that YouTube returned
                ytId = channelData.items[0].id;
                ytName = channelData.items[0].snippet.title;
                ytLink = `https://youtube.com/channel/${ytId}`;

                // 4. Check if we are already tracking this channel in MongoDB
                const exists = await YouTubeDB.findOne({ ytChannelId: ytId, discordChannelId: targetChannel.id });
                if (exists) {
                    return interaction.editReply(`<:warn:1528710101324529775> **${ytName}** IS ALREADY BEING TRACKED IN <#${targetChannel.id}>`);
                }

                // Get the ID for the channel's "Uploads" playlist
                const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

                // Fetch the most recent video
                const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${API_KEY}`);
                const playlistData = await playlistRes.json();

                if (playlistData.items && playlistData.items.length > 0) {
                    lastVidId = playlistData.items[0].snippet.resourceId.videoId;
                }
            } catch (error) {
                console.error("YouTube API Error:", error);
                return interaction.editReply(`<:no:1528709599740559415> AN ERROR OCCURRED WHILE CONTACTING THE YOUTUBE API.`);
            }

            // 5. Save to MongoDB
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
            const ytIdToRemove = interaction.options.getString('yt_channel_id'); 
            
            const removedEntry = await YouTubeDB.findOneAndDelete({ ytChannelId: ytIdToRemove });

            if (!removedEntry) {
                return interaction.reply({ content: `<:no:1528709599740559415> I COULD NOT FIND THAT CHANNEL IN THE DATABASE`, flags: [MessageFlags.Ephemeral] });
            }

            return interaction.reply({ 
                content: `<:yes:1528709597647470615> SUCCESSFULLY STOPPED TRACKING **${removedEntry.ytChannelName}**.`, 
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
                        new TextDisplayBuilder().setContent("## Youtube Tracking") 
                    );

                currentItems.forEach((item) => {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**[${item.ytChannelName}](${item.ytChannelLink})**\n-# <:th2:1456207122416275498> \`${item.ytChannelId}\`\n-# <:tl2:1456207124261634100> <#${item.discordChannelId}>`
                        )
                    );
                });

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
