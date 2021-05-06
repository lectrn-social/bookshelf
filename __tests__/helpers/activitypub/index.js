const { followReferences } = require('../../../helpers/activitypub')
const models = require('../../../models')

describe('followReferences', () => {
  beforeAll(() => {
    const Objection = require('objection')
    const Knex = require('knex')
    const knexConfig = require('../../../knexfile')

    Objection.Model.knex(Knex(knexConfig.development))
  })

  test('Doesn\'t try to resolve reserved keys', async () => {
    const x = {
      '@context': 'https://example.com/@john',
      _resolver: 'https://example.com/@john'
    }

    const { err, obj } = await followReferences('https://example.com', x)

    expect(err).toBeUndefined()
    expect(obj).toEqual(x)
  })

  test('Resolves local resources correctly', async () => {
    const x = {
      type: 'Like',
      actor: 'https://example.com/@john',
      object: {
        id: 'https://example.com/@john/75f5f65b-f72e-4232-8adc-cdff4cb0d6ff'
      },
      someObject: {
        notAnId: 'whatever'
      }
    }

    const { err, obj } = await followReferences('https://example.com', x)

    expect(err).toBeUndefined()
    expect(obj.type).toBe(x.type)

    expect(obj.actor).toBeDefined()
    expect(obj.actor._resolver).toBeDefined()
    expect(obj.actor._resolver.remote).toBe(false)
    expect(obj.actor._resolver.model).toBeInstanceOf(models.User)
    expect(obj.actor._resolver.model.username).toBe('john')
    expect(() => obj.actor._resolver.model.activityPub('https://example.com/')).not.toThrow() // Check for correct requiredGraph

    expect(obj.object).toBeDefined()
    expect(obj.object._resolver).toBeDefined()
    expect(obj.object._resolver.remote).toBe(false)
    expect(obj.object._resolver.model).toBeInstanceOf(models.Blip)
    expect(obj.object._resolver.model.uuid).toBe('75f5f65b-f72e-4232-8adc-cdff4cb0d6ff')
    expect(() => obj.object._resolver.model.activityPub('https://example.com/')).not.toThrow() // Check for correct requiredGraph
  })

  test('Handles remote objects correctly', async () => {
    const x = {
      actor: 'https://lectrn.com/@mogery'
    }

    const { err, obj } = await followReferences('https://example.com', x)

    expect(err).toBeDefined()
    expect(obj).toBeUndefined()
  })

  test('Handles unresolvable links correctly', async () => {
    {
      const x = {
        actor: 'https://example.com/'
      }

      const { err, obj } = await followReferences('https://example.com', x)

      expect(err).toBeUndefined()
      expect(obj).toEqual(x)
    }

    {
      const x = {
        actor: 'https://example.com/@jahn'
      }

      const { err, obj } = await followReferences('https://example.com', x)

      expect(err).toBeDefined()
      expect(obj).toBeUndefined()
    }
  })

  afterAll(() => {
    const Objection = require('objection')

    Objection.Model.knex().destroy()
    Objection.Model.knex(undefined)
  })
})
