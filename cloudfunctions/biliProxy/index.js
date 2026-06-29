// cloudfunctions/biliProxy/index.js
const https = require('https');
const crypto = require('crypto');
const BILI_REFERER = 'https://www.bilibili.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ===== WBI 签名 ===== */
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

var wbiKeysCache = null;
var wbiKeysCacheTime = 0;

function getMixinKey(orig) {
  var temp = '';
  for (var i = 0; i < mixinKeyEncTab.length; i++) {
    temp += orig[mixinKeyEncTab[i]] || '';
  }
  return temp.slice(0, 32);
}

function signWbi(params, imgKey, subKey) {
  var mixinKey = getMixinKey(imgKey + subKey);
  var currTime = Math.round(Date.now() / 1000);
  params['wts'] = currTime;
  var keys = Object.keys(params).sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = params[k].toString().replace(/[!'()*]/g, '');
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  }
  var query = parts.join('&');
  var wbiSign = crypto.createHash('md5').update(query + mixinKey).digest('hex');
  return query + '&w_rid=' + wbiSign;
}

async function getWbiKeys() {
  var now = Date.now();
  if (wbiKeysCache && (now - wbiKeysCacheTime) < 30 * 60 * 1000) {
    return wbiKeysCache;
  }
  var r = await httpGet('https://api.bilibili.com/x/web-interface/nav', null);
  if (!r.json || r.json.code !== 0) {
    throw new Error('nav api code=' + (r.json && r.json.code));
  }
  var imgUrl = r.json.data.wbi_img.img_url;
  var subUrl = r.json.data.wbi_img.sub_url;
  var imgKey = imgUrl.slice(imgUrl.lastIndexOf('/') + 1, imgUrl.lastIndexOf('.'));
  var subKey = subUrl.slice(subUrl.lastIndexOf('/') + 1, subUrl.lastIndexOf('.'));
  wbiKeysCache = { imgKey: imgKey, subKey: subKey };
  wbiKeysCacheTime = now;
  return wbiKeysCache;
}

/* ===== HTTP ===== */
function httpGet(url, cookie) {
  return new Promise(function (resolve, reject) {
    var headers = {
      'User-Agent': UA,
      'Referer': BILI_REFERER,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Origin': 'https://www.bilibili.com'
    };
    if (cookie) headers['Cookie'] = 'SESSDATA=' + cookie + '; buvid3=placeholder';
    var req = https.get(url, { headers: headers, timeout: 15000 }, function (res) {
      var data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        var json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, data: data, json: json });
      });
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(); reject(new Error('timeout')); });
  });
}

exports.main = async (event, context) => {
  var action = event.action, bvid = event.bvid, aid = event.aid, cid = event.cid;
  var subtitleUrl = event.subtitleUrl, cookie = event.cookie, ps = event.ps;
  try {
    if (action === 'view') {
      var r = await httpGet('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, cookie);
      if (!r.json || r.json.code !== 0) return { ok: false, msg: 'view code=' + (r.json && r.json.code) + ' msg=' + (r.json && r.json.message), statusCode: r.statusCode };
      var d = r.json.data;
      return {
        ok: true,
        aid: d.aid,
        cid: d.cid,
        title: d.title,
        desc: d.desc || '',
        tags: (d.tag || '').split(','),
        pages: (d.pages || []).map(function (p) { return { cid: p.cid, part: p.part }; })
      };
    }

    if (action === 'subtitleList') {
      var r2 = await httpGet('https://api.bilibili.com/x/player/wbi/v2?aid=' + aid + '&cid=' + cid, cookie);
      if (!r2.json || r2.json.code !== 0) return { ok: false, msg: 'player code=' + (r2.json && r2.json.code), statusCode: r2.statusCode };
      var subs = (r2.json.data && r2.json.data.subtitle && r2.json.data.subtitle.subtitles) || [];
      return {
        ok: true,
        subtitles: subs.map(function (s, i) {
          return {
            id: s.id || i,
            lan: s.lan,
            lan_doc: s.lan_doc,
            subtitle_url: s.subtitle_url,
            isAI: (s.lan || '').startsWith('ai-')
          };
        })
      };
    }

    if (action === 'subtitleContent') {
      var u = subtitleUrl;
      if (u.startsWith('//')) u = 'https:' + u;
      var r3 = await httpGet(u, cookie);
      var body = null;
      if (r3.json) body = r3.json.body || [];
      return { ok: !!body, statusCode: r3.statusCode, body: body, raw: r3.data.slice(0, 200) };
    }

    if (action === 'comments') {
      var n = Math.min(ps || 30, 30);
      var modes = [3, 2, 0];
      var lastErr = '';
      var lastCode = -999;

      // 获取 WBI 签名密钥
      var wbiKeys;
      try {
        wbiKeys = await getWbiKeys();
      } catch (e) {
        return { ok: false, msg: 'WBI密钥获取失败: ' + e.message, aid: aid };
      }

      for (var mi = 0; mi < modes.length; mi++) {
        var mode = modes[mi];
        var params = {
          oid: String(aid),
          type: '1',
          mode: String(mode),
          next: '0',
          ps: String(n)
        };
        var signedQuery = signWbi(params, wbiKeys.imgKey, wbiKeys.subKey);
        var apiUrl = 'https://api.bilibili.com/x/v2/reply/wbi/main?' + signedQuery;
        var cr = await httpGet(apiUrl, cookie);

        if (!cr.json) {
          lastErr = 'mode=' + mode + ' json fail http=' + cr.statusCode;
          lastCode = cr.statusCode;
          continue;
        }
        if (cr.json.code !== 0) {
          lastErr = 'mode=' + mode + ' code=' + cr.json.code + ' msg=' + (cr.json.message || '');
          lastCode = cr.json.code;
          continue;
        }
        var replies = (cr.json.data && cr.json.data.replies) || [];
        if (!replies.length) {
          var dataKeys = cr.json.data ? Object.keys(cr.json.data).join(',') : 'no data';
          lastErr = 'mode=' + mode + ' empty replies (data keys: ' + dataKeys + ')';
          continue;
        }
        return {
          ok: true,
          comments: replies.map(function (rp) {
            var msg = '';
            if (rp.content) msg = rp.content.message || '';
            return { content: msg, like: rp.like || 0 };
          }),
          count: replies.length
        };
      }

      for (var mi2 = 0; mi2 < modes.length; mi2++) {
        var mode2 = modes[mi2];
        var fallbackUrl = 'https://api.bilibili.com/x/v2/reply/main?type=1&oid=' + aid + '&mode=' + mode2 + '&next=0&ps=' + n;
        var fr = await httpGet(fallbackUrl, cookie);
        if (!fr.json) continue;
        if (fr.json.code !== 0) continue;
        var freplies = (fr.json.data && fr.json.data.replies) || [];
        if (!freplies.length) continue;
        return {
          ok: true,
          comments: freplies.map(function (rp) {
            var msg = '';
            if (rp.content) msg = rp.content.message || '';
            return { content: msg, like: rp.like || 0 };
          }),
          count: freplies.length,
          source: 'legacy'
        };
      }

      return { ok: false, msg: lastErr || '评论为空', code: lastCode, aid: aid };
    }

    return { ok: false, msg: 'unknown action: ' + action };
  } catch (e) {
    return { ok: false, msg: e.message, stack: e.stack };
  }
};
