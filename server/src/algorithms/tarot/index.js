// 塔罗牌算法模块

// 大阿尔卡纳（22张）
const MAJOR_ARCANA = [
  {
    id: 0,
    name: '愚者',
    nameEn: 'The Fool',
    suit: 'major',
    element: 'air',
    upright: '新的开始，冒险，自由，天真',
    reversed: '鲁莽，轻率，犹豫不决',
    love: '新的恋情，不确定的关系',
    career: '新的机会，需要勇气',
    general: '一段新的旅程即将开始',
  },
  {
    id: 1,
    name: '魔术师',
    nameEn: 'The Magician',
    suit: 'major',
    element: 'air',
    upright: '创造力，技巧，意志力',
    reversed: '欺骗，缺乏自信，技能不足',
    love: '有魅力，主动追求',
    career: '有才能，适合创业',
    general: '你拥有成功所需的一切',
  },
  {
    id: 2,
    name: '女祭司',
    nameEn: 'The High Priestess',
    suit: 'major',
    element: 'water',
    upright: '直觉，神秘，内在智慧',
    reversed: '忽视直觉，秘密被揭露',
    love: '需要等待，保持神秘',
    career: '需要深思熟虑',
    general: '倾听内心的声音',
  },
  {
    id: 3,
    name: '女皇',
    nameEn: 'The Empress',
    suit: 'major',
    element: 'earth',
    upright: '丰收，母性，美丽',
    reversed: '依赖他人，创造力受阻',
    love: '稳定的感情，家庭幸福',
    career: '收获成果，得到认可',
    general: '生活充满美好',
  },
  {
    id: 4,
    name: '皇帝',
    nameEn: 'The Emperor',
    suit: 'major',
    element: 'fire',
    upright: '权威，稳定，领导力',
    reversed: '专制，僵化，缺乏灵活性',
    love: '稳定的关系，需要承诺',
    career: '有领导才能，适合管理',
    general: '建立稳固的基础',
  },
  {
    id: 5,
    name: '教皇',
    nameEn: 'The Hierophant',
    suit: 'major',
    element: 'earth',
    upright: '传统，教育，信仰',
    reversed: '打破常规，独立思考',
    love: '传统的关系，稳定的交往',
    career: '需要学习，接受指导',
    general: '遵循传统，但保持思考',
  },
  {
    id: 6,
    name: '恋人',
    nameEn: 'The Lovers',
    suit: 'major',
    element: 'air',
    upright: '爱情，和谐，选择',
    reversed: '不和谐，错误的选择',
    love: '甜蜜的爱情，重要的决定',
    career: '合作顺利，团队和谐',
    general: '做出重要的选择',
  },
  {
    id: 7,
    name: '战车',
    nameEn: 'The Chariot',
    suit: 'major',
    element: 'water',
    upright: '胜利，意志力，决心',
    reversed: '失败，缺乏方向，沮丧',
    love: '克服困难，获得胜利',
    career: '有冲劲，适合竞争',
    general: '勇往直前，必获成功',
  },
  {
    id: 8,
    name: '力量',
    nameEn: 'Strength',
    suit: 'major',
    element: 'fire',
    upright: '勇气，耐心，内在力量',
    reversed: '软弱，自我怀疑，恐惧',
    love: '需要耐心，温柔对待',
    career: '需要毅力，克服困难',
    general: '相信自己的力量',
  },
  {
    id: 9,
    name: '隐士',
    nameEn: 'The Hermit',
    suit: 'major',
    element: 'earth',
    upright: '独处，内省，智慧',
    reversed: '孤立，逃避现实，固执',
    love: '需要空间，独自思考',
    career: '独立工作，深入研究',
    general: '寻找内在的指引',
  },
  {
    id: 10,
    name: '命运之轮',
    nameEn: 'Wheel of Fortune',
    suit: 'major',
    element: 'fire',
    upright: '转折点，好运，命运',
    reversed: '坏运，抗拒改变',
    love: '关系转折，新的开始',
    career: '机遇来临，把握时机',
    general: '命运正在改变',
  },
  {
    id: 11,
    name: '正义',
    nameEn: 'Justice',
    suit: 'major',
    element: 'air',
    upright: '公平，正义，因果',
    reversed: '不公，逃避责任',
    love: '需要公平对待',
    career: '公正处理，获得认可',
    general: '善有善报，恶有恶报',
  },
  {
    id: 12,
    name: '倒吊人',
    nameEn: 'The Hanged Man',
    suit: 'major',
    element: 'water',
    upright: '牺牲，等待，新的视角',
    reversed: '拖延，徒劳无功',
    love: '需要等待，保持耐心',
    career: '需要换个角度思考',
    general: '暂时的停滞，新的领悟',
  },
  {
    id: 13,
    name: '死神',
    nameEn: 'Death',
    suit: 'major',
    element: 'water',
    upright: '结束，转变，新生',
    reversed: '抗拒改变，停滞不前',
    love: '关系结束，新的开始',
    career: '职业转变，新的机会',
    general: '旧的结束，新的开始',
  },
  {
    id: 14,
    name: '节制',
    nameEn: 'Temperance',
    suit: 'major',
    element: 'fire',
    upright: '平衡，耐心，中庸',
    reversed: '失衡，过度，急躁',
    love: '需要平衡，互相理解',
    career: '适度工作，保持平衡',
    general: '保持内心的平静',
  },
  {
    id: 15,
    name: '恶魔',
    nameEn: 'The Devil',
    suit: 'major',
    element: 'earth',
    upright: '束缚，诱惑，物质',
    reversed: '解脱，打破束缚',
    love: '需要警惕诱惑',
    career: '注意金钱诱惑',
    general: '看清真相，获得自由',
  },
  {
    id: 16,
    name: '塔',
    nameEn: 'The Tower',
    suit: 'major',
    element: 'fire',
    upright: '突变，破坏，重建',
    reversed: '逃避灾难，避免改变',
    love: '关系突变，需要面对',
    career: '意外变化，需要适应',
    general: '旧的被摧毁，新的将建立',
  },
  {
    id: 17,
    name: '星星',
    nameEn: 'The Star',
    suit: 'major',
    element: 'air',
    upright: '希望，灵感，宁静',
    reversed: '失望，缺乏信心',
    love: '充满希望，美好未来',
    career: '有灵感，获得指引',
    general: '充满希望和光明',
  },
  {
    id: 18,
    name: '月亮',
    nameEn: 'The Moon',
    suit: 'major',
    element: 'water',
    upright: '幻觉，不确定，直觉',
    reversed: '恐惧消退，真相大白',
    love: '需要看清真相',
    career: '注意欺骗，保持警惕',
    general: '穿越迷雾，找到方向',
  },
  {
    id: 19,
    name: '太阳',
    nameEn: 'The Sun',
    suit: 'major',
    element: 'fire',
    upright: '成功，快乐，活力',
    reversed: '暂时的挫折，需要坚持',
    love: '幸福美满，充满阳光',
    career: '成功在望，充满活力',
    general: '光明和希望在前方',
  },
  {
    id: 20,
    name: '审判',
    nameEn: 'Judgement',
    suit: 'major',
    element: 'fire',
    upright: '觉醒，重生，召唤',
    reversed: '自我怀疑，逃避责任',
    love: '关系升华，重新开始',
    career: '获得认可，新的阶段',
    general: '听从内心的召唤',
  },
  {
    id: 21,
    name: '世界',
    nameEn: 'The World',
    suit: 'major',
    element: 'earth',
    upright: '完成，圆满，成就',
    reversed: '未完成，缺乏终结',
    love: '关系圆满，修成正果',
    career: '目标达成，获得成功',
    general: '一个周期的圆满结束',
  },
];

// 小阿尔卡纳 - 权杖（Wands）- 火元素
const WANDS = [
  { id: 22, name: '权杖Ace', nameEn: 'Ace of Wands', suit: 'wands', element: 'fire', upright: '新机遇，创造力，灵感', reversed: '延迟，缺乏方向', love: '新的恋情萌芽', career: '新的项目开始', general: '行动的种子已播下' },
  { id: 23, name: '权杖二', nameEn: 'Two of Wands', suit: 'wands', element: 'fire', upright: '计划，决策，展望未来', reversed: '恐惧改变，缺乏规划', love: '关系面临选择', career: '规划未来方向', general: '站在十字路口' },
  { id: 24, name: '权杖三', nameEn: 'Three of Wands', suit: 'wands', element: 'fire', upright: '拓展，远见，领导力', reversed: '挫折，缺乏远见', love: '关系有发展空间', career: '事业拓展期', general: '视野开阔' },
  { id: 25, name: '权杖四', nameEn: 'Four of Wands', suit: 'wands', element: 'fire', upright: '庆祝，和谐，稳定', reversed: '不稳定，缺乏支持', love: '感情稳定甜蜜', career: '工作环境和谐', general: '值得庆祝的时刻' },
  { id: 26, name: '权杖五', nameEn: 'Five of Wands', suit: 'wands', element: 'fire', upright: '竞争，冲突，挑战', reversed: '避免冲突，寻求和平', love: '感情有小摩擦', career: '职场竞争激烈', general: '在竞争中成长' },
  { id: 27, name: '权杖六', nameEn: 'Six of Wands', suit: 'wands', element: 'fire', upright: '胜利，认可，成功', reversed: '骄傲自满，失败', love: '感情获得认可', career: '获得成功认可', general: '凯旋而归' },
  { id: 28, name: '权杖七', nameEn: 'Seven of Wands', suit: 'wands', element: 'fire', upright: '坚持，防御，勇气', reversed: '放弃，退缩', love: '坚持维护感情', career: '坚守立场', general: '勇敢面对挑战' },
  { id: 29, name: '权杖八', nameEn: 'Eight of Wands', suit: 'wands', element: 'fire', upright: '快速行动，进展，消息', reversed: '延迟，受阻', love: '感情快速发展', career: '项目快速推进', general: '进展神速' },
  { id: 30, name: '权杖九', nameEn: 'Nine of Wands', suit: 'wands', element: 'fire', upright: '坚韧，毅力，最后坚持', reversed: '疲惫，放弃', love: '感情需要坚持', career: '坚持就是胜利', general: '黎明前的黑暗' },
  { id: 31, name: '权杖十', nameEn: 'Ten of Wands', suit: 'wands', element: 'fire', upright: '负担，责任，压力', reversed: '释放压力， delegation', love: '感情负担重', career: '工作压力大', general: '学会分担' },
  { id: 32, name: '权杖侍从', nameEn: 'Page of Wands', suit: 'wands', element: 'fire', upright: '热情，探索，新消息', reversed: '缺乏方向，挫折', love: '热情追求', career: '新机会来临', general: '探索新领域' },
  { id: 33, name: '权杖骑士', nameEn: 'Knight of Wands', suit: 'wands', element: 'fire', upright: '冒险，行动，热情', reversed: '冲动，缺乏耐心', love: '热烈追求', career: '大胆行动', general: '勇往直前' },
  { id: 34, name: '权杖皇后', nameEn: 'Queen of Wands', suit: 'wands', element: 'fire', upright: '自信，独立，魅力', reversed: '嫉妒，自私', love: '自信迷人', career: '领导力强', general: '散发魅力' },
  { id: 35, name: '权杖国王', nameEn: 'King of Wands', suit: 'wands', element: 'fire', upright: '领导力，远见，企业家精神', reversed: '专横，过高期望', love: '有担当', career: '领导才能', general: '开拓进取' },
];

// 小阿尔卡纳 - 圣杯（Cups）- 水元素
const CUPS = [
  { id: 36, name: '圣杯Ace', nameEn: 'Ace of Cups', suit: 'cups', element: 'water', upright: '新感情，直觉，创意', reversed: '情感封闭，失望', love: '新的爱情开始', career: '创意灵感', general: '情感的源泉' },
  { id: 37, name: '圣杯二', nameEn: 'Two of Cups', suit: 'cups', element: 'water', upright: '结合，合作，吸引力', reversed: '分离，失衡', love: '甜蜜的结合', career: '合作愉快', general: '心灵相通' },
  { id: 38, name: '圣杯三', nameEn: 'Three of Cups', suit: 'cups', element: 'water', upright: '庆祝，友谊，社交', reversed: '过度放纵， gossip', love: '社交场合遇桃花', career: '团队合作', general: '欢聚时光' },
  { id: 39, name: '圣杯四', nameEn: 'Four of Cups', suit: 'cups', element: 'water', upright: '不满，冥想，重新评估', reversed: '接受新机会', love: '对感情不满', career: '重新评估方向', general: '内省时刻' },
  { id: 40, name: '圣杯五', nameEn: 'Five of Cups', suit: 'cups', element: 'water', upright: '失望，悲伤，后悔', reversed: '接受，放下过去', love: '感情受挫', career: '接受失败教训', general: '学会放下' },
  { id: 41, name: '圣杯六', nameEn: 'Six of Cups', suit: 'cups', element: 'water', upright: '怀旧，天真，重逢', reversed: '活在过去，不切实际', love: '旧情复燃', career: '回忆美好时光', general: '重温旧梦' },
  { id: 42, name: '圣杯七', nameEn: 'Seven of Cups', suit: 'cups', element: 'water', upright: '幻想，选择，白日梦', reversed: '清醒，做出选择', love: '面对现实', career: '需要务实', general: '分清现实与幻想' },
  { id: 43, name: '圣杯八', nameEn: 'Eight of Cups', suit: 'cups', element: 'water', upright: '离开，放弃，寻找更深意义', reversed: '恐惧改变，停滞', love: '感情需要放手', career: '寻找新方向', general: '踏上新旅程' },
  { id: 44, name: '圣杯九', nameEn: 'Nine of Cups', suit: 'cups', element: 'water', upright: '满足，愿望实现，幸福', reversed: '不满足，物质主义', love: '感情圆满', career: '愿望成真', general: '心想事成' },
  { id: 45, name: '圣杯十', nameEn: 'Ten of Cups', suit: 'cups', element: 'water', upright: '家庭幸福，和谐，圆满', reversed: '家庭不和，失去联系', love: '家庭幸福', career: '工作生活平衡', general: '幸福美满' },
  { id: 46, name: '圣杯侍从', nameEn: 'Page of Cups', suit: 'cups', element: 'water', upright: '创意，直觉，新消息', reversed: '情感不成熟', love: '浪漫邂逅', career: '创意涌现', general: '感受内心' },
  { id: 47, name: '圣杯骑士', nameEn: 'Knight of Cups', suit: 'cups', element: 'water', upright: '浪漫，魅力，追随内心', reversed: '情绪化，不切实际', love: '浪漫追求', career: '追随热情', general: '浪漫之旅' },
  { id: 48, name: '圣杯皇后', nameEn: 'Queen of Cups', suit: 'cups', element: 'water', upright: '同情心，直觉，情感成熟', reversed: '情感依赖，自我牺牲', love: '温柔体贴', career: '富有同理心', general: '情感智慧' },
  { id: 49, name: '圣杯国王', nameEn: 'King of Cups', suit: 'cups', element: 'water', upright: '情感平衡，智慧，外交', reversed: '情绪压抑，操控', love: '成熟稳重', career: '情商高超', general: '情感大师' },
];

// 小阿尔卡纳 - 宝剑（Swords）- 风元素
const SWORDS = [
  { id: 50, name: '宝剑Ace', nameEn: 'Ace of Swords', suit: 'swords', element: 'air', upright: '突破，真相，清晰思维', reversed: '混乱，误解', love: '看清真相', career: '思维突破', general: '拨云见日' },
  { id: 51, name: '宝剑二', nameEn: 'Two of Swords', suit: 'swords', element: 'air', upright: '僵局，抉择，回避', reversed: '信息过多，困惑', love: '感情僵局', career: '面临抉择', general: '需要做决定' },
  { id: 52, name: '宝剑三', nameEn: 'Three of Swords', suit: 'swords', element: 'air', upright: '心碎，悲伤，分离', reversed: '恢复，释放悲伤', love: '感情受伤', career: '遭遇挫折', general: '疗愈伤口' },
  { id: 53, name: '宝剑四', nameEn: 'Four of Swords', suit: 'swords', element: 'air', upright: '休息，恢复，冥想', reversed: '疲惫，无法休息', love: '感情需要冷静', career: '需要休息', general: '休养生息' },
  { id: 54, name: '宝剑五', nameEn: 'Five of Swords', suit: 'swords', element: 'air', upright: '冲突，胜负，自私', reversed: '和解，放下执念', love: '感情冲突', career: '竞争激烈', general: '放下争执' },
  { id: 55, name: '宝剑六', nameEn: 'Six of Swords', suit: 'swords', element: 'air', upright: '过渡，离开，前进', reversed: '无法前进，停滞', love: '感情过渡期', career: '转型期', general: '向前看' },
  { id: 56, name: '宝剑七', nameEn: 'Seven of Swords', suit: 'swords', element: 'air', upright: '策略，机智，独行', reversed: '被欺骗，自欺欺人', love: '需要坦诚', career: '需要策略', general: '智慧取胜' },
  { id: 57, name: '宝剑八', nameEn: 'Eight of Swords', suit: 'swords', element: 'air', upright: '限制，无助，困境', reversed: '释放，找到出路', love: '感情受困', career: '突破限制', general: '打破束缚' },
  { id: 58, name: '宝剑九', nameEn: 'Nine of Swords', suit: 'swords', element: 'air', upright: '焦虑，噩梦，担忧', reversed: '希望，情况好转', love: '感情焦虑', career: '压力过大', general: '放下担忧' },
  { id: 59, name: '宝剑十', nameEn: 'Ten of Swords', suit: 'swords', element: 'air', upright: '结束，背叛，低谷', reversed: '恢复，新的开始', love: '感情结束', career: '触底反弹', general: '否极泰来' },
  { id: 60, name: '宝剑侍从', nameEn: 'Page of Swords', suit: 'swords', element: 'air', upright: '好奇心，新想法，警觉', reversed: '八卦，缺乏方向', love: '新认识', career: '学习新知', general: '保持警觉' },
  { id: 61, name: '宝剑骑士', nameEn: 'Knight of Swords', suit: 'swords', element: 'air', upright: '果断，行动，追求真相', reversed: '冲动，鲁莽', love: '果断追求', career: '快速行动', general: '勇往直前' },
  { id: 62, name: '宝剑皇后', nameEn: 'Queen of Swords', suit: 'swords', element: 'air', upright: '独立，清晰，直率', reversed: '尖酸刻薄，冷酷', love: '独立自主', career: '思维清晰', general: '直言不讳' },
  { id: 63, name: '宝剑国王', nameEn: 'King of Swords', suit: 'swords', element: 'air', upright: '权威，公正，理性', reversed: '滥用权力，操控', love: '理性对待', career: '权威决策', general: '理性判断' },
];

// 小阿尔卡纳 - 星币（Pentacles）- 土元素
const PENTACLES = [
  { id: 64, name: '星币Ace', nameEn: 'Ace of Pentacles', suit: 'pentacles', element: 'earth', upright: '新机会，财富，稳定', reversed: '失去机会，财务问题', love: '稳定的关系', career: '新财源', general: '物质丰盛' },
  { id: 65, name: '星币二', nameEn: 'Two of Pentacles', suit: 'pentacles', element: 'earth', upright: '平衡，灵活，适应', reversed: '失衡，压力过大', love: '感情需要平衡', career: '多任务处理', general: '灵活应变' },
  { id: 66, name: '星币三', nameEn: 'Three of Pentacles', suit: 'pentacles', element: 'earth', upright: '合作，技能，团队', reversed: '缺乏合作，平庸', love: '共同努力', career: '团队协作', general: '精诚合作' },
  { id: 67, name: '星币四', nameEn: 'Four of Pentacles', suit: 'pentacles', element: 'earth', upright: '保守，稳定，控制', reversed: '贪婪，过度控制', love: '感情稳定', career: '保守理财', general: '守住财富' },
  { id: 68, name: '星币五', nameEn: 'Five of Pentacles', suit: 'pentacles', element: 'earth', upright: '贫困，困难，孤立', reversed: '恢复，获得帮助', love: '感情困境', career: '财务困难', general: '困难时期' },
  { id: 69, name: '星币六', nameEn: 'Six of Pentacles', suit: 'pentacles', element: 'earth', upright: '慷慨，分享，平衡', reversed: '债务，不公平', love: '互相付出', career: '收支平衡', general: '有舍有得' },
  { id: 70, name: '星币七', nameEn: 'Seven of Pentacles', suit: 'pentacles', element: 'earth', upright: '耐心，长期投资，收获', reversed: '缺乏耐心，失望', love: '感情需要经营', career: '长期规划', general: '耕耘收获' },
  { id: 71, name: '星币八', nameEn: 'Eight of Pentacles', suit: 'pentacles', element: 'earth', upright: '专注，技能，勤奋', reversed: '缺乏专注，平庸', love: '用心经营', career: '精益求精', general: '工匠精神' },
  { id: 72, name: '星币九', nameEn: 'Nine of Pentacles', suit: 'pentacles', element: 'earth', upright: '独立，自给自足，享受', reversed: '过度依赖，损失', love: '独立自信', career: '事业有成', general: '享受成果' },
  { id: 73, name: '星币十', nameEn: 'Ten of Pentacles', suit: 'pentacles', element: 'earth', upright: '家庭财富，传承，稳定', reversed: '家庭矛盾，损失', love: '家庭幸福', career: '事业稳固', general: '富足传承' },
  { id: 74, name: '星币侍从', nameEn: 'Page of Pentacles', suit: 'pentacles', element: 'earth', upright: '学习，新技能，机遇', reversed: '缺乏方向，懒惰', love: '认真对待', career: '学习机会', general: '脚踏实地' },
  { id: 75, name: '星币骑士', nameEn: 'Knight of Pentacles', suit: 'pentacles', element: 'earth', upright: '勤奋，可靠，耐心', reversed: '懒惰，停滞', love: '稳定发展', career: '踏实工作', general: '稳步前进' },
  { id: 76, name: '星币皇后', nameEn: 'Queen of Pentacles', suit: 'pentacles', element: 'earth', upright: '富足，滋养，实用', reversed: '财务依赖，过度操心', love: '温柔体贴', career: '务实能干', general: '生活美满' },
  { id: 77, name: '星币国王', nameEn: 'King of Pentacles', suit: 'pentacles', element: 'earth', upright: '财富，成功，领导力', reversed: '贪婪，顽固', love: '经济基础好', career: '事业成功', general: '物质丰裕' },
];

// 合并所有牌组
const TAROT_CARDS = [...MAJOR_ARCANA, ...WANDS, ...CUPS, ...SWORDS, ...PENTACLES];

// 牌阵类型
const SPREAD_TYPES = {
  single: {
    name: '单牌占卜',
    description: '抽一张牌，了解今日运势或当前状况',
    count: 1,
    positions: ['当前状况'],
  },
  three: {
    name: '三牌占卜',
    description: '过去、现在、未来的三张牌',
    count: 3,
    positions: ['过去', '现在', '未来'],
  },
  cross: {
    name: '十字牌阵',
    description: '五张牌，全面分析当前处境',
    count: 5,
    positions: ['当前状况', '阻碍', '目标', '过去', '可能结果'],
  },
  relationship: {
    name: '感情牌阵',
    description: '专门用于分析感情问题',
    count: 5,
    positions: ['你的状态', '对方状态', '关系现状', '阻碍', '建议'],
  },
  career: {
    name: '事业牌阵',
    description: '专门用于分析事业问题',
    count: 5,
    positions: ['当前状况', '挑战', '优势', '建议', '结果'],
  },
  celtic: {
    name: '凯尔特十字',
    description: '全面深入的十张牌占卜',
    count: 10,
    positions: [
      '当前状况', '挑战', '过去基础', '可能结果', '近期未来',
      '态度', '环境', '希望与恐惧', '自身', '最终结果',
    ],
  },
};

// 随机洗牌
function shuffleDeck() {
  const deck = [...TAROT_CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 抽牌
function drawCards(count) {
  const deck = shuffleDeck();
  return deck.slice(0, count).map((card) => ({
    ...card,
    isReversed: Math.random() < 0.3, // 30% 概率逆位
  }));
}

// 获取牌面解读
function getCardInterpretation(card, position) {
  const meaning = card.isReversed ? card.reversed : card.upright;
  let interpretation = `【${position}】${card.name}（${card.isReversed ? '逆位' : '正位'}）\n`;
  interpretation += `含义：${meaning}\n`;
  interpretation += `爱情：${card.love}\n`;
  interpretation += `事业：${card.career}\n`;
  return interpretation;
}

// 塔罗牌占卜
function tarotReading(data) {
  const { spreadType = 'single' } = data;
  const spread = SPREAD_TYPES[spreadType] || SPREAD_TYPES.single;

  // 抽牌
  const cards = drawCards(spread.count);

  // 生成解读
  const cardsWithInterpretation = cards.map((card, index) => ({
    name: card.name,
    nameEn: card.nameEn,
    position: spread.positions[index],
    isReversed: card.isReversed,
    interpretation: getCardInterpretation(card, spread.positions[index]),
  }));

  // 生成总体解读
  const overallReading = generateOverallReading(cards, spread);

  return {
    spreadType,
    spreadName: spread.name,
    spreadDescription: spread.description,
    cards: cardsWithInterpretation,
    overallReading,
  };
}

// 生成总体解读
function generateOverallReading(cards, spread) {
  let reading = `【${spread.name}解读】\n\n`;

  // 统计正逆位
  const uprightCount = cards.filter((c) => !c.isReversed).length;
  const reversedCount = cards.length - uprightCount;

  // 统计元素分布
  const elementCount = { fire: 0, water: 0, air: 0, earth: 0 };
  cards.forEach(c => {
    if (c.element && elementCount[c.element] !== undefined) {
      elementCount[c.element]++;
    }
  });

  // 整体运势
  if (uprightCount > reversedCount) {
    reading += '整体来看，正位牌较多，运势积极向好，把握机会可获得不错的结果。\n\n';
  } else if (reversedCount > uprightCount) {
    reading += '整体来看，逆位牌较多，需要谨慎应对，调整心态方可化险为夷。\n\n';
  } else {
    reading += '正逆位牌数量相当，运势较为平衡，保持平常心即可。\n\n';
  }

  // 元素分析
  reading += '【元素能量】\n';
  if (elementCount.fire > 2) reading += '火元素旺盛，行动力强，适合主动出击。\n';
  if (elementCount.water > 2) reading += '水元素丰富，情感敏锐，适合倾听内心。\n';
  if (elementCount.air > 2) reading += '风元素突出，思维活跃，适合分析决策。\n';
  if (elementCount.earth > 2) reading += '土元素充足，务实稳重，适合踏实行动。\n';
  reading += '\n';

  // 检查特殊牌
  const hasDeath = cards.some((c) => c.name === '死神');
  const hasTower = cards.some((c) => c.name === '塔');
  const hasStar = cards.some((c) => c.name === '星星');
  const hasSun = cards.some((c) => c.name === '太阳');
  const hasMoon = cards.some((c) => c.name === '月亮');
  const hasWheel = cards.some((c) => c.name === '命运之轮');

  if (hasDeath) reading += '【重要提示】死神牌的出现预示着重要的转变即将发生，这是结束也是新的开始。\n';
  if (hasTower) reading += '【重要提示】塔牌的出现意味着可能有突发变化，需要做好心理准备，顺势而为。\n';
  if (hasStar) reading += '【积极信号】星星牌的出现带来希望和指引，保持信心，美好的事物即将到来。\n';
  if (hasSun) reading += '【积极信号】太阳牌的出现预示着成功和快乐，是行动的最佳时机。\n';
  if (hasMoon) reading += '【注意】月亮牌提醒你注意直觉，有些事情可能并非表面看起来那样。\n';
  if (hasWheel) reading += '【注意】命运之轮预示着转折点，顺应变化，把握机遇。\n';

  reading += '\n【综合建议】\n';
  reading += '保持积极心态，相信自己的直觉，勇敢面对挑战。\n';
  reading += '无论结果如何，都是一次成长的机会。善待自己，也善待他人。';

  return reading;
}

module.exports = {
  tarotReading,
  TAROT_CARDS,
  SPREAD_TYPES,
};
