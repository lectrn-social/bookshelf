const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    sharer: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'User'},
    shared: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, refPath: 'sharedType'},
    sharedType: {type: String, required: true, enum: ['Blip', 'Post']},
    // TODO: Audience
    createdAt: {type: Date, required: true, default: () => new Date()},
});

module.exports = mongoose.model('Share', schema);