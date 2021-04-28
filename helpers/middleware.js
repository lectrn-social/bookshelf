const routing = require('./routing')

function allowAllCors (req, res, next) {
  routing.allowAllCors(res)
  next()
}

async function getResourceForPath (req, res, next) {
  req.resource = await routing.getResourceForPath(req.path)
  next()
}

module.exports = {
  allowAllCors,
  getResourceForPath
}
