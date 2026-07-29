const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    SeparatorSpacingSize, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, // Note: standard v14 uses StringSelectMenuOptionBuilder
    ActionRowBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-bot-presence')
        .setDescription('Configure the bots status and activity'),
    
    async execute(interaction, client) {
        // Build the components exact to your specifications
        const components = [
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("## Bot Status Configuration"),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Current Status:**\n> Online/Idle/Do Not Disturb/Invisible\n**Current Activity:**\n> Playing/Watching/Listening to/Competing in **……**\n**Current Custom Status:**\n> None or Default or …….."),
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId("800f19499eea46e9c6f85266e651a77f")
                                .addOptions(
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Set Presence Status")
                                        .setValue("ab4b93b1c4b549d9ebe9a8a011cf978d")
                                        .setDescription("Online / Idle / Do Not Disturb / Invisible")
                                        .setEmoji({ name: "⚙️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Set Presence Activity")
                                        .setValue("0079d85075294833fc11c28f13bdc8ff")
                                        .setDescription("Playing / Watching / Listening to / Streaming / Competing in")
                                        .setEmoji({ name: "⚙️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Set Custom Status")
                                        .setValue("130960cbc3484d13a4638fd4bd9477ea")
                                        .setEmoji({ name: "⚙️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Set Cycling Status")
                                        .setValue("05125ca862eb46b0dd91351cb241ad35")
                                        .setDescription("3s to “…” / 5s to “…” / 10s to “…”")
                                        .setEmoji({ name: "⚙️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Set Cycling Presence Activity")
                                        .setValue("cycling_activity")
                                        .setDescription("e.g. 3s Listening to Hello / 5s Streaming Huh")
                                        .setEmoji({ name: "⚙️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Set Cycling Presence Status")
                                        .setValue("cycling_presence_status")
                                        .setDescription("Change bot Online/Idle/DND status every n seconds")
                                        .setEmoji({ name: "⚙️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Edit ….")
                                        .setValue("a72fcb8a646a41ffbb8fdc0fcfbafdf7")
                                        .setEmoji({ name: "✏️" }),
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel("Use Default Status")
                                        .setValue("1733fc0232574fc48e9e5b339d7f78d5")
                                        .setEmoji({ name: "⭐" })
                                )
                        )
                )
        ];

        await interaction.reply({
            components: components,
            ephemeral: true
        });
    }
};
