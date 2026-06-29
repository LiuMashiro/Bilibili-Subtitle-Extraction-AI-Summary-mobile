// pages/settings/settings.js
var store = require('../../utils/store');
var PLATFORMS = store.PLATFORMS;
var DETAIL_LEVELS = store.DETAIL_LEVELS;

Page({
  data: {
    settings: {},
    platforms: [],
    platformKeys: [],
    platformIndex: 0,
    models: [],
    modelIndex: 0,
    detailLevels: DETAIL_LEVELS,
    detailIndex: 0,
    showCustomModel: false,
    showUrlInput: false,
    showEnvTutorial: false,
    showSessTutorial: false,
    showDomainTutorial: false
  },

  onLoad: function () { this.refresh(); },
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.refresh();
  },

  refresh: function () {
    var s = store.getSettings();
    var platformKeys = Object.keys(PLATFORMS);
    var platforms = platformKeys.map(function (k) { return PLATFORMS[k].name; });
    var platformIndex = Math.max(0, platformKeys.indexOf(s.platform));
    var pkey = platformKeys[platformIndex];
    var models = PLATFORMS[pkey].models;
    var modelIndex = Math.max(0, models.indexOf(s.model));
    var detailIndex = 0;
    for (var i = 0; i < DETAIL_LEVELS.length; i++) {
      if (DETAIL_LEVELS[i].value === s.detailLevel) { detailIndex = i; break; }
    }
    this.setData({
      settings: s,
      platforms: platforms,
      platformKeys: platformKeys,
      platformIndex: platformIndex,
      models: models,
      modelIndex: modelIndex,
      detailIndex: detailIndex,
      showCustomModel: s.model === '自定义',
      showUrlInput: pkey === 'custom'
    });
  },

  onPlatformChange: function (e) {
    var idx = Number(e.detail.value);
    var pkey = this.data.platformKeys[idx];
    var models = PLATFORMS[pkey].models;
    var defaultModel = models[0];
    store.saveSettings({ platform: pkey, apiUrl: PLATFORMS[pkey].url, model: defaultModel });
    var app = getApp();
    if (app) app.initCloud();
    this.refresh();
  },

  onModelChange: function (e) {
    var idx = Number(e.detail.value);
    var model = this.data.models[idx];
    store.saveSettings({ model: model });
    this.refresh();
  },

  onCustomModelInput: function (e) {
    store.saveSettings({ customModel: e.detail.value.trim() });
  },

  onApiUrlInput: function (e) {
    store.saveSettings({ apiUrl: e.detail.value.trim() });
  },

  onApiKeyInput: function (e) {
    store.saveSettings({ apiKey: e.detail.value.trim() });
  },

  onEnvIdInput: function (e) {
    var val = e.detail.value.trim();
    store.saveSettings({ envId: val });
    var app = getApp();
    if (app && val) app.initCloud();
  },

  onSessdataInput: function (e) {
    store.saveSettings({ sessdata: e.detail.value.trim() });
  },

  onDetailChange: function (e) {
    var idx = Number(e.detail.value);
    store.saveSettings({ detailLevel: DETAIL_LEVELS[idx].value });
    this.refresh();
  },

  onOpinionChange: function (e) { store.saveSettings({ opinionAnalysis: e.detail.value }); },
  onEvaluationChange: function (e) { store.saveSettings({ aiEvaluation: e.detail.value }); },
  onAutoAIChange: function (e) { store.saveSettings({ autoAIAnalysis: e.detail.value }); },
  onConfirmBeforeAIChange: function (e) { store.saveSettings({ confirmBeforeAI: e.detail.value }); },

  onConfirmThresholdInput: function (e) {
    var n = parseInt(e.detail.value, 10);
    if (isNaN(n) || n < 1) n = 20000;
    store.saveSettings({ confirmThreshold: n });
  },

  onCommentCountInput: function (e) {
    var n = parseInt(e.detail.value, 10);
    if (isNaN(n)) n = 30;
    n = Math.min(100, Math.max(1, n));
    store.saveSettings({ opinionCommentsCount: n });
  },

  copyLink: function () {
    var s = store.getSettings();
    var link = PLATFORMS[s.platform] ? PLATFORMS[s.platform].link : '';
    if (!link) return;
    wx.setClipboardData({
      data: link,
      success: function () { wx.showToast({ title: '链接已复制', icon: 'success' }); }
    });
  },

  toggleEnvTutorial: function () {
    this.setData({ showEnvTutorial: !this.data.showEnvTutorial });
  },

  toggleSessTutorial: function () {
    this.setData({ showSessTutorial: !this.data.showSessTutorial });
  },

  toggleDomainTutorial: function () {
    this.setData({ showDomainTutorial: !this.data.showDomainTutorial });
  },

  copyGitHub: function () {
    wx.setClipboardData({
      data: 'https://github.com/LiuMashiro/Bilibili-Subtitle-Extraction-AI-Summary-mobile',
      success: function () { wx.showToast({ title: '已复制', icon: 'success' }); }
    });
  },

  copyPC: function () {
    wx.setClipboardData({
      data: 'https://github.com/LiuMashiro/Bilibili-Subtitle-Extraction-AI-Summary-Ad-Skipping',
      success: function () { wx.showToast({ title: '已复制', icon: 'success' }); }
    });
  },

  copyLegal: function () {
    wx.setClipboardData({
      data: 'https://github.com/LiuMashiro/Bilibili-Subtitle-Extraction-AI-Summary-mobile/blob/main/LEGAL.md',
      success: function () { wx.showToast({ title: '已复制', icon: 'success' }); }
    });
  }
});
