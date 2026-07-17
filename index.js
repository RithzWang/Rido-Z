const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// 1. This keeps Render alive 24/7 so it doesn't "exit early"
app.get('/', (req, res) => res.send('Widget Updater is live!'));
app.listen(port, () => console.log(`Listening on port ${port}`));

// 2. Your Widget Logic
// 🚨 DOUBLE CHECK THESE IDs! The 404 error means one of these is wrong.
const appId = "1527600343406481428"; // Ensure this matches your Discord Developer Portal
const userId = "837741275603009626"; // Ensure this is your actual personal Discord User ID
const botToken = process.env.TOKEN; // Render pulls this from your Environment Variables

async function updateWidget() {
  const newProgressValue = Math.floor(Math.random() * 100) + 1; 
  
  const widgetData = {
    "data": {
      "dynamic": [
        { "type": 2, "name": "Progress", "value": newProgressValue },
        { "type": 2, "name": "Max", "value": 100 }
      ]
    }
  };

  try {
    const res = await fetch(`https://discord.com/api/v10/applications/${appId}/users/${userId}/identities`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(widgetData)
    });

    if (res.ok) {
      console.log(`Success! Widget updated to ${newProgressValue}/100`);
    } else {
      console.error(`Failed to sync: ${res.status} - Double check your appId and userId!`);
    }
  } catch (error) {
    console.error(`Error:`, error);
  }
}

// Run the update immediately when the app starts
updateWidget();

// Then run it again every 1 hour (3600000 milliseconds)
setInterval(updateWidget, 3600000);
