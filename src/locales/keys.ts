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
    scene: {
        mainMenu: string;
    };
    shop: {
        title: string;
        open: string;
        close: string;
        /** Shown when the player has not picked a character yet — the
         *  ladder prices come from the character spec, so there is
         *  nothing to sell before that. */
        noCharacter: string;
        level: string;
        maxed: string;
        /** Weapon section heading + its empty state + the ammo refill row. */
        weapons: string;
        empty: string;
        ammo: string;
        /** "Return to Pavilion" — the shop's way home now that the merchant
         *  carries it, so it has to live outside the tavern. */
        returnHome: string;
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
    | 'scene.mainMenu'
    | 'shop.title'
    | 'shop.open'
    | 'shop.close'
    | 'shop.noCharacter'
    | 'shop.level'
    | 'shop.maxed'
    | 'shop.weapons'
    | 'shop.empty'
    | 'shop.ammo'
    | 'shop.returnHome'
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
