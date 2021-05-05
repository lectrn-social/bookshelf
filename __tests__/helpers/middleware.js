const { middleware } = require('../../helpers')

async function mockMiddleware (funct, req = {}, res = {}) {
  let nextCalls = 0
  let _status
  let _body

  const _res = Object.assign({
    status: x => {
      _status = x
      return _res
    },
    send: x => {
      _body = x
      return _res
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

describe('allowAllCors', () => {
  test('Allows all CORS', async () => {
    let acao

    const res = await mockMiddleware(middleware.allowAllCors, {}, {
      setHeader: (k, v) => {
        if (k === 'Access-Control-Allow-Origin') {
          acao = v
        }
      }
    })

    expect(res.nextCalls).toBe(1)
    expect(acao).toBe('*')
  })
})

describe('getResourceForPath', () => {
  const models = require('../../models')

  beforeAll(() => {
    const Objection = require('objection')
    const Knex = require('knex')
    const knexConfig = require('../../knexfile')

    Objection.Model.knex(Knex(knexConfig.development))
  })

  test('Returns false on unmatched path', async () => {
    const res = await mockMiddleware(middleware.getResourceForPath, {
      originalUrl: '/someWeirdPath'
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.resource).toBe(false)
  })

  test('Returns users on user path', async () => {
    const res = await mockMiddleware(middleware.getResourceForPath, {
      originalUrl: '/@john'
    })

    expect(res.nextCalls).toBe(1)
    expect(res.req.resource instanceof models.User).toBe(true)
    expect(res.req.resource.username).toBe('john')
  })

  test('Returns blips on blip path', async () => {
    const res = await mockMiddleware(middleware.getResourceForPath, {
      originalUrl: '/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3'
    })

    expect(res.nextCalls).toBe(1)
    expect(res.req.resource instanceof models.Blip).toBe(true)
    expect(res.req.resource.uuid).toBe('3affab31-5204-45eb-9a0c-3c5a5db3f6e3')
  })

  afterAll(() => {
    const Objection = require('objection')

    Objection.Model.knex().destroy()
    Objection.Model.knex(undefined)
  })
})

describe('getCurrentUser', () => {
  const models = require('../../models')
  let john

  beforeAll(async () => {
    const Objection = require('objection')
    const Knex = require('knex')
    const knexConfig = require('../../knexfile')

    Objection.Model.knex(Knex(knexConfig.development))

    john = (await models.User.query()
      .where('username', 'john')
      .limit(1))[0]
  })

  test('Skips on no session', async () => {
    const res = await mockMiddleware(middleware.getCurrentUser)
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeUndefined()
  })

  test('Skips on invalid session', async () => {
    let res = await mockMiddleware(middleware.getCurrentUser, {
      session: {
        uid: 'notanumber',
        token: 'astring'
      }
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeUndefined()

    res = await mockMiddleware(middleware.getCurrentUser, {
      session: {
        uid: 1,
        token: 2
      }
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeUndefined()

    res = await mockMiddleware(middleware.getCurrentUser, {
      session: {
        uid: 'notanumber',
        token: 13
      }
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeUndefined()
  })

  test('Skips on non-existent user', async () => {
    const res = await mockMiddleware(middleware.getCurrentUser, {
      session: {
        uid: john.id + 2,
        token: 'mysecrettoken'
      }
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeUndefined()
  })

  test('Skips on non-existent token', async () => {
    const res = await mockMiddleware(middleware.getCurrentUser, {
      session: {
        uid: john.id,
        token: 'mypublictoken'
      }
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeUndefined()
  })

  test('Succeeds on valid token', async () => {
    const res = await mockMiddleware(middleware.getCurrentUser, {
      session: {
        uid: john.id,
        token: 'mysecrettoken'
      }
    })
    expect(res.nextCalls).toBe(1)
    expect(res.req.user).toBeInstanceOf(models.User)
    expect(res.req.user.id).toBe(john.id)
  })

  afterAll(() => {
    const Objection = require('objection')

    Objection.Model.knex().destroy()
    Objection.Model.knex(undefined)
  })
})

describe('requireAuthorization', () => {
  test('Fails without user', async () => {
    const res = await mockMiddleware(middleware.requireAuthorization, {})

    expect(res.nextCalls).toBe(0)
    expect(res.status).toBe(401)
  })

  test('Succeeds with user', async () => {
    const res = await mockMiddleware(middleware.requireAuthorization, {
      user: {
        id: 1,
        username: 'john'
      }
    })

    expect(res.nextCalls).toBe(1)
    expect(res.status).toBeUndefined()
  })
})
