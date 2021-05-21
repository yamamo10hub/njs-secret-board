'use strict';
const postsHandler = require('./posts-handler');
const util = require('./handler-util');

function route(req, res) {
  // herokuはリクエストをappに渡すときx-forwarded-proto: (http|https) 
  // を付与してくれるので、httpだったら404にする
  if (process.env.DATABASE_URL
    && req.headers['x-forwarded-proto'] === 'http') {
      util.handleNotFound(req,res);
    }
  switch (req.url) {
    case '/posts':
      postsHandler.handle(req, res);
      break;
    case '/posts?delete=1':
      postsHandler.handleDelete(req, res);
      break;
    case '/logout':
      util.handleLogout(req, res);
      break;
    case '/favicon.ico':
      util.handleFavicon(req, res);
      break;
    default:
      util.handleNotFound(req, res);
      break;
  }
}

module.exports = {
  route
};