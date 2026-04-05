import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { supabase } from './supabase';

const connections = new Map<string, ImapFlow>();

export async function startImapWorkers() {
    console.log('Starting IMAP workers for email tracking...');
    
    // Poll for new IMAP accounts or dropped connections every 5 minutes
    setInterval(checkImapConnections, 5 * 60 * 1000);
    await checkImapConnections();
}

async function checkImapConnections() {
    try {
        const { data: accounts, error } = await supabase
            .from('email_accounts')
            .select('*')
            .eq('status', 'connected')
            .eq('protocol', 'imap_smtp');

        if (error || !accounts) return;

        // Disconnect removed accounts
        const activeIds = accounts.map(a => a.id);
        for (const [id, client] of connections.entries()) {
            if (!activeIds.includes(id)) {
                console.log(`Disconnecting removed IMAP account ${id}`);
                client.logout().catch(() => {});
                client.close();
                connections.delete(id);
            }
        }

        // Connect new accounts
        for (const account of accounts) {
            if (!connections.has(account.id)) {
                connectToImap(account);
            }
        }
    } catch (err) {
        console.error('Error checking IMAP connections:', err);
    }
}

async function connectToImap(account: any) {
    if (!account.imap_host || !account.imap_user) return;

    let auth: any = { user: account.imap_user };
    if (account.access_token) {
        // OAuth2 using XOAUTH2
        auth.accessToken = account.access_token;
    } else if (account.imap_password) {
        auth.pass = account.imap_password;
    } else {
        return;
    }

    const client = new ImapFlow({
        host: account.imap_host,
        port: account.imap_port || 993,
        secure: true,
        auth,
        logger: false, // disable verbose logging
    });

    connections.set(account.id, client);

    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');

        console.log(`IMAP connected for ${account.email_address}`);

        // Handle incoming emails (IDLE)
        client.on('exists', async () => {
            try {
                for await (let msg of client.fetch('*:*', { source: true, envelope: true })) {
                    // Only process unseen messages
                    if (msg.flags.has('\\Seen')) continue;

                    const parsed = await simpleParser(msg.source);
                    let fromEmail = parsed.from?.value[0]?.address;
                    if (!fromEmail) continue;

                    console.log(`New email from ${fromEmail} to ${account.email_address}`);

                    // Check if this fromEmail matches any pending/in_progress recipient in this company
                    const { data: recipients } = await supabase
                        .from('email_campaign_recipients')
                        .select('id, campaign_id')
                        .eq('lead_email', fromEmail)
                        .in('status', ['pending', 'in_progress', 'sent'])
                        .order('last_sent_at', { ascending: false })
                        .limit(1);

                    if (recipients && recipients.length > 0) {
                        const rec = recipients[0];
                        console.log(`Matched reply for recipient ${rec.id}`);
                        
                        // Mark as replied
                        await supabase
                            .from('email_campaign_recipients')
                            .update({ status: 'replied', replied_at: new Date().toISOString() })
                            .eq('id', rec.id);

                        // Mark message as seen
                        await client.messageFlagsAdd(msg.seq, ['\\Seen']);
                        
                        // Log
                        await supabase.from('email_campaign_logs').insert({
                            company_id: account.company_id,
                            campaign_id: rec.campaign_id,
                            recipient_id: rec.id,
                            sent_by_account_id: account.id,
                            recipient_email: fromEmail,
                            subject: parsed.subject,
                            status: 'replied',
                        });
                    }
                }
            } catch (err) {
                console.error(`Error processing email for ${account.email_address}:`, err);
            }
        });

        // Setup reconnect on close
        client.on('close', () => {
            console.log(`IMAP connection closed for ${account.email_address}, recreating in 30s...`);
            connections.delete(account.id);
            setTimeout(() => {
                if (!connections.has(account.id)) connectToImap(account);
            }, 30000);
        });

    } catch (err: any) {
        console.error(`IMAP connection failed for ${account.email_address}:`, err.message);
        connections.delete(account.id);
        
        // Try refreshing token if OAuth
        if (account.access_token && account.refresh_token && err.message.includes('Authentication failed')) {
            console.log(`Attempting OAuth refresh for ${account.email_address}`);
            try {
                const refreshed = await refreshGoogleToken(account);
                if (refreshed) connectToImap({...account, access_token: refreshed});
            } catch (e) {
                console.error('Refresh failed:', e);
            }
        }
    }
}

async function refreshGoogleToken(account: any) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !account.refresh_token) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: account.refresh_token,
            grant_type: "refresh_token"
        }),
    });

    const data = await res.json();
    if (!res.ok) return null;

    const expiresAt = new Date(Date.now() + (data.expires_in || 3599) * 1000).toISOString();

    await supabase
        .from('email_accounts')
        .update({
            access_token: data.access_token,
            token_expires_at: expiresAt,
            status: 'connected',
        })
        .eq('id', account.id);

    return data.access_token;
}
