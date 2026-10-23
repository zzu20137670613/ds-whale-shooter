import type { CatalogSource } from './keys';

const en: CatalogSource = {
    menu: {
        changeScene: 'Change Scene',
        toggleMovement: 'Toggle Movement',
        addSprite: 'Add New Sprite',
    },
    label: {
        spritePosition: 'Sprite Position:',
    },
    scene: {
        mainMenu: 'Main Menu',
    },
    shop: {
        title: 'Tavern Shop',
        open: 'Shop',
        close: 'Close',
        noCharacter: 'Pick a character first.',
        level: 'Lv',
        maxed: 'MAX',
        weapons: 'Weapons',
        empty: 'No weapons yet.',
        ammo: 'Refill Ammo',
        returnHome: 'Return to Pavilion',
        restoreVitals: 'Restore Vitals',
        upgrade: {
            armor: 'Armor',
            agility: 'Agility',
            spirit: 'Spirit',
            luck: 'Luck',
        },
    },
    merchant: {
        name: 'Mysterious Merchant',
    },
    tavern: {
        confirm: 'CONFIRM',
        tapToStart: '(TAP TO START)',
        cycle: 'Cycle',
        confirmHold: 'Confirm (hold 1.5s)',
        weaponSlots: 'Weapon Slots',
        weaponCount: '{count}/{max} · max {max} weapons',
        enterStage: '↑ Walk to the teleporter to enter Stage {stage}',
    },
};

export default en;
