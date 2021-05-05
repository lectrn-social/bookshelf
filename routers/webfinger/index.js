const Express = require('express')
const router = Express.Router()

const helpers = require('../../helpers')
const models = require('../../models')

router.get('/', helpers.middleware.allowAllCors, async (req, res) => {
  res.setHeader('Content-Type', 'application/jrd+json')

  // Validation
  if (typeof req.query.resource !== 'string') return res.status(400).send()

  let url
  try {
    url = new URL(req.query.resource)
  } catch (_) {
    return res.status(400).send()
  }

  let output

  if (url.protocol === 'acct:') {
    const tok = url.pathname.split('@')
    const username = tok.slice(0, -1).join('@')
    const hostname = tok.slice(-1)[0]

    const myHostname = new URL(res.app.get('base url')).hostname
    if (hostname !== myHostname) {
      console.log('WebFinger requested for hostname "' + hostname + '", but my hostname is "' + myHostname + '". Is BASE_URL misconfigured?')
      return res.status(400).send()
    }

    const userQ = await models.User.query().where('username', username).limit(1)

    if (userQ.length === 0) {
      return res.status(404).send()
    }

    const user = userQ[0]

    output = user.webfinger(res.app.get('base url'))
  } else if (url.protocol === 'https:' || url.protocol === 'http:') {
    const resource = await helpers.routing.getResourceForPath(url.pathname)

    if (resource === false) {
      return res.status(400).send()
    } else if (!resource) {
      return res.status(404).send()
    }

    output = resource.webfinger()
  } else {
    return res.status(400).send()
  }

  if (output.links && Array.isArray(req.query.rel)) {
    output.links = output.links.filter(x => req.query.rel.includes(x))
  }

  res.json(output)
})

module.exports = router
