const striptags = require('striptags')
const knex = require('knex')
const Express = require('express')
const router = Express.Router()

const helpers = require('../../helpers')
const models = require('../../models')
const { Model } = require('objection')
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

    const base = models.Blip.query()
      .where('uid', req.resource.id)

    return apLib.middleware.orderedCollection(
      async (limit, offset) => {
        const res = await base
          .withGraphFetched('user')
          .orderBy('ts', 'desc')
          .orderBy('id', 'desc')
          .limit(limit).offset(offset)
        
        return res.map(x => x.activityPubActivity())
      },
      async () => parseInt((await base.clone().count())[0]['count'])
    )(req, res)
  })

router.get('/@:username/inbox',
  helpers.middleware.getResourceForPath,
  helpers.middleware.getCurrentUser,
  helpers.middleware.requireAuthorization,
  (req, res) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    if (req.resource.id !== req.user.id) {
      return res.status(403).send()
    }

    return apLib.middleware.complexOrderedCollection(
      [
        Model.knex()
          .from(models.Blip.tableName)
          .whereIn('uid', Model.knex()
            .from(models.Relationship.tableName)
            .select('object_user_id')
            .where('approved', true)
            .where('actor_user_id', req.resource.id)
            .whereNotNull('object_user_id')
            .union(
              Model.knex()
                .select(Model.knex().raw('?', req.resource.id))
            )
          ),
        Model.knex()
          .from(models.Relationship.tableName)
          .where('approved', true)
          .where('object_user_id', req.resource.id)
      ],
      x => x.map(x => x.activityPubActivity())
    )(req, res)
  })

router.get('/@:username/followers',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    const base = models.Relationship.query()
      .where('type', 'Follow')
      .where('object_user_id', req.resource.id)

    return apLib.middleware.orderedCollection(
      async (limit, offset) => {
        const res = await base
          .withGraphFetched('actor_user')
          .orderBy('ts', 'desc')
          .orderBy('id', 'desc')
          .limit(limit).offset(offset)
        
        return res.map(x => {
          const actor = x.actor
          return typeof actor === 'string' ? actor : actor.activityPub()
        })
      },
      async () => parseInt((await base.clone().count())[0]['count'])
    )(req, res)
  })

router.get('/@:username/following',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    const base = models.Relationship.query()
      .where('type', 'Follow')
      .where('actor_user_id', req.resource.id)

    return apLib.middleware.orderedCollection(
      async (limit, offset) => {
        const res = await base
          .withGraphFetched('object_user')
          .orderBy('ts', 'desc')
          .orderBy('id', 'desc')
          .limit(limit).offset(offset)
        
        return res.map(x => {
          const actor = x.object
          return typeof actor === 'string' ? actor : actor.activityPub()
        })
      },
      async () => parseInt((await base.clone().count())[0]['count'])
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
    } else if (type === 'Follow') {
      const { err, obj } = await apLib.resolvePossibleReference(act.object)
      if (err) {
        return res.status(err).send()
      }

      if (!(obj instanceof models.User)) {
        return res.status(406).send()
      }

      if (obj.id === req.user.id) {
        return res.status(406).send()
      }

      await models.Relationship.query().insert({
        type: 'Follow',

        actor_user_id: req.user.id,
        object_user_id: obj.id,

        approved: true,
        approve_ts: new Date().toISOString()
      })

      res.status(201).send()
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
