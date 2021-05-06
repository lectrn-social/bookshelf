const { verify, followReferences } = require('../../../helpers/activitypub/index')
const models = require('../../../models')
let john, jane

beforeAll(async () => {
  const Objection = require('objection')
  const Knex = require('knex')
  const knexConfig = require('../../../knexfile')

  Objection.Model.knex(Knex(knexConfig.development))

  john = (await models.User.query().where('username', 'john').limit(1))[0]
  jane = (await models.User.query().where('username', 'jane').limit(1))[0]
})

describe('verify', () => {
  test('Throws on unknown type', async () => {
    await expect(async () => await verify(
      'https://example.com',
      john,
      {
        type: 'ThisIsAnUnknownType'
      }
    )).rejects.toThrow()
  })
})

describe('create', () => {
  function changeFactory (base = {}, object = {}) {
    const _object = {
      type: 'Note',
      content: 'Hello World!',
      attributedTo: 'https://example.com/@john'
    }

    const _base = {
      type: 'Create',
      actor: 'https://example.com/@john'
    }

    const res = Object.assign(_base, base)
    res.object = Object.assign(_object, object)

    return res
  }

  test('Passes base object', async () => {
    const x = changeFactory()

    const res = await verify('https://example.com', john, x)

    expect(res.err).toBeUndefined()
  })

  test('Handles actor mis-match', async () => {
    {
      const x = changeFactory(
        { actor: 'https://example.com/@jane' },
        { attributedTo: 'https://example.com/@jane' }
      )

      const res = await verify('https://example.com', john, x)

      expect(res.err).toBeDefined()
    }

    {
      const x = changeFactory(
        { actor: 'https://example.com/@jane' },
        { attributedTo: 'https://example.com/@john' }
      )

      const res = await verify('https://example.com', john, x)

      expect(res.err).toBeDefined()
    }

    {
      const x = changeFactory(
        { actor: 'https://example.com/@john' },
        { attributedTo: 'https://example.com/@jane' }
      )

      const res = await verify('https://example.com', john, x)

      expect(res.err).toBeDefined()
    }

    {
      const x = changeFactory(
        { actor: 'https://example.com/@jane' },
        { attributedTo: undefined }
      )

      const res = await verify('https://example.com', john, x)

      expect(res.err).toBeDefined()
    }
  })

  test('Handles unsupported object', async () => {
    const x = changeFactory({}, { type: 'Person' })
    const res = await verify('https://example.com', john, x)
    expect(res.err).toBeDefined()
  })

  test('Handles object duplication', async () => {
    const { err, obj: x } = await followReferences(
      'https://example.com',
      changeFactory({}, { id: 'https://example.com/@john/75f5f65b-f72e-4232-8adc-cdff4cb0d6ff' })
    )
    expect(err).toBeUndefined()

    const res = await verify('https://example.com', john, x)
    expect(res.err).toBeDefined()
  })

  test('Handles unacceptable content', async () => {
    {
      const x = changeFactory({}, { content: true })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = changeFactory({}, { content: '' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = changeFactory({}, { content: 'a'.repeat(501) })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }
  })
})

describe('follow', () => {
  async function changeFactory (base = {}) {
    const _base = {
      type: 'Follow',
      actor: 'https://example.com/@john',
      object: 'https://example.com/@jae'
    }

    const res = Object.assign(_base, base)
    const f = await followReferences('https://example.com', res)

    if (f.err) throw f.err
    return f.obj
  }

  test('Passes base object', async () => {
    const x = await changeFactory()
    const res = await verify('https://example.com', john, x)
    expect(res.err).toBeUndefined()
  })

  test('Handles unacceptable object', async () => {
    {
      const x = await changeFactory({ object: 'https://example.com' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory({ object: 'https://example.com/@john' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory({ object: 'https://example.com/@john/75f5f65b-f72e-4232-8adc-cdff4cb0d6ff' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }
  })

  test('Handles duplicate follows/unfollows', async () => {
    {
      const x = await changeFactory({ object: 'https://example.com/@jane' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory()
      const res = await verify('https://example.com', john, x, true)
      expect(res.err).toBeDefined()
    }
  })

  test('Returns model correctly on unfollow', async () => {
    const x = await changeFactory({ object: 'https://example.com/@jane' })
    const res = await verify('https://example.com', john, x, true)
    expect(res.err).toBeUndefined()
    expect(res.model).toBeDefined()
    expect(res.model).toBeInstanceOf(models.Relationship)
    expect(res.model.type).toBe('Follow')
    expect(res.model.actor_user_id).toBe(john.id)
    expect(res.model.object_user_id).toBe(jane.id)
  })
})

describe('like', () => {
  async function changeFactory (base = {}) {
    const _base = {
      type: 'Like',
      actor: 'https://example.com/@john',
      object: 'https://example.com/@john/75f5f65b-f72e-4232-8adc-cdff4cb0d6ff'
    }

    const res = Object.assign(_base, base)
    const f = await followReferences('https://example.com', res)

    if (f.err) throw f.err
    return f.obj
  }

  test('Passes base object', async () => {
    const x = await changeFactory()
    const res = await verify('https://example.com', john, x)
    expect(res.err).toBeUndefined()
  })

  test('Handles unacceptable object', async () => {
    {
      const x = await changeFactory({ object: 'https://example.com' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory({ object: 'https://example.com/@john' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }
  })

  test('Handles duplicate likes/unlikes', async () => {
    {
      const x = await changeFactory({ object: 'https://example.com/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory()
      const res = await verify('https://example.com', john, x, true)
      expect(res.err).toBeDefined()
    }
  })

  test('Returns model correctly on unlike', async () => {
    const _model = (await models.Blip.query().where('uuid', '3affab31-5204-45eb-9a0c-3c5a5db3f6e3').limit(1))[0]

    const x = await changeFactory({ object: 'https://example.com/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3' })
    const res = await verify('https://example.com', john, x, true)
    expect(res.err).toBeUndefined()
    expect(res.model).toBeDefined()
    expect(res.model).toBeInstanceOf(models.Relationship)
    expect(res.model.type).toBe('Like')
    expect(res.model.actor_user_id).toBe(john.id)
    expect(res.model.object_blip_id).toBe(_model.id)
  })
})

describe('announce', () => {
  async function changeFactory (base = {}) {
    const _base = {
      type: 'Announce',
      actor: 'https://example.com/@john',
      object: 'https://example.com/@john/75f5f65b-f72e-4232-8adc-cdff4cb0d6ff'
    }

    const res = Object.assign(_base, base)
    const f = await followReferences('https://example.com', res)

    if (f.err) throw f.err
    return f.obj
  }

  test('Passes base object', async () => {
    const x = await changeFactory()
    const res = await verify('https://example.com', john, x)
    expect(res.err).toBeUndefined()
  })

  test('Handles unacceptable object', async () => {
    {
      const x = await changeFactory({ object: 'https://example.com' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory({ object: 'https://example.com/@john' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }
  })

  test('Handles duplicate reblips/unreblips', async () => {
    {
      const x = await changeFactory({ object: 'https://example.com/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3' })
      const res = await verify('https://example.com', john, x)
      expect(res.err).toBeDefined()
    }

    {
      const x = await changeFactory()
      const res = await verify('https://example.com', john, x, true)
      expect(res.err).toBeDefined()
    }
  })

  test('Returns model correctly on unreblip', async () => {
    const _model = (await models.Blip.query().where('uuid', '3affab31-5204-45eb-9a0c-3c5a5db3f6e3').limit(1))[0]

    const x = await changeFactory({ object: 'https://example.com/@jane/3affab31-5204-45eb-9a0c-3c5a5db3f6e3' })
    const res = await verify('https://example.com', john, x, true)
    expect(res.err).toBeUndefined()
    expect(res.model).toBeDefined()
    expect(res.model).toBeInstanceOf(models.Relationship)
    expect(res.model.type).toBe('Reblip')
    expect(res.model.actor_user_id).toBe(john.id)
    expect(res.model.object_blip_id).toBe(_model.id)
  })
})

afterAll(() => {
  const Objection = require('objection')

  Objection.Model.knex().destroy()
  Objection.Model.knex(undefined)
})
