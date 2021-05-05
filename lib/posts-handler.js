'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const Post = require('./post');
const util = require('./handler-util');
const trackingIdKey = 'tracking_id';

function handle(req, res) {
  const cookies = new Cookies(req, res);
  addTrackingCookie(cookies);

  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({order:[['id','DESC']]}).then((posts) => {
        res.end(pug.renderFile('./views/posts.pug', { posts }));
        console.info(
          `閲覧されました: user: ${req.user}, ` + 
          `trackingId: ${cookies.get(trackingIdKey) }, ` + 
          `remoteAddress: ${req.socket.remoteAddress}, ` + 
          `userAgent: ${req.headers['user-agent']}`
        );
      });
      break;
    case 'POST':
      // TODO POST exec
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        //dataが来てstreamを受けた時の為の処理
        body = Buffer.concat(body).toString();
        //base64を関数でデコード
        const decoded = decodeURIComponent(body);
        // デコードした生データを変数化して格納
        const params = new URLSearchParams(decoded);
        const content = params.get('content');
        console.info('投稿されました: ' + content);
        Post.create({
          content,
          //trackingCookie: null,
          trackingCookie: cookies.get(trackingIdKey),
          postedBy: req.user
        }).then(() => {
          handleRedirectPosts(req, res);
        });
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}
// 
function addTrackingCookie(cookies) {
  if (!cookies.get(trackingIdKey)) {
    const trackingId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
    cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
  }
}

// postの後投稿ページに戻る為の処理
function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}

module.exports = {
  handle
};