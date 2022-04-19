const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    app: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'App'},
    user: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'User'},
    accessToken: {type: String, index: true, unique: true, required: true}, // hash of access token
    refreshToken: {type: String, index: true, unique: true}, // hash of refresh token 
    scopes: [String],
    createdAt: {type: Date, required: true},
    refreshedAt: Date,
    expiresAt: {type: Date, required: true},
});

module.exports = mongoose.model('Token', schema);