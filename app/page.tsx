// 'use client';
// import { useEffect, useState, useRef } from 'react';

// export default function ChatPage() {
//     const [messages, setMessages] = useState<any[]>([]);
//     const [input, setInput] = useState('');
//     const [users, setUsers] = useState<string[]>([]);
//     const socketRef = useRef<WebSocket | null>(null);

//     useEffect(() => {
//         const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//         const socket = new WebSocket(`${protocol}//${window.location.host}`);
//         socketRef.current = socket;

//         socket.onmessage = (event) => {
//             const data = JSON.parse(event.data);
//             if (data.type === 'userList') setUsers(data.content);
//             else setMessages((prev) => [...prev, data]);
//         };

//         return () => socket.close();
//     }, []);

//     const sendMessage = (e: React.FormEvent) => {
//         e.preventDefault();
//         if (!input.trim() || !socketRef.current) return;

//         let payload: any = { type: 'chat', content: input };

//         if (input.startsWith('/msg ')) {
//             const parts = input.split(' ');
//             payload = { type: 'private', target: parts[1], content: parts.slice(2).join(' ') };
//         }

//         socketRef.current.send(JSON.stringify(payload));
//         setInput('');
//     };

//     return (
//         <div className="flex h-screen bg-gray-100 p-4 gap-4">
//             {/* Sidebar */}
//             <div className="w-1/4 bg-white p-4 rounded shadow">
//                 <h2 className="font-bold border-b mb-2">Online Users</h2>
//                 {users.map(u => <div key={u} className="text-green-600 text-sm">● {u}</div>)}
//             </div>

//             {/* Chat Area */}
//             <div className="flex-1 flex flex-col bg-white rounded shadow p-4">
//                 <div className="flex-1 overflow-y-auto mb-4 space-y-2">
//                     {messages.map((m, i) => (
//                         <div key={i} className={`p-2 rounded ${m.type === 'private' ? 'bg-purple-100' : 'bg-gray-50'}`}>
//                             <span className="font-bold">{m.sender}: </span>{m.content}
//                         </div>
//                     ))}
//                 </div>
//                 <form onSubmit={sendMessage} className="flex gap-2">
//                     <input 
//                         className="flex-1 border p-2 rounded" 
//                         value={input} 
//                         onChange={(e) => setInput(e.target.value)}
//                         placeholder="Type message or /msg User-ID message..."
//                     />
//                     <button className="bg-blue-500 text-white px-4 py-2 rounded">Send</button>
//                 </form>
//             </div>
//         </div>
//     );
// }
'use client';

import { useEffect, useState, useRef } from 'react';

interface Message {
  type: 'chat' | 'private' | 'userList' | 'error' | 'history';
  content: string | string[];
  sender?: string;
  timestamp?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to the SEPARATE WebSocket server on port 8081
    const socket = new WebSocket('wss://chat.da0xlin.xyz/socket');
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'userList') {
          setUsers(data.content);
        } else {
          setMessages((prev) => [...prev, data]);
        }
      } catch (e) {
        console.error("Failed to parse message:", event.data);
      }
    };
    socket.onclose = () => console.log("Disconnected from Chat Server");
    return () => socket.close();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    let payload: any;

    // Command Parser for Private Messages
    if (input.startsWith('/msg ')) {
      const parts = input.split(' ');
      const target = parts[1]; // The username
      const content = parts.slice(2).join(' '); // The actual message

      payload = {
        type: 'private',
        target: target,
        content: content,
      };
    } else {
      // Default Broadcast
      payload = {
        type: 'chat',
        content: input,
      };
    }
    socketRef.current.send(JSON.stringify(payload));
    setInput('');
  };
  return (
    <div className="flex h-screen bg-gray-900 text-white p-4 gap-4 font-sans">
      {/* Sidebar: Online Users */}
      <div className="w-64 bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-blue-400 border-b border-gray-700 pb-2">
          Online ({users.length})
        </h2>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {user}
            </div>
          ))}
        </div>
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
        {/* Message List */}
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
              <div className="text-xs font-bold text-blue-400 mb-1">
                {msg.type === 'private' ? '🔒 PRIVATE FROM ' : ''}
                {msg.sender}
              </div>
              <div className="text-sm">{msg.content as string}</div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Input Bar */}
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
