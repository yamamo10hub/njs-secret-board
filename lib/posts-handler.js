'use strict';
const pug = require('pug');
const Post = require('./post');
const util = require('./handler-util');
const contents = [];

function handle(req, res) {
  switch (req.method) {
    case 'GET':
      //res.end('hi');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      res.end(pug.renderFile('./views/posts.pug', {contents}));
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
        //const content = decoded.split('content=')[1];
        const content = params.get('content');
        console.info('投稿されました: ' + content);
        contents.push(content);
        console.info('投稿された全内容: ' + contents);
        Post.create({
          content,
          trackingCookie: null,
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