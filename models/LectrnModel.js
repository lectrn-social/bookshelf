const { Model } = require('objection')

class LectrnModel extends Model {
  static get requiredGraph () {
    if (this.relationMappings) {
      return '[' + Object.entries(this.relationMappings).map(([k, v]) => k + (v.modelClass.requiredGraph ? ('.' + v.modelClass.requiredGraph) : '')).join(' ') + ']'
    } else {
      return undefined
    }
  }
}

module.exports = LectrnModel
