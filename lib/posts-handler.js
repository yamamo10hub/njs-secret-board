'use strict';
const pug = require('pug');
const crypto = require('crypto');
const Cookies = require('cookies');
const Post = require('./post');
const util = require('./handler-util');
const trackingIdKey = 'tracking_id';
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

function handle(req, res) {
  const cookies = new Cookies(req, res);
  //addTrackingCookie(cookies);
  const trackingId = addTrackingCookie(cookies, req.user);

  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({order:[['id','DESC']]}).then((posts) => {
        posts.forEach((post) => {
          //post.content = post.content.replace(/\n/g, '<br>');
          post.content = post.content.replace(/\+/g, ' ');
          post.formattedCreatedAt = dayjs(post.createdAt).tz('Asia/Tokyo')
          .format('YYYY年MM月DD日 HH時mm分ss秒');
        });
        res.end(pug.renderFile('./views/posts.pug', { posts, user: req.user }));
      });
      console.info(
        `閲覧されました: user: ${req.user}, ` + 
        `trackingId: ${trackingId},` + 
        `remoteAddress: ${req.socket.remoteAddress}, ` + 
        `userAgent: ${req.headers['user-agent']}`
      );
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
          trackingCookie: trackingId, 
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
// 投稿の削除
function handleDelete(req, res) {
  switch (req.method) {
    case 'POST':
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        const decoded = decodeURIComponent(body);
        const params = new URLSearchParams(decoded);
        const id = params.get('id');
        Post.findByPk(id).then((post) => {
          if (req.user === post.postedBy || req.user === 'admin') {
            post.destroy().then(() => {
              console.info(
                `削除されました: user: ${req.user}, ` +
                 `remoteAddress: ${req.socket.remoteAddress}, ` +
                 `userAgent: ${req.headers['user-agent']} `
              );
              handleRedirectPosts(req, res);
            });
          }
        });
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

// 旧関数
// cookieの追加
//function addTrackingCookie(cookies) {
//  if (!cookies.get(trackingIdKey)) {
//    const trackingId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
//    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
//    cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
//  }
//}

/**
 * Cookieに含まれるtrackingIDに異常が無ければその値をかえす
 * 異常がある場合、再度Cookieを付与する
 * @param {Cookies} cookies
 * @param {String} userName
 * @return {String} トラッキングID
 */
function addTrackingCookie(cookies, userName) {
  // リクエスト時のcookieを取得
  const requestedTrackingId = cookies.get(trackingIdKey);
  // 下の関数でIDの確認をする
  if (isValidTrackingId(requestedTrackingId, userName)) {
    // 正常であれば、そのままの値(リクエスト時のcookie)を返す
    return requestedTrackingId;
  } else {
    // 判別に失敗すれば再度hashを計算し付与する
    const originalId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
    const trackingId  = originalId + '_' + createValidHash(originalId, userName);
    cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
    return trackingId;
  }
}

// idの判別チェック
function isValidTrackingId(trackingId, userName) {
  if (!trackingId) {
    return false;
  }
  const splitted = trackingId.split('_');
  const originalId = splitted[0];
  const requestedHash = splitted[1];
  return createValidHash(originalId, userName) === requestedHash;
}

function createValidHash(originalId, userName) {
  const sha1sum = crypto.createHash('sha1');
  sha1sum.update(originalId + userName);
  return sha1sum.digest('hex');
}

// postの後投稿ページに戻る為の処理
function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}

module.exports = {
  handle,
  handleDelete
};