// videos.js - 抖音视频存档数据
// 数据源: https://www.douyin.com/user/MS4wLjABAAAAK713M9d8PGNb_WiMYf7yKhOI5y60H4uELJK2guDjJT0
// 抓取方式: browser_evaluate 提取 desc + publishTime + 评论 textContent, 正则切分
// 注意: 顶层评论含 subReplies 数(子评论数), 子评论需点击展开按钮加载(尚未实现)

window.MOXING_VIDEOS = [
  {
    id: "7686408682045787569",
    url: "https://www.douyin.com/video/7686408682045787569",
    desc: "大涨前夜，不要交出带血筹码！#先进封装#半导体设备",
    publishTime: "2026-09-17 15:51",
    comments: [
      { user: "C.y", content: "我永远记得与牛同寿", time: "3分钟前", location: "江苏", shares: 0, subReplies: 0 },
      { user: "l-o-v-e", content: "紧急通知 创业魔法师郭教授 突然被封了！", time: "2小时前", location: "湖南", shares: 11, subReplies: 20 },
      { user: "唱唱", content: "先生，我朋友害怕极了，想回去找妈妈@模型哥看世界", time: "6分钟前", location: "湖北", shares: 0, subReplies: 0 },
      { user: "陈皮酸梅汤", content: "大哥关注你的美女还蛮多的我刚刚发现", time: "50分钟前", location: "湖南", shares: 0, subReplies: 0 },
      { user: "我是阿和", content: "今天把有色都卖了", time: "3分钟前", location: "四川", shares: 0, subReplies: 0 },
      { user: "要早点", content: "先生，现在抖音开始整顿账号了，没有亮资质的账号要被封了", time: "57分钟前", location: "广东", shares: 2, subReplies: 0 },
      { user: "！", content: "老纪：听你这么说我就放心了", time: "2小时前", location: "浙江", shares: 130, subReplies: 19 },
      { user: "谨湫", content: "源杰科技快过前高了，有大佬分析一下怎么回事吗，难道还有一波？", time: "1小时前", location: "云南", shares: 1, subReplies: 0 },
      { user: "。七七", content: "我中午看完视频 一点开盘就割了 是不是又错了", time: "6分钟前", location: "新疆", shares: 0, subReplies: 0 },
      { user: "雪花榴莲", content: "牛还在吗，就怕牛没有寿了", time: "11分钟前", location: "江西", shares: 0, subReplies: 0 },
      { user: "手机用户95680553865", content: "先生，紫金还是维持之前时间到达2万亿吗？", time: "1分钟前", location: "重庆", shares: 0, subReplies: 0 },
      { user: "pongpong", content: "昨天加息加鹰派发言其实在我的预期内。事情一定要学会抓主要矛盾和次要矛盾。美国目前的主要矛盾就是通胀的问题。从辩证法的角度思考这次的加息是数据决定他一定会加息，但是鸽派和鹰派的发言是事情的变量。如果是鸽派发言，他能解决。通胀的问题吗？那么加息变得毫无意义。他不可能向着大家所希望的方向去发展。因为他得用鹰派发言来稳定这次加息的结果。沃什并不是一个外行。昨天所有的结果一定是商量好得出来的，一个红脸，一个黑脸。这次鹰派发言同时还能达到遏制AI泡泡的魄力，以时间换空间。他未来一定会达到某一个高点。但是尽可能的把这个时间拖长，技术的发展，基建的建设，他们都是需要时间的。我认为是完美的操盘。如果这次的行为不符合白宫的希望，那么特朗普早就跳出来！放了一些利好消息了。如果昨天是鸽派发言那么利空落地，科技将会往上涨的趋势就太猛烈了，也符合大部分人的预期。但是事情往往不会这么发展，涨得越快，跌的越狠。对于大a来说，我们其实要做的就是耐心。从昨天的主力拉伸行为得出也是给我们打了一针强心剂。安静等着吧。", time: "58分钟前", location: "湖南", shares: 8, subReplies: 4 },
      { user: "簪花郎", content: "10月不动，12月加息25bp.27年连续降息，昨晚沃什我俩去仙露池洗脚时候商量好的.v我50告诉你沃什绿泡泡", time: "22分钟前", location: "北京", shares: 1, subReplies: 0 },
      { user: "某年某月某星辰", content: "模型先生:有色与牛同寿老纪:好的，哥。那我不割了。慢慢加仓", time: "1小时前", location: "四川", shares: 31, subReplies: 6 },
      { user: "Z", content: "牛肉干的解读应该是：牛市，吃肉，猛干！！！！！！！", time: "38分钟前", location: "海南", shares: 3, subReplies: 0 }
    ]
  },
  {
    id: "7686399394883510139",
    url: "https://www.douyin.com/video/7686399394883510139",
    desc: "翻倍！ #股市行情",
    publishTime: "2026-09-17 15:15",
    comments: [
      { user: "胡桃夹子", content: "51%科技，16%化工化肥，7成仓了，给大家抬轿子了", time: "10分钟前", location: "湖南", shares: 0, subReplies: 0 },
      { user: "跑调王耶", content: "看老师说的心理稳定多了", time: "4分钟前", location: "山东", shares: 0, subReplies: 0 },
      { user: "普遍的特殊", content: "老师，我知道是荡秋千似的震荡行情，但是绳子套在我脖子上是怎么回事？", time: "3小时前", location: "安徽", shares: 162, subReplies: 17 },
      { user: "要早点⁷", content: "先生，抖音开始整顿账号了，没有亮投资认证的号要被封了，有个博主，叫创业魔法师的就是", time: "1小时前", location: "广东", shares: 4, subReplies: 4 },
      { user: "渔舟唱晚", content: "中京电子9个多点没走，最后3个多点卖了然后去追高龙星科技，到头来一天白忙活。兄弟们，像我这样是不是吃不了三菜一汤啊", time: "1小时前", location: "安徽", shares: 0, subReplies: 2 }
    ]
  },
  {
    id: "7686283584713564081",
    url: "https://www.douyin.com/video/7686283584713564081",
    desc: "加息预期不断上升！给市场带来恐慌！ 要不要加息，PCE说了算！",
    publishTime: "2026-09-17 07:45",
    comments: [
      { user: "柠檬不懵", content: "老子买了200股大秦铁路，为了等加息消息，一晚上没睡，炒股太磨人了", time: "8小时前", location: "上海", shares: 85, subReplies: 35 },
      { user: "烟台上门回收铜钱银元", content: "玩这么大不要命了？", time: "7小时前", location: "山东", shares: 351, subReplies: 0 },
      { user: "（）@", content: "先生大义，一般都是盘后发视频，今天怕大家乱操作提前发了", time: "10小时前", location: "江西", shares: 192, subReplies: 5 },
      { user: "阿尔萨斯杨", content: "先生你的柜子清空了阿。暗示什么", time: "9小时前", location: "江苏", shares: 27, subReplies: 5 },
      { user: "DDHH3", content: "哥，大家都中国人，你直接告诉我，年底前可以重仓哪个板块", time: "10小时前", location: "浙江", shares: 329, subReplies: 94 },
      { user: "模型先生作者", content: "你先和老美说说，大家都是地球人，让他别加了", time: "10小时前", location: "安徽", shares: 2369, subReplies: 0 },
      { user: "六星好市民", content: "先生，马上10月了，说说可能有哪些翻倍股票，并附上你的理由吧", time: "10小时前", location: "江西", shares: 228, subReplies: 25 }
    ]
  },
  {
    id: "7686028173843209081",
    url: "https://www.douyin.com/video/7686028173843209081",
    desc: "股市悟道犹如涅槃重生#股票#股市#股民#财经#股票知识",
    publishTime: "2026-09-16 15:14",
    comments: [
      { user: "影子的影子", content: "需要跑路的时候请卖面条 谢谢先生", time: "1天前", location: "江西", shares: 604, subReplies: 48 },
      { user: "豹躁猪仔", content: "先生今天也吃面了吗", time: "3小时前", location: "广东", shares: 0, subReplies: 0 },
      { user: "My heart", content: "牛肉面，吃口肉再吃口面， 一般面多肉少， 要肉多，得加钱（加仓）", time: "3小时前", location: "福建", shares: 0, subReplies: 0 },
      { user: "颠倒梦想", content: "哥以前是写作文高手吧，每次的视频都与商品有联系，\u201C辣椒\u201D\u201C蚂蚱\u201D\u201C肉和面\u201D都是如此", time: "20小时前", location: "陕西", shares: 1, subReplies: 0 },
      { user: "夜来风雨声。", content: "大哥，美联储的发言算加强版的鹰了吧，这个外因会不会导致面多于肉", time: "15小时前", location: "湖南", shares: 14, subReplies: 2 }
    ]
  }
];
