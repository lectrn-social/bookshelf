require('dotenv').config();
const Express = require('express');
const bodyParser = require('body-parser');
const auth = require('./lib/auth');

const app = Express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

app.use(auth.parseAuth);

app.use('/auth', require('./routes/auth').router);
app.use('/users', require('./routes/users').router);
app.use('/users/:user/blips', require('./routes/blips').router);
app.use('/users/:user/feeds', require('./routes/feed').router);

app.get('/', (req, res) => {
    res.status(200).json({
        ok: true
    });
});

app.listen(process.env.PORT, () => {
    console.log("Listening on port", process.env.PORT, "- http://localhost:" + process.env.PORT);
});