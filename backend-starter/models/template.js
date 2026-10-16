
const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Greeting',
        'Order Support',
        'Refunds',
        'Escalation',
        'Closing',
        'General',
      ],
      default: 'General',
    },
    description: {
      type: String,
      default: '',
      maxlength: 300,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: String,
      default: 'Supervisor',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', templateSchema);
