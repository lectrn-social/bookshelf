const { Model } = require('objection')
const models = require('../models')
const helpers = { routing: require('../helpers/routing') }

function calculateCollectionURLProps (path, pageCount, total) {
  const url = new URL(path, process.env.BASE_URL)

  if (pageCount !== 10) {
    url.searchParams.set('count', pageCount)
  }

  const firstPage = 0
  const lastPage = Math.max(0, Math.ceil(total / pageCount) - 1)

  return {
    id: url.href,
    first: (url.searchParams.set('page', firstPage), url.href),
    last: (url.searchParams.set('page', lastPage), url.href)
  }
}

function calculateCollectionPageURLProps (path, currentPage, req) {
  const url = new URL(path, process.env.BASE_URL)

  if (req) {
    Object.entries(req.query).forEach(x => {
      url.searchParams.set(...x)
    })
  }

  return {
    id: url.href,
    next: (url.searchParams.set('page', currentPage + 1), url.href),
    prev: currentPage !== 0 ? (url.searchParams.set('page', currentPage - 1), url.href) : undefined,
    partOf: (url.searchParams.delete('page'), url.href)
  }
}

const vals = {
  activityTypes: ['Accept', 'Add', 'Announce', 'Arrive', 'Block', 'Create', 'Delete', 'Dislike', 'Flag', 'Follow', 'Ignore', 'Invite', 'Join', 'Leave', 'Like', 'Listen', 'Move', 'Offer', 'Question', 'Reject', 'Read', 'Remove', 'TentativeReject', 'TentativeAccept', 'Travel', 'Undo', 'Update', 'View'],
  objectTypes: ['Article', 'Audio', 'Document', 'Event', 'Image', 'Note', 'Page', 'Place', 'Profile', 'Relationship', 'Tombstone', 'Video'],
  linkTypes: ['Mention']
}

const factory = (function () {
  function _collectionPointer (type, path, total, pageCount = 10) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type,
      totalItems: total,
      ...calculateCollectionURLProps(path, pageCount, total) // id, first, last
    }
  }

  function _collectionPage (type, path, currentPage, items, req) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: type,
      ...calculateCollectionPageURLProps(path, currentPage, req), // id, next, prev, partOf
      orderedItems: items
    }
  }

  function createObj (object, actor) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      id: object.id + '/activity',
      actor,
      to: object.to,
      bto: object.bto,
      cc: object.cc,
      bcc: object.bcc,
      published: object.published,
      object
    }
  }

  return {
    _collectionPointer,
    orderedCollectionPointer: _collectionPointer.bind(this, 'OrderedCollection'),
    collectionPointer: _collectionPointer.bind(this, 'Collection'),

    _collectionPage,
    orderedCollectionPage: _collectionPage.bind(this, 'OrderedCollectionPage'),
    collectionPage: _collectionPage.bind(this, 'CollectionPage'),

    createObj
  }
})()

const middleware = (function () {
  async function _collection (type, getItems, getCount, req, res) {
    // const total = Object.values((await (getCount || query.clone()).count())[0])[0]
    const total = await getCount()
    const pageCount = (req.query.count || req.query.limit) ? parseInt(req.query.count || req.query.limit) : 10

    if (isNaN(pageCount) || !isFinite(pageCount) || pageCount < 0) {
      return res.status(400).send()
    }

    if (typeof req.query.page === 'string') {
      const currentPage = parseInt(req.query.page)

      if (isNaN(currentPage) || !isFinite(currentPage) || currentPage < 0) {
        return res.status(400).send()
      }

      const items = await getItems(pageCount, pageCount * currentPage)

      res.json(factory._collectionPage(type + 'Page', req.originalUrl, currentPage, items, req))
    } else {
      res.json(factory._collectionPointer(type, req.originalUrl, total, pageCount))
    }
  }

  function orderedCollection (getItems, getCount) {
    return _collection.bind(this, 'OrderedCollection', getItems, getCount)
  }

  function collection (getItems, getCount) {
    return _collection.bind(this, 'Collection', getItems, getCount)
  }

  const tables = Object.fromEntries(Object.values(models).map(x => [x.tableName, x]))

  /**
   * Creates an OrderedCollection from multiple queries of different types.
   * @param {*} queries Array of Knex queries
   * @param {Function} transform Result transformer function
   */
  function complexOrderedCollection (queries, transform) {
    // Fold all queries into one 3-column-wide result, by table, ID, and timestamp
    const fold = queries[0]
      .clone()
      .select(Model.knex().raw('? as table, id, ts', queries[0]._single.table))
      .unionAll(queries.slice(1).map(x => {
        return x
          .clone()
          .select(Model.knex().raw('? as table, id, ts', x._single.table))
      }))

    // Do the same thing except count only for getCount
    const count = queries[0]
      .unionAll(queries.slice(1).map(x => {
        return x
          .count()
      }))
      .count()

    return orderedCollection(
      async (limit, offset) => { // getItems
        // Run feld query, order by time, and apply limits and offsets
        const snip = await fold
          .orderBy('ts', 'desc')
          .limit(limit).offset(offset)

        let byTable = Object.entries(
          snip.reduce((a, x) => { // Group resulting elements by table
            if (!a[x.table]) a[x.table] = []
            a[x.table].push(x)
            return a
          }, {})
        ).map(x => {
          const model = tables[x[0]]
          if (!model) throw new Error('No model for table ' + x[0])

          // Get modellized elements
          let q = model.query()
            .whereIn('id', x[1].map(x => x.id))

          if (model.requiredGraph) { // Apply relations if needed
            q = q.withGraphFetched(model.requiredGraph)
          }

          return [x[0], q] // Return modellized elements grouped by table
        })

        // Wait for all model queries to run
        for (const i in byTable) {
          byTable[i][1] = await byTable[i][1]
        }

        byTable = Object.fromEntries(byTable)

        // Reorder and flatten elements according to feld results
        const res = snip.map(x => byTable[x.table].find(y => y.id === x.id))

        return transform(res)
      },
      async () => (await count).reduce((a, x) => a + parseInt(x.count), 0)
    )
  }

  /**
   * Validates box POST request, wraps plain objects/links in Create
   */
  function postHandler (req, res, next) {
    if (!req.body) {
      return res.status(400).send()
    }

    const ctx = req.body['@context']
    if (Array.isArray(ctx)
      ? !ctx.includes('https://www.w3.org/ns/activitystreams')
      : ctx !== 'https://www.w3.org/ns/activitystreams') {
      return res.status(400).send()
    }

    const type = req.body.type
    const actor = req.user.activityPub()

    if (vals.objectTypes.includes(type) || vals.linkTypes.includes(type)) {
      req.activity = factory.createObj(req.body, actor)
    } else if (vals.activityTypes.includes(type)) {
      if (req.body.actor.id !== actor.id && req.body.actor !== actor.id) {
        return res.status(400).send()
      }
      req.activity = req.body
    } else {
      return res.status(400).send()
    }

    next()
  }

  return {
    orderedCollection,
    collection,

    complexOrderedCollection,

    postHandler
  }
})()

/**
 * Resolve URL/Object references to other resources.
 * This is a shallow operation.
 * NOTE: This function does not perform any permission checks.
 * @param {object} obj Object to resolve children of
 * @param {string[]} [keys] Keys to resolve. Defaults to all (string) keys.
 * @returns {object} Object with unresolved & resolved children.
 */
async function followReferences (obj, keys) {
  const promises = Object.entries(obj)
    .map(async ([k, v]) => {
      if (typeof k !== 'string') return [k, v]
      if (keys && !keys.includes(k)) return [k, v]
      // TODO: Filter keys the other way around: Only resolve properties that are valid as links.
      if (!keys && ['_resolver', '@context'].includes(k)) return [k, v]

      let url

      if (typeof v === 'string') {
        try {
          url = new URL(v)
        } catch (e) {
          return [k, v]
        }
      } else if (typeof v === 'object' && typeof v.id === 'string') {
        url = new URL(v.id)
      } else {
        return [k, v]
      }

      if (!helpers.routing.isResourceInternal(url.href)) {
        throw { err: { status: 406, msg: 'Federation Not Implemented' } } // eslint-disable-line no-throw-literal
      }

      const model = await helpers.routing.getResourceForPath(url.pathname)

      if (!model) {
        throw { err: { status: 400, msg: 'Could not resolve URL "' + url.href + '"' } } // eslint-disable-line no-throw-literal
      }

      const ref = model.activityPub()

      ref._resolver = {
        remote: false,
        model: model
      }

      return [k, ref]
    })

  const res = []

  try {
    for (const p of promises) {
      res.push(await p)
    }
  } catch (e) {
    if (e.err) {
      return e
    } else {
      throw e
    }
  }

  return {
    obj: Object.fromEntries(res)
  }
}

module.exports = {
  middleware,
  factory,
  vals,
  followReferences
}
