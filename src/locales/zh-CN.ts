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
    scene: {
        mainMenu: '主菜单',
    },
    shop: {
        title: '酒馆商店',
        open: '商店',
        close: '关闭',
        noCharacter: '请先选一个角色。',
        level: '等级',
        maxed: '满级',
        weapons: '武器',
        empty: '还没有武器。',
        ammo: '补充弹药',
        returnHome: '一键回城',
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
        tapToStart: '（点击开始）',
        cycle: '切换',
        confirmHold: '确认（长按 1.5 秒）',
        weaponSlots: '武器槽',
        weaponCount: '{count}/{max} · 上限 {max} 把',
        enterStage: '↑ 走到传送门进入第 {stage} 关',
    },
};

export default zhCN;
