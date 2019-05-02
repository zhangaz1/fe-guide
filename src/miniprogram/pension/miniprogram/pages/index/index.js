//index.js
const { calcAll } = require("../../utils");
const app = getApp();

Page({
  data: {
    // 月工资
    salary: null,
    // 职工上年月平均工资
    lastAvgSalary: 7832,
    // 现在年龄
    age: null,
    // 打算退休时年龄
    retireAge: null,
    // 帐户累积的养老金额
    accumulate: null,
    // 个人工资增长率
    rate: null,
    // 默认职工工资增长率
    avgRate: 5,
    // 期望退休后的月花销
    expectedPension: null,
    // 最终计算出的养老金
    pension: null
  },

  onLoad() {
    const cach = wx.getStorageSync("pension_cach");
    if (cach) {
      this.setData(cach);
    }
  },
  onShareAppMessage(res) {},
  onClickGoWebview() {
    const url = encodeURIComponent("");
    wx.navigateTo({
      url: `/pages/web-view/web-view?url=${url}`
    });
  },

  storeData() {
    const {
      lastAvgSalary,
      retireAge,
      accumulate,
      age,
      salary,
      avgRate,
      rate
    } = this.data;
    wx.setStorageSync("pension_cach", {
      lastAvgSalary,
      retireAge,
      accumulate,
      age,
      salary,
      avgRate,
      rate
    });
  },

  onHandleInput({
    currentTarget: {
      dataset: { key }
    },
    detail: { value }
  }) {
    if (key) {
      this.setData({
        [key]: value
      });
    }
  },

  calculatePension() {
    this.storeData();
    this.setData({
      pension: calcAll(this.data)
    });
  },

  onGetUserInfo({ detail: { userInfo } }) {
    this.calculatePension();
    userInfo.pension = this.data.pension;
    this.onGetSaveUser(userInfo);
    this.goResult();
    this.updateInfo(userInfo);
  },

  updateInfo(info) {
    getApp().userInfo = info;
  },

  onGetMobile(e) {
    console.log(e);
  },

  goResult() {
    const { age, retireAge, pension, expectedPension } = this.data;
    wx.navigateTo({
      url: `/pages/result/result?age=${age}&retireAge=${retireAge}&pension=${pension}&expectedPension=${expectedPension}`
    });
  },

  onGetSaveUser: function(userInfo) {
    wx.cloud.callFunction({
      name: "user",
      data: {
        method: "put",
        ...userInfo
      },
      success: res => {
        console.log("res", res);
      },
      fail: err => {
        console.error("[云函数] [login] 调用失败", err);
      }
    });
  }
});
