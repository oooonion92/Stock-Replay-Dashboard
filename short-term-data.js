/*
 * A股短线生态数据。
 * 来源：Stock/短线数据采集/ 各交易日收盘快照。
 * 该文件由 tools/import_short_term_data.py 更新，不参与市场总分计算。
 */
window.REPLAY_DATA = window.REPLAY_DATA || {};
window.REPLAY_DATA.shortTerm = {
  "2026-07-30": {
    source: "东方财富收盘涨停/炸板/跌停池",
    state: "complete",
    emotion: { zt: 52, zb: 19, dt: 74, sealRate: 73.24, breakRate: 26.76, firstBoard: 42, maxBoards: 8, lianban: 10 },
    promotion: { oneToTwo: 8.57, oneToTwoNumerator: 6, oneToTwoDenominator: 70, twoToThree: 16.67, threePlus: 60.0 },
    feedback: { sample: 80, median: -1.42, average: -0.22, positiveRate: 40.0, limitUpAgainRate: 12.35, deepLoss5: 14, deepLoss7: 8, worst: -11.49 },
    ladder: [
      { level: 8, count: 1, names: ["爱丽家居"] },
      { level: 4, count: 2, names: ["明新旭腾", "传智教育"] },
      { level: 3, count: 1, names: ["一鸣食品"] },
      { level: 2, count: 6, names: ["高争民爆", "金龙羽", "均瑶健康", "柳钢股份", "返利科技", "海兴电力"] }
    ],
    industryRelay: [
      { name: "汽车零部", limitUps: 6, firstBoards: 5, maxBoards: 4, brokenPool: 0 },
      { name: "电网设备", limitUps: 4, firstBoards: 2, maxBoards: 2, brokenPool: 0 },
      { name: "教育", limitUps: 2, firstBoards: 1, maxBoards: 4, brokenPool: 0 },
      { name: "饮料乳品", limitUps: 2, firstBoards: 0, maxBoards: 3, brokenPool: 0 },
      { name: "农化制品", limitUps: 2, firstBoards: 2, maxBoards: 1, brokenPool: 0 },
      { name: "化学制药", limitUps: 2, firstBoards: 2, maxBoards: 1, brokenPool: 0 }
    ]
  },
  "2026-07-31": {
    source: "东方财富收盘涨停/炸板/跌停池",
    state: "complete",
    emotion: { zt: 99, zb: 107, dt: 0, sealRate: 48.06, breakRate: 51.94, firstBoard: 89, maxBoards: 9, lianban: 10 },
    promotion: { oneToTwo: 14.29, oneToTwoNumerator: 6, oneToTwoDenominator: 42, twoToThree: 16.67, threePlus: 75.0 },
    feedback: { sample: 52, median: 1.89, average: 2.85, positiveRate: 59.62, limitUpAgainRate: 19.23, deepLoss5: 0, deepLoss7: 0, worst: -4.62 },
    ladder: [
      { level: 9, count: 1, names: ["爱丽家居"] },
      { level: 5, count: 1, names: ["传智教育"] },
      { level: 4, count: 1, names: ["一鸣食品"] },
      { level: 3, count: 1, names: ["高争民爆"] },
      { level: 2, count: 6, names: ["神雾节能", "普联软件", "泛微网络", "税友股份", "香江控股", "中国宝安"] }
    ],
    industryRelay: [
      { name: "广告营销", limitUps: 7, firstBoards: 7, maxBoards: 1, brokenPool: 3 },
      { name: "IT服务Ⅱ", limitUps: 5, firstBoards: 4, maxBoards: 2, brokenPool: 2 },
      { name: "软件开发", limitUps: 5, firstBoards: 3, maxBoards: 2, brokenPool: 5 },
      { name: "专业工程", limitUps: 5, firstBoards: 5, maxBoards: 1, brokenPool: 2 },
      { name: "专用设备", limitUps: 5, firstBoards: 5, maxBoards: 1, brokenPool: 4 },
      { name: "数字媒体", limitUps: 4, firstBoards: 4, maxBoards: 1, brokenPool: 2 }
    ]
  }
};
