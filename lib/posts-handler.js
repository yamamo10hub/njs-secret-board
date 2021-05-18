'use strict';
const pug = require('pug');
const crypto = require('crypto');
const Cookies = require('cookies');
const Post = require('./post');
const util = require('./handler-util');
const trackingIdKey = 'tracking_id';
const oneTimeTokenMap = new Map(); //key: userid, value: token
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
          post.content = post.content.replace(/\+/g, ' ');
          post.formattedCreatedAt = dayjs(post.createdAt).tz('Asia/Tokyo')
          .format('YYYY年MM月DD日 HH時mm分ss秒');
        });
        const oneTimeToken = crypto.randomBytes(8).toString('hex');
        oneTimeTokenMap.set(req.user, oneTimeToken);
        //res.end(pug.renderFile('./views/posts.pug', { posts, user: req.user }));
        res.end(pug.renderFile('./views/posts.pug', { 
          posts, 
          user: req.user, 
          oneTimeToken
        }));
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
        // dataが来てstreamを受けた時の為の処理
        body = Buffer.concat(body).toString();
        // content=[投稿内容]&oneTimeToken=[トークン本体]
        const decoded = decodeURIComponent(body);
        const params = new URLSearchParams(decoded);
        //const content = decoded.split('content=')[1];
        const content = params.get('content');
        //console.info('投稿されました: ' + content);
        // DBへの書き込み(従来通り)
        //Post.create({
        //  content, 
        //  trackingCookie: trackingId, 
        //  postedBy: req.user
        //}).then(() => {
        //  handleRedirectPosts(req, res);
        //});
        // postデータからtokenを取り出す
        const requestedOneTimeToken = params.get('oneTimeToken');
        // それぞれ投稿内容、tokenを格納した２つの変数を比較し
        // 空だったり間違っていれば、無効なpostとして400を返す
        if (!(content && requestedOneTimeToken)) {
          util.handleBadRequest(req, res);
        } else {
          // mapに保存したtokenとpost時のtokenが同じであればDBにデータを書く
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
            console.info('投稿されました:' + content);
            Post.create({
              content: content, 
              trackingCookie: trackingId, 
              postedBy: req.user
            }).then(() => {
              // 書き込み処理をした時、map上のtokenを削除する
              oneTimeTokenMap.delete(req.user);
              handleRedirectPosts(req, res);
            });
          } else {
            // tokenが一致しなければ400を返す
            util.handleBadRequest(req, res);
          }
        }
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
        //const id = decoded.split('id=')[1];
        const id = params.get('id');
//        Post.findByPk(id).then((post) => {
//          if (req.user === post.postedBy || req.user === 'admin') {
//            post.destroy().then(() => {
//            console.info(
//              `削除されました: user: ${req.user}, ` +
//               `remoteAddress: ${req.socket.remoteAddress}, ` +
//               `userAgent: ${req.headers['user-agent']} `
//            );
//            handleRedirectPosts(req, res);
//          });
//        }
//      });
        const requestedOneTimeToken = params.get('oneTimeToken');
        if (!(id && requestedOneTimeToken)) {
          util.handleBadRequest(req, res);
        } else {
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
            Post.findByPk(id).then((post) => {
              if (req.user === post.postedBy || req.user === 'admin') {
                post.destroy().then( () => {
                  console.info(
                    `削除されました: user: ${req.user}, ` + 
                    `remoteaddress: ${req.socket.remoteAddress}, ` + 
                    `userAgent: ${req.headers['user-agent']} `
                  );
                  oneTimeTokenMap.delete(req.user);
                  handleRedirectPosts(req, res);
                });
              } else {
                util.handleBadRequest(req, res);
              }
            });
          }
        }
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
    //const originalId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
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

const secretKey =
  '5a69bb55532235125986a0ac24aca759f69bae045c7a66d6e2bc4652e3efb43da4' +
  'd1256ca5ac705b9cf0eb2cacbb4adb78cba82f20596985c5216647ec218e84905a' +
  '9f668a6d3090653b3be84daca7a4578194764d8306541c0411cb23fbdbd611b5e0' +
  'cd8fca86980a91d68dc05aacc5fb52f16b33a6f3260c5a5eb88ffaee07774fe2c0' +
  '825c42fbba7c909e937a9fac7d90ded280bb18f5b43659d6fa0521dbc72ecc9b4b' +
  'a7d958360c810dbd94bbfcac80d0966e90906df302a870cdbffe655145cc4155a2' +
  '0d0d019b67899a912e0892ac0c0386829aa2c1f1237bf4f63d73711117410c2fc5' +
  '0c1472e87ecd6844d0805cac7c0ea8bbfbda507293beebc5d9';
  
function createValidHash(originalId, userName) {
  const sha1sum = crypto.createHash('sha1');
  sha1sum.update(originalId + userName + secretKey);
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