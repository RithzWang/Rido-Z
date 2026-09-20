const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {

        // ===============================================
        // 1. ROLE MENUS (SELECT MENU)
        // ===============================================
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('role_select_')) {
            const restrictionId = interaction.customId.replace('role_select_', '');
            
            // Check for restricted menu role
            if (restrictionId !== 'public' && restrictionId !== 'menu') {
                if (!interaction.member.roles.cache.has(restrictionId)) {
                    return interaction.reply({ 
                        content: `<:no:1528709599740559415> <@&${restrictionId}> IS REQUIRED`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const selectedRoleIds = interaction.values;
            const allRoleIds = interaction.component.options.map(opt => opt.value);
            const added = [];
            const removed = [];
            const failed = [];

            for (const roleId of allRoleIds) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) continue; 
                
                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    failed.push(role.name); 
                    continue;
                }
                
                const hasRole = interaction.member.roles.cache.has(roleId);
                const isSelected = selectedRoleIds.includes(roleId);
                
                try {
                    if (isSelected && !hasRole) { 
                        await interaction.member.roles.add(role); 
                        added.push(role.name); 
                    } else if (!isSelected && hasRole) { 
                        await interaction.member.roles.remove(role); 
                        removed.push(role.name); 
                    }
                } catch (e) { 
                    failed.push(role.name); 
                }
            }

            let feedbackText = [];
            if (added.length > 0) feedbackText.push(`<:yes:1528709597647470615> **Added:** ${added.join(', ')}`);
            if (removed.length > 0) feedbackText.push(`<:no:1528709599740559415> **Removed:** ${removed.join(', ')}`);
            if (failed.length > 0) feedbackText.push(`<:no:1528709599740559415> **Failed:** ${failed.join(', ')}`);
            
            if (feedbackText.length === 0) feedbackText.push('<:no:1528709599740559415> NO CHANGES MADE');

            return interaction.editReply({ content: feedbackText.join('\n') });
        }

        // ===============================================
        // 2. REACTION ROLE BUTTONS
        // ===============================================
        else if (interaction.isButton()) {

            const isStdMulti = interaction.customId.startsWith('btn_role_');
            const isStdSingle = interaction.customId.startsWith('btn_single_');
            const isRestrictedMulti = interaction.customId.startsWith('btn_r_');
            const isRestrictedSingle = interaction.customId.startsWith('btn_rs_');

            if (isStdMulti || isStdSingle || isRestrictedMulti || isRestrictedSingle) {
                let roleId, reqRoleId;
                let isSingleMode = false;

                if (isStdMulti) {
                    roleId = interaction.customId.replace('btn_role_', '');
                } else if (isStdSingle) { 
                    roleId = interaction.customId.replace('btn_single_', ''); 
                    isSingleMode = true; 
                } else if (isRestrictedMulti) { 
                    const p = interaction.customId.split('_'); 
                    reqRoleId = p[2]; 
                    roleId = p[3]; 
                } else if (isRestrictedSingle) { 
                    const p = interaction.customId.split('_'); 
                    reqRoleId = p[2]; 
                    roleId = p[3]; 
                    isSingleMode = true; 
                }

                if (reqRoleId && !interaction.member.roles.cache.has(reqRoleId)) {
                    return interaction.reply({ 
                        content: `<:no:1528709599740559415> <@&${reqRoleId}> IS REQUIRED`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                const role = interaction.guild.roles.cache.get(roleId);
                if (!role || role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({ content: '<:no:1528709599740559415> INVALID ROLE CONFIGURATION', flags: MessageFlags.Ephemeral });
                }

                try {
                    if (isSingleMode) {
                        if (interaction.member.roles.cache.has(roleId)) {
                            await interaction.member.roles.remove(role);
                            return interaction.reply({ content: `<:no:1528709599740559415> **Removed:** ${role.name}`, flags: MessageFlags.Ephemeral });
                        }
                        
                        const rolesToRemove = [];
                        const removedNames = [];
                        const container = interaction.message.components[0];
                        
                        if (container) {
                            container.components.forEach(row => {
                                if (row.type === 1) row.components.forEach(btn => {
                                    if (!btn.customId) return;
                                    let otherId = null;
                                    if (btn.customId.startsWith('btn_single_')) otherId = btn.customId.replace('btn_single_', '');
                                    else if (btn.customId.startsWith('btn_rs_')) otherId = btn.customId.split('_')[3];
                                    
                                    if (otherId && otherId !== roleId && interaction.member.roles.cache.has(otherId)) {
                                        rolesToRemove.push(otherId);
                                    }
                                });
                            });
                        }
                        
                        for (const rID of rolesToRemove) {
                            const r = interaction.guild.roles.cache.get(rID);
                            if (r) { 
                                await interaction.member.roles.remove(rID).catch(() => {}); 
                                removedNames.push(r.name); 
                            }
                        }
                        
                        await interaction.member.roles.add(role);
                        let msg = `<:yes:1528709597647470615> **Added:** ${role.name}`;
                        if (removedNames.length > 0) msg += `\n<:no:1528709599740559415> **Removed:** ${removedNames.join(', ')}`;
                        return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });

                    } else {
                        if (interaction.member.roles.cache.has(roleId)) {
                            await interaction.member.roles.remove(role);
                            return interaction.reply({ content: `<:no:1528709599740559415> **Removed:** ${role.name}`, flags: MessageFlags.Ephemeral });
                        } else {
                            await interaction.member.roles.add(role);
                            return interaction.reply({ content: `<:yes:1528709597647470615> **Added:** ${role.name}`, flags: MessageFlags.Ephemeral });
                        }
                    }
                } catch (error) {
                    console.error(error);
                    return interaction.reply({ content: `<:no:1528709599740559415> ERROR: \`${error.message}\``, flags: MessageFlags.Ephemeral });
                }
            }
        }
    }
};
