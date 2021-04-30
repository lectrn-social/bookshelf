const striptags = require('striptags')
const Express = require('express')
const router = Express.Router()

const helpers = require('../../helpers')
const models = require('../../models')
const { activitypub: apLib } = require('../../helpers')

router.use((req, res, next) => {
  // Set every response to be of ActivityPub content type.
  res.setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  next()
})

router.get('/@:username',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    res.json(req.resource.activityPub())
  })

router.get('/@:username/outbox',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    return apLib.middleware.orderedCollection(
      models.Blip.query()
        .where('uid', req.resource.id)
        .withGraphFetched('user')
        .orderBy('ts', 'desc')
        .orderBy('id', 'desc'),
      true,
      models.Blip.query()
        .where('uid', req.resource.id)
    )(req, res)
  })

router.post('/@:username/outbox',
  helpers.middleware.getResourceForPath,
  helpers.middleware.getCurrentUser,
  helpers.middleware.requireAuthorization,
  (req, res, next) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    if (req.resource.id !== req.user.id) {
      return res.status(403).send()
    }

    next()
  },
  apLib.middleware.postHandler,
  async (req, res) => {
    const act = req.activity
    const type = act.type

    if (type === 'Create') {
      const obj = act.object

      if (obj.type === 'Note') {
        const saneContent = striptags(obj.content)

        if (obj.attributedTo !== act.actor) {
          return res.status(403).send()
        }

        // TODO: Parse inReplyTo

        const insert = await models.Blip.query()
          .insertAndFetch({
            uid: req.user.id,
            content: saneContent
          })
        
        res.setHeader('Location', new URL('/@' + req.user.username + '/' + insert.uuid).href)
        res.status(201).send()
      } else {
        res.status(406).send()
      }
    } else {
      res.status(406).send()
    }
  })

router.get('/@:username/:uuid',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource || !(req.resource instanceof models.Blip)) {
      return res.status(404).send()
    }

    res.json(req.resource.activityPub())
  })

router.get('/@:username/:uuid/activity',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource || !(req.resource instanceof models.Blip)) {
      return res.status(404).send()
    }

    res.json(req.resource.activityPubActivity())
  })

module.exports = router
