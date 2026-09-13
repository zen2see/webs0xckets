'use client';

import { useEffect, useState, useRef } from 'react';

interface Message {
  type: 'chat' | 'private' | 'userList' | 'error' | 'history' | 'auth' | 'yourName';
  content: any;
  sender?: string;
  timestamp?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [myUsername, setMyUsername] = useState<string>(''); 
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      let sessionId = localStorage.getItem('chat_session_id');
      if (!sessionId) {
        sessionId = 'sees-' + Math.random().toString(36).substring(2,9);
        localStorage.setItem('chat_session_id', sessionId);
      }

      const socket = new WebSocket('wss://chat.da0xlin.xyz/socket');
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✅ Connected to Chat Server');
        socket.send(JSON.stringify({
          type: 'auth',
          content: sessionId
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data: Message = JSON.parse(event.data);

          if (data.type === 'yourName') {
            setMyUsername(data.content as string);
          } else if (data.type === 'userList') {
            setUsers(data.content as string[]);
          } else if (data.type === 'history') {
            setMessages(data.content as Message[]);
          } else {
            setMessages((prev) => [...prev, data]);
          }
        } catch (e) {
          console.error("Failed to parse message:", event.data);
        }
      };

      socket.onclose = () => {
         console.log("❌ Disconnected from Chat Server, Reconnecting in 3s...");
         reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
 
    return () => {
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.error("Socket is closed or not ready");
        return;
    }

    let payload: any;
    if (input.startsWith('/msg ')) {
        const parts = input.split(' ');
        payload = { type: 'private', target: parts[1], content: parts.slice(2).join(' ') };
    } else {
        payload = { type: 'chat', content: input };
    }

    socketRef.current.send(JSON.stringify(payload));
    setInput('');
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white p-4 gap-4 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-blue-400 border-b border-gray-700 pb-2">
          Online ({users.length})
        </h2>
        <div className="space-y-2">
          {users.map((user, idx) => {
            const isMe = user === myUsername;
            return (
              <div key={idx} className={`flex items-center gap-2 text-sm ${isMe ? 'font-bold text-blue-400 scale-102' : 'text-gray-300'}`}>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>{user} {isMe && <span className="text-xs text-blue-500 font-normal ml-1">(You)</span>}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.type === 'private'
                  ? 'bg-purple-900/40 border border-purple-500/50'
                  : 'bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-blue-400">
                  {msg.type === 'private' ? '🔒 PRIVATE FROM ' : ''}
                  {msg.sender === myUsername ? `${msg.sender} (You)` : (msg.sender || 'System')}
                </span>
                <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
              </div>
              <div className="text-sm">{msg.content as string}</div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 bg-gray-900 flex gap-2">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:border-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or /msg User-ID message..."
          />
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-bold transition-colors">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
