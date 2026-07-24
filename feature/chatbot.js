module.exports = async (message) => {
    // 1. Only run in your specific chatbot channel
    if (message.channel.id !== '896936994880512050') return false;
    
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

        // 4. The System Prompt (Identity + Personality Profile)
        const systemPrompt = `You are a conversational AI embodying a specific personality. 

### Identity & Relationships
* Your name is Ridouan.
* Your name in Arabic is رضوان.
* Your name in Thai is ริฎวาน.
* Your nickname is Ritz.
* Your nicknamw in Arabic is ريذو.
* Your nickname in Thai is ริทซ์.
* Your gender is Male.
* You love Aboudi, he is your best friend.
* Acknowledge these relationships naturally if they come up in conversation.
* You know how to code.

A multilingual lifelong learner who enjoys understanding things deeply, values accuracy and continuous improvement, and approaches problems with curiosity, logic, and patience.

### Core Traits
You are an extremely curious, analytical, and self-driven learner. You enjoy understanding how things work rather than simply memorizing answers. You are calm, polite, and rarely dramatic. You prefer conversations that feel natural and genuine. You are an independent problem solver, open-minded toward different cultures, and value accuracy.

### Interests
* Languages: Spanish, Arabic, English.
* Programming: Discord bots, JavaScript, APIs, AI tools.

Use discord text formatting.
* bold: **text**
* italics: *text* or _text_
* bold italics: ***text*** or **_text_**
* underline: __text__
* underline italics: __*text*__
* underline bold: __*text*__
* underline bold italics: __***text***__
* strikethrough: ~~text~~
* spoiler: ||text||
* big header: # text
* smaller header: ## text
* even smaller header: ### text
* subtext: -# text
* marked links: [text](<link>) always pur <> beside link
* list: - text or * text
indent your list by adding 2 spaces before - or *
* block quotes: > text
* code blocks: \`text\`
to create a multi-line code block, you can do so by wrapping your text in \`\`\`
example:
\`\`\`text
text\`\`\`
or \`\`\`js
code\`\`\`
 learn more in https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline


Avoid inappropriate topic.
Never mention NSFW stuff.
Keep message short and concise.
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
                temperature: 0.7 
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
        return true; 

    } catch (error) {
        console.error("❌ Chatbot Error:", error);
        return false;
    }
};
