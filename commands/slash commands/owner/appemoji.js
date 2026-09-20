const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags,
    ContainerBuilder, 
    TextDisplayBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ComponentType
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('appemoji')
        .setDescription('Manage the bot\'s Application Emojis')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // --- ADD SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('add')
            .setDescription('Add multiple emojis via string, or upload a single image')
            .addStringOption(opt => opt.setName('emojis').setDescription('Paste multiple emojis here to copy them').setRequired(false))
            .addAttachmentOption(opt => opt.setName('image').setDescription('Upload an image file').setRequired(false))
            .addStringOption(opt => opt.setName('name').setDescription('Name for the uploaded image').setRequired(false))
        )

        // --- REMOVE SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('remove')
            .setDescription('Remove an application emoji')
            .addStringOption(opt => opt.setName('emoji').setDescription('Paste the emoji or its ID').setRequired(true))
        )

        // --- LIST SUBCOMMAND ---
        .addSubcommand(sub => sub.setName('list')
            .setDescription('List all application emojis uploaded to the bot')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ 
                content: '<:no:1528709599740559415> YOU DO NOT HAVE PERMISSION TO DO THAT' 
            });
        }

        const sub = interaction.options.getSubcommand();
        const appEmojis = interaction.client.application.emojis;

        // ===============================================
        // 1. ADD EMOJIS
        // ===============================================
        if (sub === 'add') {
            const emojisString = interaction.options.getString('emojis');
            const imageAttach = interaction.options.getAttachment('image');
            let imageName = interaction.options.getString('name');

            const added = [];
            const failed = [];

            // 1A. Parse multiple emojis from string
            if (emojisString) {
                const regex = /<a?:([^:]+):(\d+)>/g;
                let match;
                
                while ((match = regex.exec(emojisString)) !== null) {
                    const name = match[1];
                    const id = match[2];
                    const isAnimated = match[0].startsWith('<a:');
                    const ext = isAnimated ? 'gif' : 'png';
                    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
                    
                    try {
                        const created = await appEmojis.create({ attachment: url, name: name });
                        added.push(`<${isAnimated ? 'a' : ''}:${created.name}:${created.id}>`);
                    } catch (err) {
                        failed.push(name.toUpperCase());
                    }
                }
            }

            // 1B. Upload from direct attachment
            if (imageAttach) {
                if (!imageName) {
                    imageName = imageAttach.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '');
                }
                if (imageName.length < 2) imageName = 'emoji_' + Math.floor(Math.random() * 1000);

                try {
                    const created = await appEmojis.create({ attachment: imageAttach.url, name: imageName });
                    added.push(`<${created.animated ? 'a' : ''}:${created.name}:${created.id}>`);
                } catch (err) {
                    failed.push(imageName.toUpperCase());
                }
            }

            if (added.length === 0 && failed.length === 0) {
                return interaction.editReply({ content: '<:no:1528709599740559415> YOU MUST PROVIDE EMOJIS TO COPY OR AN IMAGE TO UPLOAD' });
            }

            let response = [];
            if (added.length > 0) response.push(`<:yes:1528709597647470615> **ADDED:** ${added.join(' ')}`);
            if (failed.length > 0) response.push(`<:no:1528709599740559415> **FAILED:** ${failed.join(', ')}`);

            return interaction.editReply({ content: response.join('\n') });
        }

        // ===============================================
        // 2. REMOVE EMOJI
        // ===============================================
        else if (sub === 'remove') {
            const input = interaction.options.getString('emoji');
            
            const idMatch = input.match(/\d{15,25}/);
            const emojiId = idMatch ? idMatch[0] : input;

            try {
                await appEmojis.delete(emojiId);
                return interaction.editReply({ content: `<:yes:1528709597647470615> EMOJI **REMOVED** SUCCESSFULLY` });
            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: `<:no:1528709599740559415> COULD NOT FIND OR REMOVE EMOJI. MAKE SURE IT BELONGS TO THE BOT.` });
            }
        }

        // ===============================================
        // 3. LIST EMOJIS
        // ===============================================
        else if (sub === 'list') {
            try {
                const fetchedEmojis = await appEmojis.fetch();
                if (fetchedEmojis.size === 0) {
                    return interaction.editReply({ content: `<:no:1528709599740559415> THIS BOT HAS 0 APPLICATION EMOJIS` });
                }

                // Format: (emoji) `<:name:id>`
                const emojiList = Array.from(fetchedEmojis.values()).map(e => {
                    const tag = `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
                    return `${tag} \`${tag}\``;
                });

                let currentPage = 0;
                const itemsPerPage = 100;
                const maxPages = Math.ceil(emojiList.length / itemsPerPage);

                const generatePage = (pageIndex) => {
                    const start = pageIndex * itemsPerPage;
                    const currentItems = emojiList.slice(start, start + itemsPerPage);

                    const container = new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`### APP EMOJIS (${fetchedEmojis.size} Total | Page ${pageIndex + 1}/${maxPages})`) 
                        );

                    let currentString = "";
                    for (const item of currentItems) {
                        // Keep text blocks safely under Discord's 2000 character limit
                        if (currentString.length + item.length + 2 > 1900) {
                            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(currentString.trim()));
                            currentString = "";
                        }
                        currentString += item + "\n"; 
                    }
                    if (currentString) {
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(currentString.trim()));
                    }

                    // Add YouTube style pagination buttons
                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("emoji_first")
                            .setStyle(ButtonStyle.Primary)
                            .setLabel("First")
                            .setDisabled(pageIndex === 0),
                        new ButtonBuilder()
                            .setCustomId("emoji_prev")
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel("Previous")
                            .setDisabled(pageIndex === 0),
                        new ButtonBuilder()
                            .setCustomId("emoji_next")
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel("Next")
                            .setDisabled(pageIndex === maxPages - 1),
                        new ButtonBuilder()
                            .setCustomId("emoji_last")
                            .setStyle(ButtonStyle.Primary)
                            .setLabel("Last")
                            .setDisabled(pageIndex === maxPages - 1)
                    );
                    
                    container.addActionRowComponents(actionRow);
                    return container;
                };

                const response = await interaction.editReply({ 
                    components: [generatePage(currentPage)], 
                    flags: MessageFlags.IsComponentsV2,
                    content: '' 
                });

                if (maxPages === 1) return; 

                const collector = response.createMessageComponentCollector({ 
                    componentType: ComponentType.Button, 
                    time: 120_000 
                });

                collector.on('collect', async (i) => {
                    if (i.customId === 'emoji_first') currentPage = 0;
                    else if (i.customId === 'emoji_prev') currentPage--;
                    else if (i.customId === 'emoji_next') currentPage++;
                    else if (i.customId === 'emoji_last') currentPage = maxPages - 1;

                    await i.update({ 
                        components: [generatePage(currentPage)],
                        flags: MessageFlags.IsComponentsV2
                    });
                });

                collector.on('end', () => {
                    const disabledPage = generatePage(currentPage);
                    const lastComponent = disabledPage.components[disabledPage.components.length - 1];
                    if (lastComponent && lastComponent.type === 1) {
                        lastComponent.components.forEach(btn => btn.setDisabled(true));
                    }
                    interaction.editReply({ components: [disabledPage] }).catch(() => {});
                });

            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: `<:no:1528709599740559415> ERROR FETCHING EMOJIS: \`${error.message}\`` });
            }
        }
    }
};
