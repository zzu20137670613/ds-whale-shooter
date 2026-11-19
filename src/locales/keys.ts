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
        /** Shown for the moment between a load and the page reload. */
        loaded: string;
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
    mobile: {
        /** Touch button labels — short, because a phone button is 80 px wide. */
        fire: string;
        dodge: string;
        skill: string;
        backpack: string;
    };
    input: {
        /** Cursor aims. */
        mouse: string;
        /** Arrow keys aim, eight ways. */
        directional: string;
    };
    /**
     * Story easter eggs: lines the world itself answers with.
     *
     * These are found, not shown - nothing in the HUD points at them.
     */
    easter: {
        /** The steel bowl baked into the warhammer alley. 第七世's code word. */
        riceBowl: string;
        riceBowlHeld: string;
    };
    /** The desktop-pet chip: what the linkage is worth this run. */
    /**
     * 创世线 - seed's shop, which appears in the pavilion after the ending.
     */
    video: {
        skip: string;
    };
    seedShop: {
        title: string;
        starryLibrary: string;
        skyCity: string;
        atlantis: string;
        unknownRealm: string;
        cancel: string;
        notYet: string;
    };
    pet: {
        buff: {
            /** What the chip itself says. Numbers are hover-only. */
            title: string;
            /** Second line of the tooltip. */
            subtitle: string;
            /** What the percentage scales. */
            panels: string;
            /** The flat luck line. */
            luck: string;
            /** The top-tier extras, one line. */
            blessing: string;
        };
    };
    /** 词元盾 HUD chip（主人 2026-11-12：5 级每级效果都要写出来）。 */
    tokenShield: {
        title: string;
        /** `当前：受伤时 {percent}% 的伤害由灵力承担` */
        current: string;
        /** One row per level: `Lv.{level}：受伤时 {percent}% 由灵力承担` */
        perLevel: string;
        /** How it fails when the blue bar cannot pay. */
        note: string;
        /** Sixth pickup and beyond. */
        atMax: string;
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
        /** Fullscreen chip label while windowed. */
        fullscreen: string;
        /** …and while fullscreen, where the click goes back. */
        windowed: string;
        /** Keycap for cycling the hotbar. */
        switchKey: string;
        /** Suffix on the combo counter ("12 HITS"). */
        hits: string;
        /** Under the combo counter: how many enemies are still standing on this map. */
        remainingMonsters: string;
    };
    /** The death overlay. One of the two places a run actually ends. */
    backpack: {
        title: string;
        hint: string;
        /** Touch wording: there is no B key on a phone. */
        hintTouch: string;
        close: string;
        empty: string;
        /** Shown when a cell that cannot be used from the bag is clicked. */
        cannotUse: string;
        material: string;
        count: string;
        /** 背包底部的「图鉴」按钮与它弹出的那一页。 */
        codex: string;
        codexTitle: string;
        codexEmpty: string;
    };
    death: {
        title: string;
        subtitle: string;
        restart: string;
        hint: string;
    };
    nickname: {
        title: string;
        hint: string;
        placeholder: string;
        roll: string;
        confirm: string;
        skip: string;
        empty: string;
        unlocked: string;
    };
    support: {
        title: string;
        coinLine: string;
        hundredLine: string;
        gachaLine: string;
        wechat: string;
        alipay: string;
        custom: string;
        back: string;
        goBack: string;
        fillInfo: string;
        thanked: string;
        decline: string;
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
            /** 血量: max HP only, +20 a level. */
            hp: string;
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
    | 'shop.upgrade.hp'
    | 'shop.upgrade.spirit'
    | 'shop.upgrade.luck'
    | 'tavern.confirm'
    | 'tavern.tapToStart'
    | 'tavern.cycle'
    | 'tavern.confirmHold'
    | 'tavern.weaponSlots'
    | 'tavern.weaponCount'
    | 'tavern.enterStage'
    | 'easter.riceBowl'
    | 'easter.riceBowlHeld';

export type Catalog = Record<string, string>;
