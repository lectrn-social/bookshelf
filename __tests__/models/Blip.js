const { Blip } = require('../../models')

let blip

beforeEach(() => {
  blip = new Blip()
  blip.user = {
    username: 'john'
  }
  blip.uuid = '42cbea0d-b876-4166-8096-a6ca895ef4a9'
  blip.ts = new Date(0).toISOString()
  blip.content = 'Hello World!'
})

test('activityPub', () => {
  const x = blip.activityPub('https://example.com/')

  expect(x.type).toBe('Note')
  expect(x.id).toBe('https://example.com/@john/42cbea0d-b876-4166-8096-a6ca895ef4a9')
  expect(x.attributedTo).toBe('https://example.com/@john')
  expect(x.to).toContain('https://www.w3.org/ns/activitystreams#Public')
  x.to.forEach(y => {
    expect(() => new URL(y)).not.toThrow()
  })
  expect(x.content).toBe('Hello World!')
  expect(() => new Date(x.published)).not.toThrow()
  expect(x.replies).toBe('https://example.com/@john/42cbea0d-b876-4166-8096-a6ca895ef4a9/replies')
})

test('activityPubActivity', () => {
  const x = blip.activityPubActivity('https://example.com/')

  expect(x.type).toBe('Create')
  expect(x.id).toBe('https://example.com/@john/42cbea0d-b876-4166-8096-a6ca895ef4a9/activity')
  expect(x.actor).toBe('https://example.com/@john')
  expect(x.to).toContain('https://www.w3.org/ns/activitystreams#Public')
  x.to.forEach(y => {
    expect(() => new URL(y)).not.toThrow()
  })
  expect(() => new Date(x.published)).not.toThrow()
})
