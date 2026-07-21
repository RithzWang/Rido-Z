const { 
    ContainerBuilder, 
    MessageFlags, 
    SeparatorSpacingSize,
    TextDisplayBuilder,      
    SeparatorBuilder,        
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    name: 'stealemoji',
    aliases: ['se', 'steal'],
    description: 'Steals one or multiple emojis and adds them to this server',
   // channels: ['1456197056510165026', '1456197056510165029', '1456197056988319870'], 

    async execute(message, args) {
        // 👇 NEW: Array of allowed server IDs
        const allowedGuilds = ['878565984108150824']; 
        
        // 👇 NEW: Check if the message is from a server, and if that server is in the allowed list.
        // If not, return silently.
        if (!message.guild || !allowedGuilds.includes(message.guild.id)) {
            return; 
        }

        try {
            // 1. Permission Check (User)
            if (!message.member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
                return message.reply({ 
                    content: `<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // 2. Permission Check (Bot)
            if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
                return message.reply({ 
                    content: `<:no:1528709599740559415> PLEASE GRANT ME __**CREATE EXPRESSIONS**__ PERMISSION`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // 3. Parse Emojis from Args
            if (!args.length) return; // Silent return if no args, similar to your avatar command

            // Regex to find: <(optional a):name:id>
            const emojiRegex = /<?(a)?:?(\w{2,32}):(\d{17,19})>?/g;
            const inputString = args.join(' ');
            const matches = [...inputString.matchAll(emojiRegex)];

            if (matches.length === 0) return; // No valid emojis found

            const addedEmojis = [];
            const failedEmojis = [];

            // 4. Process Steal Logic
            // We loop through matches to handle multiple emojis at once
            for (const match of matches) {
                const isAnimated = match[1] === 'a';
                const name = match[2];
                const id = match[3];
                const extension = isAnimated ? 'gif' : 'png';
                const url = `https://cdn.discordapp.com/emojis/${id}.${extension}`;

                try {
                    const createdEmoji = await message.guild.emojis.create({ 
                        attachment: url, 
                        name: name 
                    });
                    addedEmojis.push(createdEmoji);
                } catch (err) {
                    console.error(`Failed to add ${name}:`, err);
                    failedEmojis.push(name);
                }
            }

            // If nothing was added (and nothing failed, which shouldn't happen if matches > 0), return.
            if (addedEmojis.length === 0 && failedEmojis.length === 0) return;

            // 5. Builder
            const createResultContainer = () => {
                const count = addedEmojis.length;
                const titleText = `## Emoji Stealer`;
                
                let bodyText = ``;
                if (count > 0) {
                    bodyText += `**Successfully stole ${count} emoji(s):**\n`;
                    bodyText += addedEmojis.map(e => `<${e.animated?'a':''}:${e.name}:${e.id}> \`:${e.name}:\``).join('\n');
                }
                
                if (failedEmojis.length > 0) {
                    bodyText += count > 0 ? `\n\n` : ``;
                    bodyText += `**Failed to add:** ${failedEmojis.join(', ')} (File size too big or no slots?)`;
                }

                const container = new ContainerBuilder()
                    .setAccentColor(0x888888) // Green if success, Red if all fail
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titleText}\n${bodyText}`));

                return container;
            };

            // 6. Send Reply
            await message.reply({ 
                components: [createResultContainer()], 
                flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false } 
            });

        } catch (error) {
            console.error(error);
            // Silent error handling as per your preference
        }
    }
};
