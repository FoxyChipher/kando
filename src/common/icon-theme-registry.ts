//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/menu/kando           //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import { SimpleIconsTheme } from './icon-themes/simple-icons-theme';
import { SimpleIconsColoredTheme } from './icon-themes/simple-icons-colored-theme';
import { MaterialSymbolsTheme } from './icon-themes/material-symbols-theme';
import { EmojiTheme } from './icon-themes/emoji-theme';
import { FileIconTheme } from './icon-themes/file-icon-theme';
import { FallbackTheme } from './icon-themes/fallback-theme';

/**
 * This interface describes an icon theme. An icon theme is a collection of icons that can
 * be used in the application. The icon theme provides a method to list all icons that
 * match a given search term.
 */
export interface IIconTheme {
  /** A human-readable name of the icon theme. */
  name: string;

  /**
   * Returns a list icons from this theme that match the given search term. This can be
   * implemented asynchronously if retrieving the list of icons is an expensive
   * operation.
   *
   * @param searchTerm The search term to filter the icons.
   * @returns A promise that resolves to an array of icon names that match the search
   *   term.
   */
  listIcons(searchTerm: string): Promise<Array<string>>;

  /**
   * Creates a div element that contains the icon with the given name.
   *
   * @param icon One of the icons returned by `listIcons`.
   * @returns A div element that contains the icon.
   */
  createDiv(icon: string): HTMLElement;
}

/**
 * This class is a registry that contains all available icon themes. It is a singleton
 * class. Use `getInstance` to get the instance of this class.
 */
export class IconThemeRegistry {
  /** The singleton instance of this class. */
  private static instance: IconThemeRegistry = new IconThemeRegistry();

  /** This map contains all available icon themes. The keys are the type names. */
  private iconThemes: Map<string, IIconTheme> = new Map();

  /** This is the fallback icon theme that is used if no valid icon theme is selected. */
  private fallbackTheme: IIconTheme = new FallbackTheme();

  /** The directory where the user's icon themes are stored. */
  private _userIconThemeDirectory = '';

  /**
   * This is a singleton class. The constructor is private. Use `getInstance` to get the
   * instance of this class.
   */
  private constructor() {
    this.iconThemes.set('simple-icons', new SimpleIconsTheme());
    this.iconThemes.set('simple-icons-colored', new SimpleIconsColoredTheme());
    this.iconThemes.set('material-symbols-rounded', new MaterialSymbolsTheme());
    this.iconThemes.set('emoji', new EmojiTheme());

    // Add an icon theme for all icon themes in the user's icon theme directory.
    window.api.getIconThemes().then((info) => {
      this._userIconThemeDirectory = info.userIconDirectory;
      for (const theme of info.fileIconThemes) {
        this.iconThemes.set(theme.name, new FileIconTheme(theme));
      }
    });
  }

  /**
   * Use this method to get the singleton instance of this class.
   *
   * @returns The singleton instance of this class.
   */
  public static getInstance(): IconThemeRegistry {
    return IconThemeRegistry.instance;
  }

  /**
   * Use this method to get the directory where the user's icon themes are stored.
   *
   * @returns The directory where the user's icon themes are stored.
   */
  get userIconThemeDirectory(): string {
    return this._userIconThemeDirectory;
  }

  /**
   * Use this method to get all available icon themes.
   *
   * @returns A map containing all available icon themes. The keys are the unique names
   *   used in the menu settings.
   */
  public getThemes(): Map<string, IIconTheme> {
    return this.iconThemes;
  }

  /**
   * Use this method to get a specific icon theme.
   *
   * @param key The unique key of the icon theme.
   * @returns The icon theme with the given key. If no icon theme with the given key
   *   exists, a fallback icon theme is returned.
   */
  public getTheme(key: string): IIconTheme {
    return this.iconThemes.get(key) || this.fallbackTheme;
  }
}
