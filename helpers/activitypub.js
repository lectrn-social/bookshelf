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
    //const total = Object.values((await (getCount || query.clone()).count())[0])[0]
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
  const neededRelations = Object.fromEntries(Object.values(models).map(x => [x.tableName, '[' + Object.keys(x.relationMappings || {}).join(' ') + ']']))

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
          snip.reduce((a,x) => { // Group resulting elements by table
            if (!a[x.table]) a[x.table] = []
            a[x.table].push(x)
            return a
          }, {})
        ).map(x => {
          const model = tables[x[0]]
          if (!model) throw new Error("No model for table " + x[0])

          // Get modellized elements
          let q = model.query()
            .whereIn('id', x[1].map(x => x.id))
          
          if (neededRelations[x[0]] !== '[]') { // Apply relations if needed
            q = q.withGraphFetched(neededRelations[x[0]])
          }

          return [x[0], q] // Return modellized elements grouped by table
        })

        // Wait for all model queries to run
        for (const i in byTable) {
          byTable[i][1] = await byTable[i][1]
        }

        byTable = Object.fromEntries(byTable)
        
        // Reorder and flatten elements according to feld results
        const res = snip.map(x => byTable[x.table].find(y => y.id == x.id))
        
        return transform(res)
      },
      async () => (await count).reduce((a,x) => a+parseInt(x['count']), 0)
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
    const actor = new URL('/@' + req.user.username, process.env.BASE_URL).href

    if (vals.objectTypes.includes(type) || vals.linkTypes.includes(type)) {
      req.activity = factory.createObj(req.body, actor)
    } else if (vals.activityTypes.includes(type)) {
      if (req.body.actor !== actor) {
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

async function resolvePossibleReference(obj) {
  let target

  if (typeof obj === 'string') {
    let objURL
    try {
      objURL = new URL(obj)
    } catch (e) {
      return { err: 400 }
    }

    if (!helpers.routing.isResourceInternal(obj)) {
      return { err: 406 }
    }

    target = await helpers.routing.getResourceForPath(objURL.pathname)
    
  } else {
    if (!helpers.routing.isResourceInternal(obj.id)) {
      return { err: 406 }
    }

    target = await helpers.routing.getResourceForPath(new URL(obj.id).pathname)
  }

  if (!target) {
    return { err: 404 }
  }

  return { obj: target }
}

module.exports = {
  middleware,
  factory,
  vals,
  resolvePossibleReference
}
