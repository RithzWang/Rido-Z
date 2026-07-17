// Replace with your actual IDs and your NEW Token
const appId = "1527600343406481428";
const userId = "837741275603009626";
const botToken = process.env.TOKEN;

// The JSON object from the Discord Developer Portal (fixed brackets)
const widgetData = {
  "data": {
    "dynamic": [
      {
        "type": 2,
        "name": "Progress",
        "value": 81
      },
      {
        "type": 2,
        "name": "Max",
        "value": 100
      }
    ]
  }
};

fetch(`https://discord.com/api/v10/applications/${appId}/users/${userId}/identities`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bot ${botToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(widgetData)
})
.then(res => {
  if (res.ok) console.log("Widget stats synced perfectly!");
  else console.log("Failed to sync:", res.status);
})
.catch(console.error);
