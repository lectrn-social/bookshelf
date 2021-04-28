function isActivityPub (req) {
  return [
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    'application/activity+json'
  ].includes(req.get('Accept'))
}

function allowAllCors (res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
}

const models = require('../models')

async function getResourceForPath (path) {
  if (path.startsWith('/activityPub')) {
    path = path.slice('/activityPub'.length)
  }

  let matches

  if ((matches = path.match(/^\/@([a-z0-9_]{1,32})(\/)?$/))) {
    return (await models.User.query().where('username', matches[1]).limit(1))[0]
  }

  return false
}

module.exports = {
  isActivityPub,
  allowAllCors,
  getResourceForPath
}
