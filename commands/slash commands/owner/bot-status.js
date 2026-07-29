const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const statusManager = require('../../../utils/statusManager.js'); 

// Build the cycle subcommand dynamically to add 25 options
const cycleSubcommand = subcmd => {
    subcmd
        .setName('cycle')
        .setDescription('Cycle between multiple custom statuses');
    
    // First 2 are required
    subcmd.addStringOption(opt => opt.setName('content-1').setDescription('e.g., 2s, hello').setRequired(true));
    subcmd.addStringOption(opt => opt.setName('content-2').setDescription('e.g., 5s, DM me').setRequired(true));
    
    // The next 23 are optional (Discord max options is 25)
    for (let i = 3; i <= 25; i++) {
        subcmd.addStringOption(opt => opt.setName(`content-${i}`).setDescription('Optional status (e.g., 10s, ...)').setRequired(false));
    }
    return subcmd;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-status')
        .setDescription('Change the bot custom status')
        .addSubcommand(subcmd => 
            subcmd
                .setName('normal')
                .setDescription('Set a static custom status')
                .addStringOption(opt => opt.setName('content').setDescription('The status text').setRequired(true))
        )
        .addSubcommand(subcmd =>
            subcmd
                .setName('reset')
                .setDescription('Reset back to the default time clock')
        )
        .addSubcommand(cycleSubcommand),
    
    async execute(interaction, client) {
        // 🔒 OWNER ONLY CHECK
        if (interaction.user.id !== '837741275603009626') {
            return interaction.reply({ 
                content: '⛔ You do not have permission to use this command.', 
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'reset') {
            statusManager.reset();
            return interaction.reply({ content: '✅ Reset to default time clock.', flags: MessageFlags.Ephemeral });
        }

        if (subcommand === 'normal') {
            const content = interaction.options.getString('content');
            statusManager.setStatic(client, content);
            return interaction.reply({ content: `✅ Set static custom status to: \`${content}\``, flags: MessageFlags.Ephemeral });
        }

        if (subcommand === 'cycle') {
            const cycles = [];
            
            // Loop through all 25 possible options to extract what the user typed
            for (let i = 1; i <= 25; i++) {
                const input = interaction.options.getString(`content-${i}`);
                if (input) {
                    // Parse "2s, hello" format
                    const match = input.match(/^(\d+)s,\s*(.+)$/i);
                    if (match) {
                        cycles.push({
                            duration: parseInt(match[1]) * 1000, // Convert seconds to milliseconds
                            text: match[2]
                        });
                    } else {
                        return interaction.reply({ 
                            content: `❌ Invalid format in \`content-${i}\`. Please use \`[seconds]s, [text]\` (e.g., \`2s, hello\`).`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }
                }
            }

            statusManager.setCycle(client, cycles);
            return interaction.reply({ content: `✅ Started cycling between ${cycles.length} statuses!`, flags: MessageFlags.Ephemeral });
        }
    }
};
