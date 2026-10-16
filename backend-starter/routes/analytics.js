
const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Agent = require('../models/agent');

router.get('/', async (req, res, next) => {
  try {
    const requestedDays = Number.parseInt(req.query.days, 10) || 7;
    const days = Math.min(90, Math.max(1, requestedDays));

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      total,
      active,
      waiting,
      escalated,
      resolved,
      recentConversations,
      daily,
      agents,
    ] = await Promise.all([
      Conversation.countDocuments(),
      Conversation.countDocuments({ status: 'active' }),
      Conversation.countDocuments({ status: 'waiting' }),
      Conversation.countDocuments({ status: 'escalated' }),
      Conversation.countDocuments({ status: 'resolved' }),

      Conversation.find({ startTime: { $gte: since } })
        .select('metrics startTime status alertLevel')
        .lean(),

      Conversation.aggregate([
        { $match: { startTime: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$startTime',
              },
            },
            conversations: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            conversations: 1,
          },
        },
      ]),

      Agent.find()
        .select('id name status metrics')
        .lean(),
    ]);

    const average = (values) => {
      const valid = values
        .map(Number)
        .filter(Number.isFinite);

      return valid.length
        ? valid.reduce((sum, value) => sum + value, 0) / valid.length
        : 0;
    };

    res.json({
      periodDays: days,
      conversations: {
        total,
        active,
        waiting,
        escalated,
        resolved,
        averageResponseTime: average(
          recentConversations.map((c) => c.metrics?.responseTime)
        ),
        averageSentiment: average(
          recentConversations.map((c) => c.metrics?.sentiment)
        ),
      },
      agents,
      daily,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
