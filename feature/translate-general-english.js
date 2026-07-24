module.exports = async (message) => {
    // 1. Only run in the General Translation channel
    if (message.channel.id !== '878582639215407134') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        
        // 2. Auto-detect and translate to English
        const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const resEn = await fetch(urlEn);
        const dataEn = await resEn.json();
        
        const detectedLang = dataEn[2]; 
        let finalTranslation = "";

        // Only translate if the detected language is NOT already English
        if (!detectedLang.startsWith('en')) {
            finalTranslation = dataEn[0].map(item => item[0]).join('');
        }

        // 3. Reply if there is a translation
        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `-# **Translation:**\n${finalTranslation}`,
                allowedMentions: { repliedUser: false } 
            });
        }
        
        return true; 
    } catch (error) {
        console.error("❌ General Translate Error:", error);
        return false;
    }
};
