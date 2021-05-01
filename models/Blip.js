const { Model } = require('objection')

class Blip extends Model {
  static get tableName () {
    return 'blips'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['uid', 'content'],

      properties: {
        id: { type: 'integer' },
        uuid: { type: 'string' },
        ts: { type: 'string' },

        reply_to_id: { type: ['integer', 'null'] },
        uid: { type: 'integer' },
        content: { type: 'string', minLength: 1, maxLength: 500 }
      }
    }
  }

  static get relationMappings () {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./User'),
        join: {
          from: 'blips.uid',
          to: 'users.id'
        }
      },
      replies: {
        relation: Model.HasManyRelation,
        modelClass: Blip,
        join: {
          from: 'blips.id',
          to: 'blips.reply_to_id'
        }
      }
    }
  }

  // Convert model into ActivityPub Object
  activityPub () {
    const uid = new URL('/@' + this.user.username, process.env.BASE_URL).href
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Note',
      id: uid + '/' + this.uuid,
      attributedTo: uid,
      to: [
        uid + '/followers',
        'https://www.w3.org/ns/activitystreams#Public'
      ],
      content: this.content,
      published: this.ts,
      replies: uid + '/' + this.uuid + '/replies'
    }
  }

  // Convert model into ActivityPub Activity
  activityPubActivity () {
    const obj = this.activityPub()
    return {
      '@context': obj['@context'],
      id: obj.id + '/activity',
      type: 'Create',
      to: obj.to,
      actor: obj.attributedTo,
      published: obj.published,
      object: obj
    }
  }
}

module.exports = Blip
