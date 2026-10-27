import type { CatalogSource } from './keys';

const zhCN: CatalogSource = {
    menu: {
        changeScene: '切换场景',
        toggleMovement: '切换移动',
        addSprite: '添加新精灵',
    },
    label: {
        spritePosition: '精灵位置:',
    },
    settings: {
        title: '设置',
        resume: '继续游戏',
        restart: '重新开始',
        restartHint: '重新开始会回到海边亭台',
    },
    hud: {
        spaceKey: '空格 闪避',
        reloadKey: 'F 换弹',
        hits: '连击',
    },
    backpack: {
        title: '背包',
        hint: 'B 关闭 · 点道具使用',
        empty: '空',
        material: '材料 · 可出售',
        count: '数量',
    },
    death: {
        title: '你倒下了',
        subtitle: '真可惜，我不是主角。',
        restart: '重新出发',
        hint: '回到海边亭台',
    },
    shop: {
        sell: '出售',
        sellAll: '全部卖出',
        nothingToSell: '没有可卖的东西',
        sellUnit: '单价',
        title: '酒馆商店',
        close: '关闭',
        noCharacter: '请先选一个角色。',
        level: '等级',
        maxed: '满级',
        weapons: '武器',
        empty: '还没有武器。',
        ammo: '补充弹药',
        returnHome: '一键回城',
        restoreVitals: '补满状态',
        upgrade: {
            armor: '护甲',
            agility: '敏捷',
            spirit: '精神',
            luck: '幸运',
        },
    },
    merchant: {
        name: '神秘商人',
    },
    tavern: {
        confirm: '确认',
        select: '选择',
        tapToStart: '（点击开始）',
        cycle: '切换',
        confirmHold: '确认（长按 1.5 秒）',
        weaponSlots: '武器槽',
        weaponCount: '{count}/{max} · 上限 {max} 把',
        enterStage: '↑ 走到传送门进入第 {stage} 关',
    },
};

export default zhCN;
