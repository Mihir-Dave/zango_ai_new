
const express = require('express');
const router = express.Router();
const Template = require('../models/template');

const ALLOWED_CATEGORIES = [
  'Greeting',
  'Order Support',
  'Refunds',
  'Escalation',
  'Closing',
  'General',
];

function extractVariables(content = '') {
  return [
    ...new Set(
      [...content.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
        .map((match) => match[1])
    ),
  ];
}

function validateTemplate(body) {
  const { name, content, category } = body;

  if (!name || !name.trim()) {
    return 'Template name is required';
  }

  if (!content || !content.trim()) {
    return 'Template content is required';
  }

  if (name.trim().length > 100) {
    return 'Template name must be 100 characters or fewer';
  }

  if (content.length > 5000) {
    return 'Template content must be 5000 characters or fewer';
  }

  if (category && !ALLOWED_CATEGORIES.includes(category)) {
    return 'Invalid template category';
  }

  return null;
}

// GET /api/templates?search=refund&category=Refunds
router.get('/', async (req, res, next) => {
  try {
    const { search, category, active } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (active !== 'all') {
      filter.isActive = active === 'false' ? false : true;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
      ];
    }

    const templates = await Template.find(filter).sort({
      updatedAt: -1,
    });

    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// POST /api/templates
router.post('/', async (req, res, next) => {
  try {
    const validationError = validateTemplate(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const {
      name,
      category,
      description,
      content,
      isActive,
      createdBy,
    } = req.body;

    const template = await Template.create({
      name: name.trim(),
      category: category || 'General',
      description: description || '',
      content: content.trim(),
      variables: extractVariables(content),
      isActive: isActive !== false,
      createdBy: createdBy || 'Supervisor',
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// POST /api/templates/:id/use
router.post('/:id/use', async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (!template.isActive) {
      return res.status(400).json({
        message: 'This template is inactive',
      });
    }

    const { values = {} } = req.body;
    const unresolved = [];

    const message = template.content.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (placeholder, variable) => {
        const value = values[variable];

        if (value === undefined || value === null || String(value).trim() === '') {
          unresolved.push(variable);
          return placeholder;
        }

        return String(value).trim();
      }
    );

    if (unresolved.length > 0) {
      return res.status(400).json({
        message: 'Please fill in all required variables',
        missingVariables: [...new Set(unresolved)],
      });
    }

    template.usageCount += 1;
    await template.save();

    res.json({
      templateId: template._id,
      message,
      usageCount: template.usageCount,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/templates/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const validationError = validateTemplate(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const {
      name,
      category,
      description,
      content,
      isActive,
    } = req.body;

    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    template.name = name.trim();
    template.category = category || 'General';
    template.description = description || '';
    template.content = content.trim();
    template.variables = extractVariables(content);

    if (typeof isActive === 'boolean') {
      template.isActive = isActive;
    }

    await template.save();
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
