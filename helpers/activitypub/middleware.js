const vals = require('./vals')
const factory = require('./factory')
const { Model } = require('objection')
const models = require('../../models')

async function _collection (type, baseUrl, getItems, getCount, req, res) {
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

    res.json(factory._collectionPage(type + 'Page', baseUrl, req.originalUrl, currentPage, items, req))
  } else {
    res.json(factory._collectionPointer(type, baseUrl, req.originalUrl, total, pageCount))
  }
}

const tables = Object.fromEntries(Object.values(models).map(x => [x.tableName, x]))

/**
 * Creates an OrderedCollection from multiple queries of different types.
 * @param {*} queries Array of Knex queries
 * @param {Function} transform Result transformer function
 */
function complexOrderedCollection (baseUrl, queries, transform) {
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

  return _collection.bind(this, 'OrderedCollection', baseUrl,
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

        q = q.withGraphFetched(model.requiredGraph)

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
  const actor = req.user.activityPub(res.app.get('base url'))

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

module.exports = {
  _collection,
  orderedCollection: (baseUrl, getItems, getCount) => _collection.bind(this, 'OrderedCollection', baseUrl, getItems, getCount),
  collection: (baseUrl, getItems, getCount) => _collection.bind(this, 'Collection', baseUrl, getItems, getCount),

  complexOrderedCollection,

  postHandler
}
