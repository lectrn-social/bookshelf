const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    username: {type: String, index: true, unique: true}, // username, short handle
    name: String, // "real name" (display name)
    bio: String,
    pronouns: [{
        subject: String, // he/she/they
        object: String, // him/her/them
        dependent: String, // his/her/their
        reflexive: String // himself/herself/themself
    }],
    website: String,
    location: String,
    authentication: { // forms of supported authentication
        password: {
            hash: String
        }
    },
    privacy: {
        follow: {
            approveOnly: {
                type: Boolean,
                required: true,
                default: false
            }
        },
        blip: {
            defaultAudience: {
                type: String,
                enum: ["Public", "Followers", "Mutuals", "Self"],
                required: true,
                default: "Public"
            },
        },
        post: {
            defaultAudience: {
                type: String,
                enum: ["Public", "Followers", "Mutuals", "Self"],
                required: true,
                default: "Public"
            }
        }
    }
});

module.exports = mongoose.model("User", schema);