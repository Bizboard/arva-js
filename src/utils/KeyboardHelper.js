/**
 * Created by Manuel on 24/08/16.
 */


export class KeyboardHelper {

    hasKeyboard = false;

    constructor(options = {
        hideKeyboardAccessoryBar: true,
        disableScroll: true
    }) {

        this.hasKeyboard = cordova && cordova.plugins.Keyboard;

        if (this.hasKeyboard && options.disableScroll) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar && cordova.plugins.Keyboard.hideKeyboardAccessoryBar(options.hideKeyboardAccessoryBar);
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar && cordova.plugins.Keyboard.disableScroll(options.disableScroll);

            /**
             * Change the size of the famous-container to shrink the famous-context once the keyboard shows/hides. DisableScroll should be enabled for this to work
             */
            window.addEventListener('native.keyboardshow', ()=> {
                document.getElementsByClassName('famous-container')[0].style.height = window.innerHeight + "px";
                this._dispatchResizeEvent();
            });

            window.addEventListener('native.keyboardhide', ()=> {
                document.getElementsByClassName('famous-container')[0].style.height = window.innerHeight + "px";
                this._dispatchResizeEvent();
            });

            window.addEventListener("orientationchange", ()=> {
                document.getElementsByClassName('famous-container')[0].style.height = "";
                document.getElementsByClassName('famous-container')[0].style.width = "";
                this._dispatchResizeEvent();
            });
        }
    }

    _dispatchResizeEvent() {
        let resizeEvent = new Event('resize');
        window.dispatchEvent(resizeEvent);
    }

    setKeyboardAccessoryBar(boolean = false) {
        if (this.hasKeyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(boolean);
        } else {
            this._warn();
        }
    }

    setDisableScroll(boolean = false) {
        if (this.hasKeyboard) {
            cordova.plugins.Keyboard.disableScroll(boolean);
        } else {
            this._warn();
        }
    }

    show() {
        if (this.hasKeyboard) {
            cordova.plugins.Keyboard.show();
        } else {
            this._warn();
        }
    }

    hide() {
        if (this.hasKeyboard) {
            cordova.plugins.Keyboard.hide();
        } else {
            this._warn();
        }
    }

    _warn() {
        console.warn('KeyboardHelper is not supported on this platform, probably not a native (iOS/Android) platform');
    }
}