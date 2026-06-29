// pages/browse/browse.js
var cloud = require('../../utils/cloud');
var store = require('../../utils/store');
var subtitle = require('../../utils/subtitle');

Page({
  data: {
    bvid: '',
    loading: false,
    subtitles: [],
    videoInfo: null,
    selectedId: null,
    selectedLang: '',
    error: '',
    showEmpty: false,
    sourceCollapsed: true,
    // subtitle browse
    subBody: [],
    filtered: [],
    keyword: '',
    copyOk: false,
    commentCount: 0,
    commentError: '',
    scrollTop: 0,
    credentialTip: ''
  },

  onLoad: function () { this._restoreData(); this._checkCredentials(); },
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this._restoreData();
    this._checkCredentials();
  },

  _checkCredentials: function () {
    var settings = store.getSettings();
    var missing = [];
    if (!settings.envId) missing.push('云开发环境 ID');
    if (!settings.sessdata) missing.push('SESSDATA');
    if (missing.length) {
      this.setData({ credentialTip: '未填写' + missing.join('、') + '，点击前往设置' });
    } else {
      this.setData({ credentialTip: '' });
    }
  },

  goSettings: function () {
    wx.switchTab({ url: '/pages/settings/settings' });
  },

  _restoreData: function () {
    var app = getApp();
    if (app.globalData.subtitleBody) {
      var body = app.globalData.subtitleBody;
      var display = body.map(function (it) {
        return {
          from: subtitle.formatTime(it.from),
          to: subtitle.formatTime(it.to),
          content: it.content || '',
          segments: [{ text: it.content || '', highlight: false }]
        };
      });
      this.allDisplay = display;
      this.allRaw = body;
      var kw = (this.data.keyword || '').toLowerCase();
      var filtered = kw ? this._applyHighlight(display, kw) : display;
      this.setData({
        subBody: display,
        filtered: filtered,
        videoInfo: app.globalData.videoInfo,
        selectedLang: app.globalData.subtitleLang || '',
        commentCount: app.globalData.commentCount || 0,
        bvid: app.globalData.bvid || ''
      });
    }
  },

  _applyHighlight: function (list, kw) {
    if (!kw) return list;
    return list.map(function (it) {
      var content = it.content || '';
      var lower = content.toLowerCase();
      var segments = [];
      var idx = 0;
      var pos = lower.indexOf(kw);
      while (pos !== -1) {
        if (pos > idx) segments.push({ text: content.slice(idx, pos), highlight: false });
        segments.push({ text: content.slice(pos, pos + kw.length), highlight: true });
        idx = pos + kw.length;
        pos = lower.indexOf(kw, idx);
      }
      if (idx < content.length) segments.push({ text: content.slice(idx), highlight: false });
      return {
        from: it.from,
        to: it.to,
        content: it.content,
        segments: segments.length ? segments : [{ text: content, highlight: false }]
      };
    });
  },

  onBvidInput: function (e) {
    this.setData({ bvid: e.detail.value.trim() });
  },

  onFetch: function () {
    var raw = this.data.bvid.trim();
    if (!raw) { this.shakeError('请输入 BV 号'); return; }
    var bvid = raw;
    var m = raw.match(/BV[a-zA-Z0-9]+/);
    if (m) bvid = m[0];
    if (!/^BV[a-zA-Z0-9]+$/.test(bvid)) { this.shakeError('BV 号格式不正确'); return; }
    var settings = store.getSettings();
    if (!settings.envId) {
      this._missingSetting('请先在设置页填写云开发环境 ID', 'envId');
      return;
    }
    if (!store.getSessdata()) {
      this._missingSetting('请先在设置页填写 SESSDATA', 'sessdata');
      return;
    }

    this.setData({ loading: true, error: '', subtitles: [], videoInfo: null, showEmpty: false, subBody: [], filtered: [], commentCount: 0, commentError: '' });
    var app = getApp();
    app.globalData.commentCount = 0;
    var self = this;
    cloud.callView(bvid).then(function (res) {
      if (!res.ok) throw new Error(res.msg || '获取视频信息失败');
      var videoInfo = {
        aid: res.aid, cid: res.cid, title: res.title, desc: res.desc, tags: res.tags, pages: res.pages
      };
      self.setData({ videoInfo: videoInfo });
      app.globalData.videoInfo = videoInfo;
      app.globalData.bvid = bvid;
      return cloud.callSubtitleList(res.aid, res.cid);
    }).then(function (res) {
      if (!res.ok) throw new Error(res.msg || '获取字幕列表失败');
      self.setData({ subtitles: res.subtitles, loading: false, showEmpty: res.subtitles.length === 0 });
      if (res.subtitles.length) {
        self._autoSelect(res.subtitles);
      }
    }).catch(function (err) {
      self.shakeError(err.message || '请求失败');
    });
  },

  _missingSetting: function (msg, field) {
    var self = this;
    this.setData({ error: msg });
    wx.showModal({
      title: '前往设置',
      content: msg + '。是否立即前往设置页填写？',
      confirmText: '前往',
      cancelText: '取消',
      success: function (res) {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/settings/settings' });
        }
      }
    });
  },

  _autoSelect: function (subtitles) {
    var target = null;
    for (var i = 0; i < subtitles.length; i++) {
      var lan = subtitles[i].lan || '';
      var lanDoc = subtitles[i].lan_doc || '';
      if (lan.indexOf('zh') !== -1 || lanDoc.indexOf('中') !== -1) {
        target = subtitles[i];
        break;
      }
    }
    if (!target) target = subtitles[0];
    this._loadSubtitle(target);
  },

  _loadSubtitle: function (sub) {
    var self = this;
    this.setData({ selectedId: sub.id, selectedLang: sub.lan_doc, loading: true, error: '' });
    cloud.callSubtitleContent(sub.subtitle_url).then(function (res) {
      if (!res.ok || !res.body) throw new Error('字幕内容为空');
      var app = getApp();
      app.globalData.subtitleBody = res.body;
      app.globalData.subtitleLang = sub.lan_doc;
      var display = res.body.map(function (it) {
        return {
          from: subtitle.formatTime(it.from),
          to: subtitle.formatTime(it.to),
          content: it.content || '',
          segments: [{ text: it.content || '', highlight: false }]
        };
      });
      self.allDisplay = display;
      self.allRaw = res.body;
      var kw = (self.data.keyword || '').toLowerCase();
      var filtered = kw ? self._applyHighlight(display, kw) : display;
      self.setData({ subBody: display, filtered: filtered, loading: false });

      var settings = store.getSettings();
      var videoInfo = self.data.videoInfo || app.globalData.videoInfo;
      if (settings.opinionAnalysis && videoInfo && videoInfo.aid) {
        self.setData({ commentError: '', commentCount: 0 });
        app.globalData.commentCount = 0;
        cloud.callComments(videoInfo.aid, settings.opinionCommentsCount).then(function (cr) {
          var count = (cr && cr.count) ? cr.count : (cr && cr.comments ? cr.comments.length : 0);
          if (cr && cr.ok) {
            self.setData({ commentCount: count, commentError: '' });
            app.globalData.commentCount = count;
          } else {
            self.setData({ commentCount: 0, commentError: (cr && cr.msg) || '评论获取失败' });
            app.globalData.commentCount = 0;
          }
        }).catch(function (err) {
          self.setData({ commentCount: 0, commentError: err.message || '评论请求异常' });
          app.globalData.commentCount = 0;
        });
      }
    }).catch(function (err) {
      self.setData({ loading: false });
      self.shakeError(err.message || '获取字幕内容失败');
    });
  },

  onSelect: function (e) {
    var id = e.currentTarget.dataset.id;
    for (var i = 0; i < this.data.subtitles.length; i++) {
      if (this.data.subtitles[i].id === id) {
        this._loadSubtitle(this.data.subtitles[i]);
        break;
      }
    }
  },

  toggleSource: function () {
    this.setData({ sourceCollapsed: !this.data.sourceCollapsed });
  },

  onSearch: function (e) {
    var kw = (e.detail.value || '').trim().toLowerCase();
    this.setData({ keyword: kw });
    if (!kw) {
      var plain = (this.allDisplay || []).map(function (it) {
        return {
          from: it.from,
          to: it.to,
          content: it.content,
          segments: [{ text: it.content || '', highlight: false }]
        };
      });
      this.setData({ filtered: plain });
      return;
    }
    var filtered = (this.allDisplay || []).filter(function (it) {
      return (it.content || '').toLowerCase().indexOf(kw) !== -1;
    });
    this.setData({ filtered: this._applyHighlight(filtered, kw) });
  },

  onCopy: function () {
    var text = subtitle.getTimestampedText(this.allRaw);
    var self = this;
    wx.setClipboardData({
      data: text,
      success: function () {
        self.setData({ copyOk: true });
        wx.showToast({ title: '已复制全部字幕', icon: 'success' });
        setTimeout(function () { self.setData({ copyOk: false }); }, 1500);
      }
    });
  },

  goAI: function () {
    if (!this.data.subBody.length) { this.shakeError('请先获取字幕'); return; }
    wx.switchTab({ url: '/pages/ai/ai' });
  },

  shakeError: function (msg) {
    this.setData({ error: msg, loading: false });
  }
});
