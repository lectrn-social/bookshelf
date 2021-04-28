const Express = require('express')
const router = Express.Router()

const helpers = require('../../helpers')

router.use((req, res, next) => {
  // Set every response to be of ActivityPub content type.
  res.setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  next()
})

router.get('/@:username', helpers.middleware.getResourceForPath, (req, res) => {
  if (!req.resource) {
    res.status(400).send()
    return
  }

  res.json(req.resource.activityPub())
})

module.exports = router
