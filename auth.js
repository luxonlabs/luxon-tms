// /api/auth.js - Handles login, register, logout, and session validation
// This is a catch-all auth endpoint for Luxon TMS

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;

    try {
        switch (action) {
            case 'register':
                return await handleRegister(req, res);
            case 'login':
                return await handleLogin(req, res);
            case 'logout':
                return await handleLogout(req, res);
            case 'session':
                return await handleSession(req, res);
            case 'refresh':
                return await handleRefresh(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleRegister(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password, fullName, companyName } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName || '',
                company_name: companyName || ''
            }
        }
    });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
        return res.status(200).json({ 
            message: 'Please check your email to confirm your account',
            requiresConfirmation: true
        });
    }

    return res.status(200).json({
        user: {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name
        },
        session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at
        }
    });
}

async function handleLogin(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
        user: {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name
        },
        session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at
        }
    });
}

async function handleLogout(req, res) {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Sign out with the token
        await supabase.auth.signOut({ scope: 'local' });
    }
    
    return res.status(200).json({ message: 'Logged out successfully' });
}

async function handleSession(req, res) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    return res.status(200).json({
        user: {
            id: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name
        }
    });
}

async function handleRefresh(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
    });

    if (error) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }

    return res.status(200).json({
        session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at
        }
    });
}
