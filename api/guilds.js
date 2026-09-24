export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NEXUS_BOT_URL = process.env.NEXUS_BOT_URL; // e.g. https://your-bot.nexushost.com

  try {
    const response = await fetch(`${NEXUS_BOT_URL}/api/guilds`);
    if (!response.ok) throw new Error(`Bot returned status ${response.status}`);
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Guilds API Error:", error.message);
    return res.status(502).json({ error: "Unable to reach NexusHost Bot", details: error.message });
  }
}
