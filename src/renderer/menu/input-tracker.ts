//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import { EventEmitter } from 'events';

import * as math from '../math';
import { IVec2 } from '../../common';

/**
 * This enum is used to store the logical state of the input device. This will be set to
 * eClicked once a mouse button is pressed. If the mouse is moved more than a couple of
 * pixels before the mouse button is released, it is set to eMarkingMode. When the mouse
 * button is released, it is set to eReleased. There is also the possibility of the "Turbo
 * Mode" which allows the user to select items by moving the mouse while a key is
 * pressed.
 *
 * At a higher level, Kando does not differentiate between mouse, touch, gamepad, or pen
 * input. This enum is used for all input devices.
 */
export enum InputState {
  eReleased,
  eClicked,
  eMarkingMode,
  eTurboMode,
}

/**
 * This class is used to track the state of the input device. It stores the current state
 * (see InputState), the absolute mouse position, as well as the mouse position, distance,
 * and angle relative to the currently selected item.
 *
 * This class is an EventEmitter. It emits the following events:
 *
 * @fires pointer-motion - This event is emitted whenever the mouse moves. The absolute
 *   mouse position is passed as an argument.
 */
export class InputTracker extends EventEmitter {
  /** See the documentation of the corresponding getters for more information. */
  private _state = InputState.eReleased;
  private _absolutePosition = { x: 0, y: 0 };
  private _relativePosition = { x: 0, y: 0 };
  private _angle = 0;
  private _distance = 0;
  private _deferredTurboMode = false;

  /** The position where the mouse was when the user pressed a mouse button the last time. */
  private clickPosition = { x: 0, y: 0 };

  /** The position where the mouse was when the user pressed a keyboard key the last time. */
  private keydownPosition = { x: 0, y: 0 };

  /**
   * This is set to true once a key is pressed. If the pointer is moved at least
   * this.dragThreshold before the key is released, the turbo mode will be activated.
   */
  private anyKeyPressed = false;

  /**
   * If set to a value greater than 0, this will be decremented by 1 every time the the
   * mouse moves and the corresponding event is ignored. This is used to ignore the first
   * couple of mouse motion events after the menu is opened. See the documentation of the
   * reset() method for more information.
   */
  private ignoreMotionEvents = 0;

  /**
   * This is the threshold in pixels which is used to differentiate between a click and a
   * drag. If the mouse is moved more than this threshold before the mouse button is
   * released, an item is dragged.
   */
  public dragThreshold = 15;

  /** If enabled, items can be selected by dragging the mouse over them. */
  public enableMarkingMode = true;

  /**
   * If enabled, items can be selected by hovering over them while holding down a keyboard
   * key.
   */
  public enableTurboMode = true;

  /**
   * This will be set to eClicked once a mouse button is pressed. If the mouse is moved
   * more than this.dragThreshold pixels before the mouse button is released, this is set
   * to eMarkingMode. When the mouse button is released, this is set to eReleased. It can
   * also be set to eMarkingMode if the mouse is moved while a key is pressed.
   */
  public get state() {
    return this._state;
  }

  /** Returns true if we are in marking or in turbo mode. */
  public get isDragging() {
    return (
      this._state === InputState.eMarkingMode || this._state === InputState.eTurboMode
    );
  }

  /**
   * The absolute mouse position is the position of the mouse in screen coordinates. It is
   * always updated when the mouse moves.
   */
  public get absolutePosition() {
    return this._absolutePosition;
  }

  /**
   * The relative mouse position is the position of the mouse relative to the currently
   * selected menu item. It is always updated when the mouse moves.
   */
  public get relativePosition() {
    return this._relativePosition;
  }

  /**
   * The mouse angle is the angle of the mouse relative to the currently selected menu
   * item. 0° is up, 90° is right, 180° is down and 270° is left. It is always updated
   * when the mouse moves.
   */
  public get angle() {
    return this._angle;
  }

  /**
   * This is the distance of the mouse to the center of the currently selected menu item.
   * It is always updated when the mouse moves.
   */
  public get distance() {
    return this._distance;
  }

  /**
   * If this is set to true, the turbo mode will be activated only after a key is pressed.
   * Else, the turbo mode will be activated immediately when the menu is opened and a key
   * is already pressed.
   */
  public set deferredTurboMode(val: boolean) {
    this._deferredTurboMode = val;
  }

  /**
   * This method is called by the Menu class whenever the mouse pointer is moved or a
   * touch event is received. It updates the internal state of the InputTracker and emits
   * the pointer-motion event.
   *
   * @param event The mouse or touch event.
   * @param activeItemPosition The position of the currently selected menu item.
   */
  public onMotionEvent(event: MouseEvent | TouchEvent, activeItemPosition: IVec2) {
    // Ignore mouse motion events if requested.
    if (this.ignoreMotionEvents > 0) {
      this.ignoreMotionEvents--;
      return;
    }

    if (event instanceof MouseEvent) {
      this.update({ x: event.clientX, y: event.clientY }, activeItemPosition);
    } else {
      this.update(
        {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        },
        activeItemPosition
      );
    }

    // If the mouse moved too much, the current mousedown - mouseup event is not
    // considered to be a click anymore. Instead, we are in marking mode.
    const inClickZone =
      this.clickPosition &&
      math.getDistance(this._absolutePosition, this.clickPosition) < this.dragThreshold;

    if (this._state === InputState.eClicked && !inClickZone) {
      this._state = this.enableMarkingMode
        ? InputState.eMarkingMode
        : InputState.eReleased;
    }

    // We check if the turbo mode should be activated. This is the case if any key is
    // pressed and the mouse is moved more than this.dragThreshold since the last keydown
    // event. Also, the turbo mode is activated if any modifier key is pressed.
    let shouldEnterTurboMode = false;
    const canEnterTurboMode =
      this.enableTurboMode &&
      !this._deferredTurboMode &&
      this.state !== InputState.eTurboMode;

    if (canEnterTurboMode) {
      if (this.anyKeyPressed) {
        shouldEnterTurboMode =
          math.getDistance(this._absolutePosition, this.keydownPosition) >
          this.dragThreshold;
      }

      if (!shouldEnterTurboMode) {
        shouldEnterTurboMode =
          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
      }
    }

    if (shouldEnterTurboMode) {
      this._state = InputState.eTurboMode;
    } else if (
      event instanceof MouseEvent &&
      this._state === InputState.eMarkingMode &&
      event.buttons === 0
    ) {
      this._state = InputState.eReleased;
    }

    this.emit('pointer-motion', this._absolutePosition);
  }

  /**
   * This method is called by the Menu class whenever a mouse button is pressed or a touch
   * event is received. It updates the internal state of the InputTracker and also emits
   * the pointer-motion event.
   *
   * @param event The mouse or touch event.
   * @param activeItemPosition The position of the currently selected menu item.
   */
  public onPointerDownEvent(event: MouseEvent | TouchEvent, activeItemPosition: IVec2) {
    if (event instanceof MouseEvent) {
      this.clickPosition = { x: event.clientX, y: event.clientY };
    } else {
      this.clickPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }

    this._state = InputState.eClicked;

    this.onMotionEvent(event, activeItemPosition);
  }

  /**
   * This method is called by the Menu class whenever a mouse button is released or a
   * touch release event is received. It updates the internal state of the InputTracker.
   */
  public onPointerUpEvent() {
    this._state = InputState.eReleased;
    this.clickPosition = null;
  }

  /**
   * If any key is pressed, the turbo mode will be activated as long as turbo mode is not
   * deferred. In this case, a key has to be released first before the turbo mode will be
   * activated.
   *
   * @param event The keydown event.
   */
  public onKeyDownEvent() {
    if (!this._deferredTurboMode) {
      this.anyKeyPressed = true;
      this.keydownPosition = {
        x: this._absolutePosition.x,
        y: this._absolutePosition.y,
      };
    }
  }

  /**
   * If the last key is released, the turbo mode will be deactivated.
   *
   * @param event The keyup event.
   */
  public onKeyUpEvent(event: KeyboardEvent) {
    const stillAnyModifierPressed =
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

    if (!stillAnyModifierPressed) {
      this.anyKeyPressed = false;
      this._deferredTurboMode = false;

      if (this._state === InputState.eTurboMode) {
        this._state = this.clickPosition ? InputState.eMarkingMode : InputState.eReleased;
      }
    }
  }

  /**
   * Store the absolute mouse position, as well as the mouse position, distance, and angle
   * relative to the currently selected item.
   *
   * @param position The absolute mouse position.
   * @param activeItemPosition The position of the currently selected menu item. If this
   *   is not given, the menu item is assumed to be at the same position as the mouse.
   */
  public update(position: IVec2, activeItemPosition?: IVec2) {
    activeItemPosition = activeItemPosition || position;

    this._absolutePosition = position;
    this._relativePosition = math.subtract(position, activeItemPosition);
    this._distance = math.getLength(this._relativePosition);
    this._angle = math.getAngle(this._relativePosition);
  }

  /**
   * On some wayland compositors (for instance KWin), one or two initial mouse motion
   * events are sent containing wrong coordinates. They seem to be the coordinates of the
   * last mouse motion event over any XWayland surface before Kando's window was opened.
   * We simply ignore these events. This code is currently used on all platforms but I
   * think it's not an issue.
   */
  public ignoreNextMotionEvents() {
    this.ignoreMotionEvents = 2;
  }
}
