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
        newGame: 'New Game',
        newGameConfirm: 'Erase save?',
    },
    saves: {
        title: 'SAVES',
        empty: 'Empty',
        save: 'Save',
        load: 'Load',
        delete: 'Delete',
        overwrite: 'Overwrite?',
        saved: 'Saved',
        saveFailed: 'Save failed',
        loadFailed: 'Load failed',
        hint: 'Press Save twice to overwrite',
        close: 'Close',
        autoSaved: 'Autosaved',
        tooEarly: 'No run to save yet',
        exported: 'Save file exported',
        imported: 'Save imported',
        exportFailed: 'Export failed',
        importFailed: 'Cannot read that file',
        export_: 'Export',
        import_: 'Import',
    },
    input: {
        mouse: 'Mouse',
        directional: 'Arrows',
    },
    hud: {
        spaceKey: 'SPACE · Dodge',
        reloadKey: 'F · Reload',
        hits: 'HITS',
    },
    backpack: {
        title: 'Backpack',
        hint: 'B to close · click an item to use it',
        empty: 'Empty',
        material: 'Material · sellable',
        count: 'Count',
    },
    death: {
        title: 'YOU DIED',
        // Ezreal, First Move. The owner picked this line for the death
        // screen: a sidekick's line under a death, not a hero's.
        subtitle: "Oh, please don't die.",
        restart: 'Restart',
        hint: 'Returns to the tavern',
    },
    shop: {
        sell: 'Sell',
        sellAll: 'Sell all',
        nothingToSell: 'Nothing to sell',
        sellUnit: 'each',
        title: 'Tavern Shop',
        catTitle: 'Cat Shop',
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
