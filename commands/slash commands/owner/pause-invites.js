const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    // guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('pause-invites')
        .setDescription('Manage the server invite pause state')
        // Keeps it hidden in the menu from non-admins, but we will still manually check below
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) 
        
        // --- ENABLE SUBCOMMAND ---
        .addSubcommand(sub => sub
            .setName('enable')
            .setDescription('Permanently pause invites')
        )
        
        // --- DISABLE SUBCOMMAND ---
        .addSubcommand(sub => sub
            .setName('disable')
            .setDescription('Unpause invites')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // 1. Check User Permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '-# <:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        // 2. Check Bot Permissions
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.editReply({ 
                content: '-# <:no:1528709599740559415> PLEASE GRANT ME __**MANAGE SERVER**__ PERMISSION' 
            });
        }

        const currentFeatures = interaction.guild.features;
        
        // 3. Check if Community is enabled (Required by Discord to pause invites via API)
        if (!currentFeatures.includes('COMMUNITY')) {
            return interaction.editReply({ 
                content: '-# <:no:1528709599740559415> MAKE SURE TO ENABLE COMMUNITY\n-# **SETTING → ENABLE COMMUNITY → GET STARTED** then follow the steps' 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        let newFeatures = [...currentFeatures];

        try {
            if (subcommand === 'enable') {
                if (currentFeatures.includes('INVITES_DISABLED')) {
                    return interaction.editReply({ 
                        content: '-# <:warn:1528710101324529775> PAUSE INVITES ARE ALREADY **ENABLED**' 
                    });
                }
                
                newFeatures.push('INVITES_DISABLED');
                await interaction.guild.edit({ features: newFeatures });
                
                await interaction.editReply({ 
                    content: '-# <:yes:1528709597647470615> PAUSE INVITES ARE NOW **ENABLED**' 
                });
            
            } 
            else if (subcommand === 'disable') {
                if (!currentFeatures.includes('INVITES_DISABLED')) {
                    return interaction.editReply({ 
                        content: '-# <:warn:1528710101324529775> PAUSE INVITES ARE CURRENTLY **DISABLED**' 
                    });
                }
                
                newFeatures = newFeatures.filter(feature => feature !== 'INVITES_DISABLED');
                await interaction.guild.edit({ features: newFeatures });
                
                await interaction.editReply({ 
                    content: '-# <:yes:1528709597647470615> PAUSE INVITES ARE NOW **DISABLED**' 
                });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `-# <:no:1528709599740559415> ERROR: \`${error.message}\`` 
            });
        }
    }
};
