const { 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    FileUploadBuilder, 
    LabelBuilder 
} = require('discord.js');
const ConfigDB = require('../schema/CustomRoleConfig');
const UserRoleDB = require('../schema/CustomRoleUser');

const tempStyleSelections = new Map();
const ANCHOR_ROLE_ID = '1528641882089984121';

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // 1. --- STRING SELECT MENU HANDLER ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'eb2559e1d55f44528d5b0fe72b13b06c') {
            const config = await ConfigDB.findOne({ guildId: interaction.guildId });
            const choice = interaction.values[0];

            if (choice === 'ba5a1daeadf14cff8d7e388e04921def') { 
                if (!config || !config.gradientEnabled) {
                    return interaction.reply({ content: '<:no:1551365724314935296> SORRY, THE **GRADIENT ROLE STYLE** IS NOT AVAILABLE CURRENTLY', ephemeral: true });
                }
                tempStyleSelections.set(interaction.user.id, 'gradient');
                return interaction.reply({ content: '<:yes:1551365722729484370> YOU SELECTED **GRADIENT** STYLE. CLICK THE BUTTON BELOW TO CONTINUE!', ephemeral: true });
            } 
            
            if (choice === 'ed4cec44c7b34760d6e20bd187f2cb89') { 
                tempStyleSelections.set(interaction.user.id, 'solid');
                return interaction.reply({ content: '<:yes:1551365722729484370> YOU SELECTED **SOLID** STYLE. CLICK THE BUTTON BELOW TO CONTINUE!', ephemeral: true });
            }
        }

        // 2. --- DELETE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === '4e0779b652fa4ee2fcce65c32d8dbf30') {
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

            // Remove from Database
            await UserRoleDB.deleteOne({ guildId: interaction.guildId, userId: interaction.user.id });

            return interaction.editReply("<:yes:1551365722729484370> SUCCESSFULLY DELETED YOUR CUSTOM ROLE!");
        }

        // 3. --- MANAGE BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === '786aa1a0fb134a6fb45d3723eefb9e01') {
            const config = await ConfigDB.findOne({ guildId: interaction.guildId });
            const member = interaction.member;

            const isBooster = member.premiumSince !== null;
            const hasBypassRole = config?.bypassedRoles.some(roleId => member.roles.cache.has(roleId));
            const isBypassUser = config?.bypassedUsers.includes(member.id);

            if (!isBooster && !hasBypassRole && !isBypassUser) {
                return interaction.reply({ content: "<:no:1551365724314935296> YOU NEED TO BOOST OUR SEEVER WITH DISCORD NITRO FIRST!", ephemeral: true });
            }

            const selectedStyle = tempStyleSelections.get(interaction.user.id);
            if (!selectedStyle) {
                return interaction.reply({ content: "<:no:1551365724314935296> PLEASE SELECT A **ROLE STYLE** FIRST!", ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_role_${selectedStyle}`)
                .setTitle(`Configure ${selectedStyle.charAt(0).toUpperCase() + selectedStyle.slice(1)} Role`);

            const nameInput = new TextInputBuilder()
                .setCustomId('role_name')
                .setLabel('Custom Role Name')
                .setPlaceholder('Enter...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const primaryColor = new TextInputBuilder()
                .setCustomId('primary_color')
                .setLabel(selectedStyle === 'solid' ? 'Custom Role Colour (HEX)' : 'Custom Role Primary Colour (HEX)')
                .setPlaceholder('Ex: #ffffff, #000001')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            modal.addComponents(new ActionRowBuilder().addComponents(primaryColor));

            if (selectedStyle === 'gradient') {
                const secondaryColor = new TextInputBuilder()
                    .setCustomId('secondary_color')
                    .setLabel('Custom Role Secondary Colour (HEX)')
                    .setPlaceholder('Ex: #ffffff, #000001')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(secondaryColor));
            }

            if (interaction.guild.premiumTier >= 2) {
                const iconUpload = new FileUploadBuilder().setCustomId('role_icon_file');
                const iconLabel = new LabelBuilder()
                    .setLabel('Custom Role Icon')
                    .setDescription('This icon will be displayed next to your name (optional)')
                    .setFileUploadComponent(iconUpload);
                
                modal.addLabelComponents(iconLabel);
            }

            await interaction.showModal(modal);
        }

        // 4. --- MODAL SUBMISSION HANDLER ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_role_')) {
            await interaction.deferReply({ ephemeral: true });

            const newStyle = interaction.customId.replace('modal_role_', ''); 
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
                        
                        await targetRole.edit({
                            name: name,
                            colors: customColorsPayload,
                            icon: iconBufferOrUrl || null
                        });

                        userRoleData.style = newStyle;
                        userRoleData.primaryColor = primaryColorHex;
                        userRoleData.secondaryColor = secondaryColorHex;
                        await userRoleData.save();

                        return interaction.editReply(`<:yes:1551365722729484370> SUCCESSFULLY UPDATED YOUR CUSTOM ROLE TO **${newStyle.toUpperCase()}**: ${targetRole}`);
                    }
                }

                targetRole = await interaction.guild.roles.create({
                    name: name,
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
