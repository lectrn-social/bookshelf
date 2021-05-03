const { Model } = require('objection')

class Relationship extends Model {
  static get tableName () {
    return 'relationships'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['type'],

      properties: {
        id: { type: 'integer' },
        ts: { type: 'string' },
        type: { type: 'string' },

        actor_user_id: { type: ['integer', 'null'] },
        actor_url: { type: ['string', 'null'] },

        object_user_id: { type: ['integer', 'null'] },
        object_blip_id: { type: ['integer', 'null'] },
        object_url: { type: ['string', 'null'] },

        approved: { type: ['boolean', 'null'] },
        approve_ts: { type: ['string', 'null'] }
      }
    }
  }

  static get relationMappings () {
    return {
      actor_user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./User'),
        join: {
          from: 'relationships.actor_user_id',
          to: 'users.id'
        }
      },
      object_user: {
        relation: Model.HasOneRelation,
        modelClass: require('./User'),
        join: {
          from: 'relationships.object_user_id',
          to: 'users.id'
        }
      },
      object_blip: {
        relation: Model.HasOneRelation,
        modelClass: require('./Blip'),
        join: {
          from: 'relationships.object_blip_id',
          to: 'blips.id'
        }
      }
    }
  }

  static get requiredGraph () {
    return '[' + Object.entries(this.relationMappings).map(([k, v]) => k + (v.modelClass.requiredGraph ? ('.' + v.modelClass.requiredGraph) : '')).join(' ') + ']'
  }

  get actor () {
    return this.actor_user || this.actor_url // || ...
  }

  get object () {
    return this.object_user || this.object_blip || this.object_url
  }

  // Convert model into ActivityPub Activity
  activityPubActivity () {
    const typeRemaps = { Reblip: 'Announce' }

    const base = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: Object.keys(typeRemaps).includes(this.type) ? typeRemaps[this.type] : this.type,
      actor: typeof this.actor === 'string' ? this.actor : this.actor.activityPub(),
      object: typeof this.object === 'string' ? this.object : this.object.activityPub()
    }

    if (base.type === 'Follow') {
      const invite = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Invite',
        actor: base.actor,
        object: base
      }

      if (this.approved) {
        return {
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Accept',
          actor: base.object,
          object: invite
        }
      } else {
        return invite
      }
    } else {
      return base
    }
  }
}

module.exports = Relationship
