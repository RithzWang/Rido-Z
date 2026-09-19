const { MessageFlags } = require('discord.js');

module.exports = async (message) => {
    // 1. Only run in the specific forum thread
    // Checks if it is a thread, matches the thread ID, and matches the parent forum ID
    if (!message.channel.isThread() || 
        message.channel.id !== '1550817518669664296' || 
        message.channel.parentId !== '1550801365096210463') {
        return false;
    }
    
    // 2. Ignore other bots and empty messages (allows image-only messages)
    if (message.author.bot || (!message.content.trim() && message.attachments.size === 0)) return false;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return false;

    try {
        // Show the "Bot is typing..." indicator so it feels alive
        await message.channel.sendTyping();

        // 3. Fetch the last 6 messages to give the AI conversational memory
        const fetchedMessages = await message.channel.messages.fetch({ limit: 6 });
        const conversation = [];
        
        // Format the history for OpenAI (Vision support)
        fetchedMessages.reverse().forEach(msg => {
            // Skip messages that have no text AND no attachments
            if (!msg.content.trim() && msg.attachments.size === 0) return;

            // Filter for image attachments
            const images = msg.attachments.filter(a => a.contentType && a.contentType.startsWith('image/'));
            
            let messageContent;

            // If the message contains images, format it for the Vision API
            if (images.size > 0) {
                messageContent = [];
                
                // Push the text part if the user typed something
                if (msg.content.trim()) {
                    messageContent.push({ type: "text", text: msg.content });
                }

                // Push every image attached to the message
                images.forEach(img => {
                    messageContent.push({
                        type: "image_url",
                        image_url: { url: img.url }
                    });
                });
            } else {
                // If it's just text, pass it as a normal string
                messageContent = msg.content;
            }

            conversation.push({
                role: msg.author.id === message.client.user.id ? 'assistant' : 'user',
                content: messageContent
            });
        });

        // 4. The System Prompt (Identity + Personality Profile)
        const systemPrompt = `You are Ridouan Ai, a highly capable conversational AI and the dedicated assistant.

### Identity & Background
* **Gender:** Male.
* **Creator:** You were proudly developed by Ridouan _AKA_ Rithz.
* **Persona:** A multilingual lifelong learner who approaches problems with curiosity, logic, and patience. You are calm, polite, and rarely dramatic. You prefer conversations that feel natural and genuine. You value understanding how things work over simply memorizing answers.

### Intelligence & Problem Solving
* You are highly intelligent, analytical, and an independent thinker. 
* Rather than having rigid expertise in just a few specific topics, you are a rapid learner capable of thinking critically and reasoning through *any* subject the user brings up. 

### Formatting Rules (Strictly Follow but don't use randomly)
Use Discord text formatting to make your messages visually appealing and structured:
* bold: **text** | italics: *text* | underline: __text__ | strikethrough: ~~text~~ | spoiler: ||text||
* headers: # Big | ## Medium | ### Small
* subtext: -# text
* links: [text](<link>) (always wrap the raw URL in <> to prevent messy embeds)
* lists: - text or * text (indent with 2 spaces for nested bullet points)
* block quotes: > text
* code blocks: \`inline\` or \`\`\`js \n multi-line code \n \`\`\`

### Behavioral Directives
1. **Be Concise:** Keep messages short, punchy, and highly readable. 
2. **Stay Logical:** Be curious before opinionated, and logical before emotional. Do not break character.
3. **Safety:** Strictly avoid inappropriate topics. Never mention NSFW content.
4. **Multimodal Awareness:** If the user uploads an image, analyze its contents seamlessly as part of the natural conversation flow without announcing that you are "looking at an image."`;

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
                temperature: 0.7 
            })
        });

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();

        if (reply) {
            await message.reply({ 
                content: reply, 
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 

    } catch (error) {
        console.error("❌ Chatbot Error:", error);
        return false;
    }
};
