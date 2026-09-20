const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags, 
    ChannelType, 
    ContainerBuilder,      
    TextDisplayBuilder,    
    SeparatorBuilder,      
    SeparatorSpacingSize 
} = require('discord.js');

// --- HELPER: Repack buttons into rows of 5 ---
function packButtons(buttons) {
    const rows = [];
    let currentRow = new ActionRowBuilder();

    buttons.forEach(btn => {
        currentRow.addComponents(btn);
        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    if (currentRow.components.length > 0) rows.push(currentRow);
    return rows;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolebutton')
        .setDescription('Manage role buttons')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // --- SETUP COMMAND ---
        .addSubcommand(sub => {
            sub.setName('setup')
                .setDescription('Create a NEW button menu')
                .addStringOption(opt => opt.setName('title').setDescription('Menu Title').setRequired(true))
                .addBooleanOption(opt => opt.setName('multi_select').setDescription('Allow multiple roles? (True = Toggle, False = 1 Only)').setRequired(true))
                .addRoleOption(opt => opt.setName('role1').setDescription('Role 1 (Required)').setRequired(true))
                .addRoleOption(opt => opt.setName('required_role').setDescription('Only users with this role can click buttons (Optional)'))
                .addStringOption(opt => opt.setName('emoji1').setDescription('Emoji for Role 1'))
                .addChannelOption(opt => opt.setName('channel')
                    .setDescription('Where to post?')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread))
                .addStringOption(opt => opt.setName('message_id').setDescription('Reuse a bot message ID'));

            for (let i = 2; i <= 5; i++) {
                sub.addRoleOption(opt => opt.setName(`role${i}`).setDescription(`Role ${i}`))
                   .addStringOption(opt => opt.setName(`emoji${i}`).setDescription(`Emoji ${i}`));
            }
            return sub;
        })

        // --- ADD COMMAND ---
        .addSubcommand(sub => {
            sub.setName('add')
                .setDescription('Add buttons to an EXISTING menu')
                .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID').setRequired(true))
                .addRoleOption(opt => opt.setName('role1').setDescription('Role 1 to add').setRequired(true))
                .addChannelOption(opt => opt.setName('channel')
                    .setDescription('Channel where the menu is')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread))
                .addStringOption(opt => opt.setName('emoji1').setDescription('Emoji for Role 1'));
            
            for (let i = 2; i <= 5; i++) {
                sub.addRoleOption(opt => opt.setName(`role${i}`).setDescription(`Role ${i}`))
                   .addStringOption(opt => opt.setName(`emoji${i}`).setDescription(`Emoji ${i}`));
            }
            return sub;
        })

        // --- REMOVE COMMAND ---
        .addSubcommand(sub => {
            sub.setName('remove')
                .setDescription('Remove buttons from an EXISTING menu')
                .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID').setRequired(true))
                .addRoleOption(opt => opt.setName('role1').setDescription('Role 1 to remove').setRequired(true))
                .addChannelOption(opt => opt.setName('channel')
                    .setDescription('Channel where the menu is')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread));

            for (let i = 2; i <= 5; i++) {
                sub.addRoleOption(opt => opt.setName(`role${i}`).setDescription(`Role ${i}`));
            }
            return sub;
        })

        // --- REFRESH COMMAND ---
        .addSubcommand(sub => 
            sub.setName('refresh')
                .setDescription('Update button labels and optionally the title')
                .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID').setRequired(true))
                .addChannelOption(opt => opt.setName('channel')
                    .setDescription('Channel where the menu is')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread))
                .addStringOption(opt => opt.setName('new_title').setDescription('Change the menu title (Optional)'))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const sub = interaction.options.getSubcommand();
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // ===============================================
        // 1. SETUP LOGIC
        // ===============================================
        if (sub === 'setup') {
            const title = interaction.options.getString('title');
            const multiSelect = interaction.options.getBoolean('multi_select');
            const reuseMessageId = interaction.options.getString('message_id');
            const requiredRole = interaction.options.getRole('required_role');

            let idPrefix = "";
            if (requiredRole) {
                idPrefix = multiSelect ? `btn_r_${requiredRole.id}_` : `btn_rs_${requiredRole.id}_`;
            } else {
                idPrefix = multiSelect ? 'btn_role_' : 'btn_single_';
            }

            const buttons = [];
            const descriptionLines = []; 

            for (let i = 1; i <= 5; i++) {
                const role = interaction.options.getRole(`role${i}`);
                const emoji = interaction.options.getString(`emoji${i}`);
                
                if (role) {
                    if (role.position >= interaction.guild.members.me.roles.highest.position) {
                        return interaction.editReply({ content: `<:no:1528709599740559415> ROLE **${role.name.toUpperCase()}** IS HIGHER THAN MY TOP ROLE` });
                    }
                    
                    const btn = new ButtonBuilder()
                        .setCustomId(`${idPrefix}${role.id}`)
                        .setLabel(role.name)
                        .setStyle(ButtonStyle.Secondary);
                    if (emoji) btn.setEmoji(emoji);
                    buttons.push(btn);

                    descriptionLines.push(`> **${emoji ? emoji + ' ' : ''}${role.name}**`);
                }
            }

            if (buttons.length === 0) {
                return interaction.editReply({ content: '<:no:1528709599740559415> NO VALID ROLES PROVIDED' });
            }

            const buttonRows = packButtons(buttons);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${title}`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(descriptionLines.join('\n'))
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                );
            
            buttonRows.forEach(row => container.addActionRowComponents(row));

            const payload = { 
                content: '', 
                components: [container], 
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            };

            try {
                if (reuseMessageId) {
                    const oldMsg = await targetChannel.messages.fetch(reuseMessageId);
                    await oldMsg.edit(payload);
                } else {
                    await targetChannel.send(payload);
                }
                return interaction.editReply({ content: `<:yes:1528709597647470615> BUTTON MENU READY IN ${targetChannel}` });
            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: `<:no:1528709599740559415> ERROR: \`${error.message}\`` });
            }
        }

        // ===============================================
        // 2. ADD / REMOVE / REFRESH LOGIC
        // ===============================================
        else {
            const msgId = interaction.options.getString('message_id');

            try {
                const message = await targetChannel.messages.fetch(msgId);
                const container = message.components[0];
                
                // Extract Text Safely
                const textComponents = container.components.filter(c => typeof c.content === 'string');
                let titleText = textComponents[0]?.content || "### Menu";
                const existingBody = textComponents[1]?.content || ""; 
                
                let currentBodyLines = existingBody ? existingBody.split('\n') : [];

                // Extract Buttons
                let allButtons = [];
                container.components.forEach(comp => {
                    if (comp.type === 1) { 
                        comp.components.forEach(btnData => allButtons.push(ButtonBuilder.from(btnData)));
                    }
                });

                // Detect Prefix
                const firstId = allButtons[0]?.data.custom_id || "";
                let currentPrefix = "";
                
                if (firstId.startsWith('btn_role_')) currentPrefix = 'btn_role_';
                else if (firstId.startsWith('btn_single_')) currentPrefix = 'btn_single_';
                else if (firstId.startsWith('btn_r_')) currentPrefix = `btn_r_${firstId.split('_')[2]}_`;
                else if (firstId.startsWith('btn_rs_')) currentPrefix = `btn_rs_${firstId.split('_')[2]}_`;

                if (!currentPrefix && sub !== 'remove') currentPrefix = 'btn_role_'; 

                // --- ADD ---
                if (sub === 'add') {
                    for (let i = 1; i <= 5; i++) {
                        const role = interaction.options.getRole(`role${i}`);
                        const emoji = interaction.options.getString(`emoji${i}`);
                        if (role) {
                            if (allButtons.some(b => b.data.custom_id === `${currentPrefix}${role.id}`)) continue;
                            
                            const btn = new ButtonBuilder()
                                .setCustomId(`${currentPrefix}${role.id}`)
                                .setLabel(role.name)
                                .setStyle(ButtonStyle.Secondary);
                            if (emoji) btn.setEmoji(emoji);
                            allButtons.push(btn);

                            currentBodyLines.push(`> **${emoji ? emoji + ' ' : ''}${role.name}**`);
                        }
                    }
                }
                
                // --- REMOVE ---
                else if (sub === 'remove') {
                    for (let i = 1; i <= 5; i++) {
                        const role = interaction.options.getRole(`role${i}`);
                        if (role) {
                            const btnToRemove = allButtons.find(b => b.data.custom_id.endsWith(`_${role.id}`));
                            if (btnToRemove) {
                                const nameToRemove = btnToRemove.data.label;
                                allButtons = allButtons.filter(b => b.data.custom_id !== btnToRemove.data.custom_id);
                                currentBodyLines = currentBodyLines.filter(l => !l.includes(nameToRemove));
                            }
                        }
                    }
                }

                // --- REFRESH ---
                else if (sub === 'refresh') {
                    const newTitle = interaction.options.getString('new_title');
                    
                    if (newTitle) {
                        titleText = `### ${newTitle}`;
                    }

                    const updatedButtons = [];
                    const newDescriptionLines = [];
                    const headerLines = currentBodyLines.filter(l => !l.startsWith('>'));
                    if (headerLines.length > 0) newDescriptionLines.push(...headerLines);

                    for (const btn of allButtons) {
                        const parts = btn.data.custom_id.split('_');
                        const roleId = parts[parts.length - 1];
                        const role = interaction.guild.roles.cache.get(roleId);
                        
                        if (role) {
                            btn.setLabel(role.name); 
                            updatedButtons.push(btn);
                            const emoji = btn.data.emoji;
                            const emojiStr = emoji ? (emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name) : null;
                            newDescriptionLines.push(`> **${emojiStr ? emojiStr + ' ' : ''}${role.name}**`);
                        }
                    }
                    allButtons = updatedButtons;
                    currentBodyLines = newDescriptionLines;
                }

                if (allButtons.length === 0) {
                    return interaction.editReply({ content: "<:no:1528709599740559415> CANNOT UPDATE MENU: IT WOULD BE EMPTY" });
                }

                // --- REBUILD CONTAINER ---
                const newRows = packButtons(allButtons);
                
                const newContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(titleText)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(currentBodyLines.join('\n').trim())
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    );

                newRows.forEach(row => newContainer.addActionRowComponents(row));

                await message.edit({ 
                    components: [newContainer], 
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] }
                });

                return interaction.editReply({ content: `<:yes:1528709597647470615> MENU **UPDATED** SUCCESSFULLY` });

            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: `<:no:1528709599740559415> ERROR: \`${error.message}\`` });
            }
        }
    }
};
