const { User } = require('../../models')

const x = new User()
x.username = 'example'
x.name = 'Exam Ple'
x.summary = 'An example user.'

test('activityPub matches expected format', () => {
  const ap = x.activityPub('https://example.com')

  expect(ap.type).toBe('Person')
  expect(ap.id).toBe('https://example.com/@example')
  expect(ap.inbox).toBe('https://example.com/@example/inbox')
  expect(ap.outbox).toBe('https://example.com/@example/outbox')
  expect(ap.followers).toBe('https://example.com/@example/followers')
  expect(ap.following).toBe('https://example.com/@example/following')
  expect(ap.name).toBe('Exam Ple')
  expect(ap.preferredUsername).toBe('example')
  expect(ap.summary).toBe('An example user.')
})

test('webfinger matches expected format', () => {
  const wf = x.webfinger('https://example.com:8080')

  expect(wf.subject).toBe('acct:example@example.com')
  expect(wf.aliases).toContain('https://example.com:8080/@example')
  expect(wf.links.find(x => x.type === 'application/activity+json')).toBeDefined()
  expect(wf.links.find(x => x.type === 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')).toBeDefined()
})
