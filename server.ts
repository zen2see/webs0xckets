import { WebSocketServer, WebSocket } from "ws";
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./chat.db');

// Create table if it doesn't exist
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT)");
});

// INTERFACES
interface CustomWebSocket extends WebSocket {
    username?: string;
    isAlive?: boolean;
}

interface SocketMessage {
    type: 'chat' | 'private' | 'userList' | 'typing' | 'error' | 'history' | 'auth';
    content?: any;
    sender?: string;
    target?: string;
    isTyping?: boolean;
    timestamp?: string;
}

const wss = new WebSocketServer({ port: 8081, host: '0.0.0.0' });
const messageHistory: SocketMessage[] = [];
const MAX_HISTORY = 50;

console.log('🚀 WebSocket Chat Server running on port 8081');

// HELPER: BROADCAST USER LIST
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

// HEARTBEAT (Keep-Alive)
const interval = setInterval(() => {
    wss.clients.forEach((ws: CustomWebSocket) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

// SERVER ERROR HANDLING
wss.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
        console.error('❌ Port 8081 is busy. Run "fuser -k 8081/tcp" to clear it.');
        process.exit(1);
    }
});

// CONNECTION LOGIC
wss.on('connection', (ws: CustomWebSocket) => {
    ws.isAlive = true;

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
                        ws.send(JSON.stringify({ type: "yourName", content: ws.username }));
                    } else {
                        // Create new randomized username if session ID is unknown
                        ws.username = `User-${Math.floor(Math.random() * 1000)}`;
                        db.run("INSERT INTO users (id, username) VALUES (?, ?)", [sessionId, ws.username]);
                        console.log(`Created new user: ${ws.username}`);
                        ws.send(JSON.stringify({ type: "yourName", content: ws.username }));
                    }

                    // Send history and updated list once identity is confirmed
                    ws.send(JSON.stringify({ type: 'history', content: messageHistory }));
                    broadcastUserList();
                });
                return;
            }

            // 2. HANDLE CHAT MESSAGES
            const payloadObj: SocketMessage = {
                ...parsed,
                sender: ws.username,
                type: parsed.type || 'chat',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

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

