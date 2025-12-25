// /api/loads.js - CRUD operations for loads with user authentication
// All operations are automatically scoped to the authenticated user via RLS

import { createClient } from '@supabase/supabase-js';

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
    
    return { user, token };
}

// Create a Supabase client with the user's token for RLS
function getAuthenticatedClient(token) {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        }
    );
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify user authentication
    const { user, token, error: authError } = await verifyUser(req.headers.authorization);
    if (authError) {
        return res.status(401).json({ error: authError });
    }

    // Use authenticated client for RLS
    const authClient = getAuthenticatedClient(token);

    try {
        switch (req.method) {
            case 'GET':
                return await getLoads(req, res, authClient, user);
            case 'POST':
                return await createLoad(req, res, authClient, user);
            case 'PUT':
                return await updateLoad(req, res, authClient, user);
            case 'DELETE':
                return await deleteLoad(req, res, authClient, user);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Loads API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// GET - Fetch all loads for the user (or single load by ID)
async function getLoads(req, res, supabase, user) {
    const { id, status, search, limit = 50, offset = 0 } = req.query;

    // Single load by ID
    if (id) {
        const { data, error } = await supabase
            .from('loads')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Load not found' });
        }
        return res.status(200).json({ load: data });
    }

    // List loads with optional filters
    let query = supabase
        .from('loads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter by status if provided
    if (status) {
        query = query.eq('status', status);
    }

    // Search by load number or broker name
    if (search) {
        query = query.or(`load_number.ilike.%${search}%,broker_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching loads:', error);
        return res.status(500).json({ error: 'Failed to fetch loads' });
    }

    return res.status(200).json({
        loads: data,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
}

// POST - Create a new load
async function createLoad(req, res, supabase, user) {
    const loadData = req.body;

    // Add user_id to the load
    const loadRecord = {
        ...loadData,
        user_id: user.id,
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('loads')
        .insert([loadRecord])
        .select()
        .single();

    if (error) {
        console.error('Error creating load:', error);
        return res.status(500).json({ error: 'Failed to create load' });
    }

    return res.status(201).json({ load: data });
}

// PUT - Update an existing load
async function updateLoad(req, res, supabase, user) {
    const { id } = req.query;
    const updates = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Load ID required' });
    }

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;

    // Add updated timestamp
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('loads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating load:', error);
        return res.status(500).json({ error: 'Failed to update load' });
    }

    return res.status(200).json({ load: data });
}

// DELETE - Delete a load
async function deleteLoad(req, res, supabase, user) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Load ID required' });
    }

    const { error } = await supabase
        .from('loads')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting load:', error);
        return res.status(500).json({ error: 'Failed to delete load' });
    }

    return res.status(200).json({ message: 'Load deleted successfully' });
}
