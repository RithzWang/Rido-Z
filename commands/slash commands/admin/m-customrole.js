const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder,
    TextDisplayBuilder, 
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ContainerBuilder,
    MessageFlags
} = require('discord.js');
const ConfigDB = require('../../../schema/CustomRoleConfig'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('m-customrole')
        .setDescription('Manage the custom role system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Set up the custom role panel')
            .addStringOption(opt => opt.setName('channel').setDescription('Channel ID (optional)'))
            .addStringOption(opt => opt.setName('message_id').setDescription('Message ID to edit (optional)'))
        )
        .addSubcommand(sub => sub.setName('disable').setDescription('Disable the manage custom role button temporarily'))
        .addSubcommand(sub => {
            sub.setName('bypass').setDescription('Allow users/roles to bypass boost requirement');
            for (let i = 1; i <= 5; i++) {
                sub.addRoleOption(opt => opt.setName(`role${i}`).setDescription(`Bypass Role ${i}`));
                sub.addUserOption(opt => opt.setName(`user${i}`).setDescription(`Bypass User ${i}`));
            }
            return sub;
        })
        .addSubcommand(sub => {
            sub.setName('disbypass').setDescription('Remove users/roles from bypass');
            for (let i = 1; i <= 5; i++) {
                sub.addRoleOption(opt => opt.setName(`role${i}`).setDescription(`Remove Role ${i}`));
                sub.addUserOption(opt => opt.setName(`user${i}`).setDescription(`Remove User ${i}`));
            }
            return sub;
        })
        .addSubcommand(sub => sub.setName('db').setDescription('View current bypass dashboard')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        let config = await ConfigDB.findOne({ guildId: interaction.guildId });
        if (!config) config = await ConfigDB.create({ guildId: interaction.guildId });

        const hasEnhancedRoleStyle = interaction.guild.features?.includes('ENHANCED_ROLE_COLORS');
        const hasRoleIcons = interaction.guild.premiumTier >= 2 || interaction.guild.features?.includes('ROLE_ICONS');

        // --- DASHBOARD (DB) ---
        if (subcommand === 'db') {
            const embed = new EmbedBuilder()
                .setTitle('Custom Role Dashboard')
                .setColor('#2b2d31')
                .addFields(
                    { name: 'Enhanced Perks (Gradient)', value: hasEnhancedRoleStyle ? '✅ Unlocked' : '❌ Locked', inline: true },
                    { name: 'Global Disabled', value: config.globalDisabled ? '🔴 Yes (Disabled)' : '🟢 No (Active)', inline: true },
                    { name: 'Bypassed Roles', value: config.bypassedRoles.length > 0 ? config.bypassedRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
                    { name: 'Bypassed Users', value: config.bypassedUsers.length > 0 ? config.bypassedUsers.map(id => `<@${id}>`).join(', ') : 'None', inline: false }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- BYPASS / DISBYPASS ---
        if (subcommand === 'bypass' || subcommand === 'disbypass') {
            let addedOrRemoved = 0;
            const isAdding = subcommand === 'bypass';

            for (let i = 1; i <= 5; i++) {
                const r = interaction.options.getRole(`role${i}`);
                const u = interaction.options.getUser(`user${i}`);

                if (r) {
                    if (isAdding && !config.bypassedRoles.includes(r.id)) { config.bypassedRoles.push(r.id); addedOrRemoved++; }
                    else if (!isAdding) { config.bypassedRoles = config.bypassedRoles.filter(id => id !== r.id); addedOrRemoved++; }
                }
                if (u) {
                    if (isAdding && !config.bypassedUsers.includes(u.id)) { config.bypassedUsers.push(u.id); addedOrRemoved++; }
                    else if (!isAdding) { config.bypassedUsers = config.bypassedUsers.filter(id => id !== u.id); addedOrRemoved++; }
                }
            }
            await config.save();
            return interaction.reply({ content: `Successfully ${isAdding ? 'added to' : 'removed from'} bypass list. (${addedOrRemoved} updates)`, ephemeral: true });
        }

        // --- SET / DISABLE PANEL ---
        if (subcommand === 'set' || subcommand === 'disable') {
            const isDisabled = subcommand === 'disable';
            config.globalDisabled = isDisabled;

            const gradientEmoji = hasEnhancedRoleStyle ? '<:yes:1551365722729484370>' : '<:no:1551365724314935296>';
            const iconEmoji = hasRoleIcons ? '<:yes:1551365722729484370>' : '<:no:1551365724314935296>';

            const featuresText = `<:yes:1551365722729484370> Choose your own role name\n<:yes:1551365722729484370> Set any custom [HEX](<https://share.google/Vengh8rGw8wb4ddvK>) colour\n${gradientEmoji} Unlock Gradient\n${iconEmoji} Unlock Custom Icon`;

            const containerComponents = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## <:role:1551900245653332048> Custom Role"),
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(featuresText),
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Secondary)
                                    .setLabel("Manage Custom Role")
                                    .setEmoji("1551910425254432809")
                                    .setCustomId("2a064e6b81774bcf9c6a2778c5e0ac21")
                                    .setDisabled(isDisabled),
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Danger)
                                    .setLabel("Delete")
                                    .setEmoji("1551935964866150470")
                                    .setCustomId("a1e2a2b3a3044a5ab488f7d5e2558a8c")
                                    .setDisabled(isDisabled),
                            ),
                    ),
            ];

            let channelId = interaction.options.getString('channel') || interaction.channelId;
            let messageId = interaction.options.getString('message_id') || (isDisabled ? config.panelMessageId : null);
            
            const targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
            if (!targetChannel) return interaction.reply({ content: "Invalid channel.", ephemeral: true });

            if (messageId) {
                try {
                    const msg = await targetChannel.messages.fetch(messageId);
                    await msg.edit({ 
                        components: containerComponents, 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    
                    config.panelChannelId = targetChannel.id;
                    config.panelMessageId = msg.id;
                    await config.save();
                    return interaction.reply({ content: `Panel successfully ${isDisabled ? 'disabled' : 'updated'}.`, ephemeral: true });
                } catch (e) {
                    if (isDisabled) return interaction.reply({ content: "Could not find the panel message to disable. Ensure the ID is correct.", ephemeral: true });
                }
            }

            const newMsg = await targetChannel.send({ 
                components: containerComponents,
                flags: MessageFlags.IsComponentsV2
            });
            
            config.panelChannelId = targetChannel.id;
            config.panelMessageId = newMsg.id;
            await config.save();
            
            return interaction.reply({ content: 'Panel sent successfully!', ephemeral: true });
        }
    }
};
