// /api/parse-rateconf.js - Updated with user authentication
// Parses PDF rate confirmations using Claude API and saves to user's loads

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Helper to verify user token and get user ID
async function verifyUser(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'No authorization token provided' };
    }
    
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return { error: 'Invalid or expired token' };
    }
    
    return { user };
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify user authentication
    const { user, error: authError } = await verifyUser(req.headers.authorization);
    if (authError) {
        return res.status(401).json({ error: authError });
    }

    try {
        const { pdfBase64, fileName } = req.body;

        if (!pdfBase64) {
            return res.status(400).json({ error: 'No PDF data provided' });
        }

        // Call Claude API to parse the rate confirmation
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'document',
                            source: {
                                type: 'base64',
                                media_type: 'application/pdf',
                                data: pdfBase64
                            }
                        },
                        {
                            type: 'text',
                            text: `Extract the following information from this rate confirmation document and return it as JSON:
                            
{
    "load_number": "string - the load/order number",
    "broker_name": "string - the broker/shipper company name",
    "broker_mc": "string - broker MC number if visible",
    "rate": "number - the total rate/pay amount",
    "pickup_date": "string - pickup date in YYYY-MM-DD format",
    "delivery_date": "string - delivery date in YYYY-MM-DD format", 
    "pickup_city": "string - pickup city",
    "pickup_state": "string - pickup state abbreviation",
    "pickup_address": "string - full pickup address if available",
    "delivery_city": "string - delivery city",
    "delivery_state": "string - delivery state abbreviation",
    "delivery_address": "string - full delivery address if available",
    "commodity": "string - what is being hauled",
    "weight": "number - weight in pounds if specified",
    "miles": "number - total miles if specified",
    "notes": "string - any special instructions or notes"
}

Return ONLY valid JSON, no markdown or explanation.`
                        }
                    ]
                }
            ]
        });

        // Parse Claude's response
        let loadData;
        try {
            const jsonText = response.content[0].text.trim();
            loadData = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Failed to parse Claude response:', response.content[0].text);
            return res.status(500).json({ error: 'Failed to parse rate confirmation data' });
        }

        // Add user_id and metadata to the load
        const loadRecord = {
            user_id: user.id,  // Associate with authenticated user
            load_number: loadData.load_number || null,
            broker_name: loadData.broker_name || null,
            broker_mc: loadData.broker_mc || null,
            rate: loadData.rate || null,
            pickup_date: loadData.pickup_date || null,
            delivery_date: loadData.delivery_date || null,
            pickup_city: loadData.pickup_city || null,
            pickup_state: loadData.pickup_state || null,
            pickup_address: loadData.pickup_address || null,
            delivery_city: loadData.delivery_city || null,
            delivery_state: loadData.delivery_state || null,
            delivery_address: loadData.delivery_address || null,
            commodity: loadData.commodity || null,
            weight: loadData.weight || null,
            miles: loadData.miles || null,
            notes: loadData.notes || null,
            source_file: fileName || null,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        // Insert into Supabase (RLS will verify user ownership)
        const { data: insertedLoad, error: insertError } = await supabase
            .from('loads')
            .insert([loadRecord])
            .select()
            .single();

        if (insertError) {
            console.error('Supabase insert error:', insertError);
            return res.status(500).json({ error: 'Failed to save load to database' });
        }

        return res.status(200).json({
            success: true,
            load: insertedLoad,
            parsed: loadData
        });

    } catch (error) {
        console.error('Parse error:', error);
        return res.status(500).json({ error: 'Failed to process rate confirmation' });
    }
}
