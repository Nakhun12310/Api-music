import mongoose from 'mongoose';

// 1. Mongoose Connection Cache for Vercel Serverless Functions
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.warn("MONGODB_URI is not set. Skipping database save");
      return null;
    }
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

// 2. Queue / Track Mongoose Schema
const TrackSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  addedBy: { type: String, default: 'Dashboard' },
  createdAt: { type: Date, default: Date.now }
});

const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);

// 3. Vercel Serverless Function Handler
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Preflight OPTIONS Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Accept POST (and GET for quick testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Parse input from POST body or GET query params
  const body = req.method === 'POST' ? req.body : req.query;
  const { guildId, url, title, addedBy } = body || {};

  if (!guildId || (!url && !title)) {
    return res.status(400).json({ 
      error: "Missing required parameters. Provide 'guildId' and 'url' or 'title'." 
    });
  }

  const trackTitle = title || url;
  const trackUrl = url || '';

  try {
    // Save track to MongoDB if connection URI exists
    await connectDB();
    let savedTrack = null;
    if (mongoose.connection.readyState === 1) {
      savedTrack = await Track.create({
        guildId,
        title: trackTitle,
        url: trackUrl,
        addedBy: addedBy || 'Website Dashboard'
      });
    }

    // Forward track to your NexusHost Bot
    const NEXUS_BOT_URL = process.env.NEXUS_BOT_URL;
    let botResult = null;

    if (NEXUS_BOT_URL) {
      try {
        const botResponse = await fetch(`${NEXUS_BOT_URL}/api/guilds/${guildId}/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trackUrl, title: trackTitle, guildId })
        });

        if (botResponse.ok) {
          botResult = await botResponse.json();
        }
      } catch (botErr) {
        console.error("Failed to push track to NexusHost Bot:", botErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Track successfully added to queue',
      track: {
        guildId,
        title: trackTitle,
        url: trackUrl,
        id: savedTrack ? savedTrack._id : null
      },
      botResponse: botResult || "Track queued in database"
    });

  } catch (error) {
    console.error("Error in api/add.js:", error);
    return res.status(500).json({
      error: "Failed to add track",
      details: error.message
    });
  }
}
