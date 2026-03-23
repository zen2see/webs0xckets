import { WebSocketServer, WebSocket } from 'ws';
import sqlite3 from 'sqlite3'

const db = new sqlite3.Database('./chat.db');

// Create the table if it doesn't exist
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT)");
})

// INTERFACES
interface CustomwebSocket extends WebSocket {
    unsername?: string
    isAlive?: boolean // Used for the heartbead
}

interface SocketMessage {
    type: 'chat' | 'private' | 'userList' | 'typing' | 'error' | 'history' | 'auth'
    content?: any
    sender?: string
    target?: string
    isTyping?: boolean
    timestamp?: string
}

const wss = new WebSocketServer({ port: 8081, host: '0.0.0.0' })
cnst messageHistory: socketMessage[] = []
NAX_HISTORY = 50

console.log('🚀 WebSocket Chat Server running on port 8081')

// HELPER: BROADCAST USER LIST
const broadcastUserList = () => {
    const users = Array.from(wss.clients)
        .map((c: CustomWebSocket) => c.username)
        .filter(Boolean)
    const payload = JSON.stringify({ type: 'userList', content: users })
    wss.clients.forEach((client) => {
        if (client.readyState === webSocket.OPEN) {
	    client.send(payload)
	}
    })
}

// HEARTBEAT (Keep-Alive) - prevent Nginx from closing "idle" connections
const interval = setInterval(() => {
    wss.clients.forEach((ws: customwebSocket) => {
        if (ws.isAlive == false) return ws.terminate() 
	ws.isAlive = false
	ws.ping() // send ping to client
    })
}, 30000) // Check every 30 seconds

wss.on('close', () => clearInterval(interval))

// SERVER ERROR HANDLING
wss.on('error', (error: any) => {
    if (error.code === 'ERRORINUSE') {
        console.error(❌ Port 8081 is busy. Run "fuser -k 8081/tcp" to clear it.')
	process.exit(1)
    }
}

// CONNECTION LOGIC 
wss.on('connection', (ws: CustomWebSocket) => {
    ws.isAlive = true;

    // Handle the "pong" response from client to confirm it's still there
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    console.log("New connection established.");

    ws.on('message', (data) => {
        try {
            const parsed: SocketMessage = JSON.parse(data.toString());

            // 1. HANDLE AUTHENTICATION (SQLite + LocalStorage)
            if (parsed.type === 'auth') {
                const sessionId = parsed.content;

                db.get("SELECT username FROM users WHERE id = ?", [sessionId], (err, row: any) => {
                    if (row) {
                        ws.username = row.username;
                        console.log(`Restored user: ${ws.username}`);
                    } else {
                        // Create new user if session ID is unknown
                        ws.username = `User-${Math.floor(Math.random() * 1000)}`;
                        db.run("INSERT INTO users (id, username) VALUES (?, ?)", [sessionId, ws.username]);
                        console.log(`Created new user: ${ws.username}`);
                    }

                    // Send history and updated list once identity is confirmed
                    ws.send(JSON.stringify({ type: 'history', content: messageHistory }));
                    broadcastUserList();
                });
                return; // Stop here for auth messages
            }

            // 2. HANDLE CHAT MESSAGES
            const payloadObj: SocketMessage = {
                ...parsed,
                sender: ws.username,
                type: parsed.type || 'chat',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            // Save to history (only public chat)
            if (payloadObj.type === 'chat') {
                messageHistory.push(payloadObj);
                if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
            }

            const payloadString = JSON.stringify(payloadObj);

            wss.clients.forEach((client: CustomWebSocket) => {
                if (client.readyState === WebSocket.OPEN) {
                    if (parsed.type === 'private') {
                        if (client.username === parsed.target || client === ws) {
                            client.send(payloadString);
                        }
                    } else {
                        client.send(payloadString);
                    }
                }
            });

        } catch (e) {
            console.error("Invalid JSON or DB error:", e);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username || 'Unauthenticated user'} disconnected.`);
        broadcastUserList();
    });

    ws.on('error', (err) => console.error(`Socket error:`, err));
});
 


console.log("SERVER IS STARTING ---"); 
const wss = new WebSocketServer({ port: 8081, host:'0.0.0.0' });

const messageHistory: SocketMessage[] = [];
const MAX_HISTORY = 50;
console.log('🚀 WebSocket Chat Server with History');


// --- MOVE ERROR LISTENER HERE (Top Level) ---
wss.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
        console.error('❌ Port 8081 is busy. Try running "fuser -k 8081/tcp" to clear it.');
        process.exit(1);
    }
});

console.log('🚀 WebSocket Chat Server running on ws://localhost:8081');

const broadcastUserList = () => {
    const users = Array.from(wss.clients)
        .map((c: CustomWebSocket) => c.username)
        .filter(Boolean);
    const payload = JSON.stringify({ type: 'userList', content: users });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
};

wss.on('connection', (ws: CustomWebSocket) => {
    ws.username = `User-${Math.floor(Math.random() * 1000)}`;
    console.log(`${ws.username} connected.`);
    // 1. Send existing history to the new user immediately
    ws.send(JSON.stringify({ type: 'history', content: messageHistory }));
    broadcastUserList();
    ws.on('message', (data) => {
        try {
            const parsed: SocketMessage = JSON.parse(data.toString());
            // 2. Add Server-Side Timestamp
            const payload = JSON.stringify({
                ...parsed,
                sender: ws.username,
                type: parsed.type || 'chat',
                timestamp: new Date()
                .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });

            wss.clients.forEach((client: CustomWebSocket) => {
                if (client.readyState === WebSocket.OPEN) {
                    if (parsed.type === 'private') {
                        // Logic: Send ONLY to target OR back to the sender
                        if (client.username === parsed.target || client === ws) {
                            client.send(payload);
                        }
                    } else {
                        client.send(payload);
                    }
                }
            });
        } catch (e) {
            console.error("Invalid JSON received");
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected.`);
        broadcastUserList();
    });

    // Individual socket error handler (stays inside connection)
    ws.on('error', (err) => console.error(`Socket error (${ws.username}):`, err));
});



