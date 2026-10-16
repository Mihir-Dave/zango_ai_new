
const Conversation = require('../models/conversation');

module.exports = (ws) => {
  let closed = false;
  let updating = false;

  const send = (payload) => {
    if (!closed && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  };

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
      console.error('WebSocket update failed:', error.message);
    } finally {
      updating = false;
    }
  };

  send({
    type: 'connection',
    message: 'Connected to Agent Supervisor WebSocket server',
    timestamp: new Date(),
  });

  sendConversations();

  const interval = setInterval(sendConversations, 5000);

  ws.on('close', () => {
    closed = true;
    clearInterval(interval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
};
