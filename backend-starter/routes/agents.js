// routes/agents.js
const express = require('express');
const router = express.Router();
const Agent = require('../models/agent');
const { simulateDelay } = require('../utils/helpers');

// Get all agents
router.get('/', async (req, res, next) => {
  try {
    const agents = await Agent.find();
    
    await simulateDelay(200); // Simulate network delay
    
    res.json(agents);
  } catch (error) {
    next(error);
  }
});

// Get a specific agent
router.get('/:id', async (req, res, next) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }
    
    await simulateDelay(200); // Simulate network delay
    
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

// Update agent configuration

/**
 * Update agent configuration
 * PATCH /api/agents/:id/config
 */
router.patch('/:id/config', async (req, res, next) => {
  try {
    const {
      parameters,
      capabilities,
      knowledgeBases,
      escalationThresholds,
    } = req.body;

    const agent = await Agent.findOne({ id: req.params.id });

    if (!agent) {
      return res.status(404).json({
        message: 'Agent not found',
      });
    }

    // Update model parameters without overwriting unspecified values.
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const currentParameters =
        agent.parameters?.toObject?.() || agent.parameters || {};

      const allowedParameters = [
        'temperature',
        'top_p',
        'max_tokens',
      ];

      const updates = {};

      for (const key of allowedParameters) {
        if (parameters[key] !== undefined) {
          const value = Number(parameters[key]);

          if (!Number.isFinite(value)) {
            return res.status(400).json({
              message: `Invalid parameter: ${key}`,
            });
          }

          if (
            (key === 'temperature' || key === 'top_p') &&
            (value < 0 || value > 1)
          ) {
            return res.status(400).json({
              message: `${key} must be between 0 and 1`,
            });
          }

          if (key === 'max_tokens' && (!Number.isInteger(value) || value < 1)) {
            return res.status(400).json({
              message: 'max_tokens must be a positive integer',
            });
          }

          updates[key] = value;
        }
      }

      agent.parameters = {
        ...(agent.parameters?.toObject?.() || agent.parameters || {}),
        ...updates,
      };
    }

    // Update existing capabilities or add new named capabilities.
    if (capabilities !== undefined) {
      if (!Array.isArray(capabilities)) {
        return res.status(400).json({
          message: 'Capabilities must be an array',
        });
      }

      for (const capability of capabilities) {
        if (!capability.id) continue;

        const existing = agent.capabilities.find(
          (item) => item.id === capability.id
        );

        if (existing) {
          if (capability.name) {
            existing.name = capability.name;
          }

          if (typeof capability.enabled === 'boolean') {
            existing.enabled = capability.enabled;
          }
        } else if (capability.name) {
          agent.capabilities.push({
            id: capability.id,
            name: capability.name,
            enabled: Boolean(capability.enabled),
          });
        }
      }
    }

    // Update existing knowledge bases or add new named entries.
    if (knowledgeBases !== undefined) {
      if (!Array.isArray(knowledgeBases)) {
        return res.status(400).json({
          message: 'Knowledge bases must be an array',
        });
      }

      for (const kb of knowledgeBases) {
        if (!kb.id) continue;

        const existing = agent.knowledgeBases.find(
          (item) => item.id === kb.id
        );

        if (existing) {
          if (kb.name) {
            existing.name = kb.name;
          }

          if (typeof kb.enabled === 'boolean') {
            existing.enabled = kb.enabled;
          }
        } else if (kb.name) {
          agent.knowledgeBases.push({
            id: kb.id,
            name: kb.name,
            enabled: Boolean(kb.enabled),
          });
        }
      }
    }

    // Update only the supplied escalation thresholds.
    if (
      escalationThresholds &&
      typeof escalationThresholds === 'object' &&
      !Array.isArray(escalationThresholds)
    ) {
      const currentThresholds =
        agent.escalationThresholds?.toObject?.() ||
        agent.escalationThresholds ||
        {};

      const allowedThresholds = [
        'lowConfidence',
        'negativeSentiment',
        'responseTime',
      ];

      const updates = {};

      for (const key of allowedThresholds) {
        if (escalationThresholds[key] !== undefined) {
          const value = Number(escalationThresholds[key]);

          if (!Number.isFinite(value)) {
            return res.status(400).json({
              message: `Invalid escalation threshold: ${key}`,
            });
          }

          if (
            (key === 'lowConfidence' || key === 'negativeSentiment') &&
            (value < 0 || value > 1)
          ) {
            return res.status(400).json({
              message: `${key} must be between 0 and 1`,
            });
          }

          if (key === 'responseTime' && value < 1) {
            return res.status(400).json({
              message: 'responseTime must be at least 1 second',
            });
          }

          updates[key] = value;
        }
      }

      agent.escalationThresholds = {
        ...(agent.escalationThresholds?.toObject?.() ||
        agent.escalationThresholds ||
        {}),
        ...updates,
      };
    }

    // Persist all configuration changes in MongoDB.
    await agent.save();

    await simulateDelay(300);

    return res.json({
      message: 'Agent configuration updated successfully',
      agent,
    });
  } catch (error) {
    next(error);
  }
});


// Get agent performance metrics
router.get('/:id/metrics', async (req, res, next) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }
    
    // This would normally fetch metrics from analytics service
    const metrics = agent.metrics || {
      conversations: 0,
      avgResponseTime: 0,
      satisfaction: 0,
      escalationRate: 0,
      topIssues: []
    };
    
    await simulateDelay(300); // Simulate network delay
    
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

module.exports = router;