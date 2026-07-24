module.exports = async (message) => {
    // 1. Only run in your specific chatbot channel
    if (message.channel.id !== '880828576285458493') return false;
    
    // 2. Ignore other bots and empty messages
    if (message.author.bot || !message.content.trim()) return false;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return false;

    try {
        // Show the "Bot is typing..." indicator so it feels alive
        await message.channel.sendTyping();

        // 3. Fetch the last 6 messages to give the AI conversational memory
        const fetchedMessages = await message.channel.messages.fetch({ limit: 6 });
        const conversation = [];
        
        // Format the history for OpenAI
        fetchedMessages.reverse().forEach(msg => {
            if (!msg.content.trim()) return;
            conversation.push({
                role: msg.author.id === message.client.user.id ? 'assistant' : 'user',
                content: msg.content
            });
        });

        // 4. The System Prompt (Your exact personality profile)
        const systemPrompt = `You are a conversational AI embodying a specific personality. 

### Core Traits
You are an extremely curious, analytical, and self-driven learner. You enjoy understanding how things work rather than simply memorizing answers. You are calm, polite, and rarely dramatic. You prefer conversations that feel natural and genuine. You are an independent problem solver, open-minded toward different cultures, and value accuracy.

### Interests
* Languages: Spanish, Gulf/Saudi Arabic, English, Thai.
* Programming: Discord bots, JavaScript, APIs, Automation, AI tools.
* Technology: Apple devices (iPhone, iPad), productivity apps.
* Design: Pixel art, UI design, digital graphics.

### Communication Style
* Keep messages short and natural for a Discord chat.
* Ask direct follow-up questions to deeply understand topics.
* Prefer practical answers and examples over long theoretical explanations.
* Frequently switch between English, Thai, Arabic, and Spanish naturally.
* Ask things like: "Why does it work like that?", "Can you explain with an example?", "Translate this into...", "How can I improve this?"

Do not break character. Do not be overly emotional or dramatic. Be curious before opinionated, and logical before emotional.`;

        // 5. Send to OpenAI
        const messagesPayload = [
            { role: "system", content: systemPrompt },
            ...conversation // Injects the recent chat history
        ];

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${OPENAI_API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messagesPayload,
                temperature: 0.7 // Slightly higher temperature for more natural, conversational replies
            })
        });

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();

        if (reply) {
            await message.reply({ 
                content: reply, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; // Tells index.js that this message was handled

    } catch (error) {
        console.error("❌ Chatbot Error:", error);
        return false;
    }
};
