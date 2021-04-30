const argon2 = require('argon2')
const Express = require('express')
const objection = require('objection')
const router = Express.Router()

const helpers = require('../../helpers')
const models = require('../../models')

const csrf = require('csurf')()

router.post('/auth/login', csrf, async (req, res) => {
  if (typeof req.body.username !== 'string' ||
      typeof req.body.password !== 'string') {
    return res.status(400).send('Bad Request')
  }

  const query = await models.User.query().where('username', req.body.username).limit(1)

  if (query.length === 0) {
    return res.redirect('/auth?error=404u')
  }

  const user = query[0]

  const doesPasswordMatch = await argon2.verify(user.password, req.body.password, {
    type: argon2.argon2id
  })

  if (!doesPasswordMatch) {
    return res.redirect('/auth?error=401p')
  }

  const tokenPlaintext = await helpers.db.createToken(user)
  req.session.token = tokenPlaintext
  req.session.uid = user.id
  res.redirect('/')
})

router.post('/auth/signup', csrf, async (req, res) => {
  if (typeof req.body.username !== 'string' ||
      typeof req.body.password !== 'string' ||
      typeof req.body.name !== 'string') {
    return res.status(400).send('Bad Request')
  }

  if (req.body.password.length < 8 || req.body.password.length > 1024) {
    return res.redirect('/auth?error=400v')
  }

  let user

  try {
    user = await models.User.query().insertAndFetch({
      username: req.body.username,
      password: await argon2.hash(req.body.password, {
        type: argon2.argon2id
      }),
      name: req.body.name
    })
  } catch (err) {
    if (err instanceof objection.ValidationError) {
      return res.redirect('/auth?error=400v')
    } else if (err instanceof objection.UniqueViolationError) {
      return res.redirect('/auth?error=400u')
    } else {
      throw err
    }
  }

  const tokenPlaintext = await helpers.db.createToken(user)
  req.session.token = tokenPlaintext
  req.session.uid = user.id
  res.redirect('/')
})

router.post('/auth/logout', csrf, (req, res) => {
  delete req.session.token
  delete req.session.uid

  res.redirect('/')
})

router.get('/auth', csrf, helpers.middleware.getCurrentUser, (req, res) => {
  const authErrors = {
    '404u': 'User not found.',
    '401p': 'Invalid password.',
    '400v': 'Invalid fields.',
    '400u': 'That username is taken.'
  }

  if (req.user) {
    return res.redirect('/')
  }

  res.send(`\
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8">
    <title>Lectrn - Auth</title>
  </head>
  <body>
    ${req.query.error
    ? `<p>
      Error: ${authErrors[req.query.error] || 'Unknown error.'}
    </p>`
    : ''}
    <h2>Log in</h2>
    <form action="/auth/login" method="POST">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <input type="text" name="username" placeholder="Username" required><br>
      <input type="password" name="password" placeholder="Password" required><br>
      <input type="submit" value="Log in">
    </form>
    <hr>
    <h2>Sign up</h2>
    <form action="/auth/signup" method="POST">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <input type="text" name="name" placeholder="Name" minlength="1" maxlength="256 title="Must be at least 1 character, and at most 256 characters." required><br>
      <input type="text" name="username" placeholder="Username" minlength="1" maxlength="32" pattern="^[a-z0-9_]+$" title="Must be all lowercase. Must be at least 1 characters, and at most 32 characters. Must contain only alphanumerics and underscores (_)." required><br>
      <input type="password" name="password" placeholder="Password" minlength="8" maxlength="1024" title="Must be at least 8 characters, and at most 1024 characters." required><br>
      <input type="submit" value="Sign up">
    </form>
  </body>
</html>\
`)
})

router.get('/', helpers.middleware.getCurrentUser, csrf, (req, res) => {
  res.send(`\
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8">
    <title>Lectrn</title>
  </head>
  <body>
    ${req.user
    ? `<form action="/auth/logout" method="POST" class="display: inline;">
      Logged in as <a href="/@${req.user.username}"><code>@${req.user.username}</code></a> &bull;
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <input type="submit" value="logout">
    </form>`
    : '<a href="/auth">Log in &bull; Sign up</a>'}
    <h1>Hello world!</h1>
    <p>Lectrn is currently heavily under construction. You can take a look at our links, for now.</p>
    <ul>
      <li><a href="https://twitter.com/lectrn">Twitter</a></li>
      <li><a href="https://facebook.com/lectrn">Facebook</a></li>
      <li><a href="https://github.com/lectrn">GitHub</a></li>
    </ul>
  </body>
</html>\
`)
})

router.get('/@:username', helpers.middleware.getResourceForPath, (req, res) => {
  if (!req.resource) {
    return res.status(404).send('404')
  }

  // The code below is full of XSS issues.
  // However: This is not meant to be used by anyone in this state.
  // So, it's fine. It's just a temporary debugging tool.
  // This will eventually be replaced by EJS or whatever.
  res.send(`\
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8">
    <title>@${req.resource.username}</title>
  </head>
  <body style="text-align: center">
    <b style="font-size: 1.75em">${req.resource.name}</b><br>
    <code>@${req.resource.username}</code><br><br>
    <i>${req.resource.summary || ''}</i>
  </body>
</html>\
`)
})

module.exports = router
