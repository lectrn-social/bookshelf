const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    followed: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'User'},
    follower: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'User'},
    pending: {type: Boolean, index: true, required: true},
    createdAt: {type: Date, required: true, default: () => new Date()}
});

module.exports = mongoose.model('Follow', schema);