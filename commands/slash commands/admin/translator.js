const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const Translator = require('../../../schema/TranslatorSchema.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translator')
        .setDescription('Manage translation channels for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // 1. /translator set
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a channel to translate messages into a specific language')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel to set up')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('language')
                        .setDescription('The target language for this channel')
                        .setRequired(true)
                        .addChoices(
                            { name: 'English (Any -> English)', value: 'english' },
                            { name: 'Spanish (Any -> Spanish)', value: 'spanish' },
                            { name: 'Arabic (Any -> Arabic)', value: 'arabic' },
                            { name: 'Thai (Any -> Thai)', value: 'thai' }
                        ))
        )
        // 2. /translator list
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all active translation channels in this server')
        )
        // 3. /translator remove
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a translation channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The translation channel to remove')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            const language = interaction.options.getString('language');

            try {
                // Upsert: updates if channel is already registered, creates if not
                await Translator.findOneAndUpdate(
                    { channelId: channel.id },
                    { guildId, channelId: channel.id, language },
                    { upsert: true, new: true }
                );

                await interaction.reply({
                    content: `✅ Successfully configured <#${channel.id}> as a **${language.toUpperCase()}** translation channel!`,
                    ephemeral: true
                });
            } catch (error) {
                console.error("Database Error:", error);
                await interaction.reply({ content: '❌ Failed to save to database.', ephemeral: true });
            }
        } 
        
        else if (subcommand === 'list') {
            try {
                const channels = await Translator.find({ guildId });

                if (channels.length === 0) {
                    return interaction.reply({ content: 'ℹ️ No translation channels have been set up yet. Use `/translator set` to add one.', ephemeral: true });
                }

                const description = channels.map(c => `• <#${c.channelId}> ➔ **${c.language.toUpperCase()}**`).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('🌍 Active Translation Channels')
                    .setDescription(description)
                    .setColor('#5865F2');

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error("Database Error:", error);
                await interaction.reply({ content: '❌ Failed to fetch channels.', ephemeral: true });
            }
        } 
        
        else if (subcommand === 'remove') {
            const channel = interaction.options.getChannel('channel');

            try {
                const deleted = await Translator.findOneAndDelete({ channelId: channel.id });

                if (!deleted) {
                    return interaction.reply({ content: `❌ <#${channel.id}> was not registered as a translation channel.`, ephemeral: true });
                }

                await interaction.reply({
                    content: `🗑️ Successfully removed <#${channel.id}> from the translation database.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error("Database Error:", error);
                await interaction.reply({ content: '❌ Failed to remove channel.', ephemeral: true });
            }
        }
    }
};
