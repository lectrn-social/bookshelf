const routing = require('../../helpers/routing')

describe('isActivityPub', () => {
  test('Accepts ld+json with profile', () => {
    expect(routing.isActivityPub({
      get: x => x === 'Accept' ? 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"' : undefined
    })).toBe(true)
  })

  test('Accepts activity+json', () => {
    expect(routing.isActivityPub({
      get: x => x === 'Accept' ? 'application/activity+json' : undefined
    })).toBe(true)
  })

  test('Doesn\'t accept normal json', () => {
    expect(routing.isActivityPub({
      get: x => x === 'Accept' ? 'application/json' : undefined
    })).toBe(false)
  })

  test('Doesn\'t accept undefined', () => {
    expect(routing.isActivityPub({
      get: () => undefined
    })).toBe(false)
  })
})

describe('allowAllCors', () => {
  test('Allows all CORS', () => {
    let acao

    routing.allowAllCors({
      setHeader: (k, v) => {
        if (k === 'Access-Control-Allow-Origin') {
          acao = v
        }
      }
    })

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
    expect(await routing.getResourceForPath('/someWeirdPath')).toBe(false)
  })

  test('Returns users on user path & undefined subpaths', async () => {
    const john = await routing.getResourceForPath('/@john')
    const jane = await routing.getResourceForPath('/@jane')
    const johnSub = await routing.getResourceForPath('/@john/outbox')

    expect(john instanceof models.User).toBe(true)
    expect(john.username).toBe('john')

    expect(jane instanceof models.User).toBe(true)
    expect(jane.username).toBe('jane')

    expect(johnSub instanceof models.User).toBe(true)
    expect(johnSub.username).toBe('john')
  })

  test('Returns blips on blip path & undefined subpaths', async () => {
    const blip = await routing.getResourceForPath('/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3')
    const blipSub = await routing.getResourceForPath('/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3/likes')

    expect(blip instanceof models.Blip).toBe(true)
    expect(blip.uuid).toBe('3affab31-5204-45eb-9a0c-3c5a5db3f6e3')

    expect(blipSub instanceof models.Blip).toBe(true)
    expect(blipSub.uuid).toBe('3affab31-5204-45eb-9a0c-3c5a5db3f6e3')
  })

  afterAll(() => {
    const Objection = require('objection')

    Objection.Model.knex().destroy()
    Objection.Model.knex(undefined)
  })
})

describe('isResourceInternal', () => {
  test('Correctly identifies URLs under baseUrl', async () => {
    expect(routing.isResourceInternal('https://example.com', 'https://example.com/@john')).toBe(true)
    expect(routing.isResourceInternal('https://example.com/', 'https://example.com/@john')).toBe(true)
    expect(routing.isResourceInternal('https://example.com', 'http://example.com/@john')).toBe(true)
    expect(routing.isResourceInternal('http://example.com', 'https://example.com/@john')).toBe(true)
  })

  test('Correctly identifies URLs not under baseUrl', async () => {
    expect(routing.isResourceInternal('https://example.com', 'https://example.org/@john')).toBe(false)
    expect(routing.isResourceInternal('https://example.com', 'https://example.com:5050/@john')).toBe(false)
    expect(routing.isResourceInternal('https://example.com:5050', 'https://example.com/@john')).toBe(false)
  })
})
