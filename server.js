const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from public directory
app.use(express.static('public'));

// Store connected users and messages
const connectedUsers = new Map();
const messages = [];
const MAX_MESSAGES = 100; // Keep last 100 messages

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user-joined', (username) => {
    // Store user info
    connectedUsers.set(socket.id, {
      id: socket.id,
      username: username,
      joinedAt: new Date()
    });

    // Send recent messages to new user
    socket.emit('message-history', messages);

    // Send updated user list to all clients
    io.emit('users-update', Array.from(connectedUsers.values()));

    // Notify all users about new user
    socket.broadcast.emit('user-notification', {
      type: 'joined',
      username: username,
      timestamp: new Date()
    });

    console.log(`${username} joined the chat`);
  });

  // Handle new messages
  socket.on('new-message', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now() + Math.random(),
      username: user.username,
      text: data.text,
      timestamp: new Date(),
      userId: socket.id
    };

    // Add to messages array
    messages.push(message);
    
    // Keep only last MAX_MESSAGES
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    // Broadcast message to all users
    io.emit('new-message', message);
    
    console.log(`Message from ${user.username}: ${data.text}`);
  });

  // Handle typing indicators
  socket.on('typing-start', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', {
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('typing-stop', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', {
        username: user.username,
        isTyping: false
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    
    if (user) {
      // Remove from connected users
      connectedUsers.delete(socket.id);

      // Send updated user list
      io.emit('users-update', Array.from(connectedUsers.values()));

      // Notify all users about user leaving
      socket.broadcast.emit('user-notification', {
        type: 'left',
        username: user.username,
        timestamp: new Date()
      });

      console.log(`${user.username} left the chat`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});