'use strict';
const postsHandler = require('./posts-handler');

function route(req, res) {
  switch (req.url) {
    case '/posts':
      postsHandler.handle(req, res);
      break;
    case '/logout':
      // TODO logout exec
      break;
    default:
      break;
  }
}

module.exports = {
  route
};