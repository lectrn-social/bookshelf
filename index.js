require('dotenv').config()
const Express = require('express')
const Knex = require('knex')
const Objection = require('objection')

const routers = require('./routers')
const helpers = require('./helpers')
require('./models')

// Initialize Express
const app = Express()
app.use(Express.json())
app.use(Express.urlencoded({ extended: true }))
app.use((req, res, next) => {
  // This middleware pushes ActivityPub endpoints to a different URL,
  // so that the ActivityPub router can take care of them.
  if (helpers.routing.isActivityPub(req)) req.url = '/activityPub' + req.url
  next()
})
app.disable('x-powered-by')
app.set('trust proxy', 1)

// Initialize Knex/Objection
const knexConfig = require('./knexfile')
const knex = Knex(process.env.NODE_ENV === 'production' ? knexConfig.production : knexConfig.development)
Objection.Model.knex(knex)

// Bind routers
app.use('/.well-known/webfinger', routers.webfinger)
app.use('/activityPub', routers.activityPub)
app.use('/', routers.frontend)

// Start Express
const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log('Listening on port ' + port + '. Hello world!')
})
