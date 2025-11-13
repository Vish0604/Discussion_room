import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Sign up route
app.post('/make-server-f632f783/signup', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    // Create email from username (required by Supabase)
    const email = `${username}@discussionroom.local`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.log('Signup exception:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Post a message
app.post('/make-server-f632f783/messages', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      console.log('Auth error while posting message:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { message } = await c.req.json();

    if (!message || message.trim() === '') {
      return c.json({ error: 'Message cannot be empty' }, 400);
    }

    const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonymous';
    const timestamp = new Date().toISOString();
    const msgId = crypto.randomUUID();

    const messageData = {
      msgId,
      username,
      message: message.trim(),
      timestamp,
    };

    // Store in KV with key format: message:timestamp:msgId
    await kv.set(`message:${timestamp}:${msgId}`, messageData);

    return c.json({ success: true, message: messageData });
  } catch (error) {
    console.log('Error posting message:', error);
    return c.json({ error: 'Failed to post message' }, 500);
  }
});

// Get all messages
app.get('/make-server-f632f783/messages', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      console.log('Auth error while fetching messages:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all messages with prefix 'message:'
    const messages = await kv.getByPrefix('message:');

    // Sort by timestamp (oldest first)
    const sortedMessages = messages.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return c.json({ messages: sortedMessages });
  } catch (error) {
    console.log('Error fetching messages:', error);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

Deno.serve(app.fetch);
