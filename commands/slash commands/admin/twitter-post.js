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

const TwitterDB = require('../../../schema/twitterSchema'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitter-post')
        .setDescription('Manage automated Twitter/X announcements')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a Twitter account to be tracked')
                .addStringOption(option => 
                    option.setName('twitter_handle')
                        .setDescription('The Twitter @handle or profile link')
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
                .setDescription('Remove a tracked Twitter account')
                .addStringOption(option => 
                    option.setName('twitter_id') 
                        .setDescription('Select the account to remove')
                        .setRequired(true)
                        .setAutocomplete(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View the list of tracked Twitter accounts')
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const dbAccounts = await TwitterDB.find({});
        
        const filtered = dbAccounts.filter(entry => 
            entry.twitterHandle.toLowerCase().includes(focusedValue)
        );

        await interaction.respond(
            filtered.slice(0, 25).map(entry => ({ 
                name: `@${entry.twitterHandle} (Posts in #${interaction.client.channels.cache.get(entry.discordChannelId)?.name || 'Unknown'})`, 
                value: entry.twitterId 
            }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const input = interaction.options.getString('twitter_handle');
            const targetChannel = interaction.options.getChannel('channel');

            const botPermissions = targetChannel.permissionsFor(interaction.client.user);
            const requiredPerms = [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            ];

            const missingPerms = requiredPerms.filter(perm => !botPermissions.has(perm));
            if (missingPerms.length > 0) {
                return interaction.editReply(`<:no:1528709599740559415> I AM MISSING REQUIRED PERMISSIONS IN <#${targetChannel.id}>.`);
            }

            // Clean the input to get just the username (strips URL and @)
            let username = input.replace(/(https?:\/\/)?(www\.)?(twitter\.com\/|x\.com\/)/i, '')
                                .replace('@', '')
                                .split(/[/?]/)[0];

            const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN; 
            if (!BEARER_TOKEN) return interaction.editReply("Bot Owner needs to set `TWITTER_BEARER_TOKEN` in the `.env` file.");

            let twitterId, exactHandle, lastTweetId;
            try {
                // 1. Get User ID by Username
                const userRes = await fetch(`https://api.twitter.com/2/users/by/username/${username}`, {
                    headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
                });
                const userData = await userRes.json();

                if (userData.errors || !userData.data) {
                    return interaction.editReply(`<:no:1528709599740559415> COULD NOT FIND THAT TWITTER ACCOUNT. Ensure the handle is correct.`);
                }

                twitterId = userData.data.id;
                exactHandle = userData.data.username;

                const exists = await TwitterDB.findOne({ twitterId: twitterId, discordChannelId: targetChannel.id });
                if (exists) {
                    return interaction.editReply(`<:warn:1528710101324529775> **@${exactHandle}** IS ALREADY BEING TRACKED IN <#${targetChannel.id}>`);
                }

                // 2. Get their most recent tweet to set the baseline
                const tweetRes = await fetch(`https://api.twitter.com/2/users/${twitterId}/tweets?max_results=5&exclude=retweets,replies`, {
                    headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
                });
                const tweetData = await tweetRes.json();

                if (tweetData.data && tweetData.data.length > 0) {
                    lastTweetId = tweetData.data[0].id;
                }
            } catch (error) {
                console.error("Twitter API Error:", error);
                return interaction.editReply(`<:no:1528709599740559415> AN ERROR OCCURRED WHILE CONTACTING THE TWITTER API.`);
            }

            await TwitterDB.create({
                twitterId: twitterId,
                twitterHandle: exactHandle,
                discordChannelId: targetChannel.id,
                lastTweetId: lastTweetId
            });

            return interaction.editReply(`<:yes:1528709597647470615> SUCCESSFULLY ADDED **[@${exactHandle}](https://x.com/${exactHandle})**.\nNEW TWEETS WILL BE ANNOUNCED IN <#${targetChannel.id}>!`);
        }

        if (subcommand === 'remove') {
            const idToRemove = interaction.options.getString('twitter_id'); 
            const removedEntry = await TwitterDB.findOneAndDelete({ twitterId: idToRemove });

            if (!removedEntry) {
                return interaction.reply({ content: `<:no:1528709599740559415> I COULD NOT FIND THAT ACCOUNT IN THE DATABASE`, flags: [MessageFlags.Ephemeral] });
            }

            return interaction.reply({ 
                content: `<:yes:1528709597647470615> SUCCESSFULLY STOPPED TRACKING **@${removedEntry.twitterHandle}**.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        if (subcommand === 'list') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); 
            const dbAccounts = await TwitterDB.find({});

            if (dbAccounts.length === 0) {
                return interaction.editReply({ content: `THERE ARE CURRENTLY NO TWITTER ACCOUNTS BEING TRACKED` });
            }

            let currentPage = 0;
            const itemsPerPage = 5;
            const maxPages = Math.ceil(dbAccounts.length / itemsPerPage);

            const generatePage = (pageIndex) => {
                const start = pageIndex * itemsPerPage;
                const currentItems = dbAccounts.slice(start, start + itemsPerPage);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## Twitter/X Poster") 
                    );

                currentItems.forEach((item) => {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**[@${item.twitterHandle}](https://x.com/${item.twitterHandle})**\n-# <:th2:1456207122416275498> \`${item.twitterId}\`\n-# <:tl2:1456207124261634100> <#${item.discordChannelId}>`
                        )
                    );
                });

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("tw_first")
                        .setStyle(ButtonStyle.Primary)
                        .setLabel("First")
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId("tw_prev")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Previous")
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId("tw_next")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Next")
                        .setDisabled(pageIndex === maxPages - 1),
                    new ButtonBuilder()
                        .setCustomId("tw_last")
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

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

            collector.on('collect', async (i) => {
                if (i.customId === 'tw_first') currentPage = 0;
                else if (i.customId === 'tw_prev') currentPage--;
                else if (i.customId === 'tw_next') currentPage++;
                else if (i.customId === 'tw_last') currentPage = maxPages - 1;

                await i.update({ components: [generatePage(currentPage)], flags: [MessageFlags.IsComponentsV2] });
            });

            collector.on('end', () => {
                const disabledPage = generatePage(currentPage);
                disabledPage.components[disabledPage.components.length - 1].components.forEach(btn => btn.setDisabled(true));
                interaction.editReply({ components: [disabledPage] }).catch(() => {});
            });
        }
    }
};
