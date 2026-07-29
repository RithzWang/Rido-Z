const { ActivityType } = require('discord.js');

let state = {
    mode: 'default', // 'default', 'static', or 'cycle'
    cycles: [],
    currentIndex: 0,
    timeoutId: null
};

function startCycle(client) {
    if (state.timeoutId) clearTimeout(state.timeoutId);
    if (state.cycles.length === 0 || state.mode !== 'cycle') return;

    const currentStep = state.cycles[state.currentIndex];

    // Apply the custom status
    client.user.setPresence({
        activities: [{ name: 'customstatus', type: ActivityType.Custom, state: currentStep.text }],
        status: 'dnd'
    });

    // Move to next step
    state.currentIndex = (state.currentIndex + 1) % state.cycles.length;

    // Schedule next
    state.timeoutId = setTimeout(() => {
        startCycle(client);
    }, currentStep.duration);
}

module.exports = {
    getState: () => state,
    
    setStatic: (client, text) => {
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.mode = 'static';
        client.user.setPresence({
            activities: [{ name: 'customstatus', type: ActivityType.Custom, state: text }],
            status: 'dnd'
        });
    },
    
    setCycle: (client, cycles) => {
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.mode = 'cycle';
        state.cycles = cycles;
        state.currentIndex = 0;
        startCycle(client);
    },
    
    reset: () => {
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.mode = 'default';
        state.cycles = [];
    }
};
