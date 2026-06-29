// pages/ai/ai.js
var ai = require('../../utils/ai');
var prompt = require('../../utils/prompt');
var markdown = require('../../utils/markdown');
var store = require('../../utils/store');
var subtitle = require('../../utils/subtitle');
var cloud = require('../../utils/cloud');

Page({
  data: {
    streaming: false,
    fullText: '',
    nodes: [],
    error: '',
    askText: '',
    showRaw: false,
    qaList: [],
    hasResult: false,
    videoTitle: '',
    scrollTop: 0,
    rawPrompt: ''
  },

  onLoad: function () { this._initData(); },
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this._initData();
  },

  _initData: function () {
    var app = getApp();
    var body = app.globalData.subtitleBody;
    var videoInfo = app.globalData.videoInfo || {};
    this._renderTimer = null;
    this._sc = 0;
    this.videoInfo = videoInfo;
    if (!body) {
      this.setData({ error: '未获取到字幕，请返回浏览页获取' });
      return;
    }
    this.subtitleText = subtitle.getPlainText(body);
    this.conversationHistory = [];
    this.setData({ videoTitle: videoInfo.title || '', error: '' });

    // 自动 AI 分析
    var settings = store.getSettings();
    if (settings.autoAIAnalysis && !this._autoTriggered) {
      this._autoTriggered = true;
      this.onGenerate();
    }
  },

  onGenerate: function () {
    if (this.data.streaming) return;
    var settings = store.getSettings();
    if (!settings.apiKey) {
      this.setData({ error: '请先在设置页填写 API Key' });
      return;
    }

    var self = this;
    var wordCount = (this.subtitleText || '').length;
    if (settings.confirmBeforeAI && wordCount > (settings.confirmThreshold || 20000)) {
      wx.showModal({
        title: '二次确认',
        content: '字幕字数约 ' + wordCount + ' 字，已超过阈值 ' + settings.confirmThreshold + ' 字，是否继续 AI 分析？',
        confirmText: '继续',
        cancelText: '取消',
        success: function (res) {
          if (res.confirm) {
            self._startGenerate(settings);
          }
        }
      });
      return;
    }
    this._startGenerate(settings);
  },

  _startGenerate: function (settings) {
    this.setData({
      streaming: true, error: '', fullText: '', nodes: [], hasResult: false, showRaw: false, qaList: [], rawPrompt: ''
    });
    this.conversationHistory = [];
    var self = this;
    if (settings.opinionAnalysis && this.videoInfo && this.videoInfo.aid) {
      cloud.callComments(this.videoInfo.aid, settings.opinionCommentsCount).then(function (res) {
        var comments = (res.ok && res.comments && res.comments.length) ? subtitle.formatCommentsForAI(res.comments) : '';
        self.runStream(comments, settings);
      }).catch(function () {
        self.runStream('', settings);
      });
    } else {
      self.runStream('', settings);
    }
  },

  runStream: function (comments, settings) {
    var promptText = prompt.buildFullPrompt(this.subtitleText, this.videoInfo, comments, settings);
    this.lastPrompt = promptText;
    this.conversationHistory = [{ role: 'user', content: promptText }];
    var self = this;
    ai.streamChat(this.conversationHistory, settings, function (chunk) {
      self.updateNodes(chunk);
    }).then(function (full) {
      self.conversationHistory.push({ role: 'assistant', content: full });
      self.setData({
        streaming: false, hasResult: true, fullText: full,
        nodes: markdown.markdownToNodes(full), rawPrompt: promptText
      });
      self.scrollDown();
    }).catch(function (err) {
      self.setData({ streaming: false, error: err.message || '生成失败' });
    });
  },

  updateNodes: function (text) {
    this._fullText = text;
    var self = this;
    if (self._renderTimer) return;
    self._renderTimer = setTimeout(function () {
      self._renderTimer = null;
      self.setData({ fullText: self._fullText, nodes: markdown.markdownToNodes(self._fullText) });
      self.scrollDown();
    }, 80);
  },

  scrollDown: function () {
    this._sc = (this._sc || 0) + 1;
    this.setData({ scrollTop: 800000 + this._sc });
  },

  onAskInput: function (e) {
    this.setData({ askText: e.detail.value });
  },

  onSendAsk: function () {
    if (this.data.streaming) return;
    var q = this.data.askText.trim();
    if (!q) return;
    if (!this.conversationHistory || !this.conversationHistory.length) {
      this.setData({ error: '请先生成一次分析' });
      return;
    }
    var settings = store.getSettings();
    this.conversationHistory.push({ role: 'user', content: q });
    var qa = { question: q, answer: '', nodes: [], streaming: true };
    var qaList = this.data.qaList.concat([qa]);
    this.setData({ qaList: qaList, askText: '', streaming: true, error: '' });
    var idx = qaList.length - 1;
    var self = this;
    ai.streamChat(this.conversationHistory, settings, function (chunk) {
      var list = self.data.qaList.slice();
      list[idx] = { question: q, answer: chunk, nodes: [], streaming: true };
      self.setData({ qaList: list });
      self.scrollDown();
    }).then(function (full) {
      self.conversationHistory.push({ role: 'assistant', content: full });
      var list = self.data.qaList.slice();
      list[idx] = { question: q, answer: full, nodes: markdown.markdownToNodes(full), streaming: false };
      self.setData({ qaList: list, streaming: false });
      self.scrollDown();
    }).catch(function (err) {
      self.setData({ streaming: false, error: err.message || '追问失败' });
    });
  },

  toggleRaw: function () {
    this.setData({ showRaw: !this.data.showRaw });
  }
});
