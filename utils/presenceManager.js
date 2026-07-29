const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ActivityType } = require('discord.js');

// Global state to track active presence mode and current cycling step
let presenceState = {
    mode: 'default', // 'default', 'cycling_status', 'cycling_activity', 'cycling_presence'
    cycles: [],
    currentIndex: 0,
    timeoutId: null
};

// --- CYCLE LOOP ENGINE ---
function startCycle(client) {
    if (presenceState.timeoutId) clearTimeout(presenceState.timeoutId);
    if (presenceState.cycles.length === 0 || presenceState.mode === 'default') return;

    const currentStep = presenceState.cycles[presenceState.currentIndex];

    // Apply presence step based on active mode
    if (presenceState.mode === 'cycling_status') {
        client.user.setPresence({
            activities: [{ name: 'customstatus', type: ActivityType.Custom, state: currentStep.text }],
        });
    } else if (presenceState.mode === 'cycling_activity') {
        client.user.setPresence({
            activities: [{ name: currentStep.text, type: currentStep.activityType }],
        });
    } else if (presenceState.mode === 'cycling_presence') {
        client.user.setPresence({ status: currentStep.status });
    }

    // Move to next step in loop
    presenceState.currentIndex = (presenceState.currentIndex + 1) % presenceState.cycles.length;

    // Schedule next status change
    presenceState.timeoutId = setTimeout(() => {
        startCycle(client);
    }, currentStep.duration);
}

// --- MODAL BUILDER (Supports pre-filled values for Edit) ---
function buildModal(customId, title, placeholder, prefillValues = []) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
    
    for (let i = 1; i <= 5; i++) {
        const input = new TextInputBuilder()
            .setCustomId(`input_${i}`)
            .setLabel(`Status ${i} ${i > 2 ? '(Optional)' : '(Required)'}`)
            .setPlaceholder(placeholder)
            .setStyle(TextInputStyle.Short)
            .setRequired(i <= 2);

        // Pre-fill fields if user selected "Edit"
        if (prefillValues[i - 1]) {
            input.setValue(prefillValues[i - 1]);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return modal;
}

// --- MAIN INTERACTION HANDLER ---
module.exports = async (interaction, client) => {
    
    // ==========================================
    // 1. SELECT MENU SELECTIONS
    // ==========================================
    if (interaction.isStringSelectMenu() && interaction.customId === '800f19499eea46e9c6f85266e651a77f') {
        const value = interaction.values[0];

        // "Set Cycling Status" (Custom Status)
        if (value === '05125ca862eb46b0dd91351cb241ad35') {
            await interaction.showModal(buildModal('modal_cycling_status', 'Set Cycling Custom Status', 'e.g., 2s to Hello'));
        } 
        // "Set Cycling Presence Activity"
        else if (value === 'cycling_activity') {
            await interaction.showModal(buildModal('modal_cycling_activity', 'Set Cycling Presence Activity', 'e.g., 5s Listening to Hello'));
        }
        // "Set Cycling Presence Status"
        else if (value === 'cycling_presence_status') {
            await interaction.showModal(buildModal('modal_cycling_presence', 'Set Cycling Presence Status', 'e.g., 3s to DND'));
        }
        // "Edit ...."
        else if (value === 'a72fcb8a646a41ffbb8fdc0fcfbafdf7') {
            if (presenceState.mode === 'default' || presenceState.cycles.length === 0) {
                await interaction.reply({ content: '❌ No active custom status cycle found to edit.', ephemeral: true });
                return;
            }

            // Convert active cycles back to input strings for the modal fields
            const previousInputs = presenceState.cycles.map(c => {
                if (presenceState.mode === 'cycling_status') return `${c.duration / 1000}s to ${c.text}`;
                if (presenceState.mode === 'cycling_presence') return `${c.duration / 1000}s to ${c.status}`;
                if (presenceState.mode === 'cycling_activity') {
                    const types = { 0: 'Playing', 1: 'Streaming', 2: 'Listening to', 3: 'Watching', 5: 'Competing in' };
                    return `${c.duration / 1000}s ${types[c.activityType]} ${c.text}`;
                }
            });

            // Target appropriate modal handler based on active mode
            let targetModalId = 'modal_cycling_status';
            if (presenceState.mode === 'cycling_activity') targetModalId = 'modal_cycling_activity';
            if (presenceState.mode === 'cycling_presence') targetModalId = 'modal_cycling_presence';

            await interaction.showModal(buildModal(targetModalId, 'Edit Current Cycle Configuration', 'e.g., 2s to Hello', previousInputs));
        }
        // "Use Default Status"
        else if (value === '1733fc0232574fc48e9e5b339d7f78d5') {
            presenceState.mode = 'default';
            if (presenceState.timeoutId) clearTimeout(presenceState.timeoutId);
            await interaction.reply({ content: '✅ Reverted back to Default Status Clock.', ephemeral: true });
        }
        else {
            await interaction.reply({ content: '⚙️ This configuration option is currently under maintenance.', ephemeral: true });
        }
    }

    // ==========================================
    // 2. MODAL FORM SUBMISSIONS
    // ==========================================
    if (interaction.isModalSubmit()) {
        const rawInputs = [1, 2, 3, 4, 5]
            .map(i => interaction.fields.getTextInputValue(`input_${i}`).trim())
            .filter(Boolean);

        presenceState.cycles = [];
        presenceState.currentIndex = 0;

        try {
            // Processing: Cycling Custom Status (e.g. "2s to Hello")
            if (interaction.customId === 'modal_cycling_status') {
                presenceState.mode = 'cycling_status';
                rawInputs.forEach(input => {
                    const match = input.match(/^(\d+)s\s+to\s+(.+)$/i);
                    if (match) presenceState.cycles.push({ duration: parseInt(match[1]) * 1000, text: match[2] });
                });
            } 
            // Processing: Cycling Presence Activity (e.g. "5s Listening to Hello")
            else if (interaction.customId === 'modal_cycling_activity') {
                presenceState.mode = 'cycling_activity';
                rawInputs.forEach(input => {
                    const match = input.match(/^(\d+)s\s+(Playing|Watching|Listening to|Streaming|Competing in)\s+(.+)$/i);
                    if (match) {
                        const typeMap = { 
                            'playing': ActivityType.Playing, 
                            'watching': ActivityType.Watching, 
                            'listening to': ActivityType.Listening, 
                            'streaming': ActivityType.Streaming, 
                            'competing in': ActivityType.Competing 
                        };
                        presenceState.cycles.push({ 
                            duration: parseInt(match[1]) * 1000, 
                            activityType: typeMap[match[2].toLowerCase()], 
                            text: match[3] 
                        });
                    }
                });
            }
            // Processing: Cycling Presence Status (e.g. "3s to DND")
            else if (interaction.customId === 'modal_cycling_presence') {
                presenceState.mode = 'cycling_presence';
                rawInputs.forEach(input => {
                    const match = input.match(/^(\d+)s\s+to\s+(.+)$/i);
                    if (match) {
                        const statusMap = { 'online': 'online', 'idle': 'idle', 'dnd': 'dnd', 'invisible': 'invisible' };
                        const parsedStatus = statusMap[match[2].toLowerCase()] || 'online';
                        presenceState.cycles.push({ duration: parseInt(match[1]) * 1000, status: parsedStatus });
                    }
                });
            }

            if (presenceState.cycles.length < 2) {
                throw new Error("Invalid format or less than 2 valid inputs provided. Example format: `2s to Hello` or `5s Listening to Music`.");
            }

            startCycle(client);
            await interaction.reply({ content: `✅ Activated ${presenceState.cycles.length}-step presence cycle!`, ephemeral: true });

        } catch (error) {
            presenceState.mode = 'default';
            await interaction.reply({ content: `❌ **Failed to apply cycle:** ${error.message}`, ephemeral: true });
        }
    }
};

// Export state getter to allow index.js and command file to read active state
module.exports.getPresenceState = () => presenceState;
