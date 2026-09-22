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

const ANCHOR_ROLE_ID = '1528641882089984121';

// Updated helper using the confirmed ENHANCED_ROLE_COLORS flag
async function checkEnhancedRolePerk(guild) {
    try {
        const fetchedGuild = await guild.fetch();
        return fetchedGuild.features?.includes('ENHANCED_ROLE_COLORS');
    } catch {
        return guild.features?.includes('ENHANCED_ROLE_COLORS');
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // 1. --- MANAGE CUSTOM ROLE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === '19d59d52506f46d7aeae1d22ab93ef1b') {
            const config = await ConfigDB.findOne({ guildId: interaction.guildId });
            const member = interaction.member;

            const isBooster = member.premiumSince !== null;
            const hasBypassRole = config?.bypassedRoles.some(roleId => member.roles.cache.has(roleId));
            const isBypassUser = config?.bypassedUsers.includes(member.id);

            if (!isBooster && !hasBypassRole && !isBypassUser) {
                return interaction.reply({ 
                    content: "<:no:1551365724314935296> YOU NEED TO BOOST OUR SERVER WITH DISCORD NITRO FIRST!", 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const hasEnhancedRoleStyle = await checkEnhancedRolePerk(interaction.guild);

            const gradientOption = new SelectMenuOptionBuilder()
                .setLabel("Gradient")
                .setValue("4fa214a59b764902d1ee76040341a5f4");

            if (!hasEnhancedRoleStyle) {
                gradientOption.setDisabled(true);
            }

            const styleSelectorComponents = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## <:brush:1551910052795908216> Select Role Style"),
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId("dd9a64149d5a4124ea4e263fc2b09cc4")
                                    .setPlaceholder("Solid & Gradient")
                                    .addOptions(
                                        new SelectMenuOptionBuilder()
                                            .setLabel("Solid")
                                            .setValue("2279caf5311e4e05ae9c455b9c94eb6c"),
                                        gradientOption
                                    ),
                            ),
                    ),
            ];

            return interaction.reply({ 
                components: styleSelectorComponents, 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            });
        }

        // 2. --- SELECT MENU HANDLER (OPENS MODAL DIRECTLY) ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'dd9a64149d5a4124ea4e263fc2b09cc4') {
            const choice = interaction.values[0];
            const isGradient = choice === '4fa214a59b764902d1ee76040341a5f4';
            const selectedStyle = isGradient ? 'gradient' : 'solid';

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            const hasExistingRole = !!userRoleData;

            const modal = new ModalBuilder()
                .setCustomId(`modal_role_${selectedStyle}`)
                .setTitle(`Configure ${selectedStyle.charAt(0).toUpperCase() + selectedStyle.slice(1)} Role`);

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
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            modal.addComponents(new ActionRowBuilder().addComponents(primaryColor));

            if (isGradient) {
                const secondaryColor = new TextInputBuilder()
                    .setCustomId('secondary_color')
                    .setLabel('Custom Role Secondary Colour (HEX)')
                    .setPlaceholder('Ex: #ffffff, #000001')
                    .setStyle(TextInputStyle.Short)
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

        // 3. --- DELETE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === 'a32f08479fbd434d9fb0bcfc79811f02') {
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

            const name = interaction.fields.getTextInputValue('role_name');
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
            if (!anchorRole) return interaction.editReply("Error: Anchor role not found in the server.");

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
                            icon: iconBufferOrUrl || null
                        };

                        if (name && name.trim().length > 0) {
                            editPayload.name = name;
                        }
                        
                        await targetRole.edit(editPayload);

                        userRoleData.style = newStyle;
                        userRoleData.primaryColor = primaryColorHex;
                        userRoleData.secondaryColor = secondaryColorHex;
                        await userRoleData.save();

                        return interaction.editReply(`<:yes:1551365722729484370> SUCCESSFULLY UPDATED YOUR CUSTOM ROLE TO **${newStyle.toUpperCase()}**: ${targetRole}`);
                    }
                }

                targetRole = await interaction.guild.roles.create({
                    name: name || 'Custom Role',
                    colors: customColorsPayload,
                    icon: iconBufferOrUrl || null,
                    position: anchorRole.position - 1, 
                    reason: `Custom role created by ${interaction.user.tag}`
                });

                await interaction.member.roles.add(targetRole);
                
                await UserRoleDB.create({
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    roleId: targetRole.id,
                    style: newStyle,
                    primaryColor: primaryColorHex,
                    secondaryColor: secondaryColorHex
                });

                return interaction.editReply(`<:yes:1551365722729484370> SUCCESSFULLY CREATED YOUR CUSTOM ROLE AS ${targetRole}`);

            } catch (error) {
                console.error("Custom Role Error:", error);
                return interaction.editReply("<:no:1551365724314935296> PLEASE ENSURE THE **HEX** FORMAT IS CORRECT!");
            }
        }
    }
};
