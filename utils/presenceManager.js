// Generate a Modal dynamically for 5 inputs, with optional pre-filled values
function buildModal(customId, title, placeholder, prefillValues = []) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
    for (let i = 1; i <= 5; i++) {
        const input = new TextInputBuilder()
            .setCustomId(`input_${i}`)
            .setLabel(`Status ${i} ${i > 2 ? '(Optional)' : '(Required)'}`)
            .setPlaceholder(placeholder)
            .setStyle(TextInputStyle.Short)
            .setRequired(i <= 2);

        // If we are editing, pre-fill the existing data into the text box
        if (prefillValues[i - 1]) {
            input.setValue(prefillValues[i - 1]);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return modal;
}
