
const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Agent = require('../models/agent');

router.get('/stream', async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  let fetching = false;

  const sendMetrics = async () => {
    if (closed || fetching || res.writableEnded) return;

    fetching = true;

    try {
      const [
        total,
        active,
        waiting,
        escalated,
        resolved,
        conversations,
      ] = await Promise.all([
        Conversation.countDocuments(),
        Conversation.countDocuments({ status: 'active' }),
        Conversation.countDocuments({ status: 'waiting' }),
        Conversation.countDocuments({ status: 'escalated' }),
        Conversation.countDocuments({ status: 'resolved' }),
        Conversation.find()
          .select('metrics')
          .lean(),
      ]);

      const average = (key) => {
        const values = conversations
          .map((item) => Number(item.metrics?.[key]))
          .filter(Number.isFinite);

        return values.length
          ? values.reduce((sum, value) => sum + value, 0) /
              values.length
          : 0;
      };

      const payload = {
        total,
        active,
        waiting,
        escalated,
        resolved,
        averageResponseTime: average('responseTime'),
        averageSentiment: average('sentiment'),
        timestamp: new Date().toISOString(),
      };

      if (!closed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    } catch (error) {
      console.error('Analytics stream error:', error.message);
    } finally {
      fetching = false;
    }
  };

  // Send an initial snapshot, then refresh every two seconds.
  await sendMetrics();

  if (closed || res.writableEnded) return;

  const interval = setInterval(sendMetrics, 2000);

  // Keep intermediaries from treating the connection as idle.
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  req.on('close', () => {
    closed = true;
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

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
