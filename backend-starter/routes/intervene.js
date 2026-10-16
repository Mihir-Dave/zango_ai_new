// routes/intervene.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const { simulateDelay } = require('../utils/helpers');

// Intervene in a conversation
router.post('/', async (req, res, next) => {
  try {
    const { conversationId, supervisorId, notes } = req.body;
    
    if (!conversationId || !supervisorId) {
      return res.status(400).json({ message: 'Conversation ID and supervisor ID are required' });
    }
    
    const conversation = await Conversation.findOne({ id: conversationId });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Record the intervention
    conversation.humanIntervention = {
      occurred: true,
      supervisorId,
      timestamp: new Date(),
      notes: notes || ''
    };
    
    // Change status to escalated
    conversation.status = 'escalated';
    
    await conversation.save();
    
    // This would normally trigger a WebSocket update
    
    await simulateDelay(300); // Simulate network delay
    
    res.json({ 
      message: 'Intervention recorded',
      intervention: conversation.humanIntervention
    });
  } catch (error) {
    next(error);
  }
});

// End intervention and return to agent

router.post('/release', async (req, res, next) => {
  try {
    const { conversationId, supervisorNotes } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        message: 'Conversation ID is required',
      });
    }

    const conversation = await Conversation.findOne({
      id: conversationId,
    });

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found',
      });
    }

    if (
      !conversation.humanIntervention ||
      !conversation.humanIntervention.occurred
    ) {
      return res.status(400).json({
        message: 'No active intervention to release',
      });
    }

    // Save supervisor feedback before returning control.
    if (typeof supervisorNotes === 'string' && supervisorNotes.trim()) {
      conversation.supervisorNotes = supervisorNotes.trim();

      conversation.humanIntervention.notes = supervisorNotes.trim();
    }

    // Mark the intervention as finished.
    conversation.humanIntervention.occurred = false;

    // Return the conversation to the AI workflow.
    conversation.status = 'active';

    await conversation.save();

    await simulateDelay(300);

    return res.json({
      message: 'Intervention released. Control returned to the AI.',
      conversationId: conversation.id,
      status: conversation.status,
      humanIntervention: conversation.humanIntervention,
      supervisorNotes: conversation.supervisorNotes,
    });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
