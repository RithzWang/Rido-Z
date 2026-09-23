const { 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    FileUploadBuilder, 
    LabelBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    SelectMenuOptionBuilder,
    MessageFlags
} = require('discord.js');
const ConfigDB = require('../schema/CustomRoleConfig');
const UserRoleDB = require('../schema/CustomRoleUser');

const ANCHOR_ROLE_ID = '894154962685284362';
const BOUNDARY_ROLE_ID = '1552136781984436264'; // Documented for hierarchy reference

// Cooldown Configuration
const EXEMPT_USERS = ['83774127560300962', '1469705529306910753'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function checkEnhancedRolePerk(guild) {
    try {
        const fetchedGuild = await guild.fetch();
        return fetchedGuild.features?.includes('ENHANCED_ROLE_COLORS');
    } catch {
        return guild.features?.includes('ENHANCED_ROLE_COLORS');
    }
}

async function sendRoleModal(interaction, style) {
    const isGradient = style === 'gradient';
    const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
    const hasExistingRole = !!userRoleData;

    // --- 24-HOUR COOLDOWN CHECK ---
    if (hasExistingRole && !EXEMPT_USERS.includes(interaction.user.id)) {
        const lastUpdated = userRoleData.lastUpdatedAt ? new Date(userRoleData.lastUpdatedAt).getTime() : 0;
        const now = Date.now();
        
        if (now - lastUpdated < ONE_DAY_MS) {
            const nextAvailable = Math.floor((lastUpdated + ONE_DAY_MS) / 1000);
            return interaction.reply({
                content: `<:no:1551365724314935296> YOU CAN ONLY UPDATE YOUR CUSTOM ROLE ONCE A DAY! YOU CAN UPDATE IT AGAIN <t:${nextAvailable}:R>.`,
                ephemeral: true
            });
        }
    }

    const modal = new ModalBuilder()
        .setCustomId(`modal_role_${style}`)
        .setTitle(`Configure ${style.charAt(0).toUpperCase() + style.slice(1)} Role`);

    const nameInput = new TextInputBuilder()
        .setCustomId('role_name')
        .setLabel('Custom Role Name')
        .setPlaceholder(hasExistingRole ? 'Leave blank to keep current name' : 'Enter...')
        .setStyle(TextInputStyle.Short)
        .setRequired(!hasExistingRole); 

    const primaryColor = new TextInputBuilder()
        .setCustomId('primary_color')
        .setLabel(isGradient ? 'Custom Role Primary Colour (HEX)' : 'Custom Role Colour (HEX)')
        .setPlaceholder('Ex: #ffffff, #000001')
        .setStyle(TextInputStyle.Short)
        .setMinLength(4)
        .setMaxLength(7)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    modal.addComponents(new ActionRowBuilder().addComponents(primaryColor));

    if (isGradient) {
        const secondaryColor = new TextInputBuilder()
            .setCustomId('secondary_color')
            .setLabel('Custom Role Secondary Colour (HEX)')
            .setPlaceholder('Ex: #ffffff, #000001')
            .setStyle(TextInputStyle.Short)
            .setMinLength(4)
            .setMaxLength(7)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(secondaryColor));
    }

    const hasRoleIcons = interaction.guild.premiumTier >= 2 || interaction.guild.features?.includes('ROLE_ICONS');
    if (hasRoleIcons) {
        const iconUpload = new FileUploadBuilder().setCustomId('role_icon_file');
        const iconLabel = new LabelBuilder()
            .setLabel('Custom Role Icon')
            .setDescription('This icon will be displayed next to your name (optional)')
            .setFileUploadComponent(iconUpload);
        
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
                    content: "<:no:1551365724314935296> YOU NEED TO BOOST OUR SERVER WITH DISCORD NITRO FIRST!", 
                    ephemeral: true 
                });
            }

            const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);

            if (!hasEnhancedRoleStyle) {
                return sendRoleModal(interaction, 'solid');
            }

            const styleSelectorComponents = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## <:brush:1551910052795908216> Select Custom Style"),
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
                                        new SelectMenuOptionBuilder()
                                            .setLabel("Solid")
                                            .setValue("3edc1c1c1bee48f6eac26b9555e5a408")
                                            .setEmoji({ name: "1️⃣" }),
                                        new SelectMenuOptionBuilder()
                                            .setLabel("Gradient")
                                            .setValue("5ab448a89aa04452b6f1276f6853296c")
                                            .setEmoji({ name: "2️⃣" })
                                    ),
                            ),
                    ),
            ];

            return interaction.reply({ 
                components: styleSelectorComponents, 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            });
        }

        // 2. --- SELECT MENU HANDLER (OPENS MODAL) ---
        if (interaction.isStringSelectMenu() && interaction.customId === '7961861e646f4b8f9acccc9767c973ff') {
            const choice = interaction.values[0];
            const isGradient = choice === '5ab448a89aa04452b6f1276f6853296c';
            const selectedStyle = isGradient ? 'gradient' : 'solid';

            if (isGradient) {
                const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);
                if (!hasEnhancedRoleStyle) {
                    return interaction.reply({ 
                        content: '<:no:1551365724314935296> SORRY, THE **GRADIENT** ROLE STYLE IS NOT AVAILABLE CURRENTLY', 
                        ephemeral: true 
                    });
                }
            }

            return sendRoleModal(interaction, selectedStyle);
        }

        // 3. --- DELETE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === 'a1e2a2b3a3044a5ab488f7d5e2558a8c') {
            await interaction.deferReply({ ephemeral: true });

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });

            if (!userRoleData) {
                return interaction.editReply("<:no:1551365724314935296> YOU DON’T HAVE A CUSTOM ROLE YET");
            }

            const targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
            if (targetRole) {
                try {
                    await targetRole.delete("User deleted their custom role via panel");
                } catch (error) {
                    console.error("Failed to delete role:", error);
                }
            }

            await UserRoleDB.deleteOne({ guildId: interaction.guildId, userId: interaction.user.id });
            return interaction.editReply("<:yes:1551365722729484370> SUCCESSFULLY DELETED YOUR CUSTOM ROLE!");
        }

        // 4. --- MODAL SUBMISSION HANDLER ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_role_')) {
            await interaction.deferReply({ ephemeral: true });

            const newStyle = interaction.customId.replace('modal_role_', ''); 
            
            if (newStyle === 'gradient') {
                const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);
                if (!hasEnhancedRoleStyle) {
                    return interaction.editReply('<:no:1551365724314935296> SORRY, THE **GRADIENT** ROLE STYLE IS NOT AVAILABLE CURRENTLY');
                }
            }

            const rawName = interaction.fields.getTextInputValue('role_name');
            const primaryColorHex = interaction.fields.getTextInputValue('primary_color'); 
            
            let secondaryColorHex = null;
            if (newStyle === 'gradient') {
                secondaryColorHex = interaction.fields.getTextInputValue('secondary_color');
            }
            
            let iconBufferOrUrl = null;
            try {
                const fileAttachment = interaction.fields.getAttachment('role_icon_file');
                if (fileAttachment) iconBufferOrUrl = fileAttachment.url;
            } catch (err) { }

            const anchorRole = interaction.guild.roles.cache.get(ANCHOR_ROLE_ID);
            const boundaryRole = interaction.guild.roles.cache.get(BOUNDARY_ROLE_ID);
            if (!anchorRole || !boundaryRole) return interaction.editReply("Error: Anchor or boundary role not found in the server.");

            // Determine tag based on booster vs bypass status
            const isBooster = interaction.member.premiumSince !== null;
            const prefix = isBooster ? '[booster]' : '[custom]';

            // Boosters slot right below the top anchor; Bypass users slot right above the bottom boundary
            const targetPosition = isBooster ? anchorRole.position - 1 : boundaryRole.position + 1;

            let formattedName = null;
            if (rawName && rawName.trim().length > 0) {
                const cleanName = rawName.replace(/^(\[booster\]|\[custom\]|\(custom\))\s*/i, '');
                formattedName = `${prefix} ${cleanName}`;
            }

            const customColorsPayload = {
                primaryColor: primaryColorHex,
                secondaryColor: newStyle === 'gradient' ? secondaryColorHex : null,
                tertiaryColor: null
            };

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            let targetRole;

            try {
                if (userRoleData) {
                    targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
                    if (targetRole) {
                        const editPayload = {
                            colors: customColorsPayload,
                            icon: iconBufferOrUrl || null,
                            permissions: [],
                            position: targetPosition // Dynamically updates hierarchy if a user boosts later
                        };

                        if (formattedName) {
                            editPayload.name = formattedName;
                        }
                        
                        await targetRole.edit(editPayload);

                        userRoleData.style = newStyle;
                        userRoleData.primaryColor = primaryColorHex;
                        userRoleData.secondaryColor = secondaryColorHex;
                        userRoleData.lastUpdatedAt = new Date();
                        await userRoleData.save();

                        return interaction.editReply(`<:yes:1551365722729484370> SUCCESSFULLY UPDATED YOUR CUSTOM ROLE TO **${newStyle.toUpperCase()}**: ${targetRole}`);
                    }
                }

                targetRole = await interaction.guild.roles.create({
                    name: formattedName || `${prefix} Custom Role`,
                    colors: customColorsPayload,
                    icon: iconBufferOrUrl || null,
                    permissions: [],
                    position: targetPosition, 
                    reason: `Custom role created by ${interaction.user.tag}`
                });

                await interaction.member.roles.add(targetRole);
                
                await UserRoleDB.create({
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    roleId: targetRole.id,
                    style: newStyle,
                    primaryColor: primaryColorHex,
                    secondaryColor: secondaryColorHex,
                    lastUpdatedAt: new Date()
                });

                return interaction.editReply(`<:yes:1551365722729484370> SUCCESSFULLY CREATED YOUR CUSTOM ROLE AS ${targetRole}`);

            } catch (error) {
                console.error("Custom Role Error:", error);
                return interaction.editReply("<:no:1551365724314935296> PLEASE ENSURE THE **HEX** FORMAT IS CORRECT!");
            }
        }
    }
};
