require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helemt = require('helmet');
const { NODE_ENV } = require('./config');
const validateBearerToken = require('./validate-bearer-token');
const errorHandler = require('./error-handler');
const bookmarkRouter = require('./bookmarks/bookmarksRouter');

const app = express();

const morganOption = NODE_ENV === 'production' ? 'tiny' : 'common';

app.use(morgan(morganOption));
app.use(cors());
app.use(helemt());
app.use(validateBearerToken);

app.use(bookmarkRouter);

app.get('/', (req, res) => {
  res.send('Hello, world out there!');
});

app.use(errorHandler);

module.exports = app;