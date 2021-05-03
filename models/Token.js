const { Model } = require('objection')

class Token extends Model {
  static get tableName () {
    return 'tokens'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['uid', 'token'],

      properties: {
        id: { type: 'integer' },
        uid: { type: 'integer' },
        app: { type: ['integer', 'null'] }, // NOTE: This is null if it was created by the frontend
        token: { type: 'string' } // NOTE: This is hashed.
      }
    }
  }

  static get relationMappings () {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./User'),
        join: {
          from: 'tokens.uid',
          to: 'users.id'
        }
      }
      // TODO: app
    }
  }

  static get requiredGraph () {
    return '[' + Object.entries(this.relationMappings).map(([k,v]) => k + (v.modelClass.requiredGraph ? ('.' + v.modelClass.requiredGraph) : '')).join(' ') + ']'
  }
}

module.exports = Token
