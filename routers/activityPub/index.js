const striptags = require('striptags')
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
      async () => parseInt((await base.clone().count())[0].count)
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
          .where('type', 'Follow')
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
      async () => parseInt((await base.clone().count())[0].count)
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
      async () => parseInt((await base.clone().count())[0].count)
    )(req, res)
  })

router.get('/@:username/liked',
  helpers.middleware.getResourceForPath,
  (req, res) => {
    if (!req.resource) {
      return res.status(404).send()
    }

    const base = models.Relationship.query()
      .where('type', 'Like')
      .where('actor_user_id', req.resource.id)

    return apLib.middleware.orderedCollection(
      async (limit, offset) => {
        const res = await base
          .withGraphFetched(models.Relationship.requiredGraph)
          .orderBy('ts', 'desc')
          .orderBy('id', 'desc')
          .limit(limit).offset(offset)

        return res.map(x => x.activityPubActivity())
      },
      async () => parseInt((await base.clone().count())[0].count)
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
    const _act = req.activity
    const type = _act.type

    if (type === 'Create') {
      const { err, obj: act } = await apLib.followReferences(_act)
      if (err) {
        return res.status(err.status).json(err.msg)
      }

      const { err: err2, obj } = await apLib.followReferences(act.object)
      if (err2) {
        return res.status(err2.status).json(err2.msg)
      }

      if (obj._resolver && obj._resolver.remote) {
        return res.status(406).json('Creating from remote objects is not allowed')
      }

      if (obj.type === 'Note') {
        const saneContent = striptags(obj.content)

        if (obj.attributedTo.id !== act.actor.id) {
          return res.status(403).json('Publishing for other people is not allowed')
        }

        // TODO: Parse inReplyTo

        const insert = await models.Blip.query()
          .insertAndFetch({
            uid: req.user.id,
            content: saneContent
          })
          .withGraphFetched(models.Blip.requiredGraph)

        res.setHeader('Location', insert.activityPub().id)
        res.status(201).send()
      } else {
        res.status(406).send()
      }
    } else if (type === 'Follow') {
      const { err, obj: act } = await apLib.followReferences(_act)
      if (err) {
        return res.status(err.status).json(err.msg)
      }

      const obj = act.object

      if (!obj._resolver) {
        return res.status(400).send()
      }

      if (obj.type !== 'Person') {
        return res.status(406).send()
      }

      if (obj.id === req.user.activityPub().id) {
        return res.status(406).send()
      }

      const existenceCheck = (
        await models.Relationship.query()
          .limit(1)
          .where('type', 'Follow')
          .where(...(req.user ? ['actor_user_id', req.user.id] : ['actor_url', req.remoteUser.id]))
          .where(...(!obj._resolver.remote ? ['object_user_id', obj._resolver.model.id] : ['object_url', obj.id]))
      ).length > 0

      if (existenceCheck) {
        return res.status(409).send()
      }

      await models.Relationship.query().insert({
        type: 'Follow',

        actor_url: req.remoteUser ? req.remoteUser.id : null,
        actor_user_id: req.user ? req.user.id : null,

        object_user_id: !obj._resolver.remote ? obj._resolver.model.id : null,
        object_url: obj._resolver.remote ? obj.id : null,

        approved: obj.manuallyApprovesFollowers ? null : true,
        approve_ts: obj.manuallyApprovesFollowers ? null : new Date().toISOString()
      })

      res.status(201).send()
    } else if (type === 'Like') {
      const { err, obj: act } = await apLib.followReferences(_act)
      if (err) {
        return res.status(err.status).json(err.msg)
      }

      const obj = act.object

      if (!obj._resolver) {
        return res.status(400).send()
      }

      if (obj.type !== 'Note') {
        return res.status(406).send()
      }

      const existenceCheck = (
        await models.Relationship.query()
          .limit(1)
          .where('type', 'Like')
          .where(...(req.user ? ['actor_user_id', req.user.id] : ['actor_url', req.remoteUser.id]))
          .where(...(!obj._resolver.remote ? ['object_blip_id', obj._resolver.model.id] : ['object_url', obj.id]))
      ).length > 0

      if (existenceCheck) {
        return res.status(409).send()
      }

      await models.Relationship.query().insert({
        type: 'Like',

        actor_url: req.remoteUser ? req.remoteUser.id : null,
        actor_user_id: req.user ? req.user.id : null,

        object_blip_id: !obj._resolver.remote ? obj._resolver.model.id : null,
        object_url: obj._resolver.remote ? obj.id : null
      })

      res.status(201).send()
    } else if (type === 'Undo') {
      const { err, obj: act } = await apLib.followReferences(_act.object)
      if (err) {
        return res.status(err.status).json(err.msg)
      }

      if (act.actor.id !== req.user.activityPub().id) {
        return res.status(400).send()
      }

      const type = act.type

      if (type === 'Like') {
        const obj = act.object

        if (!obj._resolver) {
          return res.status(400).send()
        }

        if (obj.type !== 'Note') {
          return res.status(406).send()
        }

        const model = (
          await models.Relationship.query()
            .limit(1)
            .where('type', 'Like')
            .where(...(req.user ? ['actor_user_id', req.user.id] : ['actor_url', req.remoteUser.id]))
            .where(...(!obj._resolver.remote ? ['object_blip_id', obj._resolver.model.id] : ['object_url', obj.id]))
        )[0]
        if (!model) {
          return res.status(404).send()
        }

        await models.Relationship.query().deleteById(model.id)

        res.status(201).send()
      } else if (type === 'Follow') {
        const obj = act.object

        if (!obj._resolver) {
          return res.status(400).send()
        }

        if (obj.type !== 'Person') {
          return res.status(406).send()
        }

        if (obj.id === req.user.activityPub().id) {
          return res.status(406).send()
        }

        const model = (
          await models.Relationship.query()
            .limit(1)
            .where('type', 'Follow')
            .where(...(req.user ? ['actor_user_id', req.user.id] : ['actor_url', req.remoteUser.id]))
            .where(...(!obj._resolver.remote ? ['object_user_id', obj._resolver.model.id] : ['object_url', obj.id]))
        )[0]

        if (!model) {
          return res.status(404).send()
        }

        await models.Relationship.query().deleteById(model.id)

        res.status(201).send()
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
