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
    settings: {
        title: 'Settings',
        resume: 'Resume',
        restart: 'Restart',
        restartHint: 'Restart returns to the tavern',
    },
    hud: {
        spaceKey: 'SPACE',
        hits: 'HITS',
    },
    death: {
        title: 'YOU DIED',
        // Ezreal, First Move. The owner picked this line for the death
        // screen: a sidekick's line under a death, not a hero's.
        subtitle: "Oh, please don't die. I can't lose a sidekick. Not again.",
        restart: 'Restart',
        hint: 'Returns to the tavern',
    },
    shop: {
        title: 'Tavern Shop',
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
        select: 'SELECT',
        tapToStart: '(TAP TO START)',
        cycle: 'Cycle',
        confirmHold: 'Confirm (hold 1.5s)',
        weaponSlots: 'Weapon Slots',
        weaponCount: '{count}/{max} · max {max} weapons',
        enterStage: '↑ Walk to the teleporter to enter Stage {stage}',
    },
};

export default en;
