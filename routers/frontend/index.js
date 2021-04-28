const Express = require('express')
const router = Express.Router()

const helpers = require('../../helpers')

router.get('/', (req, res) => {
  res.send(`\
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8">
    <title>Lectrn</title>
  </head>
  <body>
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
    res.status(404).send('404')
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
