// app.js —— 小程序入口
var store = require('./utils/store');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    this.initCloud();
  },

  initCloud() {
    var envId = store.getEnvId();
    if (!envId) {
      console.warn('未设置云开发环境ID，请在设置页填写');
      this.cloudReady = false;
      return;
    }
    try {
      wx.cloud.init({ env: envId, traceUser: true });
      this.cloudReady = true;
    } catch (e) {
      console.error('云开发初始化失败:', e);
      this.cloudReady = false;
    }
  },

  globalData: {
    subtitleBody: null,
    videoInfo: null,
    subtitleLang: ''
  }
});
