import { WebSocketServer, WebSocket } from 'ws';

interface CustomWebSocket extends WebSocket {
    username?: string;
}

interface SocketMessage {
    type: 'chat' | 'private' | 'userList' | 'typing' | 'error' | 'history';
    content?: any;
    sender?: string;
    target?: string;
    isTyping?: boolean;
    timestamp?: string;
}

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


