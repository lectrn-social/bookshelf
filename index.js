require('dotenv').config()
const Express = require('express')
const Knex = require('knex')
const Objection = require('objection')
const session = require('express-session')

const routers = require('./routers')
const helpers = require('./helpers')
require('./models')

// Initialize Express
const app = Express()
app.use(Express.json())
app.use(Express.urlencoded({ extended: true }))
app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  maxAge: 30 * 24 * 60 * 60 * 1000 // 1 month
}))
app.disable('x-powered-by')
app.set('trust proxy', 1)

// Initialize Knex/Objection
const knexConfig = require('./knexfile')
const knex = Knex(process.env.NODE_ENV === 'production' ? knexConfig.production : knexConfig.development)
Objection.Model.knex(knex)

// Bind routers
app.use('/.well-known/webfinger', routers.webfinger)
app.use('/', (req, res, next) => {
  // This middleware (more of a "splitter") takes care of ActivityPub vs. HTML routing.
  if (helpers.routing.isActivityPub(req)) return routers.activityPub(req, res, next)
  else return routers.frontend(req, res, next)
})

// Start Express
const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log('Listening on port ' + port + '. Hello world!')
})
