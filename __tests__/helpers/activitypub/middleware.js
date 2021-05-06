const { middleware } = require('../../../helpers/activitypub')
const models = require('../../../models')

async function mockMiddleware (funct, req = {}, res = {}) {
  let nextCalls = 0
  let _status = 200
  let _body

  const _res = Object.assign({
    status: x => {
      _status = x
      return _res
    },
    send: x => {
      _body = x
      return _res
    },
    json: x => {
      _body = x
      return _res
    },
    app: {
      get: x => {
        if (x === 'base url') {
          return 'https://example.com'
        }
      }
    }
  }, res)

  const _req = Object.assign({}, req)

  const result = funct(_req, _res, () => nextCalls++)

  if (result instanceof Promise) {
    await result
  }

  return {
    nextCalls,
    status: _status,
    body: _body,
    req: _req
  }
}

describe('_collection', () => {
  const _collection = middleware._collection.bind(this, 'Collection', 'https://example.com')
  const req = { originalUrl: '/items', query: {} }

  test('Handles unacceptable pageCount values', async () => {
    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 0),
        { ...req, query: { count: 'somestring' } }
      )
      expect(x.status).not.toBe(200)
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 0),
        { ...req, query: { count: '-1' } }
      )
      expect(x.status).not.toBe(200)
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 0),
        { ...req, query: { count: 'Infinity' } }
      )
      expect(x.status).not.toBe(200)
    }
  })

  test('Handles unacceptable currentPage values', async () => {
    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 0),
        { ...req, query: { page: 'somestring' } }
      )
      expect(x.status).not.toBe(200)
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 0),
        { ...req, query: { page: '-1' } }
      )
      expect(x.status).not.toBe(200)
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 0),
        { ...req, query: { page: 'Infinity' } }
      )
      expect(x.status).not.toBe(200)
    }
  })

  test('Returns totalItems correctly', async () => {
    const x = await mockMiddleware(
      _collection.bind(this, async () => [], async () => 17),
      req
    )
    expect(x.status).toBe(200)
    expect(x.body).toBeDefined()
    expect(x.body.totalItems).toBe(17)
  })

  test('Calculates first/last correctly', async () => {
    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 11),
        req
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.first).toBe('https://example.com/items?page=0')
      expect(x.body.last).toBe('https://example.com/items?page=1')
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 11),
        { ...req, query: { limit: '5' } }
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.first).toBe('https://example.com/items?count=5&page=0')
      expect(x.body.last).toBe('https://example.com/items?count=5&page=2')
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, async () => [], async () => 11),
        { ...req, query: { count: '3' } }
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.first).toBe('https://example.com/items?count=3&page=0')
      expect(x.body.last).toBe('https://example.com/items?count=3&page=3')
    }
  })

  test('Slices results correctly', async () => {
    const getItems = async (limit, offset) => {
      const _items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      return _items.slice(offset, offset + limit)
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, getItems, async () => 11),
        { ...req, query: { page: '0' } }
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, getItems, async () => 11),
        { ...req, query: { limit: '5', page: '0' } }
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.items).toEqual([0, 1, 2, 3, 4])
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, getItems, async () => 11),
        { ...req, query: { count: '3', page: '1' } }
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.items).toEqual([3, 4, 5])
    }

    {
      const x = await mockMiddleware(
        _collection.bind(this, getItems, async () => 11),
        { ...req, query: { limit: '5', page: '2' } }
      )
      expect(x.status).toBe(200)
      expect(x.body).toBeDefined()
      expect(x.body.items).toEqual([])
    }
  })
})

test('orderedCollection', async () => {
  {
    const x = await mockMiddleware(
      middleware.orderedCollection('https://example.com', async () => [], async () => 0),
      { originalUrl: '/items', query: {} }
    )
    expect(x.status).toBe(200)
    expect(x.body).toBeDefined()
    expect(x.body.type).toBe('OrderedCollection')
  }

  {
    const x = await mockMiddleware(
      middleware.orderedCollection('https://example.com', async () => [], async () => 0),
      { originalUrl: '/items', query: { page: '0' } }
    )
    expect(x.status).toBe(200)
    expect(x.body).toBeDefined()
    expect(x.body.type).toBe('OrderedCollectionPage')
    expect(x.body.orderedItems).toBeDefined()
  }
})

test('collection', async () => {
  {
    const x = await mockMiddleware(
      middleware.collection('https://example.com', async () => [], async () => 0),
      { originalUrl: '/items', query: {} }
    )
    expect(x.status).toBe(200)
    expect(x.body).toBeDefined()
    expect(x.body.type).toBe('Collection')
  }

  {
    const x = await mockMiddleware(
      middleware.collection('https://example.com', async () => [], async () => 0),
      { originalUrl: '/items', query: { page: '0' } }
    )
    expect(x.status).toBe(200)
    expect(x.body).toBeDefined()
    expect(x.body.type).toBe('CollectionPage')
    expect(x.body.items).toBeDefined()
  }
})

describe('postHandler', () => {
  let john

  beforeAll(async () => {
    const Objection = require('objection')
    const Knex = require('knex')
    const knexConfig = require('../../../knexfile')

    Objection.Model.knex(Knex(knexConfig.development))

    john = (await models.User.query().where('username', 'john').limit(1))[0]

    Objection.Model.knex().destroy()
    Objection.Model.knex(undefined)
  })

  function changeFactoryActivity (base = {}, user = john) {
    const _base = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Announce',
      actor: 'https://example.com/@john',
      object: 'https://example.com/@john/75f5f65b-f72e-4232-8adc-cdff4cb0d6ff'
    }

    const res = Object.assign(_base, base)
    return { body: res, user }
  }

  function changeFactoryObject (base = {}, user = john) {
    const _base = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Note',
      attributedTo: 'https://example.com/@john',
      content: 'Hi there!'
    }

    const res = Object.assign(_base, base)
    return { body: res, user }
  }

  test('Passes base object', async () => {
    const x = await mockMiddleware(middleware.postHandler, changeFactoryActivity())
    expect(x.nextCalls).toBe(1)
  })

  test('Handles invalid @context', async () => {
    {
      const x = await mockMiddleware(middleware.postHandler, changeFactoryActivity({
        '@context': 'someweirdthing'
      }))
      expect(x.nextCalls).toBe(0)
      expect(x.status).not.toBe(200)
    }

    {
      const x = await mockMiddleware(middleware.postHandler, changeFactoryActivity({
        '@context': ['someweirdthing']
      }))
      expect(x.nextCalls).toBe(0)
      expect(x.status).not.toBe(200)
    }
  })

  test('Handles actor mismatch/unacceptable actor', async () => {
    {
      const x = await mockMiddleware(middleware.postHandler, changeFactoryActivity({
        actor: 'https://example.com/@jane'
      }))
      expect(x.nextCalls).toBe(0)
      expect(x.status).not.toBe(200)
    }

    {
      const x = await mockMiddleware(middleware.postHandler, changeFactoryActivity({
        actor: 'https://example.com/'
      }))
      expect(x.nextCalls).toBe(0)
      expect(x.status).not.toBe(200)
    }
  })

  test('Successfully wraps object into Create activity', async () => {
    const obj = changeFactoryObject()
    const x = await mockMiddleware(middleware.postHandler, obj)
    expect(x.nextCalls).toBe(1)
    expect(x.req.activity).toBeDefined()
    expect(x.req.activity.type).toBe('Create')
    expect(x.req.activity.actor.id).toBe('https://example.com/@john')
    expect(x.req.activity.object).toEqual(obj.body)
  })

  test('Handle unknown types', async () => {
    const x = await mockMiddleware(middleware.postHandler, {
      user: john,
      body: {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'ThisIsAnUnknownType'
      }
    })
    expect(x.nextCalls).toBe(0)
    expect(x.status).not.toBe(200)
  })

  test('Handle requests without a body', async () => {
    const x = await mockMiddleware(middleware.postHandler, { user: john })
    expect(x.nextCalls).toBe(0)
    expect(x.status).not.toBe(200)
  })
})

describe('complexOrderedCollection', () => {
  const { Model } = require('objection')
  const req = { originalUrl: '/items', query: {} }

  beforeAll(async () => {
    const Objection = require('objection')
    const Knex = require('knex')
    const knexConfig = require('../../../knexfile')

    Objection.Model.knex(Knex(knexConfig.development))
  })

  test('Handles one query', async () => {
    const queries = [
      Model.knex().from(models.Blip.tableName)
    ]

    let count

    const results = []
    for (const q of queries) {
      results.push(await q.clone())
    }

    {
      const c = middleware.complexOrderedCollection('https://example.com', queries.map(x => x.clone()), x => x)
      const x = await mockMiddleware(c, req)

      expect(x.status).toBe(200)

      expect(x.body.totalItems).toBe(results.flat(1).length)
      count = x.body.totalItems
    }

    {
      const sortedIDs = [...results.flat(1)].sort((a, b) => new Date(b.ts) - new Date(a.ts)).map(x => x.id)

      const c = middleware.complexOrderedCollection('https://example.com', queries, x => x)
      const x = await mockMiddleware(c, { ...req, query: { page: '0', count } })

      expect(x.status).toBe(200)
      expect(x.body.orderedItems.map(x => x.id)).toEqual(sortedIDs)
    }
  })

  test('Handles multiple queries', async () => {
    const tables = [models.Blip.tableName, models.Relationship.tableName]
    const queries = tables.map(x => Model.knex().from(x))

    let count

    const results = []
    for (const q of queries) {
      results.push(await q.clone())
    }

    {
      const c = middleware.complexOrderedCollection('https://example.com', queries.map(x => x.clone()), x => x)
      const x = await mockMiddleware(c, req)

      expect(x.status).toBe(200)

      expect(x.body.totalItems).toBe(results.flat(1).length)
      count = x.body.totalItems
    }

    {
      const sortedIDs = [...results.map((x, i) => {
        return x.map(x => ({ table: tables[i], ts: x.ts }))
      }).flat(1)].sort((a, b) => new Date(b.ts) - new Date(a.ts))

      const c = middleware.complexOrderedCollection('https://example.com', queries, x => x)
      const x = await mockMiddleware(c, { ...req, query: { page: '0', count } })

      expect(x.status).toBe(200)
      expect(x.body.orderedItems.map(x => ({ table: x.constructor.tableName, ts: x.ts }))).toEqual(sortedIDs)

      // Checking by ts here and not ID since we are getting ts equality due to our seeds, and id sort when ts is the same doesn't seem to be consistend...
    }
  })

  afterAll(() => {
    const Objection = require('objection')

    Objection.Model.knex().destroy()
    Objection.Model.knex(undefined)
  })
})
