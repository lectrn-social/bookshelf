const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    owner: {type: mongoose.Schema.Types.ObjectId, index: true, required: true, ref: 'User'},
    contentWarning: String,
    content: {type: String, required: true},
    createdAt: {type: Date, required: true, default: () => new Date()},
    attachments: {type: [{
        type: {type: String, required: true, enum: ["Link", "Image"]},
        link: String,
        image: String,
        title: String,
        description: String,
    }], default: () => []},
    audience: {
        audience: {
            type: String,
            enum: ["Public", "Followers", "Mutuals", "Self"],
            required: true,
        },
        isDefault: {
            type: Boolean,
            required: true,
            default: true
        }
    },
});

module.exports = mongoose.model('Blip', schema);