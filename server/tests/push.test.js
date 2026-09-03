// 每日推送：字段映射与配额状态机。
//
// 这两块是整条链路上最容易「配了一半」又最难查的地方：
// 字段映射错了微信按 47003 整条拒收（界面上开关能开，就是收不到）；
// 配额算错了会出现「明明还剩几次却不再推送」或「失败也扣配额」。
// 所以都抽成纯函数，在这里钉死——不连库、不发网络、不消耗大模型额度。
const {
  FIELD_TYPES,
  CONTENT_KEYS,
  parseFieldMapping,
  buildContentValues,
  formatTemplateValue,
  buildTemplateData,
} = require('../src/services/push/templateMapping');

const {
  PUSH_MAX_QUOTA,
  PUSH_TIME_LABEL,
  PUSH_CRON,
  PUSH_TZ,
  ERRCODE_USER_REFUSED,
  nextQuotaAfterSubscribe,
  nextStateAfterSend,
  alreadyPushedToday,
  shouldSkipDuplicate,
} = require('../src/services/push/quota');

const FORTUNE = {
  date: '2026-09-03',
  score: 79,
  level: 'good',
  rating: 4,
  overall: '今日金气适中，工作顺利，人际关系融洽，适合推进既定计划。',
  yi: ['聚餐会友', '团队建设'],
  ji: ['独自决断', '意气之争'],
  career: '事业运平稳，适合协作',
  wealth: '财运尚可，宜守不宜攻',
  love: '感情融洽',
  health: '注意作息',
  luckyNumber: 4,
  luckyColorName: '金色',
  luckyColor: '#FFD700',
  dayElement: 'metal',
};

describe('parseFieldMapping', () => {
  test('留空表示没配字段映射，返回空数组而不是报错', () => {
    expect(parseFieldMapping('')).toEqual([]);
    expect(parseFieldMapping(undefined)).toEqual([]);
    expect(parseFieldMapping('   ')).toEqual([]);
  });

  test('合法声明解析出字段名、类型与内容键', () => {
    const mapping = parseFieldMapping(
      'thing1:yiji,thing2:summary,phrase3:luckyColor,date4:date,number5:score'
    );
    expect(mapping).toHaveLength(5);
    expect(mapping[0]).toEqual({
      field: 'thing1',
      type: 'thing',
      kind: 'text',
      contentKey: 'yiji',
    });
    expect(mapping[2].kind).toBe('han');
    expect(mapping[4].kind).toBe('number');
  });

  test('允许字段名前后有空格', () => {
    expect(parseFieldMapping(' thing1 : yiji , number2 : score ')).toHaveLength(2);
  });

  test('未知内容键要报错（写错一个字就是永远收不到）', () => {
    expect(() => parseFieldMapping('thing1:notAKey')).toThrow(/内容键/);
  });

  test('非法字段名要报错', () => {
    expect(() => parseFieldMapping('Thing1:yiji')).toThrow();
    expect(() => parseFieldMapping('unknown1:yiji')).toThrow();
    expect(() => parseFieldMapping('thing:yiji')).toThrow();
  });

  test('格式写错（缺冒号 / 多冒号）要报错', () => {
    expect(() => parseFieldMapping('thing1')).toThrow(/字段名:内容键/);
    expect(() => parseFieldMapping('thing1:yiji:extra')).toThrow(/字段名:内容键/);
  });

  test('重复字段要报错（微信只认一份，重复必有一个被吞掉）', () => {
    expect(() => parseFieldMapping('thing1:yiji,thing1:summary')).toThrow(/重复/);
  });

  test('内容键与字段类型不匹配要在解析阶段就拒（而不是等微信 47003）', () => {
    // score 是数字，塞进只收汉字的 phrase
    expect(() => parseFieldMapping('phrase1:score')).toThrow();
    // 宜忌是中文，塞进只收数字字母符号的 character_string
    expect(() => parseFieldMapping('character_string1:yiji')).toThrow();
  });

  // 本项目实际用的那个模板（「今日运势提醒」，模版编号 71514）的参数是
  // thing1 / thing2 / **time3** ——「日期」被声明成 time 而不是 date，
  // 只有模板详情页的「详细内容」能看出来，按语义猜成 date3 就是 47003
  test('日期可以映射进 time 字段（真实模板里「日期」是 time3 而不是 date3）', () => {
    const mapping = parseFieldMapping('thing1:level,thing2:summary,time3:date');
    expect(mapping.map((item) => item.field)).toEqual(['thing1', 'thing2', 'time3']);
    expect(mapping[2]).toMatchObject({ type: 'time', kind: 'time', contentKey: 'date' });
  });

  test('抛出的都是配置错，带 status 500 与 isPushConfigError 便于启动时点名', () => {
    try {
      parseFieldMapping('thing1:notAKey');
      throw new Error('应该抛错');
    } catch (err) {
      expect(err.status).toBe(500);
      expect(err.isPushConfigError).toBe(true);
    }
  });
});

describe('buildContentValues', () => {
  const values = buildContentValues(FORTUNE);

  test('每个可用内容键都有值（文档里写了就必须真的能用）', () => {
    for (const key of Object.keys(CONTENT_KEYS)) {
      expect(values[key] === undefined || values[key] === null).toBe(false);
    }
  });

  test('level 与 dayElement 转成中文（phrase 只收汉字）', () => {
    expect(values.level).toBe('吉');
    expect(values.dayElement).toBe('金');
  });

  test('rating 转成星号（symbol 不收汉字）', () => {
    expect(values.rating).toBe('★★★★☆');
  });

  test('yiji 把宜和忌拼在一条里', () => {
    expect(values.yiji).toContain('聚餐会友');
    expect(values.yiji).toContain('独自决断');
  });

  test('luckyColor 用颜色名而不是色值（#FFD700 放进 phrase 会被拒）', () => {
    expect(values.luckyColor).toBe('金色');
  });

  // thing 的 20 字符是微信的硬上限，没有更长的中文字段类型可选。
  // summary 进 thing 会被截成「79分 今日金气适中，工作顺利，人际关…」——
  // 20 个字符全花在铺垫上，结论一个字都没露出来。brief 是为这个预算专门写的短句。
  test('brief 在 20 字符内说完分数与宜忌，不需要截断', () => {
    expect(values.brief).toBe('79分 宜聚餐会友 忌独自决断');
    expect(Array.from(values.brief).length).toBeLessThanOrEqual(20);
    // 进 thing 字段后原样保留，不带省略号
    expect(formatTemplateValue('thing2', values.brief)).toBe(values.brief);
    expect(formatTemplateValue('thing2', values.brief)).not.toContain('…');
  });

  test('brief 在三位分数、宜忌缺失时也合法', () => {
    expect(Array.from(buildContentValues({ ...FORTUNE, score: 100 }).brief).length).toBeLessThanOrEqual(20);
    expect(buildContentValues({ score: 79 }).brief).toBe('79分');
    expect(buildContentValues({}).brief).toBe('');
  });

  // 对照组：同一份运势走 summary 一定会被截断——这就是换 brief 的理由
  test('summary 进 thing 会被截断（保留这条以说明为什么线上用 brief）', () => {
    const out = formatTemplateValue('thing2', values.summary);
    expect(Array.from(out)).toHaveLength(20);
    expect(out).toContain('…');
  });
});

describe('formatTemplateValue 按微信的字段类型裁剪', () => {
  test('thing 截到 20 个字符', () => {
    const long = '宜'.repeat(50);
    expect(Array.from(formatTemplateValue('thing1', long))).toHaveLength(20);
  });

  test('phrase 截到 5 个汉字，且不塞省略号（phrase 只收汉字）', () => {
    const out = formatTemplateValue('phrase1', '金色偏黄带白');
    expect(Array.from(out)).toHaveLength(5);
    expect(out).not.toContain('…');
  });

  test('phrase 遇到非汉字会先滤掉', () => {
    expect(formatTemplateValue('phrase1', 'gold 金色')).toBe('金色');
  });

  test('phrase 滤完为空时给一个合法兜底，而不是空字符串', () => {
    expect(formatTemplateValue('phrase1', '2026-09-03').length).toBeGreaterThan(0);
  });

  test('character_string 拒收中文，只留数字字母符号', () => {
    expect(formatTemplateValue('character_string1', '第79分')).toBe('79');
  });

  test('number 只留数字，空了给 0', () => {
    expect(formatTemplateValue('number1', 79)).toBe('79');
    expect(formatTemplateValue('number1', '79分')).toBe('79');
    expect(formatTemplateValue('number1', '金色')).toBe('0');
  });

  test('date 保留 YYYY-MM-DD', () => {
    expect(formatTemplateValue('date1', '2026-09-03')).toBe('2026-09-03');
  });

  // 同一个日期进 time 字段要换成年月日：微信的 time 文档写的是「24 小时制时间格式
  // （支持+年月日）」，带横线的写法收不收没有明文，模板详情页的示例卡片写的是「2019年11月11日」
  test('time 把 YYYY-MM-DD 换成年月日写法', () => {
    expect(formatTemplateValue('time3', '2026-09-03')).toBe('2026年09月03日');
    // 不是纯日期就原样留着（只截长度），别自作聪明
    expect(formatTemplateValue('time3', '08:30')).toBe('08:30');
  });

  test('symbol 截到 5 个', () => {
    expect(Array.from(formatTemplateValue('symbol1', '★★★★☆'))).toHaveLength(5);
  });

  test('每种类型的产出都不超过该类型的上限', () => {
    const long = '宜聚餐会友团队建设忌独自决断意气之争ABC123-/';
    for (const [type, spec] of Object.entries(FIELD_TYPES)) {
      const out = formatTemplateValue(`${type}1`, long);
      expect(Array.from(out).length).toBeLessThanOrEqual(spec.maxLen);
    }
  });
});

describe('buildTemplateData 只输出声明过的字段', () => {
  const mapping = parseFieldMapping(
    'thing1:yiji,thing2:summary,phrase3:luckyColor,date4:date,number5:score'
  );

  test('键集合与声明完全一致（多一个键微信就按 47003 整条拒收）', () => {
    const data = buildTemplateData(mapping, FORTUNE);
    expect(Object.keys(data).sort()).toEqual(
      ['date4', 'number5', 'phrase3', 'thing1', 'thing2'].sort()
    );
  });

  test('每个字段都是 { value } 形态', () => {
    const data = buildTemplateData(mapping, FORTUNE);
    for (const key of Object.keys(data)) {
      expect(Object.keys(data[key])).toEqual(['value']);
      expect(typeof data[key].value).toBe('string');
    }
  });

  test('没声明字段映射时产出空对象（推送侧据此跳过，不会去调微信）', () => {
    expect(buildTemplateData([], FORTUNE)).toEqual({});
    expect(buildTemplateData(null, FORTUNE)).toEqual({});
  });

  test('内容真的落进了 data，而不是空壳', () => {
    const data = buildTemplateData(mapping, FORTUNE);
    expect(data.date4.value).toBe('2026-09-03');
    expect(data.number5.value).toBe('79');
    expect(data.phrase3.value).toBe('金色');
    expect(data.thing1.value).toContain('聚餐会友');
  });

  // 钉住线上那个模板的实际形态：三个键、一个不多一个不少
  test('线上模板（thing1/thing2/time3）产出的就是这三个键', () => {
    const real = parseFieldMapping('thing1:level,thing2:brief,time3:date');
    const data = buildTemplateData(real, FORTUNE);
    expect(Object.keys(data).sort()).toEqual(['thing1', 'thing2', 'time3']);
    expect(data.thing1.value).toBe('吉');
    expect(data.time3.value).toBe('2026年09月03日');
    // 用户手机上看到的就是这一整句，不是一句被截断的话
    expect(data.thing2.value).toBe('79分 宜聚餐会友 忌独自决断');
    expect(Array.from(data.thing2.value).length).toBeLessThanOrEqual(20);
  });
});

describe('配额状态机', () => {
  test('每次授权 +1，封顶 PUSH_MAX_QUOTA', () => {
    expect(nextQuotaAfterSubscribe(0)).toBe(1);
    expect(nextQuotaAfterSubscribe(1)).toBe(2);
    expect(nextQuotaAfterSubscribe(PUSH_MAX_QUOTA)).toBe(PUSH_MAX_QUOTA);
    expect(nextQuotaAfterSubscribe(PUSH_MAX_QUOTA + 10)).toBe(PUSH_MAX_QUOTA);
  });

  test('脏数据（null / 负数 / 字符串）也要算出合法配额', () => {
    expect(nextQuotaAfterSubscribe(null)).toBe(1);
    expect(nextQuotaAfterSubscribe(-3)).toBe(1);
    expect(nextQuotaAfterSubscribe('2')).toBe(3);
  });

  test('发送成功扣 1 并记下当日日期', () => {
    expect(
      nextStateAfterSend({ remainingQuota: 2, success: true, errcode: 0, dateString: '2026-09-03' })
    ).toEqual({
      remainingQuota: 1,
      status: 'active',
      lastPushDate: '2026-09-03',
      quotaConsumed: true,
    });
  });

  test('扣到 0 才置 inactive（这时首页横幅要重新出现，引导再授权）', () => {
    const next = nextStateAfterSend({
      remainingQuota: 1,
      success: true,
      errcode: 0,
      dateString: '2026-09-03',
    });
    expect(next.remainingQuota).toBe(0);
    expect(next.status).toBe('inactive');
  });

  test('发送失败不扣配额、不写 lastPushDate（否则一次网络抖动就白吃一次授权）', () => {
    const next = nextStateAfterSend({
      remainingQuota: 2,
      success: false,
      errcode: -1,
      dateString: '2026-09-03',
    });
    expect(next.remainingQuota).toBe(2);
    expect(next.status).toBe('active');
    expect(next.lastPushDate).toBeNull();
    expect(next.quotaConsumed).toBe(false);
  });

  test('43101（用户拒收）直接清零：他已经在微信里关掉了，再攒配额也发不出去', () => {
    const next = nextStateAfterSend({
      remainingQuota: 5,
      success: false,
      errcode: ERRCODE_USER_REFUSED,
      dateString: '2026-09-03',
    });
    expect(next.remainingQuota).toBe(0);
    expect(next.status).toBe('inactive');
    expect(next.quotaConsumed).toBe(false);
  });

  test('同日去重：cluster 重复注册、管理员手动重试都不该重复发', () => {
    expect(alreadyPushedToday('2026-09-03', '2026-09-03')).toBe(true);
    expect(alreadyPushedToday('2026-09-02', '2026-09-03')).toBe(false);
    expect(alreadyPushedToday('', '2026-09-03')).toBe(false);
    expect(alreadyPushedToday(undefined, '2026-09-03')).toBe(false);
  });
});

// 当天推送跑完之后，用户就算重新授权也收不到——因为 lastPushDate 已经是今天。
// 这对定时任务是对的（一天一条运势，两张一样的卡片是骚扰），
// 但会让管理员那个手动接口在当天彻底失效，而它整个存在的理由就是自检和补推。
describe('force 只放开当日去重这一条', () => {
  test('默认（定时任务这条路）不传 force，去重照旧生效', () => {
    expect(shouldSkipDuplicate({ lastPushDate: '2026-09-03', today: '2026-09-03' })).toBe(true);
    expect(shouldSkipDuplicate({ lastPushDate: '2026-09-03', today: '2026-09-03', force: false })).toBe(true);
  });

  test('force=true 时不再因为「今天已推过」跳过（改完字段映射复验 / 补推 / 上线自检）', () => {
    expect(shouldSkipDuplicate({ lastPushDate: '2026-09-03', today: '2026-09-03', force: true })).toBe(false);
  });

  test('没推过时两条路都不跳过（force 不是「必须先推过」的前提）', () => {
    expect(shouldSkipDuplicate({ lastPushDate: '', today: '2026-09-03' })).toBe(false);
    expect(shouldSkipDuplicate({ lastPushDate: '', today: '2026-09-03', force: true })).toBe(false);
  });

  test('force 不碰配额状态机：失败照旧不扣、43101 照旧清零', () => {
    // force 只影响「要不要跳过」，发送之后的账还是同一套算法
    expect(
      nextStateAfterSend({ remainingQuota: 1, success: false, errcode: -1, dateString: '2026-09-03' })
        .remainingQuota
    ).toBe(1);
    expect(
      nextStateAfterSend({
        remainingQuota: 5,
        success: false,
        errcode: ERRCODE_USER_REFUSED,
        dateString: '2026-09-03',
      }).remainingQuota
    ).toBe(0);
  });
});

describe('推送时间只有一个来源', () => {
  test('cron 与文案对得上（以前是 cron 20:00、界面写 00:00、用户存的时间没人读）', () => {
    expect(PUSH_TIME_LABEL).toBe('08:30');
    expect(PUSH_CRON).toBe('30 8 * * *');
  });

  test('必须显式指定时区：容器里进程时区通常是 UTC', () => {
    expect(PUSH_TZ).toBe('Asia/Shanghai');
  });

  test('cron 的时分与文案一致（改一处忘改另一处就会被这条挡住）', () => {
    const [minute, hour] = PUSH_CRON.split(' ');
    const [labelHour, labelMinute] = PUSH_TIME_LABEL.split(':');
    expect(Number(hour)).toBe(Number(labelHour));
    expect(Number(minute)).toBe(Number(labelMinute));
  });
});
