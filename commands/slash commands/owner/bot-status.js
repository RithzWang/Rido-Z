const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    SeparatorSpacingSize, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ActionRowBuilder,
    MessageFlags
} = require('discord.js');

// Import your state manager to read the current status
const presenceManager = require('../../../utils/presenceManager.js'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-bot-presence')
        .setDescription('Configure the bots status and activity'),
    
    async execute(interaction, client) {
        // ==========================================
        // 🔒 OWNER ONLY CHECK
        // ==========================================
        if (interaction.user.id !== '837741275603009626') {
            return interaction.reply({ 
                content: '⛔ You do not have permission to use this command.', 
                flags: MessageFlags.Ephemeral
            });
        }

        const currentState = presenceManager.getPresenceState();
        
        // Dynamically build the "Edit" label based on current state
        let editLabel = "Edit ....";
        if (currentState.mode !== 'default' && currentState.cycles.length > 0) {
            // Combine the current cycle text to show in the menu
            const summary = currentState.cycles.map(c => {
                if (currentState.mode === 'cycling_status' || currentState.mode === 'cycling_presence') {
                    return `${c.duration / 1000}s to ${c.text || c.status}`;
                } else if (currentState.mode === 'cycling_activity') {
                    // Extract activity name for summary
                    const types = { 0: 'Playing', 1: 'Streaming', 2: 'Listening to', 3: 'Watching', 5: 'Competing in' };
                    return `${c.duration / 1000}s ${types[c.activityType]} ${c.text}`;
                }
            }).join(', ');
            
            editLabel = `Edit: ${summary}`.substring(0, 100); // Discord caps Select Menu labels at 100 characters
        }

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
                                        .setLabel(editLabel) 
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
            flags: MessageFlags.Ephemeral
        });
    }
};
