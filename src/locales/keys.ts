// Shared types for the i18n catalogs.
//
// - CatalogSource: nested shape each locale file declares. Add a leaf
//   here → every locale file must include it.
// - CatalogKey: dot-path autocomplete for `t('...')` call sites.
// - Catalog: the flattened Record<string, string> that the runtime uses.

export type LocaleCode = 'en' | 'zh-CN';

export type CatalogSource = {
    menu: {
        changeScene: string;
        toggleMovement: string;
        addSprite: string;
    };
    label: {
        spritePosition: string;
    };
    /** The gear panel: pause, resume, restart. */
    settings: {
        title: string;
        resume: string;
        restart: string;
        restartHint: string;
        /** Start over from the tavern, wiping the save. */
        newGame: string;
        /** Second click, because it is destructive. */
        newGameConfirm: string;
        /** Label for the aim-mode row. */
        controlScheme: string;
    };
    /** The save rack: six slots, a quick slot, and the two-step overwrite. */
    saves: {
        title: string;
        empty: string;
        save: string;
        load: string;
        delete: string;
        overwrite: string;
        saved: string;
        saveFailed: string;
        loadFailed: string;
        hint: string;
        close: string;
        tooEarly: string;
        autoSaved: string;
        exported: string;
        imported: string;
        exportFailed: string;
        importFailed: string;
        export_: string;
        import_: string;
    };
    /** The corner chip that picks how you aim. */
    input: {
        /** Cursor aims. */
        mouse: string;
        /** Arrow keys aim, eight ways. */
        directional: string;
    };
    /** In-run HUD bits that used to be English-only. */
    hud: {
        /** Keycap shown next to the skill badge. */
        spaceKey: string;
        /** Keycap next to the ammo readout. */
        reloadKey: string;
        /** Keycap for the skill badge. */
        skillKey: string;
        /** Keycap for the attack key. */
        attackKey: string;
        /** Keycap for the backpack. */
        bagKey: string;
        /** Suffix on the combo counter ("12 HITS"). */
        hits: string;
    };
    /** The death overlay. One of the two places a run actually ends. */
    backpack: {
        title: string;
        hint: string;
        close: string;
        empty: string;
        material: string;
        count: string;
    };
    death: {
        title: string;
        subtitle: string;
        restart: string;
        hint: string;
    };
    shop: {
        title: string;
        /** The cabin cat opens the same shop under this name. */
        catTitle: string;
        close: string;
        /** Shown when the player has not picked a character yet — the
         *  ladder prices come from the character spec, so there is
         *  nothing to sell before that. */
        noCharacter: string;
        level: string;
        maxed: string;
        /** Sell-back section: materials the shop buys. */
        sell: string;
        sellAll: string;
        nothingToSell: string;
        sellUnit: string;
        /** Weapon section heading + its empty state + the ammo refill row. */
        weapons: string;
        empty: string;
        ammo: string;
        /** "Return to Pavilion" — the shop's way home now that the merchant
         *  carries it, so it has to live outside the tavern. */
        returnHome: string;
        /** "Restore Vitals" — a paid full HP + SP refill. There is no passive
         *  regeneration, so this row is the only deliberate way back up
         *  besides a pickup. */
        restoreVitals: string;
        upgrade: {
            armor: string;
            agility: string;
            spirit: string;
            luck: string;
        };
    };
    /** The figure who stands on the junction of a four-block world. */
    merchant: {
        name: string;
    };
    /** Tavern character-select card. Longest run of hardcoded English in the
     *  game HUD — the stat abbreviations (HP/SP/LCK/SPD/SLT) and units
     *  (m/s, /10, s) stay untranslated on purpose: they are symbols. */
    tavern: {
        confirm: string;
        /** The character card's big button. */
        select: string;
        tapToStart: string;
        cycle: string;
        confirmHold: string;
        weaponSlots: string;
        /** `{count}/{max} · max {max} weapons` — placeholders are filled by `t()`. */
        weaponCount: string;
        /** `↑ Walk to the teleporter to enter Stage {stage}` */
        enterStage: string;
    };
};

export type CatalogKey =
    | 'menu.changeScene'
    | 'menu.toggleMovement'
    | 'menu.addSprite'
    | 'label.spritePosition'
    | 'shop.title'
    | 'shop.catTitle'
    | 'shop.close'
    | 'shop.noCharacter'
    | 'shop.level'
    | 'shop.maxed'
    | 'shop.weapons'
    | 'shop.empty'
    | 'shop.ammo'
    | 'shop.returnHome'
    | 'shop.restoreVitals'
    | 'merchant.name'
    | 'shop.upgrade.armor'
    | 'shop.upgrade.agility'
    | 'shop.upgrade.spirit'
    | 'shop.upgrade.luck'
    | 'tavern.confirm'
    | 'tavern.tapToStart'
    | 'tavern.cycle'
    | 'tavern.confirmHold'
    | 'tavern.weaponSlots'
    | 'tavern.weaponCount'
    | 'tavern.enterStage';

export type Catalog = Record<string, string>;
