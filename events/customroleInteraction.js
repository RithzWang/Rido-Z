const { 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    LabelBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    ButtonStyle,
    ButtonBuilder,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');
const ConfigDB = require('../schema/CustomRoleConfig');
const UserRoleDB = require('../schema/CustomRoleUser');

const ANCHOR_ROLE_ID = '894154962685284362';
const BOUNDARY_ROLE_ID = '1552136781984436264'; 

// Cooldown Configuration
const EXEMPT_ROLES = ['878566116203589632', '1469705529306910753'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function formatDiscordColor(hexString) {
    if (!hexString) return '';
    let clean = hexString.replace(/^#+/g, '').trim(); 
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join(''); 
    }
    return `#${clean.toUpperCase()}`; 
}

// Helper to parse URLs or Custom Emojis into a direct image link
function parseIconInput(input) {
    if (!input) return null;
    input = input.trim();
    
    // Direct URL check
    if (input.startsWith('http://') || input.startsWith('https://')) {
        return input;
    }
    
    // Custom Emoji check (e.g., <:name:id> or <a:name:id>)
    const emojiMatch = input.match(/<a?:[a-zA-Z0-9_]+:(\d+)>/);
    if (emojiMatch) {
        return `https://cdn.discordapp.com/emojis/${emojiMatch[1]}.png`;
    }
    
    // Raw ID check
    if (/^\d+$/.test(input)) {
        return `https://cdn.discordapp.com/emojis/${input}.png`;
    }
    
    return null;
}

async function checkEnhancedRolePerk(guild) {
    try {
        const fetchedGuild = await guild.fetch();
        return fetchedGuild.features?.includes('ENHANCED_ROLE_COLORS');
    } catch {
        return guild.features?.includes('ENHANCED_ROLE_COLORS');
    }
}

function buildStyleSelectorComponents() {
    return [
        new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## <:brush:1551910052795908216> Select Custom Role Style"),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("- **Solid**\n_You can pick one colour_\n- **Gradient **\n_You can pick two colours_"),
            )
            .addActionRowComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("7961861e646f4b8f9acccc9767c973ff")
                            .setPlaceholder("Solid & Gradient")
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Solid")
                                    .setValue("3edc1c1c1bee48f6eac26b9555e5a408")
                                    .setEmoji({ name: "1️⃣" }),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Gradient")
                                    .setValue("5ab448a89aa04452b6f1276f6853296c")
                                    .setEmoji({ name: "2️⃣" })
                            ),
                    ),
            ),
    ];
}

async function sendRoleModal(interaction, style) {
    const isGradient = style === 'gradient';
    const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
    
    const hasExistingRole = !!(userRoleData && userRoleData.roleId && !userRoleData.roleId.startsWith('deleted_'));

    const modal = new ModalBuilder()
        .setCustomId(`modal_role_${style}`)
        .setTitle(`${style.charAt(0).toUpperCase() + style.slice(1)} Role`);

    // Only include the Name field if creating for the first time
    if (!hasExistingRole) {
        const nameInput = new TextInputBuilder()
            .setCustomId('role_name')
            .setPlaceholder('Tap to type...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true); 

        const nameLabel = new LabelBuilder()
            .setLabel('Custom Role Name')
            .setDescription('Enter Your Custom Role Name')
            .setTextInputComponent(nameInput); 

        modal.addLabelComponents(nameLabel);
    }

    // Text Display for Basic Colours
    const colorsText = new TextDisplayBuilder().setContent(
        'Basic Colours\n-# <:000001:1552333485492932608> **Black** : #000001 - <:FFFFFF:1552333488164708433> **White** : #FFFFFF\n-# <:FF0000:1552333490429894697> **Red** : #FF0000 - <:FFFF00:1552333492245893242> **Yellow** : #FFFF00\n-# <:0000FF:1552333494397567057> **Blue** : #0000FF - <:00FF00:1552333496523948112> **Green** : #00FF00'
    );
    modal.addTextDisplayComponents(colorsText);

    // Primary Colour Input
    const primaryColorInput = new TextInputBuilder()
        .setCustomId('primary_color')
        .setPlaceholder('Tap to type...')
        .setStyle(TextInputStyle.Short)
        .setMinLength(4)
        .setMaxLength(7)
        .setRequired(true);

    const primaryColorLabel = new LabelBuilder()
        .setLabel(isGradient ? 'Custom Role Primary Colour (HEX)' : 'Custom Role Colour (HEX)')
        .setTextInputComponent(primaryColorInput);

    modal.addLabelComponents(primaryColorLabel);

    // Secondary Colour Input
    if (isGradient) {
        const secondaryColorInput = new TextInputBuilder()
            .setCustomId('secondary_color')
            .setPlaceholder('Tap to type...')
            .setStyle(TextInputStyle.Short)
            .setMinLength(4)
            .setMaxLength(7)
            .setRequired(true);

        const secondaryColorLabel = new LabelBuilder()
            .setLabel('Custom Role Secondary Colour (HEX)')
            .setTextInputComponent(secondaryColorInput);
            
        modal.addLabelComponents(secondaryColorLabel);
    }

    // Custom Icon Input (shown when guild is Level 2 boost, optional)
    const hasRoleIcons = interaction.guild.premiumTier >= 2 || interaction.guild.features?.includes('ROLE_ICONS');
    if (hasRoleIcons) {
        const iconInput = new TextInputBuilder()
            .setCustomId('role_icon_input')
            .setPlaceholder('https://... or <:emoji:id>')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const iconLabel = new LabelBuilder()
            .setLabel('Custom Role Icon')
            .setDescription('Upload an image under 256 KB or pick a custom emoji from this server. We recommend at least 64x64 pixels. Members will see the icon for their highest role if they have multiple roles.')
            .setTextInputComponent(iconInput);

        modal.addLabelComponents(iconLabel);
    }

    return interaction.showModal(modal);
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // 1. --- MANAGE CUSTOM ROLE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === '2a064e6b81774bcf9c6a2778c5e0ac21') {
            const config = await ConfigDB.findOne({ guildId: interaction.guildId });
            const member = interaction.member;

            const isBooster = member.premiumSince !== null;
            const hasBypassRole = config?.bypassedRoles.some(roleId => member.roles.cache.has(roleId));
            const isBypassUser = config?.bypassedUsers.includes(member.id);

            if (!isBooster && !hasBypassRole && !isBypassUser) {
                return interaction.reply({ 
                    content: "<:no:1551365724314935296> You need to boost our server with Discord Nitro first!!", 
                    ephemeral: true 
                });
            }

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            const isExempt = interaction.member.roles.cache.some(role => EXEMPT_ROLES.includes(role.id));

            if (userRoleData && !isExempt) {
                const lastUpdated = userRoleData.lastUpdatedAt ? new Date(userRoleData.lastUpdatedAt).getTime() : 0;
                const now = Date.now();
                
                if (now - lastUpdated < ONE_DAY_MS) {
                    const nextAvailable = Math.floor((lastUpdated + ONE_DAY_MS) / 1000);
                    return interaction.reply({
                        content: `<:no:1551365724314935296> You can only update or recreate your custom role once a day! You can do this again <t:${nextAvailable}:R>.`,
                        ephemeral: true
                    });
                }
            }

            const hasActiveRole = !!(userRoleData && userRoleData.roleId && !userRoleData.roleId.startsWith('deleted_'));

            if (hasActiveRole) {
                const hasRoleIcons = interaction.guild.premiumTier >= 2 || interaction.guild.features?.includes('ROLE_ICONS');
                
                const manageButtons = [
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Edit Role Name")
                        .setEmoji("1551910425254432809")
                        .setCustomId("f3866b946b8c488dda4de32a1e728009"),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Change Role Style")
                        .setEmoji("1551901185735131146")
                        .setCustomId("7dcd1a8051764a7ef7e9d7b436ccec93"),
                ];

                if (hasRoleIcons) {
                    manageButtons.push(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel("Edit Role Icon")
                            .setEmoji("1551935969018511471")
                            .setCustomId("f6f14fa8076d4086db9a47b73ae75085")
                    );
                }

                const manageComponents = [
                    new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("# <:pen:1551910425254432809> Manage Custom Role"),
                        )
                        .addSeparatorComponents(
                            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addActionRowComponents(
                            new ActionRowBuilder().addComponents(manageButtons),
                        ),
                ];

                return interaction.reply({ 
                    components: manageComponents, 
                    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] 
                });
            }

            const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);
            if (!hasEnhancedRoleStyle) {
                return sendRoleModal(interaction, 'solid');
            }

            return interaction.reply({ 
                components: buildStyleSelectorComponents(), 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            });
        }

        // 1b. --- EDIT ROLE NAME BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === 'f3866b946b8c488dda4de32a1e728009') {
            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            const hasActiveRole = !!(userRoleData && userRoleData.roleId && !userRoleData.roleId.startsWith('deleted_'));

            if (!hasActiveRole) {
                return interaction.reply({
                    content: "<:no:1551365724314935296> You do not have an active custom role to edit.",
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_role_name_edit')
                .setTitle('Edit Role Name');

            const nameInput = new TextInputBuilder()
                .setCustomId('new_role_name')
                .setPlaceholder('Tap to type...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const nameLabel = new LabelBuilder()
                .setLabel('Custom Role Name')
                .setDescription('Enter your new custom role name')
                .setTextInputComponent(nameInput);

            modal.addLabelComponents(nameLabel);
            return interaction.showModal(modal);
        }

        // 1c. --- CHANGE ROLE STYLE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === '7dcd1a8051764a7ef7e9d7b436ccec93') {
            const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);

            if (!hasEnhancedRoleStyle) {
                return sendRoleModal(interaction, 'solid');
            }

            return interaction.update({ 
                components: buildStyleSelectorComponents(), 
                flags: [MessageFlags.IsComponentsV2]
            });
        }

        // 1d. --- EDIT ROLE ICON BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === 'f6f14fa8076d4086db9a47b73ae75085') {
            const hasRoleIcons = interaction.guild.premiumTier >= 2 || interaction.guild.features?.includes('ROLE_ICONS');
            if (!hasRoleIcons) {
                return interaction.reply({
                    content: "<:no:1551365724314935296> Server Boost Level 2 is required to set role icons.",
                    ephemeral: true
                });
            }

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            const hasActiveRole = !!(userRoleData && userRoleData.roleId && !userRoleData.roleId.startsWith('deleted_'));

            if (!hasActiveRole) {
                return interaction.reply({
                    content: "<:no:1551365724314935296> You do not have an active custom role to edit.",
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_role_icon_edit')
                .setTitle('Edit Role Icon');

            const iconInput = new TextInputBuilder()
                .setCustomId('role_icon_input')
                .setPlaceholder('https://... or <:emoji:id>')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const iconLabel = new LabelBuilder()
                .setLabel('Custom Role Icon')
                .setDescription('Upload an image under 256 KB or pick a custom emoji from this server. We recommend at least 64x64 pixels. Members will see the icon for their highest role if they have multiple roles.')
                .setTextInputComponent(iconInput);

            modal.addLabelComponents(iconLabel);
            return interaction.showModal(modal);
        }

        // 2. --- SELECT MENU HANDLER ---
        if (interaction.isStringSelectMenu() && interaction.customId === '7961861e646f4b8f9acccc9767c973ff') {
            const choice = interaction.values[0];
            const isGradient = choice === '5ab448a89aa04452b6f1276f6853296c';
            const selectedStyle = isGradient ? 'gradient' : 'solid';

            if (isGradient) {
                const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);
                if (!hasEnhancedRoleStyle) {
                    return interaction.reply({ 
                        content: '<:no:1551365724314935296> Sorry, the **GRADIENT** role style is not currently available', 
                        ephemeral: true 
                    });
                }
            }

            return sendRoleModal(interaction, selectedStyle);
        }

        // 3. --- INITIAL DELETE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === 'a1e2a2b3a3044a5ab488f7d5e2558a8c') {
            await interaction.deferReply({ ephemeral: true });

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });

            if (!userRoleData || !userRoleData.roleId || userRoleData.roleId.startsWith('deleted_')) {
                return interaction.editReply("<:no:1551365724314935296> You do not have a custom role yet");
            }

            const targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
            let actualPrimaryColor = targetRole ? targetRole.hexColor.toUpperCase() : formatDiscordColor(userRoleData.primaryColor);
            let actualSecondaryColor = userRoleData.secondaryColor ? formatDiscordColor(userRoleData.secondaryColor) : null;

            if (targetRole && targetRole.colors) {
                const secColorInt = targetRole.colors.secondaryColor ?? targetRole.colors.secondary_color;
                if (secColorInt !== undefined && secColorInt !== null) {
                    actualSecondaryColor = `#${secColorInt.toString(16).padStart(6, '0').toUpperCase()}`;
                }
            }

            const isGradient = userRoleData.style === 'gradient';
            let formattedColorText = `-# _Colour_: \`${actualPrimaryColor}\``;
            
            if (isGradient && actualSecondaryColor) {
                formattedColorText = `-# _Primary Colour_: \`${actualPrimaryColor}\`\n-# _Secondary Colour;_ \`${actualSecondaryColor}\``;
            }

            const confirmationComponents = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## <:trash:1551935964866150470> Delete Custom Role"),
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# _Role_: <@&${userRoleData.roleId}>\n${formattedColorText}`),
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Success)
                                    .setLabel("Yes, I am sure")
                                    .setEmoji({ name: "✔️" })
                                    .setCustomId("c724df3843ac4653b315b3ceec12d4a0"),
                            ),
                    ),
            ];

            return interaction.editReply({ 
                components: confirmationComponents, 
                flags: [MessageFlags.IsComponentsV2] 
            });
        }

        // 3b. --- CONFIRM DELETE ---
        if (interaction.isButton() && interaction.customId === 'c724df3843ac4653b315b3ceec12d4a0') {
            try {
                const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });

                if (!userRoleData || !userRoleData.roleId || userRoleData.roleId.startsWith('deleted_')) {
                    return interaction.reply({ 
                        content: "<:no:1551365724314935296> You do not have a custom role to delete.", 
                        ephemeral: true 
                    });
                }

                const targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
                let actualPrimaryColor = targetRole ? targetRole.hexColor.toUpperCase() : formatDiscordColor(userRoleData.primaryColor);
                let actualSecondaryColor = userRoleData.secondaryColor ? formatDiscordColor(userRoleData.secondaryColor) : null;

                if (targetRole && targetRole.colors) {
                    const secColorInt = targetRole.colors.secondaryColor ?? targetRole.colors.secondary_color;
                    if (secColorInt !== undefined && secColorInt !== null) {
                        actualSecondaryColor = `#${secColorInt.toString(16).padStart(6, '0').toUpperCase()}`;
                    }
                }

                const isGradient = userRoleData.style === 'gradient';
                let formattedColorText = `-# _Colour:_ \`${actualPrimaryColor}\``;
                if (isGradient && actualSecondaryColor) {
                    formattedColorText = `-# _Primary Colour:_ \`${actualPrimaryColor}\`\n-# _Secondary Colour:_ \`${actualSecondaryColor}\``;
                }

                const disabledComponents = [
                    new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## <:trash:1551935964866150470> Delete Custom Role"),
                        )
                        .addSeparatorComponents(
                            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`Are you sure you want delete your <@&${userRoleData.roleId}>?\n${formattedColorText}`),
                        )
                        .addActionRowComponents(
                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setStyle(ButtonStyle.Success)
                                        .setLabel("Yes, I am sure")
                                        .setEmoji({ name: "✔️" })
                                        .setCustomId("c724df3843ac4653b315b3ceec12d4a0")
                                        .setDisabled(true) 
                                ),
                        ),
                ];

                await interaction.update({ 
                    components: disabledComponents, 
                    flags: [MessageFlags.IsComponentsV2] 
                });

                if (targetRole) {
                    try {
                        await targetRole.delete("User deleted their custom role via panel");
                    } catch (error) {
                        console.error("Discord API Failed to delete role:", error);
                    }
                }

                userRoleData.roleId = `deleted_${interaction.user.id}`; 
                userRoleData.lastUpdatedAt = new Date();
                
                await userRoleData.save();

                return interaction.followUp({ 
                    content: "<:yes:1551365722729484370> Successfully deleted your custom role!", 
                    ephemeral: true 
                });

            } catch (error) {
                console.error("Database Save Error during deletion:", error);
                
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ 
                        content: "<:no:1551365724314935296> An error occurred while deleting your role from the database. Please contact an admin.", 
                        ephemeral: true 
                    });
                } else {
                    return interaction.followUp({ 
                        content: "<:no:1551365724314935296> An error occurred while deleting your role from the database. Please contact an admin.", 
                        ephemeral: true 
                    });
                }
            }
        }

        // 4. --- EDIT NAME MODAL SUBMISSION HANDLER ---
        if (interaction.isModalSubmit() && interaction.customId === 'modal_role_name_edit') {
            await interaction.deferReply({ ephemeral: true });

            const rawName = interaction.fields.getTextInputValue('new_role_name');
            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });

            if (!userRoleData || !userRoleData.roleId || userRoleData.roleId.startsWith('deleted_')) {
                return interaction.editReply("<:no:1551365724314935296> You do not have an active custom role to edit.");
            }

            const targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
            if (!targetRole) {
                return interaction.editReply("<:no:1551365724314935296> Could not find your role on this server.");
            }

            const isBooster = interaction.member.premiumSince !== null;
            const prefix = isBooster ? '[booster]' : '[custom]';
            const cleanName = rawName.replace(/^(\[booster\]|\[custom\]|\(custom\))\s*/i, '').trim();
            const formattedName = `${prefix}${cleanName}`;

            try {
                await targetRole.edit({ name: formattedName });

                userRoleData.lastUpdatedAt = new Date();
                await userRoleData.save();

                let successText = `<:yes:1551365722729484370> Successfully updated your ${targetRole} role to:\n`;
                successText += `-# _Role Name:_ ${formattedName}`;

                return interaction.editReply(successText);
            } catch (error) {
                console.error("Role Name Edit Error:", error);
                return interaction.editReply("<:no:1551365724314935296> Failed to update role name. Please ensure the bot has proper permissions.");
            }
        }

        // 5. --- EDIT ICON MODAL SUBMISSION HANDLER ---
        if (interaction.isModalSubmit() && interaction.customId === 'modal_role_icon_edit') {
            await interaction.deferReply({ ephemeral: true });

            let rawIcon = null;
            try {
                rawIcon = interaction.fields.getTextInputValue('role_icon_input');
            } catch (err) { }

            const parsedIconUrl = parseIconInput(rawIcon);

            if (!parsedIconUrl) {
                return interaction.editReply("<:no:1551365724314935296> Invalid image link or emoji provided.");
            }

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            if (!userRoleData || !userRoleData.roleId || userRoleData.roleId.startsWith('deleted_')) {
                return interaction.editReply("<:no:1551365724314935296> You do not have an active custom role to edit.");
            }

            const targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
            if (!targetRole) {
                return interaction.editReply("<:no:1551365724314935296> Could not find your role on this server.");
            }

            try {
                await targetRole.edit({ icon: parsedIconUrl });

                userRoleData.lastUpdatedAt = new Date();
                await userRoleData.save();

                const iconSuccessComponents = [
                    new SectionBuilder()
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(parsedIconUrl)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`<:yes:1551365722729484370> Successfully updated your ${targetRole} role to:`),
                        ),
                ];

                return interaction.editReply({ 
                    components: iconSuccessComponents,
                    flags: [MessageFlags.IsComponentsV2]
                });
            } catch (error) {
                console.error("Role Icon Edit Error:", error);
                return interaction.editReply("<:no:1551365724314935296> Failed to update role icon. Ensure the link/emoji is valid and the server has Level 2 Boost.");
            }
        }

        // 6. --- STYLE MODAL SUBMISSION HANDLER ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_role_')) {
            await interaction.deferReply({ ephemeral: true });

            const newStyle = interaction.customId.replace('modal_role_', ''); 
            
            if (newStyle === 'gradient') {
                const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);
                if (!hasEnhancedRoleStyle) {
                    return interaction.editReply('<:no:1551365724314935296> Sorry, the **GRADIENT** role style is not currently available');
                }
            }

            let rawName = null;
            try {
                rawName = interaction.fields.getTextInputValue('role_name');
            } catch { }

            const primaryColorHex = interaction.fields.getTextInputValue('primary_color'); 
            
            let secondaryColorHex = null;
            if (newStyle === 'gradient') {
                secondaryColorHex = interaction.fields.getTextInputValue('secondary_color');
            }

            let rawIcon = null;
            try {
                rawIcon = interaction.fields.getTextInputValue('role_icon_input');
            } catch (err) { }
            
            const parsedIconUrl = parseIconInput(rawIcon);

            const anchorRole = interaction.guild.roles.cache.get(ANCHOR_ROLE_ID);
            const boundaryRole = interaction.guild.roles.cache.get(BOUNDARY_ROLE_ID);
            if (!anchorRole || !boundaryRole) return interaction.editReply("Error: Anchor or boundary role not found in the server.");

            const isBooster = interaction.member.premiumSince !== null;
            const prefix = isBooster ? '[booster]' : '[custom]';
            const targetPosition = isBooster ? anchorRole.position - 1 : boundaryRole.position + 1;

            let formattedName = null;
            if (rawName && rawName.trim().length > 0) {
                const cleanName = rawName.replace(/^(\[booster\]|\[custom\]|\(custom\))\s*/i, '');
                formattedName = `${prefix}${cleanName}`;
            }

            const customColorsPayload = {
                primaryColor: primaryColorHex,
                secondaryColor: newStyle === 'gradient' ? secondaryColorHex : null,
                tertiaryColor: null
            };

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            
            let targetRole;
            if (userRoleData && userRoleData.roleId && !userRoleData.roleId.startsWith('deleted_')) {
                targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
            }

            try {
                if (targetRole) {
                    const editPayload = {
                        colors: customColorsPayload,
                        permissions: [],
                        position: targetPosition 
                    };

                    if (formattedName) {
                        editPayload.name = formattedName;
                    }

                    if (parsedIconUrl) {
                        editPayload.icon = parsedIconUrl;
                    }
                    
                    await targetRole.edit(editPayload);

                    userRoleData.style = newStyle;
                    userRoleData.primaryColor = primaryColorHex;
                    userRoleData.secondaryColor = secondaryColorHex;
                    userRoleData.lastUpdatedAt = new Date();
                    await userRoleData.save();

                    const safePrimary = formatDiscordColor(primaryColorHex);
                    const safeSecondary = secondaryColorHex ? formatDiscordColor(secondaryColorHex) : null;
                    
                    let successText = `<:yes:1551365722729484370> Successfully updated your ${targetRole} role to:\n`;
                    successText += `-# _Role Style:_ ${newStyle.charAt(0).toUpperCase() + newStyle.slice(1)}\n`;
                    
                    if (newStyle === 'gradient' && safeSecondary) {
                        successText += `-# _Primary Colour:_ \`${safePrimary}\`\n`;
                        successText += `-# _Secondary Colour:_ \`${safeSecondary}\``;
                    } else {
                        successText += `-# _Colour:_ \`${safePrimary}\``;
                    }

                    return interaction.editReply(successText);
                }

                targetRole = await interaction.guild.roles.create({
                    name: formattedName || `${prefix} Custom Role`,
                    colors: customColorsPayload,
                    icon: parsedIconUrl || null,
                    permissions: [],
                    position: targetPosition, 
                    reason: `Custom role created by ${interaction.user.tag}`
                });

                await interaction.member.roles.add(targetRole);
                
                if (userRoleData) {
                    userRoleData.roleId = targetRole.id;
                    userRoleData.style = newStyle;
                    userRoleData.primaryColor = primaryColorHex;
                    userRoleData.secondaryColor = secondaryColorHex;
                    userRoleData.lastUpdatedAt = new Date();
                    await userRoleData.save();
                } else {
                    await UserRoleDB.create({
                        guildId: interaction.guildId,
                        userId: interaction.user.id,
                        roleId: targetRole.id,
                        style: newStyle,
                        primaryColor: primaryColorHex,
                        secondaryColor: secondaryColorHex,
                        lastUpdatedAt: new Date()
                    });
                }

                return interaction.editReply(`<:yes:1551365722729484370> Successfully created your custom role as ${targetRole}`);

            } catch (error) {
                console.error("Custom Role Error:", error);
                return interaction.editReply("<:no:1551365724314935296> Please ensure the **HEX** format is correct and any icon link/emoji is valid!");
            }
        }
    }
};
