// utils/cloud.js
var store = require('./store');

function call(data) {
  var envId = store.getEnvId();
  if (!envId) {
    return Promise.reject(new Error('未设置云开发环境ID，请前往设置页填写'));
  }
  var app = getApp();
  if (app && !app.cloudReady) {
    app.initCloud();
  }
  return wx.cloud.callFunction({ name: 'biliProxy', data: data }).then(function (res) {
    return res.result;
  });
}

function callView(bvid) {
  return call({ action: 'view', bvid: bvid });
}

function callSubtitleList(aid, cid) {
  return call({ action: 'subtitleList', aid: aid, cid: cid, cookie: store.getSessdata() });
}

function callSubtitleContent(url) {
  return call({ action: 'subtitleContent', subtitleUrl: url, cookie: store.getSessdata() });
}

function callComments(aid, ps) {
  return call({ action: 'comments', aid: aid, ps: ps || 30, cookie: store.getSessdata() });
}

module.exports = {
  call: call,
  callView: callView,
  callSubtitleList: callSubtitleList,
  callSubtitleContent: callSubtitleContent,
  callComments: callComments
};
