/**
 * Created by lundfall on 06/07/16.
 */
import Timer                 from 'famous/utilities/Timer';
import AnimationController   from 'famous-flex/AnimationController';
import Surface               from 'famous/core/Surface';
import FamousContext         from 'famous/core/Context.js';

import {View}                from 'arva-js/core/View.js';
import {ObjectHelper}        from 'arva-js/utils/ObjectHelper';

import {Injection}           from './Injection.js';
import {Router}              from '../core/Router.js';
import {layout}              from '../layout/decorators.js';
import Easing                from 'famous/transitions/Easing.js';

@layout.scrollable({overscroll: false, scrollSync: {preventDefault: false}})
class DialogWrapper extends View {

    /**
     * Defines the size that is appropriate for the dialog. The dialog can return undefined on its getSize function for
     * full-blown sizing instead of true sizing, and it can define a maxSize to specify a maximum that causes the margins
     * to get larger.
     * @param size
     */
    determineSizeWithMargins (size, maxSize, dimension) {
        return ~Math.min(maxSize ? maxSize[dimension] : 480, size[dimension] - 32);
    }

    @layout.size(function(...size) {return this.determineSizeWithMargins(size, this.options.dialog.maxSize, 0)},
        function(...size) {return this.determineSizeWithMargins(size, this.options.dialog.maxSize, 1)})
    @layout.stick.center()
    dialog = this.options.dialog;

    onNewParentSize(parentSize) {
        this._parentSize = parentSize;
    }

    /**
     * The getSize function is used to determine the size by the scrolling behaviour. It will try to make sure that
     * a too big dialog can be scrolled. If this isn't possible, it let's the dialog capture the entire screen
     * @returns {*}
     */
    getSize() {
        if (!this._parentSize) {
            return [undefined, undefined];
        }
        let dialogHeight = this.dialog.getSize()[1];
        let height;
        if(dialogHeight !== undefined){
            height = Math.max(this._parentSize[1], dialogHeight);
        } else {
            /* undefined height, let's make it the entire height  */
            height = this._parentSize[1];
        }
        return [undefined, height];
    }

}

export class DialogManager extends View {

    @layout.fullSize()
    @layout.animate({showInitially: false, animation: AnimationController.Animation.Fade})
    /* Add huge translations to make sure that it appears above everything else */
    @layout.translate(0, 0, 9000)
    background = new Surface({
        properties: {
            /* Permalink - use to edit and share this gradient: http://colorzilla.com/gradient-editor/#000000+0,000000+100&0.2+0,0.6+100 */
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%,rgba(0,0,0,0.6) 100%)', /* W3C, IE10+, FF16+, Chrome26+, Opera12+, Safari7+ */
            filter: "progid:DXImageTransform.Microsoft.gradient( startColorstr='#33000000', endColorstr='#99000000',GradientType=1 )" /* IE6-9 fallback on horizontal gradient */
        }
    });

    @layout.translate(0, 0, 9500)
    @layout.fullSize()
    @layout.animate({
        show: {transition: {curve: Easing.outCubic, duration: 300}, animation: AnimationController.Animation.Slide.Up},
        hide: {transition: {curve: Easing.inCubic, duration: 300}, animation: AnimationController.Animation.Slide.Down},
        showInitially: false
    })
    /* Empty content until filled */
    dialog = {};


    constructor(options = {}) {
        super(options);
        /* For ionic-plugin-keyboard */
        if (window.Keyboard) {
            /* Prevent keyboard from showing */
            window.addEventListener('native.keyboardshow', () => {
                /* Hides the keyboard when a dialog is  shown */
                if (this._hasOpenDialog) {
                    Keyboard.hide();
                }
            });
        }
        this.router = Injection.get(Router);
        let famousContext = Injection.get(FamousContext);
        famousContext.add(this);

        this.layout.on('layoutstart', ({size}) => {
            if (this.dialog.onNewParentSize) {
                this.dialog.onNewParentSize(size);
                this._savedParentSize = null;
            } else {
                this._savedParentSize = size;
            }
        });


        document.addEventListener("backbutton", this._onClose);
        this.renderables.background.on('click', this._onClose);
    }

    /**
     *
     * @param {Dialog} options.dialog dialog
     * @param {Boolean} [options.canCancel=true]
     * @param {Boolean} [options.killOldDialog=true]
     * @returns {*}
     */
    show({dialog, canCancel = true, killOldDialog = true}) {
        if(!dialog){
            throw new Error('No dialog specified in show() function of DialogManager');
        }

        if(dialog.canCancel){
            canCancel = dialog.canCancel;
        }

        if (this._hasOpenDialog) {
            /* If already open dialog we should either close that one, or just keep the current one, depending on the settings */
            if (!killOldDialog) {
                return;
            }
            this.close();
        }
        this._hasOpenDialog = true;

        /* Replace whatever non-showing dialog we have right now with the new dialog */
        this.replaceRenderable('dialog', new DialogWrapper({dialog}));
        if (this._savedParentSize) {
            this.dialog.onNewParentSize(this._savedParentSize);
        }
        this._canCancel = canCancel;
        if (canCancel) {
            /* Disable existing default behavior of backbutton going back to previous route */
            this.initialBackButtonState = this.router.isBackButtonEnabled();
            this.router.setBackButtonEnabled(false);
        }

        /* Show the dialog */
        this.showRenderable('dialog').then(() => {
            this._eventOutput.emit('dialogShown');
        });

        this.dialog.on('closeDialog', (function () {
            /* Forward the arguments coming from the event emitter when closing */
            this.close(...arguments)
        }).bind(this));

        /* Showing the background immediately propagates user's click event that triggered the show() directly to the background,
         * closing the dialog again. Delaying showing the background circumvents this issue. */
        Timer.setTimeout(() => {
            if (this._hasOpenDialog) {
                this.showRenderable('background');
            }
        }, 10);
        return this.dialogComplete();
    }


    getOpenDialog() {
        return this.hasOpenDialog() && this.dialog.dialog;
    }

    _onClose() {
        if (this._canCancel) {
            this.close();
        }
    }

    hasOpenDialog() {
        return this._hasOpenDialog;
    }


    dialogComplete() {
        if (!this._resolveDialogComplete) {
            return this._resolveDialogPromise = new Promise((resolve) => {
                this._resolveDialogComplete = resolve
            });
        } else {
            return this._resolveDialogPromise;
        }

    }

    close() {
        if (this._hasOpenDialog) {

            /* Restore back button state */
            if (this._canCancel) {
                this.router.setBackButtonEnabled(this.initialBackButtonState);
            }
            /* Resolve promise if necessary */
            if (this._resolveDialogComplete) {
                this._resolveDialogComplete(arguments);
                this._resolveDialogComplete = null;
            }
            this._hasOpenDialog = false;

            this.hideRenderable('dialog');
            this.hideRenderable('background');
            this._eventOutput.emit('close', ...arguments);
        }
    }
}
