const { Model } = require('objection')

class Token extends Model {
  static get tableName () {
    return 'tokens'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['id', 'username', 'password', 'name'],

      properties: {
        id: { type: 'integer' },
        user: { type: 'integer' },
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
          from: 'tokens.user',
          to: 'users.id'
        }
      }
      // TODO: app
    }
  }
}

module.exports = Token
