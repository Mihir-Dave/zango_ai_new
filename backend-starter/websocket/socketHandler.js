
const Conversation = require('../models/conversation');

module.exports = (ws) => {
  console.log('WebSocket client connected');

  let closed = false;
  let updating = false;

  const send = (payload) => {
    if (!closed && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  send({
    type: 'connection',
    message: 'Connected to Agent Supervisor WebSocket server',
    timestamp: new Date(),
  });

  const sendConversations = async () => {
    if (closed || updating) return;

    updating = true;

    try {
      const conversations = await Conversation.find()
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

      send({
        type: 'conversations_update',
        data: conversations,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('WebSocket conversation update failed:', error.message);
    } finally {
      updating = false;
    }
  };

  // Send the initial snapshot, then refresh every five seconds.
  sendConversations();
  const updateInterval = setInterval(sendConversations, 5000);

  const pingInterval = setInterval(() => {
    send({ type: 'ping', timestamp: new Date() });
  }, 30000);

  ws.on('message', (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());

      if (message.type === 'subscribe') {
        send({
          type: 'subscription_confirmation',
          channel: message.channel,
          timestamp: new Date(),
        });
      }
    } catch {
      send({ type: 'error', message: 'Invalid WebSocket message format' });
    }
  });

  ws.on('close', () => {
    closed = true;
    clearInterval(updateInterval);
    clearInterval(pingInterval);
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
};
