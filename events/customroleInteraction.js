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

// Temporary in-memory cache to remember what style a user selected in the dropdown
const tempStyleSelections = new Map();
const ANCHOR_ROLE_ID = '1528641882089984121';

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // 1. --- STRING SELECT MENU HANDLER ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'eb2559e1d55f44528d5b0fe72b13b06c') {
            const config = await ConfigDB.findOne({ guildId: interaction.guildId });
            const choice = interaction.values[0];

            if (choice === 'ba5a1daeadf14cff8d7e388e04921def') { // Gradient
                if (!config || !config.gradientEnabled) {
                    return interaction.reply({ content: '<:no:1551365724314935296> SORRY, THE **GRADIENT ROLE STYLE** IS NOT AVAILABLE CURRENTLY', ephemeral: true });
                }
                tempStyleSelections.set(interaction.user.id, 'gradient');
                return interaction.reply({ content: 'YOU SELECTED THE **GRADIENT** STYLE. CLICK THE **MANAGE CUSTOM ROLE** BUTTON TO CONTINUE!', ephemeral: true });
            } 
            
            if (choice === 'ed4cec44c7b34760d6e20bd187f2cb89') { // Solid
                tempStyleSelections.set(interaction.user.id, 'solid');
                return interaction.reply({ content: 'YOU SELECTED THE **SOLID** STYLE. CLICK THE **MANAGE CUSTOM ROLE** BUTTON TO CONTINUE!', ephemeral: true });
            }
        }

        // 2. --- BUTTON HANDLER ---
        if (interaction.isButton() && interaction.customId === '786aa1a0fb134a6fb45d3723eefb9e01') {
            const config = await ConfigDB.findOne({ guildId: interaction.guildId });
            const member = interaction.member;

            // Permission check: Nitro Booster, Bypass Role, or Bypass User
            const isBooster = member.premiumSince !== null;
            const hasBypassRole = config?.bypassedRoles.some(roleId => member.roles.cache.has(roleId));
            const isBypassUser = config?.bypassedUsers.includes(member.id);

            if (!isBooster && !hasBypassRole && !isBypassUser) {
                return interaction.reply({ content: "<:no:1551365724314935296> YOU NEED TO BOOST OUR SERVER WITH DISCORD NITRO FIRST!", ephemeral: true });
            }

            const selectedStyle = tempStyleSelections.get(interaction.user.id);
            if (!selectedStyle) {
                return interaction.reply({ content: "<:no:1551365724314935296> PLEASE SELECT A **ROLE STYLE FIRST**!", ephemeral: true });
            }

            // Build Modal
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

            // Using ActionRowBuilder for Text Inputs
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

            // Tier 2 File Upload logic using custom builders
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

        // 3. --- MODAL SUBMISSION HANDLER ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_role_')) {
            await interaction.deferReply({ ephemeral: true });

            const name = interaction.fields.getTextInputValue('role_name');
            const color = interaction.fields.getTextInputValue('primary_color'); // Natively discord only supports 1 color per role
            
            // Try to extract the custom file upload if it exists
            let iconBufferOrUrl = null;
            try {
                const fileAttachment = interaction.fields.getAttachment('role_icon_file');
                if (fileAttachment) {
                    iconBufferOrUrl = fileAttachment.url;
                }
            } catch (err) {
                // Ignore if field doesn't exist (e.g. Server isn't Tier 2)
            }

            const anchorRole = interaction.guild.roles.cache.get(ANCHOR_ROLE_ID);
            if (!anchorRole) return interaction.editReply("Error: Anchor role not found in the server.");

            const userRoleData = await UserRoleDB.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
            let targetRole;

            try {
                // EDIT EXISTING ROLE
                if (userRoleData) {
                    targetRole = interaction.guild.roles.cache.get(userRoleData.roleId);
                    if (targetRole) {
                        await targetRole.edit({
                            name: name,
                            color: color,
                            icon: iconBufferOrUrl || null
                        });
                        return interaction.editReply(`<:yes:1551365722729484370> YOUR CUSTOM ROLE HAS BEEN UPDATED AS ${targetRole}`);
                    }
                }

                // OR CREATE NEW ROLE
                targetRole = await interaction.guild.roles.create({
                    name: name,
                    color: color,
                    icon: iconBufferOrUrl || null,
                    position: anchorRole.position - 1, // Place below the anchor
                    reason: `Custom role created by ${interaction.user.tag}`
                });

                // Assign role & save to DB
                await interaction.member.roles.add(targetRole);
                await UserRoleDB.create({
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    roleId: targetRole.id
                });

                return interaction.editReply(`<:yes:1551365722729484370> YOUR CUSTOM ROLE HAS BEEN CREATED AS ${targetRole}`);

            } catch (error) {
                console.error("Custom Role Error:", error);
                return interaction.editReply("❌ There was an error managing your role. Make sure the bot's highest role is above the anchor role, and check your HEX format.");
            }
        }
    }
};
