const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    owner: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'User'},
    secret: {type: String, required: true}, // hash of app secret
    createdAt: {type: Date, required: true, default: () => new Date()},
    refreshedAt: Date, // secret refresh date

    name: {type: String, required: true},
    description: String,
    isOfficial: {type: Boolean, default: false},
});

module.exports = mongoose.model('App', schema);