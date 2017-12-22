/**
 * @providesModule UIView
 * @flow
 */

import type RCTTouchHandler from "RCTTouchHandler";
import type { RCTComponent } from "RCTComponent";
import UIBorderView, { ALL_BORDER_PROPS } from "UIBorderView";
import CustomElement from "CustomElement";
import ColorArrayFromHexARGB from "ColorArrayFromHexARGB";
import * as MatrixMath from "MatrixMath";
import prefixInlineStyles from "prefixInlineStyles";

(function() {
  var typesToPatch = ["DocumentType", "Element", "CharacterData"],
    remove = function() {
      // The check here seems pointless, since we're not adding this
      // method to the prototypes of any any elements that CAN be the
      // root of the DOM. However, it's required by spec (see point 1 of
      // https://dom.spec.whatwg.org/#dom-childnode-remove) and would
      // theoretically make a difference if somebody .apply()ed this
      // method to the DOM's root node, so let's roll with it.
      if (this.parentNode != null) {
        this.parentNode.removeChild(this);
      }
    };

  for (var i = 0; i < typesToPatch.length; i++) {
    var type = typesToPatch[i];
    if (window[type] && !window[type].prototype.remove) {
      window[type].prototype.remove = remove;
    }
  }
})();

export const FrameZero: Frame = {
  top: 0,
  left: 0,
  width: 0,
  height: 0
};

const baseDimension = 1000;

@CustomElement("ui-child-container-view")
export class UIChildContainerView extends HTMLElement {
  constructor() {
    super();
    Object.assign(
      this.style,
      prefixInlineStyles({
        contain: "layout style",
        position: "absolute",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        userSelect: "inherit",
        transformOrigin: "top left",
        touchAction: "manipulation"
      })
    );
  }
}

@CustomElement("ui-view")
class UIView extends HTMLElement implements RCTComponent {
  _top: number = 0;
  _left: number = 0;
  _bottom: number = 0;
  _right: number = 0;
  _width: number = 0;
  _height: number = 0;
  _touchable: boolean = false;
  _opacity: number;
  _transform: number[];
  _animatedTransform: string;
  _backgroundColor: string;
  _disabled: boolean = false;

  childContainer: UIChildContainerView;
  borderView: ?UIBorderView;

  _reactTag: number;
  reactSubviews: Array<UIView>;
  reactSuperview: ?UIView;
  hasBeenFramed: boolean;

  constructor() {
    super();

    this.childContainer = new UIChildContainerView();
    this.appendChild(this.childContainer);

    this.reactSubviews = [];
    this.hasBeenFramed = false;
    this.opacity = 1;

    this.position = "absolute";
    this.backgroundColor = "rgba(0,0,0,0)";

    Object.assign(
      this.style,
      prefixInlineStyles({
        contain: "size layout style",
        boxSizing: "border-box",
        opacity: "0",
        touchAction: "manipulation",
        userSelect: "inherit",
        isolation: "isolate"
        // overflow: "hidden"
      })
    );

    ALL_BORDER_PROPS.forEach((propName) => {
      Object.defineProperty(this, propName, {
        configurable: true,
        set: (value) => {
          if (propName.startsWith("border") && propName.endsWith("Radius")) {
            this.style[propName] = `${value}px`;
          }
          // $FlowFixMe
          this.borderChild[propName] = value;
        }
      });
    });
  }

  prefixStyle(propName: string | Object, propValue?: string) {
    let styleObject = {};
    if (typeof propName === "string") {
      styleObject[propName] = propValue;
    } else {
      styleObject = propName;
    }
    return prefixInlineStyles(styleObject);
  }

  updateHostStyle(propName: string | Object, propValue?: string) {
    Object.assign(this.style, this.prefixStyle(propName, propValue));
  }

  updateChildContainerStyle(propName: string | Object, propValue?: string) {
    Object.assign(
      this.childContainer.style,
      this.prefixStyle(propName, propValue)
    );
  }

  get reactTag(): number {
    return this._reactTag;
  }

  set reactTag(value: number) {
    this._reactTag = value;
  }

  get frame(): Frame {
    return {
      top: this.top,
      left: this.left,
      width: this.width,
      height: this.height
    };
  }

  set frame(value: Frame) {
    Object.assign(this, value);
    if (!this.hasBeenFramed) {
      this.hasBeenFramed = true;
      this.updateHostStyle("opacity", `${this._opacity}`);
    }
  }

  set position(value: string) {
    this.updateHostStyle("position", value);
  }

  get top(): number {
    return this._top;
  }

  set top(value: number) {
    if (value !== this._top) {
      this._top = value;
      this.updateTransform();
    }
  }

  get left(): number {
    return this._left;
  }

  set left(value: number) {
    if (value !== this._left) {
      this._left = value;
      this.updateTransform();
    }
  }

  updateTransform() {
    const transforms = [`translate(${this._left}px, ${this._top}px)`];

    if (this._animatedTransform) {
      transforms.push(this._animatedTransform);
    } else if (this._transform) {
      transforms.push(`matrix3d(${this._transform.join(", ")})`);
    }

    const transformString = transforms.join(" ");

    this.updateHostStyle("transform", transformString);
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    if (value !== this._width) {
      this._width = value;
      this.updateHostStyle("width", `${value}px`);
    }
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    if (value !== this._height) {
      this._height = value;
      this.updateHostStyle("height", `${value}px`);
    }
  }

  set backgroundColor(value: string | number) {
    let resolvedValue = value;
    if (typeof value === "number") {
      const [a, r, g, b] = ColorArrayFromHexARGB(value);
      const stringValue = `rgba(${r},${g},${b},${a})`;
      this._backgroundColor = stringValue;
      this.updateHostStyle("backgroundColor", stringValue);
    } else {
      this._backgroundColor = value;
      this.updateHostStyle("backgroundColor", value);
    }
  }

  set pointerEvents(value: string) {
    switch (value) {
      case "box-none": {
        this.updateHostStyle("pointerEvents", "none");
        this.updateChildContainerStyle("pointerEvents", "all");
        break;
      }
      case "box-only": {
        this.updateHostStyle("pointerEvents", "all");
        this.updateChildContainerStyle("pointerEvents", "none");
        break;
      }
      default: {
        this.updateHostStyle("pointerEvents", value);
        this.updateChildContainerStyle("pointerEvents", value);
      }
    }
  }

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    this._opacity = value;
    this.updateHostStyle("opacity", `${value}`);
  }

  get transform(): number[] {
    return this._transform;
  }

  set transform(value: ?Array<number>) {
    if (value) {
      this._transform = value;
    } else {
      this._transform = MatrixMath.createIdentityMatrix();
    }
    this.updateTransform();
  }

  get animatedTransform(): string {
    return this._animatedTransform;
  }

  set animatedTransform(value: ?Array<Object>) {
    if (!value) {
      this._animatedTransform = "";
      this.updateTransform();
      return;
    }

    let transformString = "";
    value.forEach((transformObject) => {
      Object.keys(transformObject).forEach((property) => {
        const value = transformObject[property];
        if (["translateX", "translateY", "translateZ"].includes(property)) {
          transformString += `${property}(${value}px)`;
        } else if (
          ["rotate", "rotateX", "rotateY", "rotateZ"].includes(property)
        ) {
          transformString += `${property}(${value}rad)`;
        } else {
          transformString += `${property}(${value})`;
        }
      });
    });

    this._animatedTransform = transformString + " translateZ(0px)";
    this.updateTransform();
  }

  get borderChild(): UIBorderView {
    if (!this.borderView) {
      const borderView = new UIBorderView();

      this.appendChild(borderView);
      this.borderView = borderView;
      return borderView;
    }

    return this.borderView;
  }

  get touchable(): boolean {
    return this._touchable;
  }

  updateCursor() {
    const cursorValue = this._touchable && !this._disabled ? "pointer" : "auto";
    this.updateHostStyle("cursor", cursorValue);
  }

  set touchable(value: boolean) {
    this._touchable = value;
    this.updateCursor();
  }

  set disabled(value: boolean) {
    this._disabled = value;
    this.updateCursor();
  }

  set zIndex(value: number) {
    this.updateHostStyle("zIndex", `${value}`);
  }

  set overflow(value: string) {
    this.updateHostStyle("overflow", value);
  }

  set backfaceVisibility(value: string) {
    this.updateHostStyle("backfaceVisibility", value);
  }

  insertReactSubviewAtIndex(subview: UIView, index: number) {
    if (index === this.reactSubviews.length) {
      this.childContainer.appendChild(subview);
    } else {
      const beforeElement = this.reactSubviews[index];
      this.childContainer.insertBefore(subview, beforeElement);
    }

    this.reactSubviews.splice(index, 0, subview);
    subview.reactSuperview = this;
  }

  removeReactSubview(subview: UIView) {
    subview.reactSuperview = undefined;
    this.reactSubviews = this.reactSubviews.filter((s) => s !== subview);
  }

  purge() {
    if (this.reactSuperview) {
      this.reactSuperview.removeReactSubview(this);
    }
    this.remove();
  }

  addGestureRecognizer(
    handler: RCTTouchHandler,
    deviceType: "mouseOnly" | "touchOnly" | "hybrid",
    touchListenerOptions: Object | boolean
  ) {
    if (deviceType !== "touchOnly") {
      this.addEventListener("mousedown", handler.mouseClickBegan, false);
    }

    if (deviceType !== "mouseOnly") {
      this.addEventListener(
        "touchstart",
        handler.nativeTouchBegan,
        touchListenerOptions
      );
    }
  }

  removeGestureRecognizer(handler: RCTTouchHandler) {
    // TODO: Implement
  }
}

export default UIView;
