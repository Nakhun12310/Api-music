import mongoose from 'mongoose';

const RequestSchema = new mongoose.Schema({
    guildId: String,
    query: String,
    createdAt: { type: Date, default: Date.now }
});

const SongRequest = mongoose.models.SongRequest || mongoose.model('SongRequest', RequestSchema);

export default async function handler(req, res) {
    // 1. Setup CORS so Nexushost can talk to Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle preflight request for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Connect to MongoDB (Requires MONGODB_URI in Vercel Env Variables)
    await mongoose.connect(process.env.MONGODB_URI);

    const { query, guildId } = req.body;
    await SongRequest.create({ query, guildId });

    res.status(200).json({ success: true, message: 'Song queued' });
}
