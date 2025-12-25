import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `You are a rate confirmation parser. When given a PDF rate confirmation, extract the following fields and format them EXACTLY as shown below:

**CSV LINE (for TMS import):**
Load ID, Pickup Date, Delivery Date, Broker Company, Contact Name, Phone, Extension, Email, Origin, Destination, Equipment, Miles, Posted Rate, Booked Rate, Shipper, Receiver

**INVOICE EMAIL:**
[email address for invoicing - separate from the Email field above]

**RULES:**
1. CSV format: comma-separated, no quotes, no extra spaces
2. Dates must be YYYY-MM-DD format (e.g., 2025-11-21)
3. Posted Rate: put 0 if not in rate conf (add manually later)
4. Email: the contact/dispatch email (goes in CSV)
5. Invoice Email: separate field for billing (NOT in CSV, just listed separately)
6. Miles: estimate if not provided
7. Equipment: use single letter codes (R=Reefer, V=Van, F=Flatbed, VR=Van or Reefer)
8. Origin/Destination: format as "City ST" (e.g., "Johnston SC")

Give me ONLY these two items - no explanations, no extra text. Format exactly like this:

CSV LINE:
[the comma-separated values]

INVOICE EMAIL:
[email or "Not found"]`;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Helper to verify user token
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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify user authentication
    const { user, error: authError } = await verifyUser(req.headers.authorization);
    if (authError) {
      return res.status(401).json({ error: authError });
    }

    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Call Claude with PDF
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Parse this rate confirmation and extract the load details.',
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const aiResponse = response.content[0].text;

    // Parse the response
    const csvMatch = aiResponse.match(/CSV LINE:\s*\n?(.+)/i);
    const emailMatch = aiResponse.match(/INVOICE EMAIL:\s*\n?(.+)/i);

    const csvLine = csvMatch ? csvMatch[1].trim() : null;
    const invoiceEmail = emailMatch ? emailMatch[1].trim() : null;

    if (!csvLine) {
      return res.status(422).json({ 
        error: 'Could not extract data from PDF',
        raw: aiResponse 
      });
    }

    // Parse CSV into structured data
    const fields = csvLine.split(',').map(f => f.trim());
    
    const loadData = {
      id: fields[0] || '',
      pickup_date: fields[1] || '',
      delivery_date: fields[2] || '',
      broker_company: fields[3] || '',
      contact: fields[4] || '',
      phone: fields[5] || '',
      extension: fields[6] || '',
      email: fields[7] || '',
      origin: fields[8] || '',
      destination: fields[9] || '',
      equipment: fields[10] || '',
      miles: parseFloat(fields[11]) || 0,
      posted_rate: parseFloat(fields[12]) || 0,
      booked_rate: parseFloat(fields[13]) || 0,
      shipper: fields[14] || '',
      receiver: fields[15] || '',
    };

    // Calculate RPM
    let rpm = null;
    if (loadData.miles > 0 && loadData.booked_rate > 0) {
      rpm = (loadData.booked_rate / loadData.miles).toFixed(2);
    }

    return res.status(200).json({
      success: true,
      data: loadData,
      csvLine: csvLine,
      rpm: rpm,
    });

  } catch (error) {
    console.error('Parse error:', error);
    return res.status(500).json({ 
      error: 'Failed to parse PDF',
      details: error.message 
    });
  }
}